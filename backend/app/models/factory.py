"""
工場モデル
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.models.process import Process
from app.models.buffer import Buffer
from app.models.product import Product

class ProductionPlan(BaseModel):
    """生産計画"""
    id: str
    product_id: str
    quantity: int
    due_date: datetime
    priority: int = 1  # 1=最高優先度
    customer_id: str = ""
    order_type: str = "standard"  # "standard", "rush", "kanban"
    created_at: datetime = datetime.now()
    status: str = "pending"  # "pending", "scheduled", "in_progress", "completed"
    
    # スケジューリング結果
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None

class FinishedProductStore(BaseModel):
    """完成品ストア"""
    id: str
    name: str
    description: str = ""
    capacity: int = 1000
    current_inventory: int = 0
    
    # 生産計画
    production_plans: List[ProductionPlan] = []
    
    # 接続情報
    connected_process_id: str = ""  # 最終工程のID
    
    def add_production_plan(self, plan: ProductionPlan):
        """生産計画を追加"""
        self.production_plans.append(plan)
        # 納期順にソート
        self.production_plans.sort(key=lambda x: (x.due_date, -x.priority))
    
    def get_next_production_plan(self) -> Optional[ProductionPlan]:
        """次の生産計画を取得"""
        for plan in self.production_plans:
            if plan.status == "pending":
                return plan
        return None
    
    def mark_plan_completed(self, plan_id: str):
        """計画を完了としてマーク"""
        for plan in self.production_plans:
            if plan.id == plan_id:
                plan.status = "completed"
                plan.actual_end = datetime.now()
                break

class Connection(BaseModel):
    """工程間接続"""
    id: str
    from_process_id: str
    to_process_id: str
    transport_time: float = 0.0  # 搬送時間（秒）
    transport_lot_size: Optional[int] = None  # 搬送ロットサイズ
    routing_rule: str = "FIFO"  # "FIFO", "priority", "kanban"
    
    # 搬送リソース情報
    transport_resource_id: Optional[str] = None
    transport_capacity: float = 1.0  # 同時搬送可能数
    
    def get_transport_duration(self) -> float:
        """搬送所要時間を取得（秒）"""
        return self.transport_time

class Factory(BaseModel):
    """工場全体モデル"""
    id: str
    name: str
    description: str = ""
    
    # 構成要素
    products: Dict[str, Product] = {}
    processes: Dict[str, Process] = {}
    buffers: Dict[str, Buffer] = {}
    connections: Dict[str, Connection] = {}
    finished_product_stores: Dict[str, FinishedProductStore] = {}
    
    # メタデータ
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_product(self, product: Product):
        """製品を追加"""
        self.products[product.id] = product
        
    def add_process(self, process: Process):
        """工程を追加"""
        self.processes[process.id] = process
        
    def add_buffer(self, buffer: Buffer):
        """バッファを追加"""
        self.buffers[buffer.id] = buffer
        
    def add_connection(self, connection: Connection):
        """接続を追加"""
        self.connections[connection.id] = connection
        
    def add_finished_product_store(self, store: FinishedProductStore):
        """完成品ストアを追加"""
        self.finished_product_stores[store.id] = store
        
    def get_upstream_processes(self, process_id: str) -> List[Process]:
        """上流工程を取得"""
        upstream = []
        for conn in self.connections.values():
            if conn.to_process_id == process_id:
                if conn.from_process_id in self.processes:
                    upstream.append(self.processes[conn.from_process_id])
        return upstream
        
    def get_downstream_processes(self, process_id: str) -> List[Process]:
        """下流工程を取得"""
        downstream = []
        for conn in self.connections.values():
            if conn.from_process_id == process_id:
                if conn.to_process_id in self.processes:
                    downstream.append(self.processes[conn.to_process_id])
        return downstream
        
    def get_connection_between(self, from_process_id: str, to_process_id: str) -> Optional[Connection]:
        """2つの工程間の接続を取得"""
        for conn in self.connections.values():
            if conn.from_process_id == from_process_id and conn.to_process_id == to_process_id:
                return conn
        return None
        
    def get_all_production_plans(self) -> List[ProductionPlan]:
        """全生産計画を取得（納期順）"""
        all_plans = []
        for store in self.finished_product_stores.values():
            all_plans.extend(store.production_plans)
        # 納期順にソート
        all_plans.sort(key=lambda x: (x.due_date, -x.priority))
        return all_plans
        
    def validate_network(self) -> List[str]:
        """ネットワークの妥当性を検証"""
        errors = []
        
        # 孤立した工程をチェック
        for process_id in self.processes:
            has_connection = False
            for conn in self.connections.values():
                if conn.from_process_id == process_id or conn.to_process_id == process_id:
                    has_connection = True
                    break
            if not has_connection:
                errors.append(f"工程 {process_id} が他の工程と接続されていません")
                
        # 完成品ストアの接続チェック
        for store_id, store in self.finished_product_stores.items():
            if not store.connected_process_id:
                errors.append(f"完成品ストア {store_id} が工程と接続されていません")
            elif store.connected_process_id not in self.processes:
                errors.append(f"完成品ストア {store_id} が存在しない工程 {store.connected_process_id} と接続されています")
                
        # 循環参照をチェック（簡易版）
        # TODO: より高度な循環検出アルゴリズムの実装
        
        return errors
    
    def get_component_by_id(self, component_id: str):
        """IDでコンポーネント（Process/Buffer）を取得"""
        # プロセスから検索
        if component_id in self.processes:
            return self.processes[component_id]
        
        # バッファから検索
        if component_id in self.buffers:
            return self.buffers[component_id]
            
        # 完成品ストアから検索
        if component_id in self.finished_product_stores:
            return self.finished_product_stores[component_id]
            
        return None
        
    def to_dict(self) -> Dict:
        """辞書形式に変換"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "products": {k: v.dict() for k, v in self.products.items()},
            "processes": {k: v.dict() for k, v in self.processes.items()},
            "buffers": {k: v.dict() for k, v in self.buffers.items()},
            "connections": {k: v.dict() for k, v in self.connections.items()},
            "finished_product_stores": {k: v.dict() for k, v in self.finished_product_stores.items()},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }