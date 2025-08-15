"""
バッファ（在庫）モデル
"""
from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime
from collections import defaultdict

class BufferTransaction(BaseModel):
    """在庫取引記録"""
    timestamp: datetime
    product_id: str
    lot_id: str
    quantity: int
    transaction_type: str  # "in" or "out"
    from_location: Optional[str] = None
    to_location: Optional[str] = None

class Buffer(BaseModel):
    """バッファ（在庫置き場）モデル"""
    id: str
    name: str
    capacity: Optional[int] = None  # None = 無制限
    location_type: str = "intermediate"  # "process_input", "process_output", "intermediate"
    buffer_type: str = "buffer"  # "input", "output", "buffer"
    
    # 在庫データ（メモリ内管理）
    inventory: Dict[str, List[Dict]] = {}  # product_id -> List of lots
    transactions: List[BufferTransaction] = []
    
    class Config:
        arbitrary_types_allowed = True
    
    def add_lot(self, product_id: str, lot_id: str, quantity: int, from_location: str) -> bool:
        """ロットを追加"""
        # 容量チェック
        if self.capacity and self.get_total_quantity() + quantity > self.capacity:
            return False
            
        # 在庫に追加
        if product_id not in self.inventory:
            self.inventory[product_id] = []
            
        self.inventory[product_id].append({
            "lot_id": lot_id,
            "quantity": quantity,
            "arrived_at": datetime.now()
        })
        
        # 取引記録
        self.transactions.append(BufferTransaction(
            timestamp=datetime.now(),
            product_id=product_id,
            lot_id=lot_id,
            quantity=quantity,
            transaction_type="in",
            from_location=from_location,
            to_location=self.id
        ))
        
        return True
        
    def remove_lot(self, product_id: str, quantity: int, to_location: str) -> Optional[List[Dict]]:
        """指定数量のロットを取り出し（FIFO）"""
        if product_id not in self.inventory:
            return None
            
        removed_lots = []
        remaining_quantity = quantity
        
        while remaining_quantity > 0 and self.inventory[product_id]:
            lot = self.inventory[product_id][0]
            
            if lot["quantity"] <= remaining_quantity:
                # ロット全体を取り出し
                removed_lot = self.inventory[product_id].pop(0)
                removed_lots.append(removed_lot)
                remaining_quantity -= removed_lot["quantity"]
                
                # 取引記録
                self.transactions.append(BufferTransaction(
                    timestamp=datetime.now(),
                    product_id=product_id,
                    lot_id=removed_lot["lot_id"],
                    quantity=removed_lot["quantity"],
                    transaction_type="out",
                    from_location=self.id,
                    to_location=to_location
                ))
            else:
                # ロットの一部を取り出し
                taken_quantity = remaining_quantity
                lot["quantity"] -= taken_quantity
                
                removed_lots.append({
                    "lot_id": lot["lot_id"],
                    "quantity": taken_quantity,
                    "arrived_at": lot["arrived_at"]
                })
                
                # 取引記録
                self.transactions.append(BufferTransaction(
                    timestamp=datetime.now(),
                    product_id=product_id,
                    lot_id=lot["lot_id"],
                    quantity=taken_quantity,
                    transaction_type="out",
                    from_location=self.id,
                    to_location=to_location
                ))
                
                remaining_quantity = 0
                
        if remaining_quantity > 0:
            # 在庫不足
            return None
            
        return removed_lots
        
    def get_inventory_levels(self) -> Dict[str, int]:
        """製品別の在庫数量を取得"""
        levels = defaultdict(int)
        for product_id, lots in self.inventory.items():
            levels[product_id] = sum(lot["quantity"] for lot in lots)
        return dict(levels)
        
    def get_total_quantity(self) -> int:
        """総在庫数量を取得"""
        total = 0
        for lots in self.inventory.values():
            total += sum(lot["quantity"] for lot in lots)
        return total
        
    def get_oldest_lot_age(self, product_id: str) -> Optional[float]:
        """最古ロットの滞留時間を取得（秒）"""
        if product_id not in self.inventory or not self.inventory[product_id]:
            return None
            
        oldest_lot = self.inventory[product_id][0]
        age = (datetime.now() - oldest_lot["arrived_at"]).total_seconds()
        return age