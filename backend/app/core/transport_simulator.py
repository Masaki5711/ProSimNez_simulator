"""
搬送・物流シミュレーションシステム
搬送時間計算、ロットサイズ最適化、搬送リソース管理、経路最適化
"""
import asyncio
import simpy
import math
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import uuid
import heapq

from app.models.factory import Connection
from app.models.event import SimulationEvent
from app.core.event_manager import EventManager, EventPriority
from app.core.resource_manager import ResourceManager, TransportResource

class TransportMode(Enum):
    """搬送方式"""
    MANUAL = "manual"       # 手動搬送
    CONVEYOR = "conveyor"   # コンベア
    AGV = "agv"            # 無人搬送車
    FORKLIFT = "forklift"  # フォークリフト
    TUGGER = "tugger"      # 牽引車
    CRANE = "crane"        # クレーン
    ROBOT = "robot"        # ロボット

class TransportStatus(Enum):
    """搬送状態"""
    IDLE = "idle"
    LOADING = "loading"
    TRAVELING = "traveling"
    UNLOADING = "unloading"
    CHARGING = "charging"
    MAINTENANCE = "maintenance"
    BREAKDOWN = "breakdown"

class RouteType(Enum):
    """経路タイプ"""
    DIRECT = "direct"       # 直行
    VIA_POINT = "via_point" # 経由点あり
    OPTIMIZED = "optimized" # 最適化経路

@dataclass
class TransportTask:
    """搬送タスク"""
    task_id: str
    from_location: str
    to_location: str
    product_id: str
    lot_id: str
    quantity: int
    weight: float = 0.0
    volume: float = 0.0
    priority: int = 0
    transport_mode: TransportMode = TransportMode.MANUAL
    requested_at: datetime = field(default_factory=datetime.now)
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    assigned_resource: Optional[str] = None
    route: List[str] = field(default_factory=list)
    estimated_time: float = 0.0
    actual_time: float = 0.0

@dataclass
class TransportRoute:
    """搬送経路"""
    route_id: str
    from_location: str
    to_location: str
    waypoints: List[str] = field(default_factory=list)
    distance: float = 0.0
    estimated_time: float = 0.0
    traffic_factor: float = 1.0  # 交通密度係数
    route_type: RouteType = RouteType.DIRECT

@dataclass
class LocationNode:
    """位置ノード"""
    node_id: str
    name: str
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    node_type: str = "process"  # "process", "storage", "junction"
    capacity: int = 999
    current_load: int = 0

@dataclass
class TransportResourceStatus:
    """搬送リソース状態"""
    resource_id: str
    status: TransportStatus
    current_location: str
    current_task: Optional[str] = None
    battery_level: float = 100.0  # AGV等のバッテリー残量(%)
    load_capacity: float = 100.0  # 積載容量(kg)
    current_load: float = 0.0     # 現在積載量(kg)
    speed: float = 1.0            # 移動速度(m/s)
    last_maintenance: Optional[datetime] = None

class TransportSimulator:
    """搬送シミュレータ"""
    
    def __init__(self, resource_manager: ResourceManager, 
                 event_manager: EventManager, env: simpy.Environment):
        self.resource_manager = resource_manager
        self.event_manager = event_manager
        self.env = env
        
        # 搬送タスク管理
        self.transport_tasks: Dict[str, TransportTask] = {}
        self.task_queue: deque = deque()
        self.active_tasks: Dict[str, TransportTask] = {}
        
        # 経路管理
        self.location_nodes: Dict[str, LocationNode] = {}
        self.transport_routes: Dict[str, TransportRoute] = {}
        self.distance_matrix: Dict[Tuple[str, str], float] = {}
        
        # リソース状態管理
        self.resource_status: Dict[str, TransportResourceStatus] = {}
        
        # 統計情報
        self.stats = {
            "total_tasks": 0,
            "completed_tasks": 0,
            "total_distance": 0.0,
            "total_time": 0.0,
            "average_utilization": 0.0,
            "breakdown_count": 0,
            "late_delivery_count": 0
        }
        
        # 経路最適化設定
        self.route_optimization_enabled = True
        self.traffic_monitoring_enabled = True
        
        # 初期化
        self._initialize_transport_network()
        self._initialize_transport_resources()
        
    def _initialize_transport_network(self):
        """搬送ネットワークを初期化"""
        # デフォルトの位置ノードを作成（実際はFactoryから読み込み）
        default_locations = [
            ("warehouse", "倉庫", 0, 0),
            ("process_1", "工程1", 100, 0),
            ("process_2", "工程2", 200, 0),
            ("process_3", "工程3", 300, 0),
            ("shipping", "出荷", 400, 0)
        ]
        
        for loc_id, name, x, y in default_locations:
            self.location_nodes[loc_id] = LocationNode(
                node_id=loc_id,
                name=name,
                x=x,
                y=y
            )
            
        # 距離行列を計算
        self._calculate_distance_matrix()
        
        # デフォルト経路を生成
        self._generate_default_routes()
        
    def _calculate_distance_matrix(self):
        """距離行列を計算"""
        for from_id, from_node in self.location_nodes.items():
            for to_id, to_node in self.location_nodes.items():
                if from_id != to_id:
                    # ユークリッド距離を計算
                    distance = math.sqrt(
                        (to_node.x - from_node.x) ** 2 + 
                        (to_node.y - from_node.y) ** 2
                    )
                    self.distance_matrix[(from_id, to_id)] = distance
                    
    def _generate_default_routes(self):
        """デフォルト経路を生成"""
        for (from_id, to_id), distance in self.distance_matrix.items():
            route_id = f"route_{from_id}_{to_id}"
            
            # 基本搬送時間を計算（1m/s基準）
            base_time = distance / 1.0
            
            self.transport_routes[route_id] = TransportRoute(
                route_id=route_id,
                from_location=from_id,
                to_location=to_id,
                distance=distance,
                estimated_time=base_time
            )
            
    def _initialize_transport_resources(self):
        """搬送リソースを初期化"""
        # 手動搬送作業者
        for i in range(3):
            resource_id = f"manual_worker_{i+1}"
            self.resource_status[resource_id] = TransportResourceStatus(
                resource_id=resource_id,
                status=TransportStatus.IDLE,
                current_location="warehouse",
                speed=1.5,  # 徒歩1.5m/s
                load_capacity=20.0  # 20kg
            )
            
        # AGV
        for i in range(2):
            resource_id = f"agv_{i+1}"
            self.resource_status[resource_id] = TransportResourceStatus(
                resource_id=resource_id,
                status=TransportStatus.IDLE,
                current_location="warehouse",
                speed=2.0,  # AGV 2m/s
                load_capacity=100.0,  # 100kg
                battery_level=100.0
            )
            
        # フォークリフト
        resource_id = "forklift_1"
        self.resource_status[resource_id] = TransportResourceStatus(
            resource_id=resource_id,
            status=TransportStatus.IDLE,
            current_location="warehouse",
            speed=3.0,  # フォークリフト 3m/s
            load_capacity=500.0  # 500kg
        )
        
    async def create_transport_task(self, from_location: str, to_location: str,
                                  product_id: str, lot_id: str, quantity: int,
                                  weight: float = 0.0, priority: int = 0,
                                  transport_mode: TransportMode = TransportMode.MANUAL) -> str:
        """搬送タスクを作成"""
        task_id = str(uuid.uuid4())
        
        task = TransportTask(
            task_id=task_id,
            from_location=from_location,
            to_location=to_location,
            product_id=product_id,
            lot_id=lot_id,
            quantity=quantity,
            weight=weight,
            priority=priority,
            transport_mode=transport_mode
        )
        
        # 経路と推定時間を計算
        route = await self._calculate_optimal_route(from_location, to_location, transport_mode)
        task.route = route
        task.estimated_time = await self._estimate_transport_time(route, transport_mode, weight)
        
        self.transport_tasks[task_id] = task
        self.task_queue.append(task_id)
        self.stats["total_tasks"] += 1
        
        # イベント発行
        await self._emit_event("transport_task_created", {
            "task": task.__dict__
        })
        
        # タスクスケジューリング
        await self._schedule_transport_tasks()
        
        return task_id
        
    async def _calculate_optimal_route(self, from_location: str, to_location: str,
                                     transport_mode: TransportMode) -> List[str]:
        """最適経路を計算"""
        if not self.route_optimization_enabled:
            return [from_location, to_location]
            
        # ダイクストラ法による最短経路探索
        return await self._dijkstra_shortest_path(from_location, to_location)
        
    async def _dijkstra_shortest_path(self, start: str, end: str) -> List[str]:
        """ダイクストラ法による最短経路探索"""
        if start == end:
            return [start]
            
        # 優先度キュー：(距離, ノード, 経路)
        heap = [(0, start, [start])]
        visited = set()
        
        while heap:
            current_dist, current_node, path = heapq.heappop(heap)
            
            if current_node in visited:
                continue
                
            visited.add(current_node)
            
            if current_node == end:
                return path
                
            # 隣接ノードを探索
            for next_node in self.location_nodes:
                if next_node not in visited:
                    edge_key = (current_node, next_node)
                    if edge_key in self.distance_matrix:
                        distance = self.distance_matrix[edge_key]
                        new_dist = current_dist + distance
                        new_path = path + [next_node]
                        heapq.heappush(heap, (new_dist, next_node, new_path))
                        
        # 経路が見つからない場合は直行
        return [start, end]
        
    async def _estimate_transport_time(self, route: List[str], 
                                     transport_mode: TransportMode,
                                     weight: float) -> float:
        """搬送時間を推定"""
        if len(route) < 2:
            return 0.0
            
        total_time = 0.0
        
        # 各区間の時間を計算
        for i in range(len(route) - 1):
            from_node = route[i]
            to_node = route[i + 1]
            
            # 距離を取得
            edge_key = (from_node, to_node)
            distance = self.distance_matrix.get(edge_key, 0.0)
            
            # 搬送方式による速度係数
            speed_factor = self._get_speed_factor(transport_mode, weight)
            
            # 交通密度係数
            traffic_factor = await self._get_traffic_factor(from_node, to_node)
            
            # 区間時間 = 距離 / (基準速度 * 速度係数) * 交通係数
            segment_time = (distance / (1.0 * speed_factor)) * traffic_factor
            total_time += segment_time
            
        # 積込・荷降し時間を追加
        loading_time = self._get_loading_time(transport_mode, weight)
        unloading_time = self._get_unloading_time(transport_mode, weight)
        
        return total_time + loading_time + unloading_time
        
    def _get_speed_factor(self, transport_mode: TransportMode, weight: float) -> float:
        """搬送方式と重量による速度係数"""
        base_factors = {
            TransportMode.MANUAL: 1.5,
            TransportMode.CONVEYOR: 2.0,
            TransportMode.AGV: 2.0,
            TransportMode.FORKLIFT: 3.0,
            TransportMode.TUGGER: 2.5,
            TransportMode.CRANE: 1.0,
            TransportMode.ROBOT: 1.8
        }
        
        base_factor = base_factors.get(transport_mode, 1.0)
        
        # 重量による調整（重いほど遅くなる）
        weight_factor = max(0.5, 1.0 - (weight / 1000.0) * 0.3)
        
        return base_factor * weight_factor
        
    async def _get_traffic_factor(self, from_node: str, to_node: str) -> float:
        """交通密度係数を取得"""
        return self._get_traffic_factor_sync(from_node, to_node)
        
    def _get_traffic_factor_sync(self, from_node: str, to_node: str) -> float:
        """交通密度係数を取得（同期版）"""
        if not self.traffic_monitoring_enabled:
            return 1.0
            
        # 現在のアクティブタスクから交通密度を計算
        active_routes = []
        for task in self.active_tasks.values():
            if task.route:
                active_routes.extend(zip(task.route[:-1], task.route[1:]))
                
        # 同じ経路を使用しているタスク数
        route_usage = active_routes.count((from_node, to_node))
        
        # 交通密度係数（使用量が多いほど遅くなる）
        traffic_factor = 1.0 + (route_usage * 0.2)
        
        return min(traffic_factor, 3.0)  # 最大3倍まで
        
    def _get_loading_time(self, transport_mode: TransportMode, weight: float) -> float:
        """積込時間を取得"""
        base_times = {
            TransportMode.MANUAL: 60,      # 1分
            TransportMode.CONVEYOR: 10,    # 10秒
            TransportMode.AGV: 30,         # 30秒
            TransportMode.FORKLIFT: 120,   # 2分
            TransportMode.TUGGER: 180,     # 3分
            TransportMode.CRANE: 300,      # 5分
            TransportMode.ROBOT: 45        # 45秒
        }
        
        base_time = base_times.get(transport_mode, 60)
        
        # 重量による調整
        weight_factor = 1.0 + (weight / 100.0) * 0.1
        
        return base_time * weight_factor
        
    def _get_unloading_time(self, transport_mode: TransportMode, weight: float) -> float:
        """荷降し時間を取得"""
        # 荷降し時間は積込時間の80%
        return self._get_loading_time(transport_mode, weight) * 0.8
        
    async def _schedule_transport_tasks(self):
        """搬送タスクをスケジューリング"""
        # 利用可能なリソースを取得
        available_resources = self._get_available_resources()
        
        # タスクを優先度順にソート
        sorted_tasks = sorted(
            [self.transport_tasks[tid] for tid in self.task_queue],
            key=lambda t: (-t.priority, t.requested_at)
        )
        
        assigned_tasks = []
        
        for task in sorted_tasks:
            # 適切なリソースを選択
            best_resource = await self._select_best_resource(task, available_resources)
            
            if best_resource:
                # タスクを割り当て
                await self._assign_task_to_resource(task, best_resource)
                assigned_tasks.append(task.task_id)
                available_resources.remove(best_resource)
                
        # 割り当てたタスクをキューから削除
        for task_id in assigned_tasks:
            if task_id in [self.transport_tasks[tid].task_id for tid in self.task_queue]:
                self.task_queue.remove(task_id)
                
    def _get_available_resources(self) -> List[str]:
        """利用可能なリソースを取得"""
        available = []
        
        for resource_id, status in self.resource_status.items():
            if status.status == TransportStatus.IDLE:
                # バッテリーチェック（AGVの場合）
                if "agv" in resource_id and status.battery_level < 20:
                    continue  # バッテリー不足
                    
                available.append(resource_id)
                
        return available
        
    async def _select_best_resource(self, task: TransportTask, 
                                  available_resources: List[str]) -> Optional[str]:
        """最適なリソースを選択"""
        if not available_resources:
            return None
            
        candidates = []
        
        for resource_id in available_resources:
            resource_status = self.resource_status[resource_id]
            
            # 容量チェック
            if resource_status.load_capacity < task.weight:
                continue
                
            # 搬送方式の適合性チェック
            if not self._is_resource_compatible(resource_id, task.transport_mode):
                continue
                
            # 評価スコアを計算
            score = await self._calculate_resource_score(resource_id, task)
            candidates.append((resource_id, score))
            
        if not candidates:
            return None
            
        # 最高スコアのリソースを選択
        best_resource = max(candidates, key=lambda x: x[1])
        return best_resource[0]
        
    def _is_resource_compatible(self, resource_id: str, 
                              transport_mode: TransportMode) -> bool:
        """リソースと搬送方式の適合性チェック"""
        resource_type_map = {
            "manual": [TransportMode.MANUAL],
            "agv": [TransportMode.AGV, TransportMode.MANUAL],
            "forklift": [TransportMode.FORKLIFT, TransportMode.MANUAL],
            "conveyor": [TransportMode.CONVEYOR],
            "crane": [TransportMode.CRANE],
            "robot": [TransportMode.ROBOT]
        }
        
        for resource_type, compatible_modes in resource_type_map.items():
            if resource_type in resource_id:
                return transport_mode in compatible_modes
                
        return False
        
    async def _calculate_resource_score(self, resource_id: str, 
                                      task: TransportTask) -> float:
        """リソースの評価スコアを計算"""
        resource_status = self.resource_status[resource_id]
        
        # 距離による評価（近いほど高スコア）
        distance_to_start = self.distance_matrix.get(
            (resource_status.current_location, task.from_location), 0
        )
        distance_score = 100 / (1 + distance_to_start / 100)
        
        # 容量適合性による評価
        capacity_utilization = task.weight / resource_status.load_capacity
        capacity_score = 50 + (capacity_utilization * 50)  # 適度な利用率が好ましい
        
        # バッテリーレベル（AGVの場合）
        battery_score = resource_status.battery_level if "agv" in resource_id else 100
        
        # 総合スコア
        total_score = (distance_score * 0.4 + capacity_score * 0.3 + battery_score * 0.3)
        
        return total_score
        
    async def _assign_task_to_resource(self, task: TransportTask, resource_id: str):
        """タスクをリソースに割り当て"""
        task.assigned_resource = resource_id
        task.scheduled_at = datetime.now()
        
        resource_status = self.resource_status[resource_id]
        resource_status.current_task = task.task_id
        resource_status.status = TransportStatus.LOADING
        
        self.active_tasks[task.task_id] = task
        
        # イベント発行
        await self._emit_event("transport_task_assigned", {
            "task_id": task.task_id,
            "resource_id": resource_id,
            "estimated_completion": (datetime.now() + timedelta(seconds=task.estimated_time)).isoformat()
        })
        
        # タスク実行を開始
        await self._start_task_execution(task)
        
    async def _start_task_execution(self, task: TransportTask):
        """タスク実行を開始"""
        # SimPyプロセスとして実行
        def execute_transport():
            resource_status = self.resource_status[task.assigned_resource]
            
            try:
                # 開始位置への移動
                if resource_status.current_location != task.from_location:
                    travel_time = self.distance_matrix.get(
                        (resource_status.current_location, task.from_location), 0
                    ) / resource_status.speed
                    
                    resource_status.status = TransportStatus.TRAVELING
                    yield self.env.timeout(travel_time)
                    resource_status.current_location = task.from_location
                    
                # 積込
                resource_status.status = TransportStatus.LOADING
                loading_time = self._get_loading_time(task.transport_mode, task.weight)
                yield self.env.timeout(loading_time)
                
                task.started_at = datetime.now()
                resource_status.current_load = task.weight
                
                asyncio.create_task(self._emit_event("transport_loading_completed", {
                    "task_id": task.task_id
                }))
                
                # 経路に沿って移動
                resource_status.status = TransportStatus.TRAVELING
                for i in range(len(task.route) - 1):
                    from_node = task.route[i]
                    to_node = task.route[i + 1]
                    
                    distance = self.distance_matrix.get((from_node, to_node), 0)
                    travel_time = distance / resource_status.speed
                    
                    # 交通密度を考慮
                    traffic_factor = self._get_traffic_factor_sync(from_node, to_node)
                    actual_travel_time = travel_time * traffic_factor
                    
                    yield self.env.timeout(actual_travel_time)
                    resource_status.current_location = to_node
                    
                    # バッテリー消費（AGVの場合）
                    if "agv" in task.assigned_resource:
                        battery_consumption = distance / 1000 * 2  # 1kmあたり2%消費
                        resource_status.battery_level = max(0, resource_status.battery_level - battery_consumption)
                        
                # 荷降し
                resource_status.status = TransportStatus.UNLOADING
                unloading_time = self._get_unloading_time(task.transport_mode, task.weight)
                yield self.env.timeout(unloading_time)
                
                # タスク完了
                task.completed_at = datetime.now()
                task.actual_time = (task.completed_at - task.started_at).total_seconds()
                
                resource_status.status = TransportStatus.IDLE
                resource_status.current_task = None
                resource_status.current_load = 0.0
                
                # 統計更新
                self.stats["completed_tasks"] += 1
                self.stats["total_distance"] += sum(
                    self.distance_matrix.get((task.route[i], task.route[i+1]), 0)
                    for i in range(len(task.route) - 1)
                )
                self.stats["total_time"] += task.actual_time
                
                # アクティブタスクから削除
                if task.task_id in self.active_tasks:
                    del self.active_tasks[task.task_id]
                    
                asyncio.create_task(self._emit_event("transport_task_completed", {
                    "task_id": task.task_id,
                    "actual_time": task.actual_time,
                    "estimated_time": task.estimated_time,
                    "efficiency": task.estimated_time / task.actual_time if task.actual_time > 0 else 1.0
                }))
                
                # 次のタスクをスケジュール
                asyncio.create_task(self._schedule_transport_tasks())
                
            except Exception as e:
                asyncio.create_task(self._handle_transport_error(task, str(e)))
                
        return self.env.process(execute_transport())
        
    async def _handle_transport_error(self, task: TransportTask, error_message: str):
        """搬送エラーを処理"""
        if task.assigned_resource:
            resource_status = self.resource_status[task.assigned_resource]
            resource_status.status = TransportStatus.BREAKDOWN
            resource_status.current_task = None
            
        # エラーイベント発行
        await self._emit_event("transport_error", {
            "task_id": task.task_id,
            "error": error_message,
            "resource_id": task.assigned_resource
        })
        
        # タスクをキューに戻す
        self.task_queue.append(task.task_id)
        if task.task_id in self.active_tasks:
            del self.active_tasks[task.task_id]
            
    def get_transport_status(self) -> Dict[str, Any]:
        """搬送状況を取得"""
        return {
            "tasks": {
                "total": self.stats["total_tasks"],
                "completed": self.stats["completed_tasks"],
                "active": len(self.active_tasks),
                "queued": len(self.task_queue)
            },
            "resources": {
                resource_id: {
                    "status": status.status.value,
                    "location": status.current_location,
                    "battery": status.battery_level,
                    "load": f"{status.current_load}/{status.load_capacity}",
                    "current_task": status.current_task
                }
                for resource_id, status in self.resource_status.items()
            },
            "performance": {
                "average_completion_time": (
                    self.stats["total_time"] / self.stats["completed_tasks"]
                    if self.stats["completed_tasks"] > 0 else 0
                ),
                "total_distance": self.stats["total_distance"],
                "resource_utilization": self._calculate_resource_utilization()
            }
        }
        
    def _calculate_resource_utilization(self) -> float:
        """リソース稼働率を計算"""
        if not self.resource_status:
            return 0.0
            
        busy_resources = sum(
            1 for status in self.resource_status.values()
            if status.status != TransportStatus.IDLE
        )
        
        return (busy_resources / len(self.resource_status)) * 100
        
    async def optimize_transport_routes(self):
        """搬送経路を最適化"""
        # 全体的な経路最適化（定期実行）
        if len(self.active_tasks) < 2:
            return
            
        # 現在のアクティブタスクを分析
        route_conflicts = self._detect_route_conflicts()
        
        if route_conflicts:
            await self._resolve_route_conflicts(route_conflicts)
            
    def _detect_route_conflicts(self) -> List[Dict[str, Any]]:
        """経路競合を検出"""
        conflicts = []
        
        # 同じ経路セグメントを使用するタスクを検出
        segment_usage = defaultdict(list)
        
        for task in self.active_tasks.values():
            if task.route and len(task.route) > 1:
                for i in range(len(task.route) - 1):
                    segment = (task.route[i], task.route[i + 1])
                    segment_usage[segment].append(task.task_id)
                    
        # 競合が発生しているセグメントを特定
        for segment, task_ids in segment_usage.items():
            if len(task_ids) > 1:
                conflicts.append({
                    "segment": segment,
                    "conflicting_tasks": task_ids,
                    "conflict_level": len(task_ids)
                })
                
        return conflicts
        
    async def _resolve_route_conflicts(self, conflicts: List[Dict[str, Any]]):
        """経路競合を解決"""
        for conflict in conflicts:
            # 低優先度のタスクに代替経路を提案
            task_ids = conflict["conflicting_tasks"]
            
            # 優先度でソート
            sorted_tasks = sorted(
                [self.active_tasks[tid] for tid in task_ids],
                key=lambda t: t.priority
            )
            
            # 最低優先度のタスクに代替経路を計算
            if len(sorted_tasks) > 1:
                lowest_priority_task = sorted_tasks[0]
                alternative_route = await self._find_alternative_route(
                    lowest_priority_task.from_location,
                    lowest_priority_task.to_location,
                    avoid_segments=[conflict["segment"]]
                )
                
                if alternative_route:
                    await self._emit_event("route_conflict_resolved", {
                        "task_id": lowest_priority_task.task_id,
                        "original_route": lowest_priority_task.route,
                        "alternative_route": alternative_route
                    })
                    
    async def _find_alternative_route(self, start: str, end: str, 
                                    avoid_segments: List[Tuple[str, str]]) -> List[str]:
        """代替経路を検索"""
        # 回避すべきセグメントを除外してダイクストラ法を実行
        # 実装簡略化のため、元の経路をそのまま返す
        return await self._dijkstra_shortest_path(start, end)
        
    async def _emit_event(self, event_type: str, data: Dict[str, Any] = None):
        """イベントを発行"""
        event = SimulationEvent(
            timestamp=datetime.now(),
            event_type=event_type,
            data=data or {}
        )
        await self.event_manager.emit_event(event)
