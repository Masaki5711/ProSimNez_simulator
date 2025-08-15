"""
スケジューリング最適化システム
プッシュ・プル型スケジューリング、制約理論(TOC)、リーンプロダクション対応
"""
import asyncio
import heapq
import random
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import uuid

from app.models.product import Product, Lot
from app.models.process import Process
from app.models.factory import Factory
from app.models.event import SimulationEvent
from app.core.event_manager import EventManager, EventPriority
from app.core.process_simulator import ProcessingJob
from app.core.material_flow_manager import MaterialRequest

class SchedulingStrategy(Enum):
    """スケジューリング戦略"""
    PUSH = "push"           # プッシュ型（計画主導）
    PULL = "pull"           # プル型（需要主導）
    KANBAN = "kanban"       # かんばん方式
    TOC = "toc"             # 制約理論
    LEAN = "lean"           # リーンプロダクション
    HYBRID = "hybrid"       # ハイブリッド

class PriorityRule(Enum):
    """優先度ルール"""
    FIFO = "fifo"           # 先入先出
    LIFO = "lifo"           # 後入先出
    SPT = "spt"             # 最短処理時間優先
    LPT = "lpt"             # 最長処理時間優先
    EDD = "edd"             # 最早納期優先
    CR = "cr"               # クリティカル比
    RUSH = "rush"           # 緊急度優先
    PROFIT = "profit"       # 利益優先

class ConstraintType(Enum):
    """制約タイプ"""
    CAPACITY = "capacity"         # 能力制約
    MATERIAL = "material"         # 材料制約
    SETUP = "setup"              # 段取り制約
    PRECEDENCE = "precedence"     # 先行制約
    AVAILABILITY = "availability" # 可用性制約

@dataclass
class ProductionOrder:
    """生産指示"""
    order_id: str
    product_id: str
    quantity: int
    due_date: datetime
    priority: int = 0
    customer_id: str = ""
    order_type: str = "standard"  # "standard", "rush", "kanban"
    profit_margin: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    status: str = "pending"  # "pending", "scheduled", "released", "in_progress", "completed"

@dataclass
class SchedulingConstraint:
    """スケジューリング制約"""
    constraint_id: str
    constraint_type: ConstraintType
    resource_id: str
    capacity: float
    availability_start: Optional[datetime] = None
    availability_end: Optional[datetime] = None
    setup_time_matrix: Dict[Tuple[str, str], float] = field(default_factory=dict)

@dataclass
class ScheduledOperation:
    """スケジュール済み作業"""
    operation_id: str
    order_id: str
    process_id: str
    product_id: str
    quantity: int
    scheduled_start: datetime
    scheduled_end: datetime
    estimated_duration: float
    setup_time: float = 0.0
    predecessor_operations: List[str] = field(default_factory=list)
    successor_operations: List[str] = field(default_factory=list)
    resource_requirements: Dict[str, float] = field(default_factory=dict)

@dataclass
class BottleneckAnalysis:
    """ボトルネック分析"""
    process_id: str
    utilization_rate: float
    queue_length: int
    average_wait_time: float
    throughput_rate: float
    constraint_severity: float  # 制約の深刻度
    improvement_suggestions: List[str] = field(default_factory=list)

class ProductionScheduler:
    """生産スケジューラ"""
    
    def __init__(self, factory: Factory, event_manager: EventManager):
        self.factory = factory
        self.event_manager = event_manager
        
        # スケジューリング設定
        self.scheduling_strategy = SchedulingStrategy.HYBRID
        self.primary_priority_rule = PriorityRule.EDD
        self.secondary_priority_rule = PriorityRule.SPT
        
        # 生産指示管理
        self.production_orders: Dict[str, ProductionOrder] = {}
        self.order_queue: deque = deque()
        
        # スケジュール管理
        self.scheduled_operations: Dict[str, ScheduledOperation] = {}
        self.resource_schedules: Dict[str, List[ScheduledOperation]] = {}
        
        # 制約管理
        self.constraints: Dict[str, SchedulingConstraint] = {}
        self.bottleneck_processes: List[str] = []
        
        # 統計情報
        self.stats = {
            "total_orders": 0,
            "completed_orders": 0,
            "on_time_deliveries": 0,
            "late_deliveries": 0,
            "average_lead_time": 0.0,
            "average_utilization": 0.0,
            "schedule_efficiency": 0.0
        }
        
        # 制約理論(TOC)関連
        self.drum_process: Optional[str] = None  # ドラム（制約工程）
        self.buffer_sizes: Dict[str, int] = {}   # バッファサイズ
        
        # 初期化
        self._initialize_constraints()
        self._identify_bottlenecks()
        
    def _initialize_constraints(self):
        """制約を初期化"""
        # 工程能力制約
        for process_id, process in self.factory.processes.items():
            constraint_id = f"capacity_{process_id}"
            
            # 設備数から能力を計算
            total_capacity = sum(eq.capacity for eq in process.equipments.values())
            
            self.constraints[constraint_id] = SchedulingConstraint(
                constraint_id=constraint_id,
                constraint_type=ConstraintType.CAPACITY,
                resource_id=process_id,
                capacity=total_capacity
            )
            
            # リソーススケジュールを初期化
            self.resource_schedules[process_id] = []
            
    async def _identify_bottlenecks(self):
        """ボトルネック工程を特定"""
        # 各工程の理論的スループットを計算
        throughputs = {}
        
        for process_id, process in self.factory.processes.items():
            # 基本処理時間の逆数をスループットとする（簡略化）
            avg_processing_time = sum(process.processing_time.values()) / len(process.processing_time) if process.processing_time else 60.0
            theoretical_throughput = 3600 / avg_processing_time  # 時間あたり個数
            
            # 設備数を考慮
            total_capacity = sum(eq.capacity for eq in process.equipments.values())
            actual_throughput = theoretical_throughput * total_capacity
            
            throughputs[process_id] = actual_throughput
            
        # 最も低いスループットの工程をボトルネックとする
        if throughputs:
            bottleneck_process = min(throughputs.keys(), key=lambda k: throughputs[k])
            self.bottleneck_processes = [bottleneck_process]
            self.drum_process = bottleneck_process
            
            # ボトルネック前後のバッファサイズを設定
            self.buffer_sizes[bottleneck_process] = 10  # ボトルネック前バッファ
            
            await self._emit_event("bottleneck_identified", {
                "bottleneck_process": bottleneck_process,
                "throughput": throughputs[bottleneck_process],
                "all_throughputs": throughputs
            })
            
    async def create_production_order(self, product_id: str, quantity: int,
                                    due_date: datetime, priority: int = 0,
                                    customer_id: str = "", order_type: str = "standard") -> str:
        """生産指示を作成"""
        order_id = str(uuid.uuid4())
        
        order = ProductionOrder(
            order_id=order_id,
            product_id=product_id,
            quantity=quantity,
            due_date=due_date,
            priority=priority,
            customer_id=customer_id,
            order_type=order_type
        )
        
        self.production_orders[order_id] = order
        self.order_queue.append(order_id)
        self.stats["total_orders"] += 1
        
        # イベント発行
        await self._emit_event("production_order_created", {
            "order": order.__dict__
        })
        
        # スケジューリングを実行
        await self._schedule_orders()
        
        return order_id
        
    async def _schedule_orders(self):
        """生産指示をスケジューリング"""
        # 戦略に応じたスケジューリング
        if self.scheduling_strategy == SchedulingStrategy.PUSH:
            await self._push_scheduling()
        elif self.scheduling_strategy == SchedulingStrategy.PULL:
            await self._pull_scheduling()
        elif self.scheduling_strategy == SchedulingStrategy.KANBAN:
            await self._kanban_scheduling()
        elif self.scheduling_strategy == SchedulingStrategy.TOC:
            await self._toc_scheduling()
        elif self.scheduling_strategy == SchedulingStrategy.LEAN:
            await self._lean_scheduling()
        else:  # HYBRID
            await self._hybrid_scheduling()
            
    async def _push_scheduling(self):
        """プッシュ型スケジューリング"""
        # 納期順にソートして前倒しスケジューリング
        pending_orders = [
            self.production_orders[oid] for oid in self.order_queue
            if self.production_orders[oid].status == "pending"
        ]
        
        # 優先度ルールに従ってソート
        sorted_orders = self._sort_orders_by_priority(pending_orders)
        
        current_time = datetime.now()
        
        for order in sorted_orders:
            # 工程順序を決定
            process_sequence = await self._determine_process_sequence(order.product_id)
            
            # 各工程の作業をスケジュール
            operation_start_time = current_time
            
            for process_id in process_sequence:
                operation = await self._schedule_operation(
                    order, process_id, operation_start_time
                )
                
                if operation:
                    operation_start_time = operation.scheduled_end
                    
            order.status = "scheduled"
            order.scheduled_start = current_time
            order.scheduled_end = operation_start_time
            
    async def _pull_scheduling(self):
        """プル型スケジューリング"""
        # 後工程からの需要に基づいてスケジューリング
        # 最終工程から逆算して必要なタイミングを決定
        
        pending_orders = [
            self.production_orders[oid] for oid in self.order_queue
            if self.production_orders[oid].status == "pending"
        ]
        
        for order in pending_orders:
            # 納期から逆算してスケジュール
            process_sequence = await self._determine_process_sequence(order.product_id)
            process_sequence.reverse()  # 逆順
            
            operation_end_time = order.due_date
            
            for process_id in process_sequence:
                # 処理時間を取得
                processing_time = await self._get_processing_time(order.product_id, process_id)
                operation_start_time = operation_end_time - timedelta(seconds=processing_time)
                
                operation = await self._schedule_operation_backward(
                    order, process_id, operation_start_time, operation_end_time
                )
                
                if operation:
                    operation_end_time = operation.scheduled_start
                    
            order.status = "scheduled"
            order.scheduled_start = operation_end_time
            order.scheduled_end = order.due_date
            
    async def _kanban_scheduling(self):
        """かんばん方式スケジューリング"""
        # かんばんカードの流れに基づいてスケジューリング
        # 実際の実装では材料フロー管理システムと連携
        
        # 簡略化: プル型と同様だが、ロットサイズを小さく設定
        await self._pull_scheduling()
        
        # かんばん特有の調整
        for order_id in self.order_queue:
            order = self.production_orders[order_id]
            if order.order_type == "kanban":
                # 小ロット化
                if order.quantity > 10:
                    await self._split_order_into_small_lots(order)
                    
    async def _toc_scheduling(self):
        """制約理論(TOC)ベーススケジューリング"""
        # ドラム-バッファ-ロープ方式
        
        if not self.drum_process:
            await self._push_scheduling()
            return
            
        pending_orders = [
            self.production_orders[oid] for oid in self.order_queue
            if self.production_orders[oid].status == "pending"
        ]
        
        # 1. ドラム（制約工程）のスケジューリング
        drum_schedule = await self._schedule_drum_process(pending_orders)
        
        # 2. バッファの設定
        await self._set_buffers_for_toc(drum_schedule)
        
        # 3. ロープ（材料投入タイミング）の決定
        await self._determine_rope_schedule(drum_schedule)
        
    async def _lean_scheduling(self):
        """リーンプロダクション方式スケジューリング"""
        # ジャストインタイム、平準化、単個流し
        
        pending_orders = [
            self.production_orders[oid] for oid in self.order_queue
            if self.production_orders[oid].status == "pending"
        ]
        
        # 生産平準化（ヘイジュンカ）
        leveled_orders = await self._level_production(pending_orders)
        
        # 単個流し（ワンピースフロー）を目指したスケジューリング
        for order in leveled_orders:
            await self._schedule_one_piece_flow(order)
            
        # ムダの排除
        await self._eliminate_waste_in_schedule()
        
    async def _hybrid_scheduling(self):
        """ハイブリッドスケジューリング"""
        # 製品タイプや状況に応じて戦略を切り替え
        
        pending_orders = [
            self.production_orders[oid] for oid in self.order_queue
            if self.production_orders[oid].status == "pending"
        ]
        
        # 緊急オーダーはプッシュ型
        rush_orders = [o for o in pending_orders if o.order_type == "rush"]
        standard_orders = [o for o in pending_orders if o.order_type == "standard"]
        kanban_orders = [o for o in pending_orders if o.order_type == "kanban"]
        
        # 緊急オーダーを最優先でスケジュール
        for order in rush_orders:
            await self._emergency_schedule(order)
            
        # 標準オーダーはプル型またはTOC
        if self.drum_process:
            self.order_queue = deque([o.order_id for o in standard_orders])
            await self._toc_scheduling()
        else:
            self.order_queue = deque([o.order_id for o in standard_orders])
            await self._pull_scheduling()
            
        # かんばんオーダーは専用スケジュール
        self.order_queue = deque([o.order_id for o in kanban_orders])
        await self._kanban_scheduling()
        
    def _sort_orders_by_priority(self, orders: List[ProductionOrder]) -> List[ProductionOrder]:
        """優先度ルールに従ってオーダーをソート"""
        def primary_key(order):
            if self.primary_priority_rule == PriorityRule.FIFO:
                return order.created_at
            elif self.primary_priority_rule == PriorityRule.EDD:
                return order.due_date
            elif self.primary_priority_rule == PriorityRule.RUSH:
                return -order.priority  # 高優先度が先
            elif self.primary_priority_rule == PriorityRule.PROFIT:
                return -order.profit_margin
            else:
                return order.created_at
                
        def secondary_key(order):
            if self.secondary_priority_rule == PriorityRule.SPT:
                # 処理時間が短い順（簡略化）
                return order.quantity
            elif self.secondary_priority_rule == PriorityRule.LPT:
                return -order.quantity
            else:
                return 0
                
        return sorted(orders, key=lambda o: (primary_key(o), secondary_key(o)))
        
    async def _determine_process_sequence(self, product_id: str) -> List[str]:
        """製品の工程順序を決定"""
        # 簡略化: ファクトリーの工程IDを順番に並べる
        process_ids = list(self.factory.processes.keys())
        
        # 実際の実装では製品のBOMや工程フローから決定
        return process_ids
        
    async def _schedule_operation(self, order: ProductionOrder, process_id: str,
                                start_time: datetime) -> Optional[ScheduledOperation]:
        """作業をスケジュール"""
        # 処理時間を計算
        processing_time = await self._get_processing_time(order.product_id, process_id)
        setup_time = await self._get_setup_time(process_id, order.product_id)
        
        total_duration = processing_time + setup_time
        end_time = start_time + timedelta(seconds=total_duration)
        
        # リソースの空きをチェック
        if not await self._is_resource_available(process_id, start_time, end_time):
            # 空いている時間を探す
            available_slot = await self._find_available_slot(
                process_id, total_duration, start_time
            )
            if available_slot:
                start_time, end_time = available_slot
            else:
                return None
                
        # 作業をスケジュール
        operation_id = str(uuid.uuid4())
        operation = ScheduledOperation(
            operation_id=operation_id,
            order_id=order.order_id,
            process_id=process_id,
            product_id=order.product_id,
            quantity=order.quantity,
            scheduled_start=start_time,
            scheduled_end=end_time,
            estimated_duration=total_duration,
            setup_time=setup_time
        )
        
        self.scheduled_operations[operation_id] = operation
        self.resource_schedules[process_id].append(operation)
        
        # リソーススケジュールをソート
        self.resource_schedules[process_id].sort(key=lambda op: op.scheduled_start)
        
        return operation
        
    async def _get_processing_time(self, product_id: str, process_id: str) -> float:
        """処理時間を取得"""
        process = self.factory.processes.get(process_id)
        if process and product_id in process.processing_time:
            return process.processing_time[product_id]
        return 3600.0  # デフォルト1時間
        
    async def _get_setup_time(self, process_id: str, product_id: str) -> float:
        """段取り時間を取得"""
        # 簡略化: 固定段取り時間
        return 1800.0  # 30分
        
    async def _is_resource_available(self, process_id: str, start_time: datetime,
                                   end_time: datetime) -> bool:
        """リソースが利用可能かチェック"""
        existing_operations = self.resource_schedules.get(process_id, [])
        
        for operation in existing_operations:
            # 時間の重複をチェック
            if (start_time < operation.scheduled_end and 
                end_time > operation.scheduled_start):
                return False
                
        return True
        
    async def _find_available_slot(self, process_id: str, duration: float,
                                 earliest_start: datetime) -> Optional[Tuple[datetime, datetime]]:
        """利用可能な時間枠を探す"""
        existing_operations = self.resource_schedules.get(process_id, [])
        
        if not existing_operations:
            end_time = earliest_start + timedelta(seconds=duration)
            return (earliest_start, end_time)
            
        # 既存作業の間の空き時間を探す
        sorted_operations = sorted(existing_operations, key=lambda op: op.scheduled_start)
        
        # 最初の作業より前
        if earliest_start + timedelta(seconds=duration) <= sorted_operations[0].scheduled_start:
            end_time = earliest_start + timedelta(seconds=duration)
            return (earliest_start, end_time)
            
        # 作業間の空き時間
        for i in range(len(sorted_operations) - 1):
            current_end = sorted_operations[i].scheduled_end
            next_start = sorted_operations[i + 1].scheduled_start
            
            gap_duration = (next_start - current_end).total_seconds()
            
            if gap_duration >= duration:
                slot_start = max(earliest_start, current_end)
                slot_end = slot_start + timedelta(seconds=duration)
                
                if slot_end <= next_start:
                    return (slot_start, slot_end)
                    
        # 最後の作業より後
        last_end = sorted_operations[-1].scheduled_end
        slot_start = max(earliest_start, last_end)
        slot_end = slot_start + timedelta(seconds=duration)
        
        return (slot_start, slot_end)
        
    async def _emergency_schedule(self, order: ProductionOrder):
        """緊急スケジューリング"""
        # 既存スケジュールを調整して緊急オーダーを割り込ませる
        
        process_sequence = await self._determine_process_sequence(order.product_id)
        current_time = datetime.now()
        
        for process_id in process_sequence:
            # 現在時刻で即座にスケジュール
            await self._force_schedule_operation(order, process_id, current_time)
            
            # 処理時間分だけ時刻を進める
            processing_time = await self._get_processing_time(order.product_id, process_id)
            current_time += timedelta(seconds=processing_time)
            
        order.status = "scheduled"
        order.scheduled_start = datetime.now()
        order.scheduled_end = current_time
        
    async def _force_schedule_operation(self, order: ProductionOrder, 
                                      process_id: str, start_time: datetime):
        """強制的に作業をスケジュール（既存作業を押し下げ）"""
        processing_time = await self._get_processing_time(order.product_id, process_id)
        setup_time = await self._get_setup_time(process_id, order.product_id)
        
        total_duration = processing_time + setup_time
        end_time = start_time + timedelta(seconds=total_duration)
        
        # 重複する既存作業を後ろにシフト
        existing_operations = self.resource_schedules.get(process_id, [])
        
        for operation in existing_operations:
            if operation.scheduled_start < end_time and operation.scheduled_end > start_time:
                # 重複する作業を後ろにシフト
                shift_amount = end_time - operation.scheduled_start
                operation.scheduled_start += shift_amount
                operation.scheduled_end += shift_amount
                
        # 新しい作業を追加
        operation_id = str(uuid.uuid4())
        operation = ScheduledOperation(
            operation_id=operation_id,
            order_id=order.order_id,
            process_id=process_id,
            product_id=order.product_id,
            quantity=order.quantity,
            scheduled_start=start_time,
            scheduled_end=end_time,
            estimated_duration=total_duration,
            setup_time=setup_time
        )
        
        self.scheduled_operations[operation_id] = operation
        self.resource_schedules[process_id].append(operation)
        self.resource_schedules[process_id].sort(key=lambda op: op.scheduled_start)
        
    async def analyze_bottlenecks(self) -> List[BottleneckAnalysis]:
        """ボトルネック分析を実行"""
        analyses = []
        
        for process_id in self.factory.processes.keys():
            # 利用率計算
            utilization = await self._calculate_utilization(process_id)
            
            # 待ち行列長
            queue_length = len([
                op for op in self.scheduled_operations.values()
                if op.process_id == process_id and op.scheduled_start > datetime.now()
            ])
            
            # 平均待ち時間
            avg_wait_time = await self._calculate_average_wait_time(process_id)
            
            # スループット率
            throughput_rate = await self._calculate_throughput_rate(process_id)
            
            # 制約の深刻度
            constraint_severity = utilization * (1 + queue_length / 10)
            
            # 改善提案
            suggestions = await self._generate_improvement_suggestions(
                process_id, utilization, queue_length, throughput_rate
            )
            
            analysis = BottleneckAnalysis(
                process_id=process_id,
                utilization_rate=utilization,
                queue_length=queue_length,
                average_wait_time=avg_wait_time,
                throughput_rate=throughput_rate,
                constraint_severity=constraint_severity,
                improvement_suggestions=suggestions
            )
            
            analyses.append(analysis)
            
        # 制約の深刻度でソート
        analyses.sort(key=lambda a: a.constraint_severity, reverse=True)
        
        return analyses
        
    async def _calculate_utilization(self, process_id: str) -> float:
        """工程の利用率を計算"""
        operations = [
            op for op in self.scheduled_operations.values()
            if op.process_id == process_id
        ]
        
        if not operations:
            return 0.0
            
        # 今後24時間の利用率を計算
        start_time = datetime.now()
        end_time = start_time + timedelta(hours=24)
        
        busy_time = 0.0
        total_time = 24 * 3600  # 24時間
        
        for operation in operations:
            if (operation.scheduled_start < end_time and 
                operation.scheduled_end > start_time):
                
                overlap_start = max(operation.scheduled_start, start_time)
                overlap_end = min(operation.scheduled_end, end_time)
                overlap_duration = (overlap_end - overlap_start).total_seconds()
                
                busy_time += max(0, overlap_duration)
                
        return min(100.0, (busy_time / total_time) * 100)
        
    async def _calculate_average_wait_time(self, process_id: str) -> float:
        """平均待ち時間を計算"""
        # 簡略化: キュー長に基づく推定
        queue_length = len([
            op for op in self.scheduled_operations.values()
            if op.process_id == process_id and op.scheduled_start > datetime.now()
        ])
        
        # 平均処理時間を取得
        avg_processing_time = 3600.0  # デフォルト1時間
        process = self.factory.processes.get(process_id)
        if process and process.processing_time:
            avg_processing_time = sum(process.processing_time.values()) / len(process.processing_time)
            
        # リトルの法則に基づく近似
        return queue_length * avg_processing_time
        
    async def _calculate_throughput_rate(self, process_id: str) -> float:
        """スループット率を計算"""
        # 過去24時間の完了作業数
        recent_operations = [
            op for op in self.scheduled_operations.values()
            if (op.process_id == process_id and 
                op.scheduled_end <= datetime.now() and
                op.scheduled_end >= datetime.now() - timedelta(hours=24))
        ]
        
        return len(recent_operations)  # 時間あたり個数
        
    async def _generate_improvement_suggestions(self, process_id: str, 
                                              utilization: float, queue_length: int,
                                              throughput_rate: float) -> List[str]:
        """改善提案を生成"""
        suggestions = []
        
        if utilization > 90:
            suggestions.append("設備を追加して能力を増強")
            suggestions.append("作業者を増員")
            
        if queue_length > 5:
            suggestions.append("バッチサイズを最適化")
            suggestions.append("段取り時間を短縮")
            
        if throughput_rate < 10:
            suggestions.append("工程を並列化")
            suggestions.append("作業手順を見直し")
            
        return suggestions
        
    def get_schedule_status(self) -> Dict[str, Any]:
        """スケジュール状況を取得"""
        now = datetime.now()
        
        # 進行中の作業
        active_operations = [
            op for op in self.scheduled_operations.values()
            if op.scheduled_start <= now <= op.scheduled_end
        ]
        
        # 今後の作業
        upcoming_operations = [
            op for op in self.scheduled_operations.values()
            if op.scheduled_start > now
        ]
        
        # 完了した作業
        completed_operations = [
            op for op in self.scheduled_operations.values()
            if op.scheduled_end <= now
        ]
        
        return {
            "summary": {
                "total_orders": self.stats["total_orders"],
                "completed_orders": self.stats["completed_orders"],
                "active_operations": len(active_operations),
                "upcoming_operations": len(upcoming_operations),
                "completed_operations": len(completed_operations)
            },
            "performance": {
                "on_time_delivery_rate": (
                    self.stats["on_time_deliveries"] / max(1, self.stats["completed_orders"]) * 100
                ),
                "average_lead_time": self.stats["average_lead_time"],
                "schedule_efficiency": self.stats["schedule_efficiency"]
            },
            "resource_utilization": {
                process_id: len([
                    op for op in active_operations
                    if op.process_id == process_id
                ])
                for process_id in self.factory.processes.keys()
            }
        }
        
    async def _emit_event(self, event_type: str, data: Dict[str, Any] = None):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
