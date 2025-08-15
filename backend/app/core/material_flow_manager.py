"""
材料フロー管理システム
BOMベースの材料要求計算、在庫管理、かんばんシステム
"""
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import uuid

from app.models.product import Product, BOMItem
from app.models.buffer import Buffer
from app.models.factory import Factory
from app.core.event_manager import EventManager, EventPriority
from app.models.event import SimulationEvent

class MaterialRequestStatus(Enum):
    """材料要求状態"""
    PENDING = "pending"
    ALLOCATED = "allocated"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class KanbanType(Enum):
    """かんばんタイプ"""
    PRODUCTION = "production"  # 生産指示かんばん
    WITHDRAWAL = "withdrawal"  # 引き取りかんばん
    SUPPLIER = "supplier"      # 納入指示かんばん

class InventoryPolicy(Enum):
    """在庫方針"""
    PUSH = "push"      # プッシュ型（計画ベース）
    PULL = "pull"      # プル型（需要ベース）
    KANBAN = "kanban"  # かんばん方式
    JUST_IN_TIME = "jit"  # ジャストインタイム

@dataclass
class MaterialRequest:
    """材料要求"""
    request_id: str
    process_id: str
    product_id: str
    quantity: int
    required_by: datetime
    priority: int = 0
    status: MaterialRequestStatus = MaterialRequestStatus.PENDING
    allocated_lots: List[str] = field(default_factory=list)
    requested_at: datetime = field(default_factory=datetime.now)
    allocated_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

@dataclass
class KanbanCard:
    """かんばんカード"""
    kanban_id: str
    kanban_type: KanbanType
    product_id: str
    quantity: int
    from_location: str
    to_location: str
    created_at: datetime
    status: str = "active"  # "active", "in_use", "completed"
    due_date: Optional[datetime] = None
    actual_completion: Optional[datetime] = None

@dataclass
class InventoryLevel:
    """在庫レベル"""
    product_id: str
    location_id: str
    current_stock: int
    reserved_stock: int = 0
    min_stock: int = 0
    max_stock: int = 100
    reorder_point: int = 10
    target_stock: int = 50
    last_updated: datetime = field(default_factory=datetime.now)

@dataclass
class SupplierInfo:
    """サプライヤー情報"""
    supplier_id: str
    name: str
    lead_time: float  # 納期（日）
    reliability: float  # 信頼性（0-1）
    cost_factor: float  # コスト係数
    capacity: int  # 供給能力
    products: List[str]  # 供給可能製品

class MaterialFlowManager:
    """材料フロー管理システム"""
    
    def __init__(self, factory: Factory, event_manager: EventManager):
        self.factory = factory
        self.event_manager = event_manager
        
        # 材料要求管理
        self.material_requests: Dict[str, MaterialRequest] = {}
        self.pending_requests: deque = deque()
        
        # 在庫管理
        self.inventory_levels: Dict[str, InventoryLevel] = {}
        self.inventory_policies: Dict[str, InventoryPolicy] = {}
        
        # かんばんシステム
        self.kanban_cards: Dict[str, KanbanCard] = {}
        self.kanban_circulation: Dict[str, List[str]] = {}  # location -> kanban_ids
        
        # BOM管理
        self.bom_tree: Dict[str, List[BOMItem]] = {}
        self.where_used: Dict[str, List[str]] = {}  # 部品がどの製品で使われるか
        
        # サプライヤー管理
        self.suppliers: Dict[str, SupplierInfo] = {}
        
        # 統計情報
        self.stats = {
            "total_requests": 0,
            "fulfilled_requests": 0,
            "stockout_count": 0,
            "excess_inventory_count": 0,
            "kanban_circulation_time": 0.0,
            "supplier_performance": {}
        }
        
        # 初期化
        self._initialize_bom_tree()
        self._initialize_inventory_levels()
        self._initialize_kanban_system()
        
    def _initialize_bom_tree(self):
        """BOMツリーを初期化"""
        # TODO: Factory から BOM データを読み込み
        # 現在は簡略化されたBOMを使用
        for product in self.factory.products.values():
            self.bom_tree[product.id] = product.bom
            
            # Where-used情報を構築
            for bom_item in product.bom:
                if bom_item.part_id not in self.where_used:
                    self.where_used[bom_item.part_id] = []
                self.where_used[bom_item.part_id].append(product.id)
                
    def _initialize_inventory_levels(self):
        """在庫レベルを初期化"""
        for product in self.factory.products.values():
            for buffer in self.factory.buffers.values():
                location_key = f"{product.id}@{buffer.id}"
                self.inventory_levels[location_key] = InventoryLevel(
                    product_id=product.id,
                    location_id=buffer.id,
                    current_stock=0,
                    min_stock=10,
                    max_stock=100,
                    reorder_point=20,
                    target_stock=50
                )
                
                # デフォルト在庫方針
                self.inventory_policies[location_key] = InventoryPolicy.PULL
                
    def _initialize_kanban_system(self):
        """かんばんシステムを初期化"""
        # 各製品に対してかんばんカードを生成
        for product in self.factory.products.values():
            kanban_count = 3  # デフォルト3枚
            
            for i in range(kanban_count):
                kanban_id = f"kanban_{product.id}_{i+1}"
                kanban_card = KanbanCard(
                    kanban_id=kanban_id,
                    kanban_type=KanbanType.PRODUCTION,
                    product_id=product.id,
                    quantity=10,  # デフォルト10個
                    from_location="supplier",
                    to_location="warehouse",
                    created_at=datetime.now()
                )
                
                self.kanban_cards[kanban_id] = kanban_card
                
    async def request_material(self, process_id: str, product_id: str, 
                              quantity: int, required_by: datetime,
                              priority: int = 0) -> str:
        """材料を要求"""
        request_id = str(uuid.uuid4())
        
        material_request = MaterialRequest(
            request_id=request_id,
            process_id=process_id,
            product_id=product_id,
            quantity=quantity,
            required_by=required_by,
            priority=priority
        )
        
        self.material_requests[request_id] = material_request
        self.pending_requests.append(request_id)
        self.stats["total_requests"] += 1
        
        # イベント発行
        await self._emit_event("material_requested", {
            "request": material_request.__dict__
        })
        
        # 即座に割り当てを試行
        await self._try_allocate_material(request_id)
        
        return request_id
        
    async def _try_allocate_material(self, request_id: str) -> bool:
        """材料の割り当てを試行"""
        request = self.material_requests.get(request_id)
        if not request or request.status != MaterialRequestStatus.PENDING:
            return False
            
        # 在庫確認
        available_stock = self._get_available_stock(request.product_id)
        
        if available_stock >= request.quantity:
            # 在庫から割り当て
            await self._allocate_from_stock(request)
            return True
        else:
            # 不足分を調達
            shortage = request.quantity - available_stock
            await self._trigger_procurement(request.product_id, shortage)
            
            # 利用可能な分だけ割り当て
            if available_stock > 0:
                await self._partial_allocate(request, available_stock)
                
            return False
            
    async def _allocate_from_stock(self, request: MaterialRequest):
        """在庫から材料を割り当て"""
        # 最適な場所から在庫を取得
        best_location = self._find_best_stock_location(request.product_id, request.quantity)
        
        if best_location:
            # 在庫を予約
            location_key = f"{request.product_id}@{best_location}"
            inventory = self.inventory_levels[location_key]
            
            if inventory.current_stock >= request.quantity:
                inventory.current_stock -= request.quantity
                inventory.reserved_stock += request.quantity
                inventory.last_updated = datetime.now()
                
                request.status = MaterialRequestStatus.ALLOCATED
                request.allocated_at = datetime.now()
                
                # イベント発行
                await self._emit_event("material_allocated", {
                    "request_id": request.request_id,
                    "location": best_location,
                    "quantity": request.quantity
                })
                
                # 配送をスケジュール
                await self._schedule_delivery(request, best_location)
                
    async def _partial_allocate(self, request: MaterialRequest, available_quantity: int):
        """部分的に材料を割り当て"""
        # 部分割り当て用の新しい要求を作成
        partial_request = MaterialRequest(
            request_id=f"{request.request_id}_partial",
            process_id=request.process_id,
            product_id=request.product_id,
            quantity=available_quantity,
            required_by=request.required_by,
            priority=request.priority
        )
        
        await self._allocate_from_stock(partial_request)
        
        # 残りの数量で元の要求を更新
        request.quantity -= available_quantity
        
    async def _trigger_procurement(self, product_id: str, quantity: int):
        """調達を発動"""
        # かんばんシステムまたはサプライヤーからの調達
        if self._use_kanban_for_product(product_id):
            await self._trigger_kanban_procurement(product_id, quantity)
        else:
            await self._trigger_supplier_procurement(product_id, quantity)
            
    def _use_kanban_for_product(self, product_id: str) -> bool:
        """製品にかんばんシステムを使用するかチェック"""
        # 簡略化: 全ての製品でかんばんを使用
        return True
        
    async def _trigger_kanban_procurement(self, product_id: str, quantity: int):
        """かんばんによる調達を発動"""
        # 利用可能なかんばんカードを検索
        available_kanbans = [
            kanban for kanban in self.kanban_cards.values()
            if (kanban.product_id == product_id and 
                kanban.status == "active")
        ]
        
        needed_cards = max(1, quantity // 10)  # 10個単位でかんばん
        
        for i, kanban in enumerate(available_kanbans[:needed_cards]):
            kanban.status = "in_use"
            kanban.due_date = datetime.now() + timedelta(hours=2)  # 2時間以内
            
            await self._emit_event("kanban_triggered", {
                "kanban_id": kanban.kanban_id,
                "product_id": product_id,
                "quantity": kanban.quantity
            })
            
            # かんばん循環時間をシミュレート
            await self._schedule_kanban_completion(kanban)
            
    async def _schedule_kanban_completion(self, kanban: KanbanCard):
        """かんばん完了をスケジュール"""
        # 非同期でかんばん完了を処理
        async def complete_kanban():
            # 調達時間をシミュレート（30分〜2時間）
            import random
            procurement_time = random.uniform(1800, 7200)
            await asyncio.sleep(procurement_time / 1000)  # 実時間では短縮
            
            # 在庫を追加
            await self._add_inventory(kanban.product_id, kanban.to_location, kanban.quantity)
            
            # かんばんカードを完了状態に
            kanban.status = "completed"
            kanban.actual_completion = datetime.now()
            
            # 統計更新
            circulation_time = (kanban.actual_completion - kanban.created_at).total_seconds()
            self.stats["kanban_circulation_time"] = (
                self.stats["kanban_circulation_time"] + circulation_time
            ) / 2  # 移動平均
            
            await self._emit_event("kanban_completed", {
                "kanban_id": kanban.kanban_id,
                "circulation_time": circulation_time
            })
            
            # かんばんカードを再利用可能に
            kanban.status = "active"
            kanban.created_at = datetime.now()
            
        asyncio.create_task(complete_kanban())
        
    async def _trigger_supplier_procurement(self, product_id: str, quantity: int):
        """サプライヤーからの調達を発動"""
        # 最適なサプライヤーを選択
        best_supplier = self._select_best_supplier(product_id)
        
        if best_supplier:
            procurement_time = best_supplier.lead_time * 24 * 3600  # 日を秒に変換
            
            await self._emit_event("supplier_procurement_started", {
                "supplier_id": best_supplier.supplier_id,
                "product_id": product_id,
                "quantity": quantity,
                "expected_delivery": (datetime.now() + timedelta(seconds=procurement_time)).isoformat()
            })
            
            # 非同期で調達完了を処理
            async def complete_procurement():
                await asyncio.sleep(procurement_time / 1000)  # 短縮時間
                await self._add_inventory(product_id, "warehouse", quantity)
                
                await self._emit_event("supplier_procurement_completed", {
                    "supplier_id": best_supplier.supplier_id,
                    "product_id": product_id,
                    "quantity": quantity
                })
                
            asyncio.create_task(complete_procurement())
            
    def _select_best_supplier(self, product_id: str) -> Optional[SupplierInfo]:
        """最適なサプライヤーを選択"""
        # 製品を供給可能なサプライヤーを検索
        available_suppliers = [
            supplier for supplier in self.suppliers.values()
            if product_id in supplier.products
        ]
        
        if not available_suppliers:
            return None
            
        # コスト、納期、信頼性を考慮して選択（簡略化）
        best_supplier = min(available_suppliers, 
                           key=lambda s: s.lead_time * s.cost_factor / s.reliability)
        
        return best_supplier
        
    async def _add_inventory(self, product_id: str, location_id: str, quantity: int):
        """在庫を追加"""
        location_key = f"{product_id}@{location_id}"
        
        if location_key not in self.inventory_levels:
            self.inventory_levels[location_key] = InventoryLevel(
                product_id=product_id,
                location_id=location_id,
                current_stock=0
            )
            
        inventory = self.inventory_levels[location_key]
        inventory.current_stock += quantity
        inventory.last_updated = datetime.now()
        
        await self._emit_event("inventory_added", {
            "product_id": product_id,
            "location_id": location_id,
            "quantity": quantity,
            "new_stock": inventory.current_stock
        })
        
        # 待機中の要求を再チェック
        await self._process_pending_requests()
        
    async def _process_pending_requests(self):
        """待機中の要求を処理"""
        processed_requests = []
        
        while self.pending_requests:
            request_id = self.pending_requests.popleft()
            success = await self._try_allocate_material(request_id)
            
            if not success:
                # 再度待機列に追加（優先度順）
                processed_requests.append(request_id)
                
        # 処理できなかった要求を優先度順に戻す
        for request_id in sorted(processed_requests, 
                               key=lambda rid: self.material_requests[rid].priority, 
                               reverse=True):
            self.pending_requests.append(request_id)
            
    async def _schedule_delivery(self, request: MaterialRequest, from_location: str):
        """配送をスケジュール"""
        # 配送時間を計算（簡略化）
        delivery_time = 300  # 5分
        
        async def deliver():
            await asyncio.sleep(delivery_time / 1000)  # 短縮時間
            
            # 在庫から実際に減算
            location_key = f"{request.product_id}@{from_location}"
            inventory = self.inventory_levels[location_key]
            inventory.reserved_stock -= request.quantity
            
            # 要求を完了状態に
            request.status = MaterialRequestStatus.DELIVERED
            request.delivered_at = datetime.now()
            
            self.stats["fulfilled_requests"] += 1
            
            await self._emit_event("material_delivered", {
                "request_id": request.request_id,
                "process_id": request.process_id,
                "product_id": request.product_id,
                "quantity": request.quantity,
                "delivery_time": delivery_time
            })
            
        asyncio.create_task(deliver())
        
    def _get_available_stock(self, product_id: str) -> int:
        """利用可能在庫を取得"""
        total_stock = 0
        
        for location_key, inventory in self.inventory_levels.items():
            if inventory.product_id == product_id:
                available = inventory.current_stock - inventory.reserved_stock
                total_stock += max(0, available)
                
        return total_stock
        
    def _find_best_stock_location(self, product_id: str, quantity: int) -> Optional[str]:
        """最適な在庫場所を検索"""
        candidates = []
        
        for location_key, inventory in self.inventory_levels.items():
            if (inventory.product_id == product_id and 
                inventory.current_stock - inventory.reserved_stock >= quantity):
                candidates.append((inventory.location_id, inventory.current_stock))
                
        if not candidates:
            return None
            
        # 在庫量が最も適切な場所を選択
        best_location = min(candidates, key=lambda x: x[1])
        return best_location[0]
        
    async def calculate_material_requirements(self, production_plan: Dict[str, int]) -> Dict[str, int]:
        """生産計画から材料所要量を計算（MRP）"""
        requirements = defaultdict(int)
        
        # 各製品の生産予定から必要材料を展開
        for product_id, planned_quantity in production_plan.items():
            await self._explode_bom(product_id, planned_quantity, requirements)
            
        return dict(requirements)
        
    async def _explode_bom(self, product_id: str, quantity: int, 
                          requirements: defaultdict, level: int = 0):
        """BOM展開"""
        if product_id not in self.bom_tree:
            # 材料または購入品
            requirements[product_id] += quantity
            return
            
        # BOMを展開
        for bom_item in self.bom_tree[product_id]:
            required_qty = quantity * bom_item.quantity
            await self._explode_bom(bom_item.part_id, required_qty, requirements, level + 1)
            
    def get_inventory_status(self) -> Dict[str, Any]:
        """在庫状況を取得"""
        status = {
            "by_product": defaultdict(lambda: {"total_stock": 0, "locations": {}}),
            "by_location": defaultdict(lambda: {"products": {}, "total_items": 0}),
            "alerts": []
        }
        
        for location_key, inventory in self.inventory_levels.items():
            product_id = inventory.product_id
            location_id = inventory.location_id
            available_stock = inventory.current_stock - inventory.reserved_stock
            
            # 製品別集計
            status["by_product"][product_id]["total_stock"] += available_stock
            status["by_product"][product_id]["locations"][location_id] = available_stock
            
            # 場所別集計
            status["by_location"][location_id]["products"][product_id] = available_stock
            status["by_location"][location_id]["total_items"] += available_stock
            
            # アラート生成
            if available_stock <= inventory.min_stock:
                status["alerts"].append({
                    "type": "low_stock",
                    "product_id": product_id,
                    "location_id": location_id,
                    "current_stock": available_stock,
                    "min_stock": inventory.min_stock
                })
            elif available_stock >= inventory.max_stock:
                status["alerts"].append({
                    "type": "excess_stock",
                    "product_id": product_id,
                    "location_id": location_id,
                    "current_stock": available_stock,
                    "max_stock": inventory.max_stock
                })
                
        return status
        
    def get_kanban_status(self) -> Dict[str, Any]:
        """かんばん状況を取得"""
        status = {
            "total_cards": len(self.kanban_cards),
            "by_status": defaultdict(int),
            "by_product": defaultdict(lambda: {"active": 0, "in_use": 0, "completed": 0}),
            "circulation_metrics": {
                "average_circulation_time": self.stats["kanban_circulation_time"],
                "active_cards": 0,
                "overdue_cards": 0
            }
        }
        
        now = datetime.now()
        
        for kanban in self.kanban_cards.values():
            status["by_status"][kanban.status] += 1
            status["by_product"][kanban.product_id][kanban.status] += 1
            
            if kanban.status == "active":
                status["circulation_metrics"]["active_cards"] += 1
            elif kanban.status == "in_use" and kanban.due_date and now > kanban.due_date:
                status["circulation_metrics"]["overdue_cards"] += 1
                
        return status
        
    async def _emit_event(self, event_type: str, data: Dict[str, Any] = None):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
