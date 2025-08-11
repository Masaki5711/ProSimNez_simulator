"""
シミュレーションイベントモデル
"""
from typing import Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime

class SimulationEvent(BaseModel):
    """シミュレーションイベント"""
    timestamp: datetime
    event_type: str  # "process_start", "process_complete", "lot_arrival", "state_update", etc.
    process_id: Optional[str] = None
    equipment_id: Optional[str] = None
    product_id: Optional[str] = None
    lot_id: Optional[str] = None
    data: Dict[str, Any] = {}
    
    def to_dict(self) -> Dict:
        """辞書形式に変換"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type,
            "process_id": self.process_id,
            "equipment_id": self.equipment_id,
            "product_id": self.product_id,
            "lot_id": self.lot_id,
            "data": self.data
        }