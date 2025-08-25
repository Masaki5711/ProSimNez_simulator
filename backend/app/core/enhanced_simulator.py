"""
強化された非同期シミュレーションエンジン
"""
import asyncio
import simpy
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime, timedelta
import json
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.models.factory import Factory
from app.models.process import Process
from app.models.product import Product
from app.models.event import SimulationEvent
from app.core.event_manager import EventManager, EventPriority, RealtimeEventHandler, StatisticsEventHandler
from app.core.resource_manager import ResourceManager, Equipment, Worker, TransportResource

class SimulationState:
    """シミュレーション状態管理"""
    
    def __init__(self):
        self.status = "idle"  # "idle", "running", "paused", "completed", "error"
        self.progress = 0.0
        self.current_time = 0.0
        self.target_duration = 0.0
        self.start_timestamp: Optional[datetime] = None
        self.end_timestamp: Optional[datetime] = None
        self.error_message: Optional[str] = None
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "progress": self.progress,
            "current_time": self.current_time,
            "target_duration": self.target_duration,
            "start_timestamp": self.start_timestamp.isoformat() if self.start_timestamp else None,
            "end_timestamp": self.end_timestamp.isoformat() if self.end_timestamp else None,
            "error_message": self.error_message
        }

class ProcessSimulator:
    """工程シミュレーター"""
    
    def __init__(self, process: Process, resource_manager: ResourceManager, 
                 event_manager: EventManager, env: simpy.Environment):
        self.process = process
        self.resource_manager = resource_manager
        self.event_manager = event_manager
        self.env = env
        self.is_active = True
        
    async def simulate_process(self):
        """工程をシミュレート"""
        while self.is_active:
            try:
                # 入力材料の待機
                await self._wait_for_materials()
                
                # リソースの確保
                equipment_id, worker_id = await self._allocate_resources()
                
                if equipment_id and worker_id:
                    # 段取り時間
                    await self._setup_process(equipment_id)
                    
                    # 加工処理
                    await self._execute_processing(equipment_id, worker_id)
                    
                    # リソース解放
                    await self._release_resources(equipment_id, worker_id)
                    
                    # 出力材料の生成
                    await self._produce_output()
                else:
                    # リソースが確保できない場合は少し待機
                    await asyncio.sleep(5)
                    
            except Exception as e:
                await self._emit_error_event(str(e))
                await asyncio.sleep(10)  # エラー時は長めに待機
                
    async def _wait_for_materials(self):
        """入力材料の待機"""
        if not self.process.input_buffer_id:
            return
            
        # 簡略化: 入力バッファに材料があるかチェック
        buffer = self.resource_manager.get_resource(self.process.input_buffer_id)
        while buffer and buffer.current_usage == 0:
            await asyncio.sleep(1)
            
    async def _allocate_resources(self) -> tuple[Optional[str], Optional[str]]:
        """リソースを確保"""
        # 設備を確保
        available_equipment = self.resource_manager.find_available_resources(
            resource_type="equipment",
            criteria={"process_id": self.process.id}
        )
        
        equipment_id = None
        if available_equipment:
            equipment = available_equipment[0]
            equipment_id = self.resource_manager.allocate_resource(
                equipment.resource_id, 
                self.process.id
            )
            
        # 作業者を確保
        available_workers = self.resource_manager.find_available_resources(
            resource_type="worker"
        )
        
        worker_id = None
        if available_workers:
            worker = available_workers[0]
            worker_id = self.resource_manager.allocate_resource(
                worker.resource_id,
                self.process.id
            )
            
        return equipment_id, worker_id
        
    async def _setup_process(self, equipment_id: str):
        """段取り処理"""
        equipment = self.resource_manager.get_resource(equipment_id)
        if equipment and hasattr(equipment, 'setup_time') and equipment.setup_time > 0:
            await self._emit_event("setup_start", equipment_id=equipment_id)
            await asyncio.sleep(equipment.setup_time)
            await self._emit_event("setup_complete", equipment_id=equipment_id)
            
    async def _execute_processing(self, equipment_id: str, worker_id: str):
        """加工処理実行"""
        await self._emit_event("process_start", equipment_id=equipment_id, worker_id=worker_id)
        
        # 処理時間を取得（デフォルト60秒）
        processing_time = 60
        if self.process.processing_time:
            processing_time = list(self.process.processing_time.values())[0]
            
        await asyncio.sleep(processing_time)
        
        await self._emit_event("process_complete", 
                             equipment_id=equipment_id, 
                             worker_id=worker_id,
                             data={"processing_time": processing_time})
        
    async def _release_resources(self, equipment_id: str, worker_id: str):
        """リソース解放"""
        if equipment_id:
            self.resource_manager.release_resource(equipment_id, equipment_id)
        if worker_id:
            self.resource_manager.release_resource(worker_id, worker_id)
            
    async def _produce_output(self):
        """出力材料の生成"""
        if self.process.output_buffer_id:
            buffer = self.resource_manager.get_resource(self.process.output_buffer_id)
            if buffer:
                # 簡略化: バッファに製品を追加
                await self._emit_event("product_created", 
                                     data={"buffer_id": self.process.output_buffer_id})
                
    async def _emit_event(self, event_type: str, **kwargs):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            process_id=self.process.id,
            **kwargs
        )
        await self.event_manager.emit_event(event)
        
    async def _emit_error_event(self, error_message: str):
        """エラーイベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type="process_error",
            process_id=self.process.id,
            data={"error": error_message}
        )
        await self.event_manager.emit_event(event, EventPriority.CRITICAL)

class EnhancedSimulationEngine:
    """強化されたシミュレーションエンジン"""
    
    def __init__(self, factory: Factory, 
                 websocket_manager=None, 
                 redis_client=None):
        self.factory = factory
        self.env = simpy.Environment()
        self.state = SimulationState()
        
        # 管理システム
        self.event_manager = EventManager()
        self.resource_manager = ResourceManager()
        
        # プロセスシミュレーター
        self.process_simulators: Dict[str, ProcessSimulator] = {}
        
        # 非同期実行用
        self.executor = ThreadPoolExecutor(max_workers=4)
        self.simulation_task: Optional[asyncio.Task] = None
        
        # ハンドラーの設定
        self._setup_event_handlers(websocket_manager, redis_client)
        
        # リソースの初期化
        self._initialize_resources()
        
    def _setup_event_handlers(self, websocket_manager, redis_client):
        """イベントハンドラーを設定"""
        # リアルタイムハンドラー
        if websocket_manager:
            realtime_handler = RealtimeEventHandler(websocket_manager, redis_client)
            self.event_manager.register_handler(realtime_handler)
            
        # 統計ハンドラー
        stats_handler = StatisticsEventHandler()
        self.event_manager.register_handler(stats_handler)
        
    def _initialize_resources(self):
        """リソースを初期化"""
        # 工程の設備を登録
        for process in self.factory.processes.values():
            for equipment in process.equipments.values():
                resource = Equipment(equipment.id, equipment.name, process.id)
                resource.setup_time = equipment.setup_time
                self.resource_manager.register_resource(resource)
                
        # TODO: 作業者、搬送リソースの初期化
        
    def _initialize_process_simulators(self):
        """プロセスシミュレーターを初期化"""
        for process in self.factory.processes.values():
            simulator = ProcessSimulator(
                process, 
                self.resource_manager, 
                self.event_manager, 
                self.env
            )
            self.process_simulators[process.id] = simulator
            
    async def start_simulation(self, duration: float = 3600.0) -> bool:
        """シミュレーションを開始"""
        try:
            if self.state.status == "running":
                return False
                
            self.state.status = "running"
            self.state.start_timestamp = datetime.now()
            self.state.target_duration = duration
            self.state.progress = 0.0
            self.state.error_message = None
            
            # イベント管理開始
            await self.event_manager.start_processing()
            
            # プロセスシミュレーター初期化
            self._initialize_process_simulators()
            
            # シミュレーション開始イベント
            await self._emit_simulation_event("simulation_started")
            
            # シミュレーションタスクを開始
            self.simulation_task = asyncio.create_task(
                self._run_simulation_loop(duration)
            )
            
            return True
            
        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            return False
            
    async def _run_simulation_loop(self, duration: float):
        """シミュレーションメインループ"""
        try:
            # プロセスシミュレーターを開始
            tasks = []
            for simulator in self.process_simulators.values():
                task = asyncio.create_task(simulator.simulate_process())
                tasks.append(task)
                
            # 進捗更新タスク
            progress_task = asyncio.create_task(self._update_progress(duration))
            tasks.append(progress_task)
            
            # 統計更新タスク
            stats_task = asyncio.create_task(self._update_statistics())
            tasks.append(stats_task)
            
            # タスクを実行
            await asyncio.gather(*tasks, return_exceptions=True)
            
        except Exception as e:
            self.state.status = "error"
            self.state.error_message = str(e)
            await self._emit_simulation_event("simulation_error", {"error": str(e)})
            
        finally:
            # クリーンアップ
            await self._cleanup_simulation()
            
    async def _update_progress(self, duration: float):
        """進捗を更新"""
        start_time = datetime.now()
        
        while self.state.status == "running":
            elapsed = (datetime.now() - start_time).total_seconds()
            self.state.current_time = elapsed
            self.state.progress = min((elapsed / duration) * 100, 100.0)
            
            # 進捗イベントを発行
            await self._emit_simulation_event("progress_update", {
                "progress": self.state.progress,
                "current_time": self.state.current_time
            })
            
            # 状態更新イベントを発行（KPI、在庫、設備状態を含む）
            await self._emit_simulation_event("state_update", {
                "simulation_time": self.state.current_time,
                "current_time": self.state.current_time,
                "elapsed_time": self.state.current_time,
                "inventories": self._collect_inventory_data(),
                "equipment_states": self._collect_equipment_states(),
                "kpis": self._collect_kpi_data()
            })
            
            # 完了チェック
            if elapsed >= duration:
                await self.stop_simulation()
                break
                
            await asyncio.sleep(1.0)  # 1秒ごとに更新
            
    async def _update_statistics(self):
        """統計を更新"""
        while self.state.status == "running":
            # リソース稼働率レポート
            utilization_report = self.resource_manager.get_resource_utilization_report()
            
            # 統計イベントを発行
            await self._emit_simulation_event("statistics_update", {
                "resource_utilization": utilization_report,
                "timestamp": datetime.now().isoformat()
            })
            
            await asyncio.sleep(10.0)  # 10秒ごとに更新
            
    async def pause_simulation(self) -> bool:
        """シミュレーションを一時停止"""
        if self.state.status == "running":
            self.state.status = "paused"
            await self._emit_simulation_event("simulation_paused")
            return True
        return False
        
    async def resume_simulation(self) -> bool:
        """シミュレーションを再開"""
        if self.state.status == "paused":
            self.state.status = "running"
            await self._emit_simulation_event("simulation_resumed")
            return True
        return False
        
    async def stop_simulation(self) -> bool:
        """シミュレーションを停止"""
        if self.state.status in ["running", "paused"]:
            self.state.status = "completed"
            self.state.end_timestamp = datetime.now()
            self.state.progress = 100.0
            
            await self._emit_simulation_event("simulation_completed")
            await self._cleanup_simulation()
            return True
        return False
        
    async def _cleanup_simulation(self):
        """シミュレーション終了処理"""
        # プロセスシミュレーターを停止
        for simulator in self.process_simulators.values():
            simulator.is_active = False
            
        # イベント管理停止
        await self.event_manager.stop_processing()
        
        # タスクのキャンセル
        if self.simulation_task and not self.simulation_task.done():
            self.simulation_task.cancel()
            
    async def _emit_simulation_event(self, event_type: str, data: Dict[str, Any] = None):
        """シミュレーションイベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
        
    def get_simulation_state(self) -> Dict[str, Any]:
        """シミュレーション状態を取得"""
        return {
            "state": self.state.to_dict(),
            "factory_id": self.factory.id,
            "resource_count": len(self.resource_manager.resources),
            "process_count": len(self.process_simulators),
            "event_stats": self.event_manager.get_statistics()
        }
        
    def get_real_time_data(self) -> Dict[str, Any]:
        """リアルタイムデータを取得"""
        return {
            "timestamp": datetime.now().isoformat(),
            "simulation_state": self.get_simulation_state(),
            "resource_utilization": self.resource_manager.get_resource_utilization_report(),
            "recent_events": [
                event.to_dict() for event in 
                self.event_manager.get_event_history(limit=50)
            ]
        }
        
    async def update_factory_configuration(self, new_factory: Factory):
        """工場設定を動的更新"""
        # 実行中の場合は一時停止
        was_running = self.state.status == "running"
        if was_running:
            await self.pause_simulation()
            
        try:
            # 工場設定を更新
            self.factory = new_factory
            
            # リソースを再初期化
            self.resource_manager = ResourceManager()
            self._initialize_resources()
            
            # プロセスシミュレーターを再初期化
            self.process_simulators.clear()
            self._initialize_process_simulators()
            
            await self._emit_simulation_event("configuration_updated")
            
            # 実行中だった場合は再開
            if was_running:
                await self.resume_simulation()
                
            return True
            
        except Exception as e:
            self.state.status = "error"
            self.state.error_message = f"設定更新エラー: {str(e)}"
            return False
            
    def _collect_inventory_data(self) -> Dict[str, Any]:
        """在庫データを収集"""
        inventories = {}
        if hasattr(self.factory, 'buffers'):
            for buffer_id, buffer in self.factory.buffers.items():
                # シミュレーション進行に応じて在庫レベルを動的に変更
                base_quantity = getattr(buffer, 'quantity', 0)
                time_factor = max(1, int(self.state.current_time / 10))  # 10秒ごとに在庫変動
                
                # バッファータイプに応じた在庫変動
                if "INPUT" in buffer_id:
                    # 入力バッファは時間とともに減少
                    current_quantity = max(0, base_quantity - time_factor)
                elif "OUTPUT" in buffer_id or "FINAL" in buffer_id:
                    # 出力バッファは時間とともに増加
                    current_quantity = base_quantity + time_factor
                else:
                    # 中間バッファは変動
                    current_quantity = base_quantity + (time_factor % 10)
                
                inventories[buffer_id] = {
                    "total": current_quantity,
                    "products": getattr(buffer, 'products', {})
                }
        return inventories
        
    def _collect_equipment_states(self) -> Dict[str, Any]:
        """設備状態データを収集"""
        equipment_states = {}
        if hasattr(self.factory, 'processes'):
            for process_id, process in self.factory.processes.items():
                equipment_states[process_id] = {
                    "equipments": {}
                }
                if hasattr(process, 'equipments'):
                    for eq_id, equipment in process.equipments.items():
                        # シミュレーション時間に基づいて設備状態を動的に変更
                        time_cycle = int(self.state.current_time / 15)  # 15秒サイクル
                        
                        if time_cycle % 3 == 0:
                            status = "running"
                        elif time_cycle % 3 == 1:
                            status = "idle"
                        else:
                            status = "maintenance"
                            
                        equipment_states[process_id]["equipments"][eq_id] = {
                            "status": status,
                            "utilization": (time_cycle * 10) % 100,
                            "last_update": self.state.current_time
                        }
        return equipment_states
        
    def _collect_kpi_data(self) -> Dict[str, Any]:
        """KPIデータを収集"""
        total_production = 0
        running_equipment = 0
        total_equipment = 0
        
        # 生産数を計算
        if hasattr(self.factory, 'buffers'):
            for buffer_id, buffer in self.factory.buffers.items():
                if "FINAL" in buffer_id or "OUTPUT" in buffer_id:
                    total_production += getattr(buffer, 'quantity', 0)
        
        # 設備稼働率を計算
        if hasattr(self.factory, 'processes'):
            for process in self.factory.processes.values():
                if hasattr(process, 'equipments'):
                    for equipment in process.equipments.values():
                        total_equipment += 1
                        if getattr(equipment, 'status', 'idle') == 'running':
                            running_equipment += 1
        
        equipment_utilization = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
        
        return {
            "equipment_utilization": equipment_utilization,
            "total_production": total_production,
            "average_lead_time": self.state.current_time / max(total_production, 1) if total_production > 0 else 0
        }
