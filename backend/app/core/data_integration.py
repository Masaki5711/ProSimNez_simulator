"""
フロントエンドデータ統合システム
NetworkEditorのデータをシミュレーションエンジン用に変換
"""
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import json
import uuid
from pydantic import BaseModel, ValidationError

from app.models.factory import Factory, Connection
from app.models.process import Process, Equipment, ProcessInput, ProcessOutput
from app.models.product import Product
from app.models.buffer import Buffer
from app.core.resource_manager import ResourceManager, Equipment as ResourceEquipment, Worker, TransportResource

class NetworkEditorData(BaseModel):
    """NetworkEditorからのデータ構造"""
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    products: List[Dict[str, Any]] = []
    bom_items: List[Dict[str, Any]] = []
    variants: List[Dict[str, Any]] = []
    process_advanced_data: Dict[str, Any] = {}

class DataTransformationResult(BaseModel):
    """データ変換結果"""
    factory: Factory
    resource_manager: Any  # ResourceManagerは非Pydanticクラスのため
    validation_errors: List[str] = []
    warnings: List[str] = []
    statistics: Dict[str, Any] = {}
    
    class Config:
        arbitrary_types_allowed = True

class DataIntegrationEngine:
    """データ統合エンジン"""
    
    def __init__(self):
        self.transformation_rules = {
            'machining': self._transform_machining_process,
            'assembly': self._transform_assembly_process,
            'inspection': self._transform_inspection_process,
            'storage': self._transform_storage_process,
            'shipping': self._transform_shipping_process,
            'store': self._transform_store_process
        }
        
    async def transform_network_data(self, network_data: Dict[str, Any], 
                                   project_id: str) -> DataTransformationResult:
        """NetworkEditorデータをシミュレーション用に変換"""
        try:
            # データ構造の検証
            editor_data = NetworkEditorData(**network_data)
            
            # Factoryオブジェクトを作成
            factory = Factory(
                id=project_id,
                name=f"Project_{project_id}",
                description="NetworkEditorから変換されたファクトリ"
            )
            
            # ResourceManagerを作成
            resource_manager = ResourceManager()
            
            # 製品を変換
            products_map = await self._transform_products(editor_data.products, factory)
            
            # 工程を変換
            processes_map = await self._transform_processes(
                editor_data.nodes, 
                editor_data.process_advanced_data,
                factory, 
                resource_manager
            )
            
            # バッファを変換
            buffers_map = await self._transform_buffers(editor_data.nodes, factory)
            
            # 接続を変換
            connections_map = await self._transform_connections(
                editor_data.edges, 
                processes_map,
                factory
            )
            
            # BOMアイテムを変換
            await self._transform_bom_items(editor_data.bom_items, factory)
            
            # 製品バリエーションを変換
            await self._transform_variants(editor_data.variants, factory)
            
            # 統計情報を生成
            statistics = self._generate_statistics(factory, resource_manager)
            
            # 検証
            validation_errors = self._validate_factory(factory)
            warnings = self._generate_warnings(factory)
            
            return DataTransformationResult(
                factory=factory,
                resource_manager=resource_manager,
                validation_errors=validation_errors,
                warnings=warnings,
                statistics=statistics
            )
            
        except ValidationError as e:
            return DataTransformationResult(
                factory=Factory(id=project_id, name="Error", description=""),
                resource_manager=ResourceManager(),
                validation_errors=[f"データ構造エラー: {str(e)}"]
            )
        except Exception as e:
            return DataTransformationResult(
                factory=Factory(id=project_id, name="Error", description=""),
                resource_manager=ResourceManager(),
                validation_errors=[f"変換エラー: {str(e)}"]
            )
            
    async def _transform_products(self, products_data: List[Dict[str, Any]], 
                                 factory: Factory) -> Dict[str, Product]:
        """製品データを変換"""
        products_map = {}
        
        for product_data in products_data:
            try:
                product = Product(
                    id=product_data.get('id', str(uuid.uuid4())),
                    name=product_data.get('name', 'Unknown Product'),
                    code=product_data.get('code', ''),
                    type=product_data.get('type', 'finished_product'),
                    version=product_data.get('version', '1.0'),
                    description=product_data.get('description', ''),
                    unit_cost=product_data.get('unitCost', 0.0),
                    lead_time=product_data.get('leadTime', 0.0),
                    supplier=product_data.get('supplier', ''),
                    storage_conditions=product_data.get('storageConditions', ''),
                    quality_grade=product_data.get('qualityGrade', 'A')
                )
                
                factory.add_product(product)
                products_map[product.id] = product
                
            except Exception as e:
                print(f"製品変換エラー: {e}")
                
        return products_map
        
    async def _transform_processes(self, nodes_data: List[Dict[str, Any]],
                                  advanced_data: Dict[str, Any],
                                  factory: Factory,
                                  resource_manager: ResourceManager) -> Dict[str, Process]:
        """工程データを変換"""
        processes_map = {}
        
        for node_data in nodes_data:
            try:
                process_type = node_data.get('type', 'machining')
                transformation_func = self.transformation_rules.get(
                    process_type, 
                    self._transform_default_process
                )
                
                process = await transformation_func(
                    node_data, 
                    advanced_data.get(node_data.get('id', ''), {}),
                    factory,
                    resource_manager
                )
                
                if process:
                    factory.add_process(process)
                    processes_map[process.id] = process
                    
            except Exception as e:
                print(f"工程変換エラー: {e}")
                
        return processes_map
        
    async def _transform_machining_process(self, node_data: Dict[str, Any],
                                         advanced_data: Dict[str, Any],
                                         factory: Factory,
                                         resource_manager: ResourceManager) -> Process:
        """機械加工工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        # 基本工程データ
        process = Process(
            id=process_id,
            name=node_data.get('label', '機械加工'),
            type='machining'
        )
        
        # 処理時間設定
        cycle_time = node_data.get('cycleTime', 60)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # 設備を追加
        equipment_count = node_data.get('equipmentCount', 1)
        setup_time = node_data.get('setupTime', 0)
        
        for i in range(equipment_count):
            equipment_id = f"{process_id}_eq_{i+1}"
            equipment = Equipment(
                id=equipment_id,
                name=f"設備{i+1}",
                process_id=process_id,
                setup_time=setup_time
            )
            process.add_equipment(equipment)
            
            # ResourceManagerにも登録
            resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
            resource_equipment.setup_time = setup_time
            resource_manager.register_resource(resource_equipment)
            
        # 作業者を追加
        operator_count = node_data.get('operatorCount', 1)
        for i in range(operator_count):
            worker_id = f"{process_id}_worker_{i+1}"
            worker = Worker(worker_id, f"作業者{i+1}", ["machining"])
            resource_manager.register_resource(worker)
            
        # 入出力設定
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_assembly_process(self, node_data: Dict[str, Any],
                                        advanced_data: Dict[str, Any],
                                        factory: Factory,
                                        resource_manager: ResourceManager) -> Process:
        """組立工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', '組立'),
            type='assembly'
        )
        
        # サイクルタイム設定
        cycle_time = node_data.get('cycleTime', 120)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # 設備と作業者を追加
        equipment_count = node_data.get('equipmentCount', 1)
        operator_count = node_data.get('operatorCount', 2)
        setup_time = node_data.get('setupTime', 0)
        
        # 設備
        for i in range(equipment_count):
            equipment_id = f"{process_id}_eq_{i+1}"
            equipment = Equipment(
                id=equipment_id,
                name=f"組立設備{i+1}",
                process_id=process_id,
                setup_time=setup_time
            )
            process.add_equipment(equipment)
            
            resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
            resource_equipment.setup_time = setup_time
            resource_manager.register_resource(resource_equipment)
            
        # 作業者
        for i in range(operator_count):
            worker_id = f"{process_id}_worker_{i+1}"
            worker = Worker(worker_id, f"組立作業者{i+1}", ["assembly", "quality_check"])
            resource_manager.register_resource(worker)
            
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_inspection_process(self, node_data: Dict[str, Any],
                                          advanced_data: Dict[str, Any],
                                          factory: Factory,
                                          resource_manager: ResourceManager) -> Process:
        """検査工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', '検査'),
            type='inspection'
        )
        
        cycle_time = node_data.get('cycleTime', 30)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # 検査設備
        equipment_count = node_data.get('equipmentCount', 1)
        for i in range(equipment_count):
            equipment_id = f"{process_id}_eq_{i+1}"
            equipment = Equipment(
                id=equipment_id,
                name=f"検査設備{i+1}",
                process_id=process_id,
                setup_time=node_data.get('setupTime', 0)
            )
            process.add_equipment(equipment)
            
            resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
            resource_manager.register_resource(resource_equipment)
            
        # 検査員
        operator_count = node_data.get('operatorCount', 1)
        for i in range(operator_count):
            worker_id = f"{process_id}_worker_{i+1}"
            worker = Worker(worker_id, f"検査員{i+1}", ["inspection", "quality_control"])
            resource_manager.register_resource(worker)
            
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_storage_process(self, node_data: Dict[str, Any],
                                       advanced_data: Dict[str, Any],
                                       factory: Factory,
                                       resource_manager: ResourceManager) -> Process:
        """保管工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', '保管'),
            type='storage'
        )
        
        # 保管は短時間処理
        cycle_time = node_data.get('cycleTime', 10)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # 保管設備（クレーン、フォークリフト等）
        equipment_id = f"{process_id}_storage"
        equipment = Equipment(
            id=equipment_id,
            name="保管設備",
            process_id=process_id,
            capacity=node_data.get('inputBufferCapacity', 1000)
        )
        process.add_equipment(equipment)
        
        resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
        resource_manager.register_resource(resource_equipment)
        
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_shipping_process(self, node_data: Dict[str, Any],
                                        advanced_data: Dict[str, Any],
                                        factory: Factory,
                                        resource_manager: ResourceManager) -> Process:
        """出荷工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', '出荷'),
            type='shipping'
        )
        
        cycle_time = node_data.get('cycleTime', 300)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # 出荷設備
        equipment_count = node_data.get('equipmentCount', 1)
        for i in range(equipment_count):
            equipment_id = f"{process_id}_eq_{i+1}"
            equipment = Equipment(
                id=equipment_id,
                name=f"出荷設備{i+1}",
                process_id=process_id,
                setup_time=node_data.get('setupTime', 0)
            )
            process.add_equipment(equipment)
            
            resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
            resource_manager.register_resource(resource_equipment)
            
        # 出荷作業者
        operator_count = node_data.get('operatorCount', 3)
        for i in range(operator_count):
            worker_id = f"{process_id}_worker_{i+1}"
            worker = Worker(worker_id, f"出荷作業者{i+1}", ["shipping", "loading"])
            resource_manager.register_resource(worker)
            
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_store_process(self, node_data: Dict[str, Any],
                                     advanced_data: Dict[str, Any],
                                     factory: Factory,
                                     resource_manager: ResourceManager) -> Process:
        """ストア工程を変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', 'ストア'),
            type='store'
        )
        
        # ストアは即座に処理
        cycle_time = node_data.get('cycleTime', 1)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        # ストア設備
        equipment_id = f"{process_id}_store"
        equipment = Equipment(
            id=equipment_id,
            name="ストア",
            process_id=process_id,
            capacity=999999  # 無制限
        )
        process.add_equipment(equipment)
        
        resource_equipment = ResourceEquipment(equipment_id, equipment.name, process_id)
        resource_manager.register_resource(resource_equipment)
        
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _transform_default_process(self, node_data: Dict[str, Any],
                                       advanced_data: Dict[str, Any],
                                       factory: Factory,
                                       resource_manager: ResourceManager) -> Process:
        """デフォルト工程変換"""
        process_id = node_data.get('id', str(uuid.uuid4()))
        
        process = Process(
            id=process_id,
            name=node_data.get('label', 'プロセス'),
            type=node_data.get('type', 'machining')
        )
        
        cycle_time = node_data.get('cycleTime', 60)
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process.processing_time[output_id] = cycle_time
                
        await self._set_process_inputs_outputs(process, node_data, advanced_data)
        
        return process
        
    async def _set_process_inputs_outputs(self, process: Process, 
                                        node_data: Dict[str, Any],
                                        advanced_data: Dict[str, Any]):
        """工程の入出力を設定"""
        # 入力設定
        if 'inputs' in node_data:
            for input_id in node_data['inputs']:
                process_input = ProcessInput(
                    from_process_id="",  # 後で接続情報から設定
                    product_id=input_id,
                    required_quantity=1
                )
                process.inputs.append(process_input)
                
        # 出力設定
        if 'outputs' in node_data:
            for output_id in node_data['outputs']:
                process_output = ProcessOutput(
                    product_id=output_id,
                    quantity=1,
                    lot_size_standard=node_data.get('transportLotSize', 10)
                )
                process.outputs.append(process_output)
                
        # バッファID設定
        process.input_buffer_id = f"{process.id}_input_buffer"
        process.output_buffer_id = f"{process.id}_output_buffer"
        
    async def _transform_buffers(self, nodes_data: List[Dict[str, Any]], 
                               factory: Factory) -> Dict[str, Buffer]:
        """バッファを変換"""
        buffers_map = {}
        
        for node_data in nodes_data:
            process_id = node_data.get('id', '')
            
            # 入力バッファ
            input_buffer_id = f"{process_id}_input_buffer"
            input_capacity = node_data.get('inputBufferCapacity', 50)
            input_buffer = Buffer(
                id=input_buffer_id,
                name=f"{node_data.get('label', 'プロセス')}_入力バッファ",
                capacity=input_capacity,
                buffer_type="input"
            )
            factory.add_buffer(input_buffer)
            buffers_map[input_buffer_id] = input_buffer
            
            # 出力バッファ
            output_buffer_id = f"{process_id}_output_buffer"
            output_capacity = node_data.get('outputBufferCapacity', 50)
            output_buffer = Buffer(
                id=output_buffer_id,
                name=f"{node_data.get('label', 'プロセス')}_出力バッファ",
                capacity=output_capacity,
                buffer_type="output"
            )
            factory.add_buffer(output_buffer)
            buffers_map[output_buffer_id] = output_buffer
            
        return buffers_map
        
    async def _transform_connections(self, edges_data: List[Dict[str, Any]],
                                   processes_map: Dict[str, Process],
                                   factory: Factory) -> Dict[str, Connection]:
        """接続を変換"""
        connections_map = {}
        
        for edge_data in edges_data:
            try:
                connection_id = edge_data.get('id', str(uuid.uuid4()))
                source_id = edge_data.get('source', '')
                target_id = edge_data.get('target', '')
                
                # 接続データから搬送設定を取得
                transport_time = edge_data.get('transportTime', 0)
                transport_lot_size = edge_data.get('transportLotSize', 1)
                routing_rule = "FIFO"  # デフォルト
                
                # transportMethodsがある場合は最初の方法を使用
                if 'transportMethods' in edge_data and edge_data['transportMethods']:
                    first_method = edge_data['transportMethods'][0]
                    transport_time = first_method.get('transportTime', transport_time)
                    
                connection = Connection(
                    id=connection_id,
                    from_process_id=source_id,
                    to_process_id=target_id,
                    transport_time=transport_time,
                    transport_lot_size=transport_lot_size,
                    routing_rule=routing_rule
                )
                
                factory.add_connection(connection)
                connections_map[connection_id] = connection
                
            except Exception as e:
                print(f"接続変換エラー: {e}")
                
        return connections_map
        
    async def _transform_bom_items(self, bom_data: List[Dict[str, Any]], 
                                 factory: Factory):
        """BOMアイテムを変換"""
        # TODO: BOMアイテムの変換実装
        pass
        
    async def _transform_variants(self, variants_data: List[Dict[str, Any]], 
                                factory: Factory):
        """製品バリエーションを変換"""
        # TODO: バリエーションの変換実装
        pass
        
    def _generate_statistics(self, factory: Factory, 
                           resource_manager: ResourceManager) -> Dict[str, Any]:
        """統計情報を生成"""
        return {
            "processes_count": len(factory.processes),
            "products_count": len(factory.products),
            "buffers_count": len(factory.buffers),
            "connections_count": len(factory.connections),
            "resources_count": len(resource_manager.resources),
            "equipment_count": len(resource_manager.get_resources_by_type("equipment")),
            "worker_count": len(resource_manager.get_resources_by_type("worker")),
            "transport_count": len(resource_manager.get_resources_by_type("transport"))
        }
        
    def _validate_factory(self, factory: Factory) -> List[str]:
        """ファクトリの妥当性を検証"""
        errors = []
        
        # 基本検証
        if not factory.processes:
            errors.append("工程が定義されていません")
            
        if not factory.products:
            errors.append("製品が定義されていません")
            
        # ネットワーク検証
        network_errors = factory.validate_network()
        errors.extend(network_errors)
        
        # プロセス個別検証
        for process in factory.processes.values():
            if not process.equipments:
                errors.append(f"工程 {process.name} に設備が定義されていません")
                
            if not process.processing_time:
                errors.append(f"工程 {process.name} に処理時間が定義されていません")
                
        return errors
        
    def _generate_warnings(self, factory: Factory) -> List[str]:
        """警告を生成"""
        warnings = []
        
        # バッファ容量の警告
        for buffer in factory.buffers.values():
            if buffer.capacity < 10:
                warnings.append(f"バッファ {buffer.name} の容量が小さすぎる可能性があります")
                
        # 処理時間の警告
        for process in factory.processes.values():
            for product_id, time in process.processing_time.items():
                if time > 3600:  # 1時間以上
                    warnings.append(f"工程 {process.name} の処理時間が長すぎる可能性があります")
                    
        return warnings

class DynamicConfigurationManager:
    """動的設定管理"""
    
    def __init__(self, data_integration_engine: DataIntegrationEngine):
        self.integration_engine = data_integration_engine
        self.active_configurations: Dict[str, DataTransformationResult] = {}
        
    async def update_configuration(self, project_id: str, 
                                 network_data: Dict[str, Any]) -> DataTransformationResult:
        """設定を動的更新"""
        try:
            # 新しい設定を変換
            result = await self.integration_engine.transform_network_data(
                network_data, project_id
            )
            
            # 成功した場合のみ更新
            if not result.validation_errors:
                self.active_configurations[project_id] = result
                
            return result
            
        except Exception as e:
            return DataTransformationResult(
                factory=Factory(id=project_id, name="Error", description=""),
                resource_manager=ResourceManager(),
                validation_errors=[f"設定更新エラー: {str(e)}"]
            )
            
    def get_configuration(self, project_id: str) -> Optional[DataTransformationResult]:
        """設定を取得"""
        return self.active_configurations.get(project_id)
        
    def remove_configuration(self, project_id: str):
        """設定を削除"""
        if project_id in self.active_configurations:
            del self.active_configurations[project_id]
            
    def get_all_configurations(self) -> Dict[str, DataTransformationResult]:
        """全設定を取得"""
        return self.active_configurations.copy()
