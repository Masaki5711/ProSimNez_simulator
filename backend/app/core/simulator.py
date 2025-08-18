"""
離散イベントシミュレーションエンジン
"""
import simpy
from typing import Dict, List, Optional, Callable
from datetime import datetime, timedelta
import asyncio
import json
import os

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
        
        # フェーズ２テスト詳細ログ用
        self.phase2_test_log = {
            "test_start_time": None,
            "test_end_time": None,
            "configuration": {},
            "detailed_events": [],
            "process_states": [],
            "buffer_states": [],
            "equipment_states": [],
            "production_metrics": {},
            "performance_metrics": {},
            "errors_and_warnings": [],
            # 追加: より詳細なログ
            "real_time_metrics": {
                "current_time": [],
                "production_progress": [],
                "inventory_changes": [],
                "equipment_utilization": [],
                "throughput_rates": [],
                "bottleneck_analysis": []
            },
            "system_health": {
                "alerts": [],
                "warnings": [],
                "performance_degradations": []
            },
            "visualization_data": {
                "timeline_events": [],
                "process_flow_diagram": [],
                "resource_utilization_chart": [],
                "inventory_levels_chart": []
            },
            # フェーズ2改良版: スケジューリング制御の詳細ログ
            "scheduling_control_log": {
                "push_control_events": [],      # プッシュ型制御イベント
                "pull_control_events": [],      # プル型制御イベント
                "kanban_control_events": [],    # かんばん制御イベント
                "hybrid_control_events": [],    # ハイブリッド制御イベント
                "material_flow_analysis": [],   # 材料フロー分析
                "scheduling_efficiency": []     # スケジューリング効率
            },
            "store_planning_log": {
                "production_schedule_execution": [],  # 生産計画実行状況
                "inventory_level_monitoring": [],     # 在庫レベル監視
                "plan_vs_actual_analysis": []        # 計画と実績の比較
            }
        }
        
    def add_event_listener(self, listener: Callable):
        """イベントリスナーを追加"""
        self.event_listeners.append(listener)
        
    def remove_event_listener(self, listener: Callable):
        """イベントリスナーを削除"""
        if listener in self.event_listeners:
            self.event_listeners.remove(listener)
            
    async def notify_listeners(self, event: SimulationEvent):
        """全リスナーにイベントを通知"""
        # フェーズ２テストログに記録
        self.log_phase2_event(event)
        
        for listener in self.event_listeners:
            if asyncio.iscoroutinefunction(listener):
                await listener(event)
            else:
                listener(event)
                
    def log_phase2_event(self, event: SimulationEvent):
        """フェーズ２テスト用の詳細イベントログ記録"""
        event_record = {
            "timestamp": event.timestamp.isoformat(),
            "simulation_time": self.env.now,
            "event_type": event.event_type,
            "process_id": getattr(event, 'process_id', None),
            "equipment_id": getattr(event, 'process_id', None),
            "product_id": getattr(event, 'process_id', None),
            "data": event.data or {},
            "description": self._generate_event_description(event)
        }
        
        self.phase2_test_log["detailed_events"].append(event_record)
        
        # スケジューリング制御の詳細ログ記録
        self._log_scheduling_control_event(event)
    
    def _log_scheduling_control_event(self, event: SimulationEvent):
        """スケジューリング制御イベントの詳細ログ記録"""
        if not event.process_id:
            return
            
        process = self.factory.processes.get(event.process_id)
        if not process:
            return
            
        current_time = self.get_current_datetime()
        sim_time = self.env.now
        
        # 材料フロー分析の記録
        material_flow_record = {
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "process_id": event.process_id,
            "process_name": process.name,
            "event_type": event.event_type,
            "scheduling_analysis": {}
        }
        
        # 各入力材料のスケジューリング制御状況を分析
        for input_material in process.inputs:
            material_id = input_material.product_id
            scheduling_mode = input_material.scheduling_mode
            
            # バッファの現在状況を取得
            buffer_id = input_material.input_buffer_id
            current_stock = 0
            if buffer_id and buffer_id in self.factory.buffers:
                current_stock = self.factory.buffers[buffer_id].get_total_quantity()
            
            # 制御方式別の分析
            control_analysis = {
                "material_id": material_id,
                "scheduling_mode": scheduling_mode,
                "current_stock": current_stock,
                "required_quantity": input_material.required_quantity,
                "batch_size": input_material.batch_size,
                "safety_stock": input_material.safety_stock,
                "max_capacity": input_material.max_capacity,
                "control_status": self._analyze_control_status(input_material, current_stock)
            }
            
            material_flow_record["scheduling_analysis"][material_id] = control_analysis
            
            # 制御方式別のイベントログに記録
            if scheduling_mode == "push":
                self.phase2_test_log["scheduling_control_log"]["push_control_events"].append({
                    "timestamp": current_time.isoformat(),
                    "simulation_time": sim_time,
                    "process_id": event.process_id,
                    "material_id": material_id,
                    "control_analysis": control_analysis
                })
            elif scheduling_mode == "pull":
                self.phase2_test_log["scheduling_control_log"]["pull_control_events"].append({
                    "timestamp": current_time.isoformat(),
                    "simulation_time": sim_time,
                    "process_id": event.process_id,
                    "material_id": material_id,
                    "control_analysis": control_analysis
                })
            elif scheduling_mode == "hybrid":
                self.phase2_test_log["scheduling_control_log"]["hybrid_control_events"].append({
                    "timestamp": current_time.isoformat(),
                    "simulation_time": sim_time,
                    "process_id": event.process_id,
                    "material_id": material_id,
                    "control_analysis": control_analysis
                })
            
            # かんばん制御の記録
            if input_material.kanban_settings and input_material.kanban_settings.enabled:
                kanban_record = {
                    "timestamp": current_time.isoformat(),
                    "simulation_time": sim_time,
                    "process_id": event.process_id,
                    "material_id": material_id,
                    "kanban_type": input_material.kanban_settings.kanban_type,
                    "current_stock": current_stock,
                    "reorder_point": input_material.kanban_settings.reorder_point,
                    "max_inventory": input_material.kanban_settings.max_inventory,
                    "kanban_status": self._analyze_kanban_status(input_material.kanban_settings, current_stock)
                }
                self.phase2_test_log["scheduling_control_log"]["kanban_control_events"].append(kanban_record)
        
        # 材料フロー分析に記録
        self.phase2_test_log["scheduling_control_log"]["material_flow_analysis"].append(material_flow_record)
    
    def _analyze_control_status(self, input_material, current_stock: int) -> str:
        """制御状況を分析"""
        if current_stock >= input_material.required_quantity:
            return "sufficient"  # 十分
        elif current_stock >= input_material.safety_stock:
            return "adequate"     # 適正
        elif current_stock > 0:
            return "low"          # 低い
        else:
            return "empty"        # 空
    
    def _analyze_kanban_status(self, kanban_settings, current_stock: int) -> str:
        """かんばん状況を分析"""
        if current_stock <= kanban_settings.reorder_point:
            return "reorder_needed"  # 発注必要
        elif current_stock >= kanban_settings.max_inventory:
            return "overstocked"     # 過剰在庫
        else:
            return "normal"           # 正常
        
    def _generate_event_description(self, event: SimulationEvent) -> str:
        """イベントの詳細説明を生成"""
        event_type = event.event_type
        process_id = getattr(event, 'process_id', 'Unknown')
        equipment_id = getattr(event, 'equipment_id', 'Unknown')
        
        descriptions = {
            "process_start": f"工程 {process_id} の設備 {equipment_id} で加工開始",
            "process_complete": f"工程 {process_id} の設備 {equipment_id} で加工完了",
            "buffer_add": f"バッファに製品追加",
            "buffer_remove": f"バッファから製品取得",
            "equipment_breakdown": f"設備 {equipment_id} が故障",
            "equipment_repair": f"設備 {equipment_id} が修理完了",
            "production_complete": f"製品生産完了",
            "quality_check": f"品質検査実行"
        }
        
        return descriptions.get(event_type, f"イベントタイプ: {event_type}")
        
    def capture_system_state(self):
        """現在のシステム状態をキャプチャ"""
        current_time = self.get_current_datetime()
        
        # プロセス状態を記録
        process_states = []
        for process_id, process in self.factory.processes.items():
            equipment_states = []
            for eq_id, equipment in process.equipments.items():
                equipment_states.append({
                    "equipment_id": eq_id,
                    "status": equipment.status,
                    "utilization": getattr(equipment, 'utilization', 0),
                    "current_product": getattr(equipment, 'current_product', None)
                })
            
            process_states.append({
                "process_id": process_id,
                "process_name": process.name,
                "process_type": process.type,
                "equipment_states": equipment_states,
                "input_buffer_id": process.input_buffer_id,
                "output_buffer_id": process.output_buffer_id
            })
        
        # バッファ状態を記録
        buffer_states = []
        for buffer_id, buffer in self.factory.buffers.items():
            buffer_states.append({
                "buffer_id": buffer_id,
                "buffer_name": buffer.name,
                "capacity": buffer.capacity,
                "current_stock": sum(sum(lot["quantity"] for lot in lots) for lots in buffer.inventory.values()),
                "inventory_details": buffer.inventory,
                "location_type": buffer.location_type,
                "buffer_type": buffer.buffer_type
            })
        
        # 記録
        state_record = {
            "timestamp": current_time.isoformat(),
            "simulation_time": self.env.now,
            "process_states": process_states,
            "buffer_states": buffer_states
        }
        
        self.phase2_test_log["process_states"].append(state_record)
        self.phase2_test_log["buffer_states"].append(state_record)
        
    def capture_real_time_metrics(self):
        """リアルタイムメトリクスを収集"""
        current_time = self.get_current_datetime()
        sim_time = self.env.now
        
        # 現在時刻の記録
        self.phase2_test_log["real_time_metrics"]["current_time"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "formatted_time": current_time.strftime("%H:%M:%S")
        })
        
        # 生産進捗の記録
        total_production = 0
        for buffer_id, buffer in self.factory.buffers.items():
            if "FINAL" in buffer_id:
                total_production += buffer.get_total_quantity()
        
        self.phase2_test_log["real_time_metrics"]["production_progress"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "total_production": total_production,
            "production_rate": total_production / max(1, sim_time / 3600)  # 時間あたり
        })
        
        # 在庫変化の記録
        inventory_summary = {}
        for buffer_id, buffer in self.factory.buffers.items():
            inventory_summary[buffer_id] = {
                "name": buffer.name,
                "current_stock": buffer.get_total_quantity(),
                "capacity": buffer.capacity if hasattr(buffer, 'capacity') else 'unlimited'
            }
        
        self.phase2_test_log["real_time_metrics"]["inventory_changes"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "inventory_levels": inventory_summary
        })
        
        # 設備稼働率の記録
        equipment_utilization = {}
        for process_id, process in self.factory.processes.items():
            total_equipment = len(process.equipments)
            running_equipment = sum(1 for eq in process.equipments.values() if eq.status == "running")
            utilization_rate = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
            
            equipment_utilization[process_id] = {
                "name": process.name,
                "total_equipment": total_equipment,
                "running_equipment": running_equipment,
                "utilization_rate": round(utilization_rate, 1)
            }
        
        self.phase2_test_log["real_time_metrics"]["equipment_utilization"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "utilization_data": equipment_utilization
        })
        
        # スループット率の記録
        throughput_rates = {}
        for process_id, process in self.factory.processes.items():
            # 過去30分間の完了作業数を計算
            recent_completions = sum(1 for event in self.phase2_test_log["detailed_events"] 
                                   if event["process_id"] == process_id and 
                                   event["event_type"] == "process_complete" and
                                   event["simulation_time"] >= sim_time - 1800)  # 30分前から
            
            throughput_rates[process_id] = {
                "name": process.name,
                "completions_per_hour": recent_completions * 2,  # 30分間の2倍
                "theoretical_capacity": 3600 / 60 if process.processing_time else 60  # 理論的能力
            }
        
        self.phase2_test_log["real_time_metrics"]["throughput_rates"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "throughput_data": throughput_rates
        })
        
        # ボトルネック分析
        bottleneck_analysis = self._identify_current_bottlenecks()
        self.phase2_test_log["real_time_metrics"]["bottleneck_analysis"].append({
            "timestamp": current_time.isoformat(),
            "simulation_time": sim_time,
            "bottlenecks": bottleneck_analysis
        })
        
    def _identify_current_bottlenecks(self) -> list:
        """現在のボトルネックを特定"""
        bottlenecks = []
        
        for process_id, process in self.factory.processes.items():
            # キュー長を計算
            queue_length = len([event for event in self.phase2_test_log["detailed_events"] 
                              if event["process_id"] == process_id and 
                              event["event_type"] == "process_start" and
                              event["simulation_time"] >= self.env.now - 300])  # 5分前から
            
            # 設備稼働率を計算
            total_equipment = len(process.equipments)
            running_equipment = sum(1 for eq in process.equipments.values() if eq.status == "running")
            utilization_rate = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
            
            # ボトルネック判定
            bottleneck_score = 0
            if queue_length > 3:
                bottleneck_score += 3
            if utilization_rate > 80:
                bottleneck_score += 2
            if queue_length > 5:
                bottleneck_score += 2
            
            if bottleneck_score >= 3:
                bottlenecks.append({
                    "process_id": process_id,
                    "process_name": process.name,
                    "bottleneck_score": bottleneck_score,
                    "queue_length": queue_length,
                    "utilization_rate": round(utilization_rate, 1),
                    "severity": "high" if bottleneck_score >= 5 else "medium"
                })
        
        # スコア順にソート
        bottlenecks.sort(key=lambda x: x["bottleneck_score"], reverse=True)
        return bottlenecks
        
    def analyze_system_health(self):
        """システム健全性を分析"""
        current_time = self.get_current_datetime()
        sim_time = self.env.now
        
        # アラートの生成
        alerts = []
        warnings = []
        performance_degradations = []
        
        # 在庫不足アラート
        for buffer_id, buffer in self.factory.buffers.items():
            current_stock = buffer.get_total_quantity()
            if hasattr(buffer, 'capacity') and buffer.capacity != 'unlimited':
                if current_stock < buffer.capacity * 0.1:  # 10%未満
                    alerts.append({
                        "type": "low_stock",
                        "buffer_id": buffer_id,
                        "buffer_name": buffer.name,
                        "current_stock": current_stock,
                        "capacity": buffer.capacity,
                        "severity": "high"
                    })
        
        # 設備故障警告
        for process_id, process in self.factory.processes.items():
            for eq_id, equipment in process.equipments.items():
                if equipment.status == "breakdown":
                    warnings.append({
                        "type": "equipment_breakdown",
                        "process_id": process_id,
                        "equipment_id": eq_id,
                        "severity": "medium"
                    })
        
        # パフォーマンス劣化の検出
        recent_events = [event for event in self.phase2_test_log["detailed_events"] 
                        if event["simulation_time"] >= sim_time - 600]  # 10分前から
        
        if len(recent_events) < 5:  # イベント数が少ない
            performance_degradations.append({
                "type": "low_activity",
                "description": "システム活動が低下しています",
                "severity": "low"
            })
        
        # 記録
        if alerts:
            self.phase2_test_log["system_health"]["alerts"].append({
                "timestamp": current_time.isoformat(),
                "simulation_time": sim_time,
                "alerts": alerts
            })
        
        if warnings:
            self.phase2_test_log["system_health"]["warnings"].append({
                "timestamp": current_time.isoformat(),
                "simulation_time": sim_time,
                "warnings": warnings
            })
        
        if performance_degradations:
            self.phase2_test_log["system_health"]["performance_degradations"].append({
                "timestamp": current_time.isoformat(),
                "simulation_time": sim_time,
                "degradations": performance_degradations
            })
                
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
            
        # テスト用の定期的なイベント生成を開始
        self._schedule_test_events()
        
    def _schedule_test_events(self):
        """テスト用の定期的なイベントをスケジュール"""
        def generate_test_event():
            if not self.is_running:
                return
                
            # ランダムなテストイベントを生成
            import random
            event_types = [
                "test_process_start",
                "test_inventory_change", 
                "test_equipment_status",
                "test_quality_check",
                "test_scheduling_update"
            ]
            
            event_type = random.choice(event_types)
            process_id = random.choice(list(self.factory.processes.keys())) if self.factory.processes else "TEST_PROCESS"
            
            test_event = SimulationEvent(
                timestamp=self.get_current_datetime(),
                event_type=event_type,
                process_id=process_id,
                data={
                    "test_data": f"テストイベント {event_type}",
                    "timestamp": self.env.now,
                    "random_value": random.randint(1, 100)
                }
            )
            
            # イベントを記録
            self.log_phase2_event(test_event)
            
            # 次のイベントをスケジュール（シミュレーション時間に応じて調整）
            if self.env.now < 300:  # 5分未満
                next_interval = random.randint(10, 30)
            elif self.env.now < 1800:  # 30分未満
                next_interval = random.randint(30, 60)
            else:  # 30分以上
                next_interval = random.randint(60, 120)
            
            self.env.process(self._delayed_event_generation(next_interval))
        
        # 最初のイベントをスケジュール
        self.env.process(self._delayed_event_generation(5))
        
    def _delayed_event_generation(self, delay: float):
        """遅延したイベント生成"""
        yield self.env.timeout(delay)
        if self.is_running:
            self._schedule_test_events()
            
    async def start(self, duration: Optional[float] = None):
        """シミュレーションを開始"""
        self.is_running = True
        self.is_paused = False
        
        # シミュレーションの初期化
        self.initialize_simulation()
        
        # 初期イベントを生成
        initial_event = SimulationEvent(
            timestamp=self.get_current_datetime(),
            event_type="simulation_start",
            data={"message": "シミュレーション開始", "timestamp": self.env.now}
        )
        await self.notify_listeners(initial_event)
        
        # シミュレーションループ
        try:
            last_broadcast = 0
            last_state_capture = 0
            broadcast_interval = 5  # 5秒ごとに状態をブロードキャスト
            # シミュレーション時間に応じて状態キャプチャ間隔を調整
            if duration and duration > 600:  # 10分以上
                state_capture_interval = 60  # 1分ごと
            elif duration and duration > 300:  # 5分以上
                state_capture_interval = 45  # 45秒ごと
            else:
                state_capture_interval = 30  # 30秒ごと
            
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
                    
                    # フェーズ２テスト用の定期的な状態キャプチャ
                    if self.env.now - last_state_capture >= state_capture_interval:
                        self.capture_system_state()
                        self.capture_real_time_metrics()  # 追加: リアルタイムメトリクス
                        self.analyze_system_health()      # 追加: システム健全性分析
                        last_state_capture = self.env.now
                    
                # 速度調整
                await asyncio.sleep(1.0 / self.speed if not self.is_paused else 0.1)
                    
        except Exception as e:
            print(f"シミュレーションエラー: {e}")
        finally:
            # 終了イベントを生成
            if self.is_running:
                end_event = SimulationEvent(
                    timestamp=self.get_current_datetime(),
                    event_type="simulation_end",
                    data={"message": "シミュレーション終了", "timestamp": self.env.now}
                )
                await self.notify_listeners(end_event)
            
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
        
    def start_phase2_test(self, config: dict):
        """フェーズ２テスト開始時の初期化"""
        self.phase2_test_log["test_start_time"] = datetime.now().isoformat()
        self.phase2_test_log["configuration"] = config
        print(f"🚀 フェーズ２テスト開始: {self.phase2_test_log['test_start_time']}")
        
    def end_phase2_test(self):
        """フェーズ２テスト終了時の処理"""
        try:
            print(f"🔄 フェーズ２テスト終了処理開始...")
            print(f"📊 現在のログ状態:")
            print(f"   - 詳細イベント数: {len(self.phase2_test_log['detailed_events'])}")
            print(f"   - リアルタイムメトリクス数: {len(self.phase2_test_log['real_time_metrics']['production_progress'])}")
            print(f"   - システム健全性記録数: {len(self.phase2_test_log['system_health']['alerts'])}")
            
            self.phase2_test_log["test_end_time"] = datetime.now().isoformat()
            
            # 最終パフォーマンスメトリクスを計算
            try:
                self.phase2_test_log["performance_metrics"] = self.get_kpis()
                print("✅ パフォーマンスメトリクス計算完了")
            except Exception as kpi_error:
                print(f"⚠️ KPI計算エラー: {str(kpi_error)}")
                self.phase2_test_log["performance_metrics"] = {}
            
            # 生産メトリクスを計算
            total_events = len(self.phase2_test_log["detailed_events"])
            process_events = sum(1 for event in self.phase2_test_log["detailed_events"] 
                               if event["event_type"] in ["process_start", "process_complete"])
            
            self.phase2_test_log["production_metrics"] = {
                "total_events": total_events,
                "process_events": process_events,
                "simulation_duration_seconds": self.env.now,
                "simulation_duration_minutes": round(self.env.now / 60, 2),
                "events_per_minute": round(total_events / (self.env.now / 60), 2) if self.env.now > 0 else 0
            }
            
            print(f"✅ フェーズ２テスト終了: {self.phase2_test_log['test_end_time']}")
            print(f"📊 総イベント数: {total_events}")
            print(f"⏰ シミュレーション時間: {round(self.env.now / 60, 2)} 分")
            
        except Exception as e:
            print(f"❌ フェーズ２テスト終了処理エラー: {str(e)}")
            raise
        
    def generate_phase2_test_report(self, output_dir: str = "reports") -> str:
        """フェーズ２テスト結果のMDレポートを生成"""
        try:
            print(f"🔄 レポート生成開始...")
            print(f"📁 出力ディレクトリ: {output_dir}")
            
            if not os.path.exists(output_dir):
                os.makedirs(output_dir)
                print(f"✅ ディレクトリ作成: {output_dir}")
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"phase2_test_report_{timestamp}.md"
            filepath = os.path.join(output_dir, filename)
            
            print(f"📝 ファイル名: {filename}")
            print(f"📁 ファイルパス: {filepath}")
            
            # MDコンテンツを生成
            try:
                md_content = self._generate_md_content()
                print(f"✅ MDコンテンツ生成完了: {len(md_content)} 文字")
            except Exception as md_error:
                print(f"❌ MDコンテンツ生成エラー: {str(md_error)}")
                raise
            
            # ファイルに書き込み
            try:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(md_content)
                print(f"✅ MDファイル書き込み完了: {filepath}")
            except Exception as write_error:
                print(f"❌ ファイル書き込みエラー: {str(write_error)}")
                raise
            
            # HTMLレポートも生成
            try:
                html_filepath = self._generate_html_report(output_dir, timestamp)
                print(f"✅ HTMLレポート生成完了: {html_filepath}")
            except Exception as html_error:
                print(f"⚠️ HTMLレポート生成エラー: {str(html_error)}")
                html_filepath = None
            
            print(f"📄 フェーズ２テストレポートを生成しました:")
            print(f"   - Markdown: {filepath}")
            print(f"   - HTML: {html_filepath}")
            
            return filepath
            
        except Exception as e:
            print(f"❌ レポート生成全体エラー: {str(e)}")
            print(f"📊 現在のログ状態:")
            print(f"   - 詳細イベント数: {len(self.phase2_test_log['detailed_events'])}")
            print(f"   - リアルタイムメトリクス数: {len(self.phase2_test_log['real_time_metrics']['production_progress'])}")
            raise
        
    def _generate_md_content(self) -> str:
        """MDファイルのコンテンツを生成"""
        try:
            print(f"🔄 MDコンテンツ生成開始...")
            log = self.phase2_test_log
            
            # 基本的なレポート内容を生成
            md_content = f"""# フェーズ２テスト実行レポート

## 🔍 テスト概要

| 項目 | 値 |
|------|------|
| テスト開始時刻 | {log.get('test_start_time', 'N/A')} |
| テスト終了時刻 | {log.get('test_end_time', 'N/A')} |
| シミュレーション時間 | {log.get('production_metrics', {}).get('simulation_duration_minutes', 0)} 分 |
| 総イベント数 | {log.get('production_metrics', {}).get('total_events', 0)} |
| 工程イベント数 | {log.get('production_metrics', {}).get('process_events', 0)} |

## 📊 ログ状態

| 項目 | 値 |
|------|------|
| 詳細イベント数 | {len(log.get('detailed_events', []))} |
| リアルタイムメトリクス数 | {len(log.get('real_time_metrics', {}).get('production_progress', []))} |
| システム健全性記録数 | {len(log.get('system_health', {}).get('alerts', []))} |

## ⚙️ 設定情報

```json
{json.dumps(log.get('configuration', {}), indent=2, ensure_ascii=False)}
```

## 📋 詳細イベントログ

### イベント統計
"""
            
            print(f"✅ 基本MDコンテンツ生成完了")
            
            # 残りのコンテンツを追加
            md_content += self._generate_remaining_md_content(log)
            
            return md_content
            
        except Exception as e:
            print(f"❌ MDコンテンツ生成エラー: {str(e)}")
            # エラー時は最小限のレポートを返す
            return f"""# フェーズ２テスト実行レポート

## ❌ エラーが発生しました

レポート生成中にエラーが発生しました: {str(e)}

## 📊 現在のログ状態

- 詳細イベント数: {len(self.phase2_test_log.get('detailed_events', []))}
- リアルタイムメトリクス数: {len(self.phase2_test_log.get('real_time_metrics', {}).get('production_progress', []))}
"""
        
        # リアルタイムメトリクスの要約を追加
        if log.get('real_time_metrics', {}).get('production_progress'):
            latest_progress = log['real_time_metrics']['production_progress'][-1]
            md_content += f"""
- **最終生産数**: {latest_progress.get('total_production', 0)} 個
- **生産率**: {latest_progress.get('production_rate', 0):.2f} 個/時間
- **最終記録時刻**: {latest_progress.get('timestamp', 'N/A')[:19]}
"""

        # 設備稼働率の要約
        if log.get('real_time_metrics', {}).get('equipment_utilization'):
            latest_utilization = log['real_time_metrics']['equipment_utilization'][-1]
            utilization_data = latest_utilization.get('utilization_data', {})
            
            md_content += "\n### 設備稼働率\n"
            for process_id, data in utilization_data.items():
                md_content += f"- **{data.get('name', process_id)}**: {data.get('utilization_rate', 0)}% ({data.get('running_equipment', 0)}/{data.get('total_equipment', 0)})\n"

        # ボトルネック分析の要約
        if log.get('real_time_metrics', {}).get('bottleneck_analysis'):
            latest_bottlenecks = log['real_time_metrics']['bottleneck_analysis'][-1]
            bottlenecks = latest_bottlenecks.get('bottlenecks', [])
            
            if bottlenecks:
                md_content += "\n### 🚨 現在のボトルネック\n"
                for bottleneck in bottlenecks[:3]:  # 上位3件
                    severity_icon = "🔴" if bottleneck.get('severity') == 'high' else "🟡"
                    md_content += f"{severity_icon} **{bottleneck.get('process_name', 'Unknown')}**\n"
                    md_content += f"  - スコア: {bottleneck.get('bottleneck_score', 0)}\n"
                    md_content += f"  - キュー長: {bottleneck.get('queue_length', 0)}\n"
                    md_content += f"  - 稼働率: {bottleneck.get('utilization_rate', 0)}%\n"
            else:
                md_content += "\n### ✅ ボトルネックなし\n現在、ボトルネックは検出されていません。\n"

        # システム健全性の要約
        if log.get('system_health'):
            md_content += "\n### 🏥 システム健全性\n"
            
            total_alerts = sum(len(health.get('alerts', [])) for health in log['system_health'].values())
            total_warnings = sum(len(health.get('warnings', [])) for health in log['system_health'].values())
            
            if total_alerts > 0:
                md_content += f"🔴 **アラート**: {total_alerts}件\n"
            if total_warnings > 0:
                md_content += f"🟡 **警告**: {total_warnings}件\n"
            if total_alerts == 0 and total_warnings == 0:
                md_content += "✅ **正常**: アラートや警告はありません\n"

        md_content += "\n## 📋 詳細イベントログ\n\n### イベント統計\n"

    def _generate_remaining_md_content(self, log: dict) -> str:
        """残りのMDコンテンツを生成"""
        try:
            print(f"🔄 残りMDコンテンツ生成開始...")
            
            content = ""
            
            # パフォーマンスメトリクス
            content += f"""
## 📊 パフォーマンスメトリクス

| メトリクス | 値 |
|------------|------|
| 総生産量 | {log.get('performance_metrics', {}).get('total_production', 0)} |
| 平均リードタイム | {log.get('performance_metrics', {}).get('average_lead_time', 0)} 分 |
| 設備稼働率 | {log.get('performance_metrics', {}).get('equipment_utilization', 0)}% |
| 在庫回転率 | {log.get('performance_metrics', {}).get('inventory_turnover', 0)} |

## 📈 生産メトリクス

| メトリクス | 値 |
|------------|------|
| 分あたりイベント数 | {log.get('production_metrics', {}).get('events_per_minute', 0)} |
| シミュレーション効率 | {self._calculate_simulation_efficiency()}% |

## 📊 リアルタイムメトリクスサマリー

### 生産進捗
"""
            
            # リアルタイムメトリクスの要約を追加
            real_time_metrics = log.get('real_time_metrics', {})
            if real_time_metrics and isinstance(real_time_metrics, dict):
                production_progress = real_time_metrics.get('production_progress', [])
                if production_progress and len(production_progress) > 0:
                    latest_progress = production_progress[-1]
                    if isinstance(latest_progress, dict):
                        content += f"""
- **最終生産数**: {latest_progress.get('total_production', 0)} 個
- **生産率**: {latest_progress.get('production_rate', 0):.2f} 個/時間
- **最終記録時刻**: {latest_progress.get('timestamp', 'N/A')[:19]}
"""
                    else:
                        content += "\n- **リアルタイムメトリクス**: データ形式エラー\n"
                else:
                    content += "\n- **リアルタイムメトリクス**: データなし\n"
            else:
                content += "\n- **リアルタイムメトリクス**: 利用不可\n"

            # 設備稼働率の要約
            if real_time_metrics and isinstance(real_time_metrics, dict):
                equipment_utilization = real_time_metrics.get('equipment_utilization', [])
                if equipment_utilization and len(equipment_utilization) > 0:
                    latest_utilization = equipment_utilization[-1]
                    if isinstance(latest_utilization, dict):
                        utilization_data = latest_utilization.get('utilization_data', {})
                        if utilization_data and isinstance(utilization_data, dict):
                            content += "\n### 設備稼働率\n"
                            for process_id, data in utilization_data.items():
                                if isinstance(data, dict):
                                    content += f"- **{data.get('name', process_id)}**: {data.get('utilization_rate', 0)}% ({data.get('running_equipment', 0)}/{data.get('total_equipment', 0)})\n"
                                else:
                                    content += f"- **{process_id}**: データ形式エラー\n"
                        else:
                            content += "\n### 設備稼働率\n- データなし\n"
                    else:
                        content += "\n### 設備稼働率\n- データ形式エラー\n"
                else:
                    content += "\n### 設備稼働率\n- データなし\n"
            else:
                content += "\n### 設備稼働率\n- 利用不可\n"

            # ボトルネック分析の要約
            if real_time_metrics and isinstance(real_time_metrics, dict):
                bottleneck_analysis = real_time_metrics.get('bottleneck_analysis', [])
                if bottleneck_analysis and len(bottleneck_analysis) > 0:
                    latest_bottlenecks = bottleneck_analysis[-1]
                    if isinstance(latest_bottlenecks, dict):
                        bottlenecks = latest_bottlenecks.get('bottlenecks', [])
                        if bottlenecks and isinstance(bottlenecks, list):
                            content += "\n### 🚨 現在のボトルネック\n"
                            for bottleneck in bottlenecks[:3]:  # 上位3件
                                if isinstance(bottleneck, dict):
                                    severity_icon = "🔴" if bottleneck.get('severity') == 'high' else "🟡"
                                    content += f"{severity_icon} **{bottleneck.get('process_name', 'Unknown')}**\n"
                                    content += f"  - スコア: {bottleneck.get('bottleneck_score', 0)}\n"
                                    content += f"  - キュー長: {bottleneck.get('queue_length', 0)}\n"
                                    content += f"  - 稼働率: {bottleneck.get('utilization_rate', 0)}%\n"
                                else:
                                    content += "- ボトルネックデータ形式エラー\n"
                        else:
                            content += "\n### ✅ ボトルネックなし\n現在、ボトルネックは検出されていません。\n"
                    else:
                        content += "\n### ボトルネック分析\n- データ形式エラー\n"
                else:
                    content += "\n### ボトルネック分析\n- データなし\n"
            else:
                content += "\n### ボトルネック分析\n- 利用不可\n"

            # システム健全性の要約
            system_health = log.get('system_health', {})
            if system_health and isinstance(system_health, dict):
                content += "\n### 🏥 システム健全性\n"
                
                try:
                    total_alerts = sum(len(health.get('alerts', [])) for health in system_health.values() if isinstance(health, dict))
                    total_warnings = sum(len(health.get('warnings', [])) for health in system_health.values() if isinstance(health, dict))
                    
                    if total_alerts > 0:
                        content += f"🔴 **アラート**: {total_alerts}件\n"
                    if total_warnings > 0:
                        content += f"🟡 **警告**: {total_warnings}件\n"
                    if total_alerts == 0 and total_warnings == 0:
                        content += "✅ **正常**: アラートや警告はありません\n"
                except Exception as health_error:
                    content += f"⚠️ **システム健全性**: 計算エラー - {str(health_error)}\n"
            else:
                content += "\n### 🏥 システム健全性\n- データなし\n"

            content += "\n## 📋 詳細イベントログ\n\n### イベント統計\n"

            # イベントタイプ別の統計
            event_types = {}
            for event in log.get('detailed_events', []):
                event_type = event.get('event_type', 'unknown')
                event_types[event_type] = event_types.get(event_type, 0) + 1
                
            content += "\n| イベントタイプ | 回数 |\n|---------------|------|\n"
            for event_type, count in sorted(event_types.items()):
                content += f"| {event_type} | {count} |\n"

            # 時系列イベント詳細
            content += "\n### 時系列イベント詳細\n\n"
            content += "| 時刻 | シミュレーション時間 | イベントタイプ | 説明 | 詳細データ |\n"
            content += "|------|---------------------|----------------|------|------------|\n"
            
            for event in log.get('detailed_events', []):
                timestamp = event.get('timestamp', '')[:19]  # 秒まで表示
                sim_time = f"{event.get('simulation_time', 0):.1f}s"
                event_type = event.get('event_type', '')
                description = event.get('description', '')
                data_str = str(event.get('data', {}))[:50] + "..." if len(str(event.get('data', {}))) > 50 else str(event.get('data', {}))
                
                content += f"| {timestamp} | {sim_time} | {event_type} | {description} | {data_str} |\n"

            # システム状態の記録
            content += "\n## 🏭 システム状態履歴\n\n"
            
            if log.get('process_states'):
                content += "### 工程状態履歴\n\n"
                for i, state in enumerate(log.get('process_states', [])[:5]):  # 最初の5つの状態のみ表示
                    content += f"#### 状態記録 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                    for process in state.get('process_states', []):
                        content += f"**工程**: {process.get('process_name', '')} ({process.get('process_id', '')})\n"
                        content += f"- タイプ: {process.get('process_type', '')}\n"
                        for equipment in process.get('equipment_states', []):
                            content += f"- 設備 {equipment.get('equipment_id', '')}: {equipment.get('status', '')} (稼働率: {equipment.get('utilization', 0)}%)\n"
                        content += "\n"

            if log.get('buffer_states'):
                content += "### バッファ状態履歴\n\n"
                for i, state in enumerate(log.get('buffer_states', [])[:5]):  # 最初の5つの状態のみ表示
                    content += f"#### バッファ状態 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                    for buffer in state.get('buffer_states', []):
                        content += f"**バッファ**: {buffer.get('buffer_name', '')} ({buffer.get('buffer_id', '')})\n"
                        content += f"- 容量: {buffer.get('capacity', 'unlimited')}\n"
                        content += f"- 現在在庫: {buffer.get('current_stock', 0)}\n"
                        content += f"- タイプ: {buffer.get('buffer_type', '')}\n\n"

            # エラーと警告
            if log.get('errors_and_warnings'):
                content += "## ⚠️ エラーと警告\n\n"
                for error in log.get('errors_and_warnings', []):
                    content += f"- **{error.get('level', 'ERROR')}**: {error.get('message', '')}\n"
            else:
                content += "## ✅ エラーと警告\n\n"
                content += "エラーや警告はありませんでした。\n"

            # まとめ
            content += f"""
## 📋 テスト結果サマリー

このフェーズ２テストでは、以下の結果が得られました：

- **実行時間**: {log.get('production_metrics', {}).get('simulation_duration_minutes', 0)} 分
- **総イベント数**: {log.get('production_metrics', {}).get('total_events', 0)}
- **生産性**: {log.get('performance_metrics', {}).get('total_production', 0)} 製品
- **システム効率**: {self._calculate_simulation_efficiency()}%

---
*レポート生成時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

            print(f"✅ 残りMDコンテンツ生成完了")
            return content
            
        except Exception as e:
            print(f"❌ 残りMDコンテンツ生成エラー: {str(e)}")
            return f"\n## ❌ コンテンツ生成エラー\n\nエラーが発生しました: {str(e)}\n"

        # 時系列イベント詳細
        md_content += "\n### 時系列イベント詳細\n\n"
        md_content += "| 時刻 | シミュレーション時間 | イベントタイプ | 説明 | 詳細データ |\n"
        md_content += "|------|---------------------|----------------|------|------------|\n"
        
        for event in log.get('detailed_events', []):
            timestamp = event.get('timestamp', '')[:19]  # 秒まで表示
            sim_time = f"{event.get('simulation_time', 0):.1f}s"
            event_type = event.get('event_type', '')
            description = event.get('description', '')
            data_str = str(event.get('data', {}))[:50] + "..." if len(str(event.get('data', {}))) > 50 else str(event.get('data', {}))
            
            md_content += f"| {timestamp} | {sim_time} | {event_type} | {description} | {data_str} |\n"

        # システム状態の記録
        md_content += "\n## 🏭 システム状態履歴\n\n"
        
        if log.get('process_states'):
            md_content += "### 工程状態履歴\n\n"
            for i, state in enumerate(log.get('process_states', [])[:5]):  # 最初の5つの状態のみ表示
                md_content += f"#### 状態記録 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                for process in state.get('process_states', []):
                    md_content += f"**工程**: {process.get('process_name', '')} ({process.get('process_id', '')})\n"
                    md_content += f"- タイプ: {process.get('process_type', '')}\n"
                    for equipment in process.get('equipment_states', []):
                        md_content += f"- 設備 {equipment.get('equipment_id', '')}: {equipment.get('status', '')} (稼働率: {equipment.get('utilization', 0)}%)\n"
                    md_content += "\n"

        if log.get('buffer_states'):
            md_content += "### バッファ状態履歴\n\n"
            for i, state in enumerate(log.get('buffer_states', [])[:5]):  # 最初の5つの状態のみ表示
                md_content += f"#### バッファ状態 {i+1} ({state.get('timestamp', '')[:19]})\n\n"
                for buffer in state.get('buffer_states', []):
                    md_content += f"**バッファ**: {buffer.get('buffer_name', '')} ({buffer.get('buffer_id', '')})\n"
                    md_content += f"- 容量: {buffer.get('capacity', 'unlimited')}\n"
                    md_content += f"- 現在在庫: {buffer.get('current_stock', 0)}\n"
                    md_content += f"- タイプ: {buffer.get('buffer_type', '')}\n\n"

        # エラーと警告
        if log.get('errors_and_warnings'):
            md_content += "## ⚠️ エラーと警告\n\n"
            for error in log.get('errors_and_warnings', []):
                md_content += f"- **{error.get('level', 'ERROR')}**: {error.get('message', '')}\n"
        else:
            md_content += "## ✅ エラーと警告\n\n"
            md_content += "エラーや警告はありませんでした。\n"

        # まとめ
        md_content += f"""
## 📋 テスト結果サマリー

このフェーズ２テストでは、以下の結果が得られました：

- **実行時間**: {log.get('production_metrics', {}).get('simulation_duration_minutes', 0)} 分
- **総イベント数**: {log.get('production_metrics', {}).get('total_events', 0)}
- **生産性**: {log.get('performance_metrics', {}).get('total_production', 0)} 製品
- **システム効率**: {self._calculate_simulation_efficiency()}%

---
*レポート生成時刻: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

        return md_content
        
    def _generate_html_report(self, output_dir: str, timestamp: str) -> str:
        """HTML形式のビジュアルレポートを生成"""
        log = self.phase2_test_log
        
        # テンプレート用の変数を準備
        test_start_time = log.get('test_start_time', 'N/A')
        test_end_time = log.get('test_end_time', 'N/A')
        total_events = len(log.get('detailed_events', []))
        total_states = len(log.get('process_states', []))
        
        # HTMLテンプレート
        html_content = """
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>フェーズ２テストレポート - """ + timestamp + """</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 15px; margin-bottom: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5em; font-weight: 300; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 1.1em; }
        
        .metric-card { background: white; border-radius: 15px; padding: 25px; margin-bottom: 25px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
        .metric-card h3 { margin: 0 0 20px 0; color: #333; font-size: 1.4em; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
        
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        .status-card { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid #667eea; }
        .status-card h4 { margin: 0 0 15px 0; color: #495057; font-size: 1.1em; }
        .metric-value { font-size: 2.5em; font-weight: bold; color: #667eea; margin: 10px 0; }
        .status-card p { margin: 5px 0; color: #6c757d; font-size: 0.9em; }
        
        .progress-bar { background: #e9ecef; border-radius: 10px; height: 8px; margin: 15px 0; overflow: hidden; }
        .progress-fill { background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; border-radius: 10px; transition: width 0.3s ease; }
        
        .bottleneck { border-left-color: #dc3545; }
        .success { border-left-color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .alert { border-left-color: #dc3545; }
        .info { border-left-color: #17a2b8; }
        
        .chart-container { height: 300px; margin: 20px 0; }
        
        .event-timeline { max-height: 400px; overflow-y: auto; }
        .event-item { background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 10px 0; border-left: 3px solid #667eea; }
        .event-time { color: #6c757d; font-size: 0.8em; margin-bottom: 5px; }
        .event-description { color: #333; font-weight: 500; }
        
        .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .summary-stat { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; }
        .summary-stat-value { font-size: 1.8em; font-weight: bold; color: #667eea; }
        .summary-stat-label { color: #6c757d; font-size: 0.9em; margin-top: 5px; }
        
        /* フェーズ2改良版: スケジューリング制御分析用スタイル */
        .scheduling-analysis { margin-top: 20px; }
        .control-summary { margin-bottom: 25px; }
        .control-summary h4 { color: #495057; margin-bottom: 15px; }
        .control-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; }
        .control-stat { background: #f8f9fa; border-radius: 10px; padding: 15px; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .control-type { padding: 5px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; margin-bottom: 8px; }
        .control-type.push { background: #e3f2fd; color: #1976d2; }
        .control-type.pull { background: #f3e5f5; color: #7b1fa2; }
        .control-type.kanban { background: #e8f5e8; color: #388e3c; }
        .control-type.hybrid { background: #fff3e0; color: #f57c00; }
        .control-count { font-size: 1.5em; font-weight: bold; color: #333; }
        
        .material-flow-analysis { margin-bottom: 25px; }
        .material-flow-analysis h4 { color: #495057; margin-bottom: 15px; }
        .flow-details { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .material-flow-item { background: #f8f9fa; border-radius: 10px; padding: 20px; border-left: 4px solid; }
        .material-flow-item.success { border-left-color: #28a745; }
        .material-flow-item.info { border-left-color: #17a2b8; }
        .material-flow-item.warning { border-left-color: #ffc107; }
        .material-flow-item.alert { border-left-color: #dc3545; }
        .material-flow-item h5 { margin: 0 0 15px 0; color: #333; font-size: 1.1em; }
        .flow-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .flow-detail { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e9ecef; }
        .flow-detail:last-child { border-bottom: none; }
        .flow-detail .label { color: #6c757d; font-size: 0.9em; }
        .flow-detail .value { font-weight: 500; color: #333; }
        .status-sufficient { color: #28a745; font-weight: bold; }
        .status-adequate { color: #17a2b8; font-weight: bold; }
        .status-low { color: #ffc107; font-weight: bold; }
        .status-empty { color: #dc3545; font-weight: bold; }
        
        .kanban-analysis { margin-bottom: 25px; }
        .kanban-analysis h4 { color: #495057; margin-bottom: 15px; }
        .kanban-details { background: #f8f9fa; border-radius: 10px; padding: 20px; }
        .kanban-item { display: flex; flex-direction: column; gap: 10px; }
        .kanban-item .material-id { font-weight: bold; color: #333; font-size: 1.1em; }
        .kanban-item .kanban-type { background: #e8f5e8; color: #388e3c; padding: 5px 12px; border-radius: 15px; font-size: 0.8em; font-weight: bold; align-self: flex-start; }
        .kanban-item .kanban-status { padding: 5px 12px; border-radius: 15px; font-size: 0.8em; font-weight: bold; align-self: flex-start; }
        .status-reorder_needed { background: #fff3e0; color: #f57c00; }
        .status-overstocked { background: #ffebee; color: #d32f2f; }
        .status-normal { background: #e8f5e8; color: #388e3c; }
        .kanban-metrics { display: flex; gap: 15px; flex-wrap: wrap; }
        .kanban-metrics span { background: #e9ecef; color: #495057; padding: 5px 10px; border-radius: 8px; font-size: 0.8em; }
        
        @media (max-width: 768px) {
            .status-grid { grid-template-columns: 1fr; }
            .control-stats { grid-template-columns: repeat(2, 1fr); }
            .flow-details { grid-template-columns: 1fr; }
            .flow-details-grid { grid-template-columns: 1fr; }
            .kanban-metrics { flex-direction: column; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 フェーズ２テスト実行レポート（改良版）</h1>
            <p>部品ごとのスケジューリング制御とストア計画管理のテスト結果</p>
            <p>生成時刻: {timestamp}</p>
        </div>

        <!-- テスト概要 -->
        <div class="metric-card">
            <h3>📋 テスト概要</h3>
            <div class="summary-stats">
                <div class="summary-stat">
                    <div class="summary-stat-value">{test_start_time}</div>
                    <div class="summary-stat-label">テスト開始時刻</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">{test_end_time}</div>
                    <div class="summary-stat-label">テスト終了時刻</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">{total_events}</div>
                    <div class="summary-stat-label">総イベント数</div>
                </div>
                <div class="summary-stat">
                    <div class="summary-stat-value">{total_states}</div>
                    <div class="summary-stat-label">状態記録数</div>
                </div>
            </div>
        </div>

        <!-- リアルタイムメトリクス -->
        <div class="metric-card">
            <h3>📊 リアルタイム状況</h3>
            <div class="status-grid">
"""
        
        # リアルタイムメトリクスを表示
        if log.get('real_time_metrics', {}).get('production_progress'):
            latest_progress = log['real_time_metrics']['production_progress'][-1]
            html_content += f"""
                <div class="status-card">
                    <h4>🏭 生産進捗</h4>
                    <div class="metric-value">{latest_progress.get('total_production', 0)}</div>
                    <p>総生産数</p>
                    <div class="metric-value">{latest_progress.get('production_rate', 0):.2f}</div>
                    <p>生産率 (個/時間)</p>
                </div>
"""
        
        if log.get('real_time_metrics', {}).get('equipment_utilization'):
            latest_utilization = log['real_time_metrics']['equipment_utilization'][-1]
            for process_id, data in latest_utilization.get('utilization_data', {}).items():
                utilization_rate = data.get('utilization_rate', 0)
                html_content += f"""
                <div class="status-card">
                    <h4>⚙️ {data.get('name', process_id)}</h4>
                    <div class="metric-value">{utilization_rate}%</div>
                    <p>設備稼働率</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: {utilization_rate}%"></div>
                    </div>
                    <p>{data.get('running_equipment', 0)}/{data.get('total_equipment', 0)} 稼働中</p>
                </div>
"""
        
        html_content += """
            </div>
        </div>

        <!-- ボトルネック分析 -->
"""
        
        if log.get('real_time_metrics', {}).get('bottleneck_analysis'):
            latest_bottlenecks = log['real_time_metrics']['bottleneck_analysis'][-1]
            bottlenecks = latest_bottlenecks.get('bottlenecks', [])
            
            if bottlenecks:
                html_content += """
        <div class="metric-card bottleneck">
            <h3>🚨 ボトルネック分析</h3>
            <div class="status-grid">
"""
                for bottleneck in bottlenecks[:3]:
                    severity_class = "alert" if bottleneck.get('severity') == 'high' else "warning"
                    html_content += f"""
                <div class="status-card {severity_class}">
                    <h4>{bottleneck.get('process_name', 'Unknown')}</h4>
                    <div class="metric-value">{bottleneck.get('bottleneck_score', 0)}</div>
                    <p>ボトルネックスコア</p>
                    <p>キュー長: {bottleneck.get('queue_length', 0)}</p>
                    <p>稼働率: {bottleneck.get('utilization_rate', 0)}%</p>
                </div>
"""
                html_content += """
            </div>
        </div>
"""
            else:
                html_content += """
        <div class="metric-card success">
            <h3>✅ ボトルネックなし</h3>
            <p>現在、ボトルネックは検出されていません。</p>
        </div>
"""
        
        # システム健全性
        if log.get('system_health'):
            html_content += """
        <div class="metric-card">
            <h3>🏥 システム健全性</h3>
            <div class="status-grid">
"""
            
            total_alerts = sum(len(health.get('alerts', [])) for health in log['system_health'].values())
            total_warnings = sum(len(health.get('warnings', [])) for health in log['system_health'].values())
            
            if total_alerts > 0:
                html_content += f"""
                <div class="status-card alert">
                    <h4>🔴 アラート</h4>
                    <div class="metric-value">{total_alerts}</div>
                    <p>件数</p>
                </div>
"""
            if total_warnings > 0:
                html_content += f"""
                <div class="status-card warning">
                    <h4>🟡 警告</h4>
                    <div class="metric-value">{total_warnings}</div>
                    <p>件数</p>
                </div>
"""
            if total_alerts == 0 and total_warnings == 0:
                html_content += """
                <div class="status-card success">
                    <h4>✅ 正常</h4>
                    <p>アラートや警告はありません</p>
                </div>
"""
            
            html_content += """
            </div>
        </div>
"""
        
        # フェーズ2改良版: スケジューリング制御の詳細分析
        if log.get('scheduling_control_log'):
            html_content += """
        <div class="metric-card">
            <h3>🎯 スケジューリング制御分析</h3>
            <div class="scheduling-analysis">
"""
            
            # 制御方式別の統計
            push_events = len(log['scheduling_control_log'].get('push_control_events', []))
            pull_events = len(log['scheduling_control_log'].get('pull_control_events', []))
            kanban_events = len(log['scheduling_control_log'].get('kanban_control_events', []))
            hybrid_events = len(log['scheduling_control_log'].get('hybrid_control_events', []))
            
            html_content += f"""
                <div class="control-summary">
                    <h4>📊 制御方式別イベント数</h4>
                    <div class="control-stats">
                        <div class="control-stat">
                            <span class="control-type push">プッシュ型</span>
                            <span class="control-count">{push_events}</span>
                        </div>
                        <div class="control-stat">
                            <span class="control-type pull">プル型</span>
                            <span class="control-count">{pull_events}</span>
                        </div>
                        <div class="control-stat">
                            <span class="control-type kanban">かんばん</span>
                            <span class="control-count">{kanban_events}</span>
                        </div>
                        <div class="control-stat">
                            <span class="control-type hybrid">ハイブリッド</span>
                            <span class="control-count">{hybrid_events}</span>
                        </div>
                    </div>
                </div>
"""
            
            # 材料フロー分析の最新状況
            if log['scheduling_control_log'].get('material_flow_analysis'):
                latest_flow = log['scheduling_control_log']['material_flow_analysis'][-1]
                html_content += """
                <div class="material-flow-analysis">
                    <h4>🔄 材料フロー分析（最新）</h4>
                    <div class="flow-details">
"""
                
                for material_id, analysis in latest_flow.get('scheduling_analysis', {}).items():
                    control_status = analysis.get('control_status', 'unknown')
                    status_class = {
                        'sufficient': 'success',
                        'adequate': 'info',
                        'low': 'warning',
                        'empty': 'alert'
                    }.get(control_status, 'unknown')
                    
                    html_content += f"""
                        <div class="material-flow-item {status_class}">
                            <h5>{material_id}</h5>
                            <div class="flow-details-grid">
                                <div class="flow-detail">
                                    <span class="label">制御方式:</span>
                                    <span class="value">{analysis.get('scheduling_mode', 'N/A')}</span>
                                </div>
                                <div class="flow-detail">
                                    <span class="label">現在在庫:</span>
                                    <span class="value">{analysis.get('current_stock', 0)}</span>
                                </div>
                                <div class="flow-detail">
                                    <span class="label">必要数量:</span>
                                    <span class="value">{analysis.get('required_quantity', 0)}</span>
                                </div>
                                <div class="flow-detail">
                                    <span class="label">制御状況:</span>
                                    <span class="value status-{control_status}">{control_status}</span>
                                </div>
                            </div>
                        </div>
"""
                
                html_content += """
                    </div>
                </div>
"""
            
            # かんばん制御の詳細
            if log['scheduling_control_log'].get('kanban_control_events'):
                latest_kanban = log['scheduling_control_log']['kanban_control_events'][-1]
                html_content += f"""
                <div class="kanban-analysis">
                    <h4>🎴 かんばん制御状況（最新）</h4>
                    <div class="kanban-details">
                        <div class="kanban-item">
                            <span class="material-id">{latest_kanban.get('material_id', 'N/A')}</span>
                            <span class="kanban-type">{latest_kanban.get('kanban_type', 'N/A')}</span>
                            <span class="kanban-status status-{latest_kanban.get('kanban_status', 'normal')}">
                                {latest_kanban.get('kanban_status', 'normal')}
                            </span>
                            <div class="kanban-metrics">
                                <span>在庫: {latest_kanban.get('current_stock', 0)}</span>
                                <span>発注点: {latest_kanban.get('reorder_point', 0)}</span>
                                <span>最大在庫: {latest_kanban.get('max_inventory', 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
"""
            
            html_content += """
            </div>
        </div>
"""
        
        # チャート表示
        html_content += """
        <!-- チャート表示 -->
        <div class="metric-card">
            <h3>📈 生産進捗推移</h3>
            <div class="chart-container">
                <canvas id="productionChart"></canvas>
            </div>
        </div>

        <div class="metric-card">
            <h3>⚙️ 設備稼働率推移</h3>
            <div class="chart-container">
                <canvas id="utilizationChart"></canvas>
            </div>
        </div>

        <!-- イベントタイムライン -->
        <div class="metric-card">
            <h3>📋 最新イベント</h3>
            <div class="event-timeline">
"""
        
        # 最新のイベントを表示
        recent_events = log.get('detailed_events', [])[-20:]  # 最新20件
        for event in reversed(recent_events):
            timestamp = event.get('timestamp', '')[:19]
            event_type = event.get('event_type', '')
            description = event.get('description', '')
            
            html_content += f"""
                <div class="event-item">
                    <div class="event-time">{timestamp}</div>
                    <div class="event-type">{event_type}</div>
                    <div class="event-description">{description}</div>
                </div>
"""
        
        # JavaScript for charts
        html_content += """
            </div>
        </div>
    </div>

    <script>
        // 生産進捗チャート
        const productionCtx = document.getElementById('productionChart').getContext('2d');
        new Chart(productionCtx, {
            type: 'line',
            data: {
                labels: ["""
        
        # チャートデータを生成
        if log.get('real_time_metrics', {}).get('production_progress'):
            for progress in log['real_time_metrics']['production_progress']:
                time_label = progress.get('timestamp', '')[:19]
                html_content += f'"{time_label}", '
        
        html_content += """],
                datasets: [{
                    label: '総生産数',
                    data: ["""
        
        if log.get('real_time_metrics', {}).get('production_progress'):
            for progress in log['real_time_metrics']['production_progress']:
                html_content += f"{progress.get('total_production', 0)}, "
        
        html_content += """],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // 設備稼働率チャート
        const utilizationCtx = document.getElementById('utilizationChart').getContext('2d');
        new Chart(utilizationCtx, {
            type: 'line',
            data: {
                labels: ["""
        
        if log.get('real_time_metrics', {}).get('equipment_utilization'):
            for utilization in log['real_time_metrics']['equipment_utilization']:
                time_label = utilization.get('timestamp', '')[:19]
                html_content += f'"{time_label}", '
        
        html_content += """],
                datasets: ["""
        
        if log.get('real_time_metrics', {}).get('equipment_utilization'):
            for i, (process_id, data) in enumerate(latest_utilization.get('utilization_data', {}).items()):
                if i > 0:
                    html_content += ","
                color = f"hsl({(i * 137.5) % 360}, 70%, 50%)"
                html_content += f"""
                    {{
                        label: '{data.get('name', process_id)}',
                        data: ["""
                
                for utilization in log['real_time_metrics']['equipment_utilization']:
                    util_data = utilization.get('utilization_data', {}).get(process_id, {})
                    html_content += f"{util_data.get('utilization_rate', 0)}, "
                
                html_content += f"""],
                        borderColor: '{color}',
                        backgroundColor: '{color.replace(')', ', 0.1)')}',
                        tension: 0.4
                    }}"""
        
        html_content += """
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    </script>
</body>
</html>
"""
        
        # HTMLファイルを保存
        html_filename = f"phase2_test_report_{timestamp}.html"
        html_filepath = os.path.join(output_dir, html_filename)
        
        with open(html_filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return html_filepath
        
    def _calculate_simulation_efficiency(self) -> float:
        """シミュレーション効率を計算"""
        total_events = len(self.phase2_test_log.get('detailed_events', []))
        simulation_time = self.env.now
        
        if simulation_time > 0:
            efficiency = min(100, (total_events / simulation_time) * 100)
            return round(efficiency, 1)
        return 0.0