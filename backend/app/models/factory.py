"""
工場モデル
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.models.process import Process
from app.models.buffer import Buffer
from app.models.product import Product

class Connection(BaseModel):
    """工程間接続"""
    id: str
    from_process_id: str
    to_process_id: str
    transport_time: float = 0.0  # 搬送時間（秒）
    transport_lot_size: Optional[int] = None  # 搬送ロットサイズ
    routing_rule: str = "FIFO"  # "FIFO", "priority", "kanban"

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
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }