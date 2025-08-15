"""
リソース管理システム
"""
import asyncio
from typing import Dict, List, Optional, Any, Set
from datetime import datetime, timedelta
from enum import Enum
import uuid

class ResourceType(Enum):
    """リソースタイプ"""
    EQUIPMENT = "equipment"
    WORKER = "worker"
    TRANSPORT = "transport"
    MATERIAL = "material"
    BUFFER = "buffer"

class ResourceStatus(Enum):
    """リソース状態"""
    AVAILABLE = "available"
    BUSY = "busy"
    MAINTENANCE = "maintenance"
    BREAKDOWN = "breakdown"
    RESERVED = "reserved"

class Resource:
    """リソース基底クラス"""
    
    def __init__(self, resource_id: str, resource_type: ResourceType, capacity: int = 1):
        self.resource_id = resource_id
        self.resource_type = resource_type
        self.capacity = capacity
        self.status = ResourceStatus.AVAILABLE
        self.current_usage = 0
        self.reservations: List[Dict] = []
        self.history: List[Dict] = []
        self.properties: Dict[str, Any] = {}
        
    def is_available(self) -> bool:
        """リソースが利用可能か確認"""
        return (self.status == ResourceStatus.AVAILABLE and 
                self.current_usage < self.capacity)
                
    def get_available_capacity(self) -> int:
        """利用可能容量を取得"""
        if self.status != ResourceStatus.AVAILABLE:
            return 0
        return self.capacity - self.current_usage
        
    def reserve(self, requester_id: str, quantity: int = 1, 
                start_time: Optional[datetime] = None,
                duration: Optional[timedelta] = None) -> Optional[str]:
        """リソースを予約"""
        if self.get_available_capacity() < quantity:
            return None
            
        reservation_id = str(uuid.uuid4())
        reservation = {
            "reservation_id": reservation_id,
            "requester_id": requester_id,
            "quantity": quantity,
            "start_time": start_time or datetime.now(),
            "duration": duration,
            "status": "reserved"
        }
        
        self.reservations.append(reservation)
        self.current_usage += quantity
        
        if self.current_usage >= self.capacity:
            self.status = ResourceStatus.RESERVED
            
        return reservation_id
        
    def release(self, reservation_id: str) -> bool:
        """リソースを解放"""
        for i, reservation in enumerate(self.reservations):
            if reservation["reservation_id"] == reservation_id:
                quantity = reservation["quantity"]
                self.current_usage -= quantity
                
                # 履歴に追加
                reservation["released_at"] = datetime.now()
                self.history.append(reservation)
                
                # 予約リストから削除
                del self.reservations[i]
                
                # ステータス更新
                if self.current_usage == 0:
                    self.status = ResourceStatus.AVAILABLE
                    
                return True
        return False
        
    def get_utilization(self) -> float:
        """稼働率を計算"""
        if self.capacity == 0:
            return 0.0
        return (self.current_usage / self.capacity) * 100
        
    def get_state(self) -> Dict[str, Any]:
        """リソース状態を取得"""
        return {
            "resource_id": self.resource_id,
            "resource_type": self.resource_type.value,
            "status": self.status.value,
            "capacity": self.capacity,
            "current_usage": self.current_usage,
            "utilization": self.get_utilization(),
            "reservations_count": len(self.reservations),
            "properties": self.properties
        }

class Equipment(Resource):
    """設備リソース"""
    
    def __init__(self, equipment_id: str, name: str, process_id: str):
        super().__init__(equipment_id, ResourceType.EQUIPMENT)
        self.name = name
        self.process_id = process_id
        self.setup_time = 0.0
        self.current_product_id: Optional[str] = None
        self.maintenance_schedule: List[Dict] = []
        
    def set_maintenance_schedule(self, start_time: datetime, duration: timedelta):
        """メンテナンススケジュールを設定"""
        self.maintenance_schedule.append({
            "start_time": start_time,
            "duration": duration,
            "status": "scheduled"
        })
        
    def start_maintenance(self) -> bool:
        """メンテナンスを開始"""
        if self.status == ResourceStatus.AVAILABLE:
            self.status = ResourceStatus.MAINTENANCE
            return True
        return False
        
    def complete_maintenance(self) -> bool:
        """メンテナンスを完了"""
        if self.status == ResourceStatus.MAINTENANCE:
            self.status = ResourceStatus.AVAILABLE
            return True
        return False

class Worker(Resource):
    """作業者リソース"""
    
    def __init__(self, worker_id: str, name: str, skills: List[str]):
        super().__init__(worker_id, ResourceType.WORKER)
        self.name = name
        self.skills = skills
        self.shift_schedule: List[Dict] = []
        self.current_process_id: Optional[str] = None
        
    def has_skill(self, skill: str) -> bool:
        """スキルを持っているか確認"""
        return skill in self.skills
        
    def add_skill(self, skill: str):
        """スキルを追加"""
        if skill not in self.skills:
            self.skills.append(skill)
            
    def is_available_for_process(self, process_id: str, required_skills: List[str]) -> bool:
        """指定工程で利用可能か確認"""
        if not self.is_available():
            return False
            
        # 必要スキルをチェック
        for skill in required_skills:
            if not self.has_skill(skill):
                return False
                
        return True

class TransportResource(Resource):
    """搬送リソース"""
    
    def __init__(self, transport_id: str, name: str, transport_type: str):
        super().__init__(transport_id, ResourceType.TRANSPORT)
        self.name = name
        self.transport_type = transport_type  # "AGV", "forklift", "conveyor", "manual"
        self.current_location: Optional[str] = None
        self.speed = 1.0  # m/s
        self.load_capacity = 100  # kg
        self.current_load = 0.0
        
    def move_to(self, location: str, distance: float) -> float:
        """指定位置に移動（移動時間を返す）"""
        travel_time = distance / self.speed
        self.current_location = location
        return travel_time
        
    def can_carry_load(self, weight: float) -> bool:
        """荷物を運べるか確認"""
        return self.current_load + weight <= self.load_capacity

class ResourceManager:
    """リソース管理システム"""
    
    def __init__(self):
        self.resources: Dict[str, Resource] = {}
        self.resource_types: Dict[ResourceType, Set[str]] = {
            resource_type: set() for resource_type in ResourceType
        }
        self.allocation_history: List[Dict] = []
        self.conflicts: List[Dict] = []
        
    def register_resource(self, resource: Resource):
        """リソースを登録"""
        self.resources[resource.resource_id] = resource
        self.resource_types[resource.resource_type].add(resource.resource_id)
        
    def unregister_resource(self, resource_id: str):
        """リソースの登録を解除"""
        if resource_id in self.resources:
            resource = self.resources[resource_id]
            self.resource_types[resource.resource_type].discard(resource_id)
            del self.resources[resource_id]
            
    def get_resource(self, resource_id: str) -> Optional[Resource]:
        """リソースを取得"""
        return self.resources.get(resource_id)
        
    def get_resources_by_type(self, resource_type: ResourceType) -> List[Resource]:
        """タイプ別にリソースを取得"""
        return [
            self.resources[resource_id] 
            for resource_id in self.resource_types[resource_type]
            if resource_id in self.resources
        ]
        
    def find_available_resources(self, resource_type: ResourceType, 
                               quantity: int = 1,
                               criteria: Optional[Dict[str, Any]] = None) -> List[Resource]:
        """利用可能なリソースを検索"""
        available_resources = []
        
        for resource in self.get_resources_by_type(resource_type):
            if resource.get_available_capacity() >= quantity:
                # 追加条件をチェック
                if criteria:
                    if not self._check_criteria(resource, criteria):
                        continue
                        
                available_resources.append(resource)
                
        return available_resources
        
    def _check_criteria(self, resource: Resource, criteria: Dict[str, Any]) -> bool:
        """リソースが条件を満たすかチェック"""
        for key, value in criteria.items():
            if hasattr(resource, key):
                if getattr(resource, key) != value:
                    return False
            elif key in resource.properties:
                if resource.properties[key] != value:
                    return False
            else:
                return False
        return True
        
    def allocate_resource(self, resource_id: str, requester_id: str,
                         quantity: int = 1,
                         duration: Optional[timedelta] = None) -> Optional[str]:
        """リソースを割り当て"""
        resource = self.get_resource(resource_id)
        if not resource:
            return None
            
        reservation_id = resource.reserve(requester_id, quantity, duration=duration)
        
        if reservation_id:
            # 割り当て履歴に記録
            allocation = {
                "allocation_id": str(uuid.uuid4()),
                "resource_id": resource_id,
                "requester_id": requester_id,
                "quantity": quantity,
                "reservation_id": reservation_id,
                "allocated_at": datetime.now(),
                "duration": duration
            }
            self.allocation_history.append(allocation)
            
        return reservation_id
        
    def release_resource(self, resource_id: str, reservation_id: str) -> bool:
        """リソースを解放"""
        resource = self.get_resource(resource_id)
        if not resource:
            return False
            
        return resource.release(reservation_id)
        
    def detect_conflicts(self) -> List[Dict]:
        """リソース競合を検出"""
        current_conflicts = []
        
        for resource in self.resources.values():
            if len(resource.reservations) > 1:
                # 同時予約による競合をチェック
                overlapping_reservations = self._find_overlapping_reservations(resource.reservations)
                if overlapping_reservations:
                    conflict = {
                        "conflict_id": str(uuid.uuid4()),
                        "resource_id": resource.resource_id,
                        "type": "overlapping_reservations",
                        "reservations": overlapping_reservations,
                        "detected_at": datetime.now()
                    }
                    current_conflicts.append(conflict)
                    
        return current_conflicts
        
    def _find_overlapping_reservations(self, reservations: List[Dict]) -> List[Dict]:
        """重複する予約を検出"""
        overlapping = []
        
        for i, res1 in enumerate(reservations):
            for j, res2 in enumerate(reservations[i+1:], i+1):
                if self._reservations_overlap(res1, res2):
                    overlapping.extend([res1, res2])
                    
        return list({res["reservation_id"]: res for res in overlapping}.values())
        
    def _reservations_overlap(self, res1: Dict, res2: Dict) -> bool:
        """2つの予約が重複するかチェック"""
        if not res1.get("duration") or not res2.get("duration"):
            return False
            
        start1 = res1["start_time"]
        end1 = start1 + res1["duration"]
        start2 = res2["start_time"]
        end2 = start2 + res2["duration"]
        
        return not (end1 <= start2 or end2 <= start1)
        
    def get_resource_utilization_report(self) -> Dict[str, Any]:
        """リソース稼働率レポートを生成"""
        report = {
            "total_resources": len(self.resources),
            "by_type": {},
            "high_utilization": [],
            "low_utilization": [],
            "conflicts": len(self.detect_conflicts())
        }
        
        for resource_type in ResourceType:
            resources = self.get_resources_by_type(resource_type)
            if not resources:
                continue
                
            total_utilization = sum(r.get_utilization() for r in resources)
            avg_utilization = total_utilization / len(resources)
            
            report["by_type"][resource_type.value] = {
                "count": len(resources),
                "average_utilization": round(avg_utilization, 2),
                "available": len([r for r in resources if r.is_available()]),
                "busy": len([r for r in resources if r.status == ResourceStatus.BUSY])
            }
            
            # 高稼働率・低稼働率リソースを特定
            for resource in resources:
                utilization = resource.get_utilization()
                if utilization > 90:
                    report["high_utilization"].append({
                        "resource_id": resource.resource_id,
                        "utilization": utilization
                    })
                elif utilization < 20:
                    report["low_utilization"].append({
                        "resource_id": resource.resource_id,
                        "utilization": utilization
                    })
                    
        return report
        
    def optimize_allocation(self) -> Dict[str, Any]:
        """リソース割り当ての最適化提案"""
        optimization_suggestions = []
        
        # 高稼働率リソースの負荷分散提案
        for resource_type in ResourceType:
            resources = self.get_resources_by_type(resource_type)
            if len(resources) < 2:
                continue
                
            utilizations = [(r.resource_id, r.get_utilization()) for r in resources]
            utilizations.sort(key=lambda x: x[1], reverse=True)
            
            if utilizations[0][1] > 80 and utilizations[-1][1] < 50:
                optimization_suggestions.append({
                    "type": "load_balancing",
                    "resource_type": resource_type.value,
                    "overloaded": utilizations[0][0],
                    "underutilized": utilizations[-1][0],
                    "potential_improvement": utilizations[0][1] - utilizations[-1][1]
                })
                
        return {
            "suggestions": optimization_suggestions,
            "potential_savings": len(optimization_suggestions) * 10  # 概算効果
        }
