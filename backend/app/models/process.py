"""
工程モデル
"""
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
from datetime import datetime

class Equipment(BaseModel):
    """設備モデル"""
    id: str
    name: str
    process_id: str  # 所属工程ID
    capacity: int = 1  # 同時処理可能数
    setup_time: float = 0.0  # 段取り替え時間（秒）
    status: str = "idle"  # "idle", "running", "setup", "breakdown"
    current_product_id: Optional[str] = None
    current_lot_id: Optional[str] = None
    
    def get_state(self) -> Dict:
        """設備の状態を取得"""
        return {
            "status": self.status,
            "current_product": self.current_product_id,
            "current_lot": self.current_lot_id
        }

class KanbanSettings(BaseModel):
    """かんばん設定"""
    enabled: bool = False
    card_count: int = 5
    reorder_point: int = 10
    max_inventory: int = 50
    supplier_lead_time: int = 3
    kanban_type: str = "production"  # "production", "withdrawal", "supplier"

class ProcessInput(BaseModel):
    """工程入力定義（拡張版）"""
    from_process_id: str
    product_id: str
    required_quantity: int
    
    # スケジューリング設定
    scheduling_mode: str = "push"  # "push", "pull", "hybrid"
    batch_size: int = 1
    min_batch_size: int = 1
    max_batch_size: int = 100
    
    # かんばん設定
    kanban_settings: Optional[KanbanSettings] = None
    
    # バッファ設定
    input_buffer_id: Optional[str] = None
    safety_stock: int = 0
    max_capacity: int = 100

class ProcessOutput(BaseModel):
    """工程出力定義"""
    product_id: str
    quantity: int
    lot_size_min: int = 1
    lot_size_standard: int = 10
    lot_size_max: int = 100

class Process(BaseModel):
    """工程モデル"""
    id: str
    name: str
    type: str  # "machining", "assembly", "inspection", etc.
    equipments: Dict[str, Equipment] = {}
    inputs: List[ProcessInput] = []
    outputs: List[ProcessOutput] = []
    processing_time: Dict[str, float] = {}  # 製品ID別の処理時間
    
    # バッファ
    input_buffer_id: Optional[str] = None
    output_buffer_id: Optional[str] = None
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_equipment(self, equipment: Equipment):
        """設備を追加"""
        self.equipments[equipment.id] = equipment
        
    def get_available_equipment(self) -> Optional[Equipment]:
        """利用可能な設備を取得"""
        for eq in self.equipments.values():
            if eq.status == "idle":
                return eq
        return None
        
    def can_process(self, product_id: str) -> bool:
        """指定製品を処理可能か確認"""
        return product_id in self.processing_time
    
    def get_input_material(self, product_id: str) -> Optional[ProcessInput]:
        """指定製品の入力材料設定を取得"""
        for input_material in self.inputs:
            if input_material.product_id == product_id:
                return input_material
        return None
    
    def should_process_pull(self, product_id: str) -> bool:
        """指定製品がプル型制御かどうか確認"""
        input_material = self.get_input_material(product_id)
        if input_material:
            return input_material.scheduling_mode in ["pull", "hybrid"]
        return False
    
    def should_process_push(self, product_id: str) -> bool:
        """指定製品がプッシュ型制御かどうか確認"""
        input_material = self.get_input_material(product_id)
        if input_material:
            return input_material.scheduling_mode in ["push", "hybrid"]
        return False
    
    def get_kanban_settings(self, product_id: str) -> Optional[KanbanSettings]:
        """指定製品のかんばん設定を取得"""
        input_material = self.get_input_material(product_id)
        if input_material and input_material.kanban_settings:
            return input_material.kanban_settings
        return None

class StoreNode(BaseModel):
    """ストアノードモデル（計画管理）"""
    id: str
    name: str
    type: str = "store"
    store_type: str = "finished_product"  # "finished_product", "component"
    
    # 生産計画
    production_schedule: List[Dict] = []
    
    # 在庫レベル
    inventory_levels: Dict[str, Dict] = {}
    
    # 位置情報
    position: Optional[Dict[str, float]] = None
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_production_schedule_item(self, product_id: str, quantity: int, priority: int = 1, 
                                   start_time: Optional[str] = None, end_time: Optional[str] = None):
        """生産計画アイテムを追加"""
        schedule_item = {
            "id": f"schedule_{len(self.production_schedule) + 1}",
            "product_id": product_id,
            "quantity": quantity,
            "priority": priority,
            "sequence": len(self.production_schedule) + 1,
            "start_time": start_time,
            "end_time": end_time,
            "is_active": True
        }
        self.production_schedule.append(schedule_item)
    
    def set_inventory_level(self, product_id: str, current_stock: int, min_stock: int = 0, 
                           max_stock: int = 100, reorder_point: int = 10):
        """在庫レベルを設定"""
        self.inventory_levels[product_id] = {
            "current_stock": current_stock,
            "min_stock": min_stock,
            "max_stock": max_stock,
            "reorder_point": reorder_point
        }
    
    def get_active_schedule(self) -> List[Dict]:
        """アクティブな生産計画を取得"""
        return [item for item in self.production_schedule if item.get("is_active", True)]
    
    def get_schedule_by_priority(self) -> List[Dict]:
        """優先度順の生産計画を取得"""
        return sorted(self.get_active_schedule(), key=lambda x: x.get("priority", 1))