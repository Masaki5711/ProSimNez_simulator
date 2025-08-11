"""
製品モデル
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

class BOMItem(BaseModel):
    """部品表（BOM）アイテム"""
    part_id: str
    quantity: int
    
class Product(BaseModel):
    """製品モデル"""
    id: str
    name: str
    type: str  # "component", "subassembly", "finished_product"
    bom: List[BOMItem] = []  # 必要部品リスト
    processing_time: float = 0.0  # 標準加工時間（秒）
    
class Lot(BaseModel):
    """ロットモデル"""
    id: str
    product_id: str
    quantity: int
    created_at: datetime
    current_location: str  # 現在位置（工程ID or バッファID）
    status: str  # "waiting", "processing", "completed", "in_transit"
    history: List[Dict] = []  # 履歴情報