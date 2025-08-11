"""
離散イベントシミュレーションエンジン
"""
import simpy
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
import asyncio
import json

from app.models.factory import Factory
from app.models.process import Process
from app.models.product import Product
from app.models.event import SimulationEvent

class SimulationEngine:
    """シミュレーションエンジンクラス"""
    
    def __init__(self, factory: Factory, start_time: datetime, speed: float = 1.0):
        self.factory = factory
        self.env = simpy.Environment()
        self.start_time = start_time
        self.current_time = start_time
        self.speed = speed
        self.is_running = False
        self.is_paused = False
        
        # イベントリスナー
        self.event_listeners: List[Callable] = []
        
        # データ収集用
        self.inventory_history = []
        self.equipment_history = []
        self.event_log = []
        
    def add_event_listener(self, listener: Callable):
        """イベントリスナーを追加"""
        self.event_listeners.append(listener)
        
    def remove_event_listener(self, listener: Callable):
        """イベントリスナーを削除"""
        if listener in self.event_listeners:
            self.event_listeners.remove(listener)
            
    async def notify_listeners(self, event: SimulationEvent):
        """全リスナーにイベントを通知"""
        for listener in self.event_listeners:
            if asyncio.iscoroutinefunction(listener):
                await listener(event)
            else:
                listener(event)
                
    def get_current_datetime(self) -> datetime:
        """現在のシミュレーション時刻を取得"""
        return self.start_time + timedelta(seconds=self.env.now)
        
    def run_process(self, process: Process):
        """工程プロセスを実行"""
        def process_runner():
            while True:
                try:
                    # 設備が利用可能になるまで待機
                    equipment = process.get_available_equipment()
                    if not equipment:
                        yield self.env.timeout(5)  # 5秒待機
                        continue
                    
                    # 設備を占有
                    equipment.status = "running"
                    
                    # 加工開始イベント
                    event = SimulationEvent(
                        timestamp=self.get_current_datetime(),
                        event_type="process_start",
                        process_id=process.id,
                        equipment_id=equipment.id,
                        data={"equipment_status": equipment.status}
                    )
                    asyncio.create_task(self.notify_listeners(event))
                    
                    # 加工時間をシミュレート（30-180秒の範囲）
                    processing_time = list(process.processing_time.values())[0] if process.processing_time else 60
                    yield self.env.timeout(processing_time)
                    
                    # 設備を解放
                    equipment.status = "idle"
                    
                    # 完了イベント
                    event = SimulationEvent(
                        timestamp=self.get_current_datetime(),
                        event_type="process_complete",
                        process_id=process.id,
                        equipment_id=equipment.id,
                        data={"equipment_status": equipment.status}
                    )
                    asyncio.create_task(self.notify_listeners(event))
                    
                    # 出力バッファに製品を追加
                    if process.output_buffer_id and process.output_buffer_id in self.factory.buffers:
                        product_id = list(process.processing_time.keys())[0] if process.processing_time else "SAMPLE_PRODUCT"
                        self.factory.buffers[process.output_buffer_id].add_lot(
                            product_id, 
                            f"LOT_{int(self.env.now)}_{equipment.id}",
                            1,
                            process.id
                        )
                    
                except Exception as e:
                    print(f"工程 {process.id} でエラー: {e}")
                    yield self.env.timeout(10)  # エラー時は10秒待機
                
        return self.env.process(process_runner())
        
    def initialize_simulation(self):
        """シミュレーションを初期化"""
        # 各工程のプロセスを開始
        for process in self.factory.processes.values():
            self.run_process(process)
            
    async def start(self, duration: Optional[float] = None):
        """シミュレーションを開始"""
        self.is_running = True
        self.is_paused = False
        
        # シミュレーションの初期化
        self.initialize_simulation()
        
        # シミュレーションループ
        try:
            last_broadcast = 0
            broadcast_interval = 5  # 5秒ごとに状態をブロードキャスト
            
            while self.is_running:
                if not self.is_paused:
                    # 1秒分のシミュレーションを実行
                    next_time = self.env.now + 1
                    if duration and next_time > duration:
                        break
                        
                    self.env.run(until=next_time)
                    
                    # 定期的に状態更新を通知
                    if self.env.now - last_broadcast >= broadcast_interval:
                        await self.broadcast_state()
                        last_broadcast = self.env.now
                    
                # 速度調整
                await asyncio.sleep(1.0 / self.speed if not self.is_paused else 0.1)
                    
        except Exception as e:
            print(f"シミュレーションエラー: {e}")
        finally:
            self.is_running = False
            
    async def pause(self):
        """シミュレーションを一時停止"""
        self.is_paused = True
        
    async def resume(self):
        """シミュレーションを再開"""
        self.is_paused = False
        
    async def stop(self):
        """シミュレーションを停止"""
        self.is_running = False
        
    def set_speed(self, speed: float):
        """シミュレーション速度を設定"""
        self.speed = max(0.1, min(speed, 100.0))  # 0.1倍〜100倍の範囲
        
    async def broadcast_state(self):
        """現在の状態をブロードキャスト"""
        state = {
            "timestamp": self.get_current_datetime().isoformat(),
            "inventories": self.get_current_inventories(),
            "equipment_states": self.get_equipment_states(),
            "kpis": self.calculate_kpis()
        }
        
        event = SimulationEvent(
            timestamp=self.get_current_datetime(),
            event_type="state_update",
            data=state
        )
        await self.notify_listeners(event)
        
    def get_current_inventories(self) -> Dict:
        """現在の在庫状態を取得"""
        inventories = {}
        for buffer_id, buffer in self.factory.buffers.items():
            inventories[buffer_id] = {
                "products": buffer.get_inventory_levels(),
                "total": buffer.get_total_quantity()
            }
        return inventories
        
    def get_equipment_states(self) -> Dict:
        """設備の状態を取得"""
        states = {}
        for process_id, process in self.factory.processes.items():
            states[process_id] = {
                "equipments": {
                    eq_id: eq.get_state() 
                    for eq_id, eq in process.equipments.items()
                }
            }
        return states
        
    def calculate_kpis(self) -> Dict:
        """KPIを計算"""
        total_production = 0
        total_inventory = 0
        running_equipment = 0
        total_equipment = 0
        
        # 生産数を計算（完成品バッファの在庫）
        for buffer_id, buffer in self.factory.buffers.items():
            if "FINAL" in buffer_id:
                total_production += buffer.get_total_quantity()
            total_inventory += buffer.get_total_quantity()
        
        # 設備稼働率を計算
        for process in self.factory.processes.values():
            for equipment in process.equipments.values():
                total_equipment += 1
                if equipment.status == "running":
                    running_equipment += 1
        
        equipment_utilization = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
        
        # 簡易的な在庫回転率（実行時間に基づく）
        runtime_hours = self.env.now / 3600 if self.env.now > 0 else 0.01
        inventory_turnover = total_production / runtime_hours if runtime_hours > 0 else 0
        
        # 平均リードタイム（簡易計算）
        average_lead_time = (self.env.now / 60) if total_production > 0 else 0  # 分単位
        
        return {
            "total_production": int(total_production),
            "average_lead_time": round(average_lead_time, 1),
            "equipment_utilization": round(equipment_utilization, 1),
            "inventory_turnover": round(inventory_turnover, 2)
        }