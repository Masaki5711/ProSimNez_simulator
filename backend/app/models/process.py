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

class ProcessInput(BaseModel):
    """工程入力定義"""
    from_process_id: str
    product_id: str
    required_quantity: int

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