"""
プロジェクトデータをシミュレーションモデルに変換する機能
NetworkEditorのプロジェクトデータをFactory/Process/Bufferモデルに変換
"""
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

from app.models.factory import Factory
from app.models.process import Process, Equipment
from app.models.product import Product
from app.models.buffer import Buffer
from app.core.resource_manager import ResourceManager

logger = logging.getLogger(__name__)

class ProjectDataConverter:
    """プロジェクトデータをシミュレーション用モデルに変換"""
    
    def __init__(self):
        self.resource_manager = ResourceManager()
    
    async def convert_project_to_factory(self, project_data: Dict[str, Any], project_id: str = "default") -> Factory:
        """プロジェクトデータをFactoryモデルに変換"""
        try:
            # プロジェクトデータの構造を解析
            nodes = project_data.get('nodes', [])
            edges = project_data.get('edges', [])
            products = project_data.get('products', [])
            bom_items = project_data.get('bom_items', [])
            
            logger.info(f"プロジェクトデータ変換開始: nodes={len(nodes)}, edges={len(edges)}, products={len(products)}")
            
            # サンプルデータが空の場合、デモ用データを生成
            if not nodes and not edges:
                logger.info("空のプロジェクトデータ - デモ用データを生成")
                return await self._create_demo_factory(project_id)
            
            # Factoryインスタンスを作成
            factory = Factory(
                id=project_id,
                name=f"Factory_{project_id}",
                description="NetworkEditorプロジェクトから変換されたファクトリー",
                location="Default Location"
            )
            
            # プロダクトを変換
            converted_products = await self._convert_products(products)
            for product in converted_products:
                factory.add_product(product)
            
            # ノードをProcess/Bufferに変換
            processes, buffers = await self._convert_nodes_to_components(nodes)
            
            # プロセスを追加
            for process in processes:
                factory.add_process(process)
            
            # バッファを追加
            for buffer in buffers:
                factory.add_buffer(buffer)
            
            # エッジを接続情報として設定
            await self._apply_connections(factory, edges)
            
            logger.info(f"Factory変換完了: processes={len(processes)}, buffers={len(buffers)}")
            return factory
            
        except Exception as e:
            logger.error(f"プロジェクトデータ変換エラー: {e}")
            # フォールバック: デモ用ファクトリーを返す
            return await self._create_demo_factory(project_id)
    
    async def _convert_products(self, products_data: List[Dict]) -> List[Product]:
        """プロダクトデータを変換"""
        converted_products = []
        
        for product_data in products_data:
            product = Product(
                id=product_data.get('id', f"product_{len(converted_products)}"),
                name=product_data.get('name', f"Product {len(converted_products)}"),
                properties=product_data.get('properties', {}),
                bom_id=product_data.get('bom_id')
            )
            converted_products.append(product)
        
        # サンプルプロダクトがない場合はデフォルトを追加
        if not converted_products:
            converted_products.append(Product(
                id="product_a",
                name="製品A",
                properties={"type": "main_product", "priority": 1}
            ))
        
        return converted_products
    
    async def _convert_nodes_to_components(self, nodes: List[Dict]) -> tuple[List[Process], List[Buffer]]:
        """ノードをProcess/Bufferコンポーネントに変換"""
        processes = []
        buffers = []
        
        for node in nodes:
            node_type = node.get('type', 'process')
            node_id = node.get('id', f"node_{len(processes) + len(buffers)}")
            
            if node_type in ['process', 'manufacturing', 'assembly']:
                process = await self._create_process_from_node(node)
                processes.append(process)
            elif node_type in ['buffer', 'storage', 'warehouse', 'store']:
                buffer = await self._create_buffer_from_node(node)
                buffers.append(buffer)
            else:
                # デフォルトはプロセスとして扱う
                process = await self._create_process_from_node(node)
                processes.append(process)
        
        return processes, buffers
    
    async def _create_process_from_node(self, node: Dict) -> Process:
        """ノードからProcessを作成"""
        node_id = node.get('id', 'default_process')
        name = node.get('label', node.get('name', f"Process {node_id}"))
        
        # 処理時間を取得（秒単位）
        processing_time = {}
        if 'processingTime' in node:
            processing_time['default'] = float(node['processingTime'])
        elif 'data' in node and 'processingTime' in node['data']:
            processing_time['default'] = float(node['data']['processingTime'])
        else:
            processing_time['default'] = 60.0  # デフォルト1分
        
        # 設備を作成
        equipment_count = node.get('equipmentCount', 1)
        equipments = []
        for i in range(equipment_count):
            equipment = Equipment(
                id=f"{node_id}_eq_{i}",
                name=f"{name} 設備{i+1}",
                status="idle",
                capacity=1.0
            )
            equipments.append(equipment)
        
        process = Process(
            id=node_id,
            name=name,
            processing_time=processing_time,
            equipments=equipments,
            input_buffers=[],
            output_buffers=[],
            quality_parameters=node.get('quality', {}),
            setup_time=node.get('setupTime', 0.0)
        )
        
        return process
    
    async def _create_buffer_from_node(self, node: Dict) -> Buffer:
        """ノードからBufferを作成"""
        node_id = node.get('id', 'default_buffer')
        name = node.get('label', node.get('name', f"Buffer {node_id}"))
        
        # 容量を取得
        capacity = node.get('capacity', node.get('maxCapacity', 100))
        initial_quantity = node.get('initialQuantity', 0)
        buffer_type = node.get('bufferType', 'intermediate')
        
        buffer = Buffer(
            id=node_id,
            name=name,
            capacity=capacity,
            current_quantity=initial_quantity,
            buffer_type=buffer_type,
            location=node.get('position', {'x': 0, 'y': 0})
        )
        
        return buffer
    
    async def _apply_connections(self, factory: Factory, edges: List[Dict]):
        """エッジ情報を基に接続を設定"""
        for edge in edges:
            source_id = edge.get('source', edge.get('from'))
            target_id = edge.get('target', edge.get('to'))
            
            if not source_id or not target_id:
                continue
            
            # ソースとターゲットのコンポーネントを取得
            source_component = factory.get_component_by_id(source_id)
            target_component = factory.get_component_by_id(target_id)
            
            if source_component and target_component:
                # プロセス → バッファの接続
                if isinstance(source_component, Process) and isinstance(target_component, Buffer):
                    source_component.output_buffers.append(target_id)
                # バッファ → プロセスの接続
                elif isinstance(source_component, Buffer) and isinstance(target_component, Process):
                    target_component.input_buffers.append(source_id)
                # プロセス → プロセスの直接接続（中間バッファを自動生成）
                elif isinstance(source_component, Process) and isinstance(target_component, Process):
                    intermediate_buffer_id = f"buffer_{source_id}_to_{target_id}"
                    intermediate_buffer = Buffer(
                        id=intermediate_buffer_id,
                        name=f"中間バッファ {source_component.name} → {target_component.name}",
                        capacity=50,
                        current_quantity=0,
                        buffer_type="intermediate"
                    )
                    factory.add_buffer(intermediate_buffer)
                    source_component.output_buffers.append(intermediate_buffer_id)
                    target_component.input_buffers.append(intermediate_buffer_id)
    
    async def _create_demo_factory(self, project_id: str) -> Factory:
        """デモ用のファクトリーを作成"""
        logger.info("デモ用ファクトリーを作成中...")
        
        factory = Factory(
            id=project_id,
            name="デモファクトリー",
            description="シミュレーションデモ用のサンプルファクトリー",
            location="Tokyo, Japan"
        )
        
        # デモ製品
        product_a = Product(
            id="product_a",
            name="製品A",
            properties={"type": "main_product", "priority": 1}
        )
        factory.add_product(product_a)
        
        # 原材料バッファ
        raw_material_buffer = Buffer(
            id="raw_materials",
            name="原材料倉庫",
            capacity=1000,
            current_quantity=500,
            buffer_type="input"
        )
        factory.add_buffer(raw_material_buffer)
        
        # 加工工程1
        equipment_1 = Equipment(id="eq_cutting_1", name="切断機1", status="idle", capacity=1.0)
        cutting_process = Process(
            id="cutting_process",
            name="切断工程",
            processing_time={"product_a": 30.0},  # 30秒
            equipments=[equipment_1],
            input_buffers=["raw_materials"],
            output_buffers=["semi_finished"],
            quality_parameters={"defect_rate": 0.02}
        )
        factory.add_process(cutting_process)
        
        # 中間バッファ
        semi_finished_buffer = Buffer(
            id="semi_finished",
            name="仕掛品倉庫",
            capacity=200,
            current_quantity=50,
            buffer_type="intermediate"
        )
        factory.add_buffer(semi_finished_buffer)
        
        # 加工工程2
        equipment_2a = Equipment(id="eq_assembly_1", name="組立機1", status="idle", capacity=1.0)
        equipment_2b = Equipment(id="eq_assembly_2", name="組立機2", status="idle", capacity=1.0)
        assembly_process = Process(
            id="assembly_process",
            name="組立工程",
            processing_time={"product_a": 45.0},  # 45秒
            equipments=[equipment_2a, equipment_2b],
            input_buffers=["semi_finished"],
            output_buffers=["finished_goods"],
            quality_parameters={"defect_rate": 0.01}
        )
        factory.add_process(assembly_process)
        
        # 完成品バッファ
        finished_goods_buffer = Buffer(
            id="finished_goods",
            name="完成品倉庫",
            capacity=300,
            current_quantity=20,
            buffer_type="output"
        )
        factory.add_buffer(finished_goods_buffer)
        
        # 検査工程
        equipment_3 = Equipment(id="eq_inspection_1", name="検査機1", status="idle", capacity=1.0)
        inspection_process = Process(
            id="inspection_process",
            name="検査工程",
            processing_time={"product_a": 15.0},  # 15秒
            equipments=[equipment_3],
            input_buffers=["finished_goods"],
            output_buffers=["shipping"],
            quality_parameters={"defect_detection_rate": 0.95}
        )
        factory.add_process(inspection_process)
        
        # 出荷バッファ
        shipping_buffer = Buffer(
            id="shipping",
            name="出荷エリア",
            capacity=100,
            current_quantity=0,
            buffer_type="output"
        )
        factory.add_buffer(shipping_buffer)
        
        logger.info(f"デモファクトリー作成完了: processes={len(factory.processes)}, buffers={len(factory.buffers)}")
        return factory

    async def load_project_data(self, project_id: str) -> Dict[str, Any]:
        """プロジェクトデータを読み込み"""
        try:
            # 複数のプロジェクトファイルパスを試す
            possible_paths = [
                f"backend/data/projects/network_{project_id}.json",
                f"backend/data/projects/demo_project.json",  # デモプロジェクト
                f"data/projects/network_{project_id}.json"
            ]
            
            for project_file_path in possible_paths:
                try:
                    with open(project_file_path, 'r', encoding='utf-8') as f:
                        project_data = json.load(f)
                    logger.info(f"プロジェクトデータ読み込み成功: {project_file_path}")
                    return project_data
                except FileNotFoundError:
                    continue
            
            logger.warning(f"プロジェクトファイルが見つかりません: project_id={project_id}")
            # デフォルトの空データを返す
            return {
                "nodes": [],
                "edges": [],
                "products": [],
                "bom_items": [],
                "variants": []
            }
                
        except Exception as e:
            logger.error(f"プロジェクトデータ読み込みエラー: {e}")
            raise

# ヘルパー関数
async def convert_project_to_simulation_model(project_id: str) -> Factory:
    """プロジェクトIDからシミュレーション用Factoryモデルを作成"""
    converter = ProjectDataConverter()
    project_data = await converter.load_project_data(project_id)
    factory = await converter.convert_project_to_factory(project_data, project_id)
    return factory
