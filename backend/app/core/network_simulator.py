"""
ネットワークベースシミュレーター
フロントエンドのNetworkEditorで作成されたネットワークデータに基づいて
動的に工場モデルを構築し、スケジューリング制御を実行する
"""
import simpy
import asyncio
import logging
import uuid
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)

from app.models.factory import Factory
from app.models.process import Process, ProcessInput, KanbanSettings, Equipment
from app.models.buffer import Buffer
from app.models.product import Product
from app.models.event import SimulationEvent

@dataclass
class NetworkNode:
    """ネットワークノードのデータ構造"""
    id: str
    type: str
    data: Dict[str, Any]
    position: Optional[Dict[str, float]] = None

@dataclass
class NetworkEdge:
    """ネットワークエッジのデータ構造"""
    id: str
    source: str
    target: str
    data: Dict[str, Any]

class NetworkBasedSimulator:
    """ネットワークベースシミュレーター"""
    
    def __init__(self, network_data: dict, start_time: datetime, speed: float = 1.0,
                 enable_scheduling_control: bool = True, enable_real_time_update: bool = True):
        self.network_data = network_data
        self.start_time = start_time
        self.speed = speed
        self.enable_scheduling_control = enable_scheduling_control
        self.enable_real_time_update = enable_real_time_update
        
        # シミュレーション環境
        self.env = simpy.Environment()
        self.is_running = False
        self.is_paused = False
        
        # 工場モデル
        self.factory: Optional[Factory] = None
        
        # ネットワーク解析結果
        self.nodes: List[NetworkNode] = []
        self.edges: List[NetworkEdge] = []
        self.products: List[Dict] = []
        self.bom_items: List[Dict] = []
        
        # シミュレーション結果
        self.simulation_id = str(uuid.uuid4())
        self.simulation_results = {}
        self.event_log = []
        self.scheduling_analysis = {}
        
        # イベントリスナー
        self.event_listeners: List[Callable] = []
        
        # ネットワークデータを解析
        self._parse_network_data()
        
        # 工場モデルを構築
        self._build_factory_model()
    
    def _parse_network_data(self):
        """ネットワークデータを解析"""
        # ノードの解析
        for node_data in self.network_data.get('nodes', []):
            node = NetworkNode(
                id=node_data.get('id'),
                type=node_data.get('type', 'unknown'),
                data=node_data.get('data', {}),
                position=node_data.get('position')
            )
            self.nodes.append(node)
        
        # エッジの解析
        for edge_data in self.network_data.get('edges', []):
            edge = NetworkEdge(
                id=edge_data.get('id'),
                source=edge_data.get('source'),
                target=edge_data.get('target'),
                data=edge_data.get('data', {})
            )
            self.edges.append(edge)
        
        # 製品とBOMの解析
        self.products = self.network_data.get('products', [])
        self.bom_items = self.network_data.get('bom_items', [])
        
        logger.info(f"Network analysis complete: {len(self.nodes)} nodes, {len(self.edges)} edges")
    
    def _build_factory_model(self):
        """ネットワークデータから工場モデルを構築"""
        self.factory = Factory(
            id=f"network_factory_{self.simulation_id[:8]}",
            name="ネットワークベース工場",
            description="NetworkEditorで作成されたネットワークから構築"
        )
        
        # 製品の追加
        self._add_products()
        
        # 工程の追加
        self._add_processes()
        
        # バッファの追加
        self._add_buffers()
        
        # 接続関係の設定
        self._setup_connections()
        
        logger.info(f"Factory model built: {len(self.factory.processes)} processes, {len(self.factory.buffers)} buffers")
    
    def _add_products(self):
        """製品を工場モデルに追加"""
        for product_data in self.products:
            product = Product(
                id=product_data.get('id', f"PROD_{len(self.factory.products)}"),
                name=product_data.get('name', 'Unknown Product'),
                type=product_data.get('type', 'component'),
                processing_time=product_data.get('processing_time', 60)
            )
            self.factory.add_product(product)
    
    def _add_processes(self):
        """工程を工場モデルに追加"""
        for node in self.nodes:
            if node.type in ['machining', 'assembly', 'inspection', 'storage', 'shipping', 'kitting']:
                process = self._create_process_from_node(node)
                self.factory.add_process(process)
    
    def _create_process_from_node(self, node: NetworkNode) -> Process:
        """ノードから工程を作成"""
        data = node.data
        
        process = Process(
            id=node.id,
            name=data.get('label', data.get('name', f'Process_{node.id}')),
            type=node.type,
            processing_time=self._extract_processing_times(data)
        )
        
        # 設備の追加
        equipment_count = data.get('equipmentCount', 1)
        for i in range(equipment_count):
            equipment = Equipment(
                id=f"{node.id}_EQ_{i+1}",
                name=f"{data.get('label', 'Equipment')} {i+1}",
                process_id=node.id,
                capacity=1,
                setup_time=data.get('setupTime', 0)
            )
            process.add_equipment(equipment)
        
        # 入力材料の設定
        if self.enable_scheduling_control:
            process.inputs = self._create_process_inputs(node)
        
        # 出力製品の設定
        process.outputs = self._create_process_outputs(node)
        
        return process
    
    def _extract_processing_times(self, data: Dict[str, Any]) -> Dict[str, float]:
        """処理時間を抽出"""
        processing_times = {}
        
        # サイクルタイムから処理時間を計算
        cycle_time = data.get('cycleTime', 60)
        
        # 製品IDが特定できない場合はデフォルト値を使用
        default_product_id = f"PRODUCT_{len(processing_times)}"
        processing_times[default_product_id] = cycle_time
        
        return processing_times
    
    def _create_process_inputs(self, node: NetworkNode) -> List[ProcessInput]:
        """工程の入力材料を作成"""
        inputs = []
        data = node.data
        
        # 前工程からの入力材料を特定
        incoming_edges = [edge for edge in self.edges if edge.target == node.id]
        
        for edge in incoming_edges:
            source_node = next((n for n in self.nodes if n.id == edge.source), None)
            if source_node and source_node.type in ['machining', 'assembly', 'inspection']:
                # 前工程の出力製品を入力材料として設定
                input_material = ProcessInput(
                    from_process_id=edge.source,
                    product_id=f"PRODUCT_{edge.source}",
                    required_quantity=1,
                    scheduling_mode=data.get('schedulingMode', 'push'),
                    batch_size=data.get('batchSize', 1),
                    min_batch_size=data.get('minBatchSize', 1),
                    max_batch_size=data.get('maxBatchSize', 100),
                    input_buffer_id=f"BUF_{edge.source}",
                    safety_stock=data.get('safetyStock', 0),
                    max_capacity=data.get('maxCapacity', 100)
                )
                
                # かんばん設定の追加
                if data.get('kanbanEnabled', False):
                    input_material.kanban_settings = KanbanSettings(
                        enabled=True,
                        card_count=data.get('kanbanCardCount', 5),
                        reorder_point=data.get('reorderPoint', 10),
                        max_inventory=data.get('maxInventory', 50),
                        supplier_lead_time=data.get('supplierLeadTime', 3),
                        kanban_type=data.get('kanbanType', 'production')
                    )
                
                inputs.append(input_material)
        
        return inputs
    
    def _create_process_outputs(self, node: NetworkNode) -> List[Dict[str, Any]]:
        """工程の出力製品を作成"""
        outputs = []
        data = node.data
        
        # 出力製品の設定
        output_product = {
            "product_id": f"PRODUCT_{node.id}",
            "quantity": 1,
            "lot_size_min": data.get('minBatchSize', 1),
            "lot_size_standard": data.get('batchSize', 10),
            "lot_size_max": data.get('maxBatchSize', 100)
        }
        outputs.append(output_product)
        
        return outputs
    
    def _add_buffers(self):
        """バッファを工場モデルに追加"""
        # 各工程の入力・出力バッファを作成
        for process in self.factory.processes.values():
            # 入力バッファ
            input_buffer = Buffer(
                id=f"BUF_IN_{process.id}",
                name=f"{process.name}入力バッファ",
                location_type="process_input",
                buffer_type="input"
            )
            self.factory.add_buffer(input_buffer)
            process.input_buffer_id = input_buffer.id
            
            # 出力バッファ
            output_buffer = Buffer(
                id=f"BUF_OUT_{process.id}",
                name=f"{process.name}出力バッファ",
                location_type="process_output",
                buffer_type="output"
            )
            self.factory.add_buffer(output_buffer)
            process.output_buffer_id = output_buffer.id
    
    def _setup_connections(self):
        """工程間の接続関係を設定"""
        for edge in self.edges:
            source_process = self.factory.processes.get(edge.source)
            target_process = self.factory.processes.get(edge.target)
            
            if source_process and target_process:
                # 搬送時間の設定
                transport_time = edge.data.get('transportTime', 10)
                transport_lot_size = edge.data.get('transportLotSize', 1)
                
                # 接続情報を記録
                connection_info = {
                    "source": edge.source,
                    "target": edge.target,
                    "transport_time": transport_time,
                    "transport_lot_size": transport_lot_size,
                    "transport_type": edge.data.get('transportType', 'conveyor')
                }
                
                # 工場の接続情報に追加
                if not hasattr(self.factory, 'connections'):
                    self.factory.connections = {}
                self.factory.connections[edge.id] = connection_info
    
    async def run_simulation(self, duration: float):
        """シミュレーションを非同期で実行（イベントループをブロックしない）"""
        self.is_running = True
        self.is_paused = False
        self._duration = duration

        logger.info(f"Network-based simulation started: {duration}s")

        try:
            # シミュレーション環境を初期化
            self._initialize_simulation()

            # SimPyをステップ実行して非同期で進める
            step_size = 1.0  # 1秒ずつ進める
            while self.is_running and self.env.now < duration:
                # SimPyを1ステップ進める
                next_time = min(self.env.now + step_size, duration)
                self.env.run(until=next_time)

                # イベントリスナーに進捗を通知
                for listener in self.event_listeners:
                    try:
                        if asyncio.iscoroutinefunction(listener):
                            await listener(SimulationEvent(
                                timestamp=self.start_time + timedelta(seconds=self.env.now),
                                event_type="progress_update",
                                data={"simulation_time": self.env.now, "progress": self.env.now / duration},
                            ))
                    except Exception:
                        pass

                # イベントループに制御を戻す
                await asyncio.sleep(0)

            # 結果を収集
            self._collect_simulation_results()
            self.is_running = False

            logger.info(f"Simulation completed: {duration}s")

        except Exception as e:
            logger.error(f"Simulation error: {e}")
            self.is_running = False
            raise
    
    def _initialize_simulation(self):
        """シミュレーション環境を初期化"""
        # 各工程のプロセスを開始
        for process in self.factory.processes.values():
            self.env.process(self._run_process(process))
        
        # 初期在庫を設定
        self._setup_initial_inventory()
        
        # スケジューリング制御を開始
        if self.enable_scheduling_control:
            self.env.process(self._run_scheduling_control())
    
    def _run_process(self, process: Process):
        """工程のプロセスを実行"""
        while self.is_running:
            try:
                # 利用可能な設備を取得
                equipment = process.get_available_equipment()
                if not equipment:
                    yield self.env.timeout(1)
                    continue
                
                # 入力材料の確認
                if not self._check_input_materials(process):
                    yield self.env.timeout(5)
                    continue
                
                # 処理開始
                equipment.status = "running"
                self._log_event("process_start", process.id, equipment.id)
                
                # 処理時間
                processing_time = self._get_processing_time(process)
                yield self.env.timeout(processing_time)
                
                # 処理完了
                equipment.status = "idle"
                self._log_event("process_complete", process.id, equipment.id)
                
                # 出力バッファに製品を追加
                self._add_output_product(process)
                
                # スケジューリング制御の更新
                if self.enable_scheduling_control:
                    self._update_scheduling_control(process)
                
            except Exception as e:
                logger.error(f"Process {process.id} error: {e}")
                yield self.env.timeout(10)
    
    def _check_input_materials(self, process: Process) -> bool:
        """入力材料の充足性を確認"""
        for input_material in process.inputs:
            buffer_id = input_material.input_buffer_id
            if buffer_id and buffer_id in self.factory.buffers:
                buffer = self.factory.buffers[buffer_id]
                current_stock = buffer.get_total_quantity()
                required_quantity = input_material.required_quantity
                
                if current_stock < required_quantity:
                    return False
        
        return True
    
    def _get_processing_time(self, process: Process) -> float:
        """工程の処理時間を取得"""
        # 最初の製品の処理時間を返す
        if process.processing_time:
            return list(process.processing_time.values())[0]
        return 60  # デフォルト値
    
    def _add_output_product(self, process: Process):
        """出力バッファに製品を追加"""
        if process.output_buffer_id and process.output_buffer_id in self.factory.buffers:
            buffer = self.factory.buffers[process.output_buffer_id]
            product_id = f"PRODUCT_{process.id}"
            
            buffer.add_lot(
                product_id,
                f"LOT_{int(self.env.now)}_{process.id}",
                1,
                process.id
            )
    
    def _run_scheduling_control(self):
        """スケジューリング制御を実行"""
        while self.is_running:
            try:
                # 各工程のスケジューリング制御を実行
                for process in self.factory.processes.values():
                    self._execute_scheduling_control(process)
                
                # 制御間隔
                yield self.env.timeout(10)
                
            except Exception as e:
                logger.error(f"Scheduling control error: {e}")
                yield self.env.timeout(30)
    
    def _execute_scheduling_control(self, process: Process):
        """工程のスケジューリング制御を実行"""
        for input_material in process.inputs:
            if input_material.scheduling_mode == "push":
                self._execute_push_control(process, input_material)
            elif input_material.scheduling_mode == "pull":
                self._execute_pull_control(process, input_material)
            elif input_material.scheduling_mode == "hybrid":
                self._execute_hybrid_control(process, input_material)
    
    def _execute_push_control(self, process: Process, input_material: ProcessInput):
        """プッシュ型制御を実行"""
        # 上流工程からの自動供給
        source_process_id = input_material.from_process_id
        if source_process_id in self.factory.processes:
            source_process = self.factory.processes[source_process_id]
            # プッシュ制御のロジックを実装
            pass
    
    def _execute_pull_control(self, process: Process, input_material: ProcessInput):
        """プル型制御を実行"""
        # 下流工程からの要求に基づく供給
        buffer_id = input_material.input_buffer_id
        if buffer_id and buffer_id in self.factory.buffers:
            buffer = self.factory.buffers[buffer_id]
            current_stock = buffer.get_total_quantity()
            reorder_point = input_material.kanban_settings.reorder_point if input_material.kanban_settings else 10
            
            if current_stock <= reorder_point:
                # 発注指示を生成
                self._generate_order_request(process, input_material)
    
    def _execute_hybrid_control(self, process: Process, input_material: ProcessInput):
        """ハイブリッド型制御を実行"""
        # プッシュとプルの組み合わせ
        self._execute_push_control(process, input_material)
        self._execute_pull_control(process, input_material)
    
    def _generate_order_request(self, process: Process, input_material: ProcessInput):
        """発注要求を生成"""
        order_request = {
            "timestamp": self.env.now,
            "process_id": process.id,
            "material_id": input_material.product_id,
            "quantity": input_material.batch_size,
            "priority": "high" if input_material.scheduling_mode == "pull" else "normal"
        }
        
        # 発注要求を記録
        if "order_requests" not in self.simulation_results:
            self.simulation_results["order_requests"] = []
        self.simulation_results["order_requests"].append(order_request)
    
    def _setup_initial_inventory(self):
        """初期在庫を設定"""
        logger.info(f"Setting initial inventory: {len(self.factory.buffers)} buffers")
        
        # 全ての入力バッファに初期在庫を設定
        for buffer in self.factory.buffers.values():
            if "IN" in buffer.id:  # 入力バッファ
                # 初期在庫を設定
                buffer.add_lot("INITIAL_PRODUCT", "LOT_INITIAL", 50, "initial")
                logger.debug(f"Initial inventory added: {buffer.id} = 50")
        
        # 開始工程（入力接続がない工程）を特定して追加在庫投入
        start_processes = []
        for process in self.factory.processes.values():
            incoming_edges = [edge for edge in self.edges if edge.target == process.id]
            if len(incoming_edges) == 0:
                start_processes.append(process)
        
        logger.info(f"Start processes identified: {len(start_processes)}")
        for process in start_processes:
            buffer_id = f"BUF_IN_{process.id}"
            if buffer_id in self.factory.buffers:
                buffer = self.factory.buffers[buffer_id]
                # 開始工程には大量の初期材料を投入
                buffer.add_lot("START_MATERIAL", "LOT_START", 100, "start_process")
                logger.debug(f"Start process material added: {process.id} = 100")
    
    def _log_event(self, event_type: str, process_id: str, equipment_id: str = None):
        """イベントを記録"""
        event = SimulationEvent(
            timestamp=self.start_time + timedelta(seconds=self.env.now),
            event_type=event_type,
            process_id=process_id,
            equipment_id=equipment_id,
            data={"simulation_time": self.env.now}
        )
        
        self.event_log.append(event)
        
        # イベントリスナーに通知
        for listener in self.event_listeners:
            try:
                if asyncio.iscoroutinefunction(listener):
                    asyncio.create_task(listener(event))
                else:
                    listener(event)
            except Exception as e:
                logger.error(f"Event listener error: {e}")
    
    def _update_scheduling_control(self, process: Process):
        """スケジューリング制御を更新"""
        # 工程の状態を更新
        if process.id not in self.scheduling_analysis:
            self.scheduling_analysis[process.id] = {}
        
        self.scheduling_analysis[process.id].update({
            "last_update": self.env.now,
            "status": "active",
            "input_materials": [
                {
                    "material_id": input_material.product_id,
                    "scheduling_mode": input_material.scheduling_mode,
                    "current_stock": self._get_material_stock(input_material),
                    "required_quantity": input_material.required_quantity
                }
                for input_material in process.inputs
            ]
        })
    
    def _get_material_stock(self, input_material: ProcessInput) -> int:
        """材料の現在在庫を取得"""
        buffer_id = input_material.input_buffer_id
        if buffer_id and buffer_id in self.factory.buffers:
            return self.factory.buffers[buffer_id].get_total_quantity()
        return 0
    
    def _collect_simulation_results(self):
        """シミュレーション結果を収集"""
        self.simulation_results.update({
            "simulation_id": self.simulation_id,
            "start_time": self.start_time.isoformat(),
            "end_time": (self.start_time + timedelta(seconds=self.env.now)).isoformat(),
            "duration": self.env.now,
            "total_events": len(self.event_log),
            "production_summary": self._get_production_summary(),
            "scheduling_analysis": self.scheduling_analysis,
            "network_performance": self._get_network_performance(),
            "created_at": datetime.now().isoformat()
        })
    
    def _get_production_summary(self) -> Dict[str, Any]:
        """生産サマリーを取得"""
        summary = {
            "total_production": 0,
            "process_production": {},
            "buffer_inventory": {}
        }
        
        # 各工程の生産数を集計
        for process in self.factory.processes.values():
            if process.output_buffer_id and process.output_buffer_id in self.factory.buffers:
                buffer = self.factory.buffers[process.output_buffer_id]
                production_count = buffer.get_total_quantity()
                summary["process_production"][process.id] = production_count
                summary["total_production"] += production_count
        
        # 各バッファの在庫数を集計
        for buffer in self.factory.buffers.values():
            summary["buffer_inventory"][buffer.id] = buffer.get_total_quantity()
        
        return summary
    
    def _get_network_performance(self) -> Dict[str, Any]:
        """ネットワーク性能を取得"""
        performance = {
            "total_processes": len(self.factory.processes),
            "total_buffers": len(self.factory.buffers),
            "total_connections": len(self.edges),
            "scheduling_modes": {},
            "kanban_usage": 0
        }
        
        # スケジューリング方式の統計
        for process in self.factory.processes.values():
            for input_material in process.inputs:
                mode = input_material.scheduling_mode
                performance["scheduling_modes"][mode] = performance["scheduling_modes"].get(mode, 0) + 1
                
                if input_material.kanban_settings and input_material.kanban_settings.enabled:
                    performance["kanban_usage"] += 1
        
        return performance
    
    async def stop(self):
        """シミュレーションを停止"""
        self.is_running = False
        logger.info(f"Simulation stopped: {self.simulation_id}")
    
    def get_status(self) -> str:
        """シミュレーションの状態を取得"""
        if self.is_running:
            return "running"
        elif self.is_paused:
            return "paused"
        else:
            return "stopped"
    
    def get_current_time(self) -> str:
        """現在のシミュレーション時刻を取得"""
        return (self.start_time + timedelta(seconds=self.env.now)).isoformat()
    
    def get_progress(self) -> float:
        """シミュレーションの進捗を取得"""
        duration = getattr(self, "_duration", 0)
        if duration > 0:
            return min(self.env.now / duration, 1.0)
        return 0.0
    
    def get_production_summary(self) -> Dict[str, Any]:
        """生産サマリーを取得"""
        return self._get_production_summary()
    
    def get_scheduling_analysis(self) -> Dict[str, Any]:
        """スケジューリング分析を取得"""
        return self.scheduling_analysis
    
    def get_simulation_results(self) -> Dict[str, Any]:
        """シミュレーション結果を取得"""
        return self.simulation_results
    
    def add_event_listener(self, listener: Callable):
        """イベントリスナーを追加"""
        self.event_listeners.append(listener)
    
    def remove_event_listener(self, listener: Callable):
        """イベントリスナーを削除"""
        if listener in self.event_listeners:
            self.event_listeners.remove(listener)
