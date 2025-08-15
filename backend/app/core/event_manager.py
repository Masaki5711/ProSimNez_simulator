"""
高度なイベント管理システム
"""
import asyncio
from typing import Dict, List, Callable, Optional, Any
from datetime import datetime
from enum import Enum
import json
import uuid

from app.models.event import SimulationEvent

class EventPriority(Enum):
    """イベント優先度"""
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4

class EventStatus(Enum):
    """イベント処理状態"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class EventHandler:
    """イベントハンドラー基底クラス"""
    
    def __init__(self, handler_id: str, event_types: List[str], priority: EventPriority = EventPriority.NORMAL):
        self.handler_id = handler_id
        self.event_types = event_types
        self.priority = priority
        self.is_active = True
        
    async def handle(self, event: SimulationEvent) -> bool:
        """イベントを処理 - サブクラスで実装"""
        raise NotImplementedError

class EventManager:
    """高度なイベント管理システム"""
    
    def __init__(self, max_queue_size: int = 10000):
        self.max_queue_size = max_queue_size
        self.event_queue = asyncio.Queue(maxsize=max_queue_size)
        self.handlers: Dict[str, EventHandler] = {}
        self.event_history: List[SimulationEvent] = []
        self.is_processing = False
        self.processing_task: Optional[asyncio.Task] = None
        
        # 統計情報
        self.stats = {
            "events_processed": 0,
            "events_failed": 0,
            "handlers_executed": 0,
            "average_processing_time": 0.0
        }
        
    def register_handler(self, handler: EventHandler):
        """イベントハンドラーを登録"""
        self.handlers[handler.handler_id] = handler
        
    def unregister_handler(self, handler_id: str):
        """イベントハンドラーの登録を解除"""
        if handler_id in self.handlers:
            del self.handlers[handler_id]
            
    def get_matching_handlers(self, event: SimulationEvent) -> List[EventHandler]:
        """イベントにマッチするハンドラーを取得"""
        matching_handlers = []
        
        for handler in self.handlers.values():
            if (handler.is_active and 
                (not handler.event_types or event.event_type in handler.event_types)):
                matching_handlers.append(handler)
                
        # 優先度でソート
        matching_handlers.sort(key=lambda h: h.priority.value)
        return matching_handlers
        
    async def emit_event(self, event: SimulationEvent, priority: EventPriority = EventPriority.NORMAL):
        """イベントを発行"""
        try:
            # イベントにメタデータを追加
            event.data.update({
                "event_id": str(uuid.uuid4()),
                "priority": priority.value,
                "emitted_at": datetime.now().isoformat()
            })
            
            # キューに追加
            await self.event_queue.put((priority, event))
            
        except asyncio.QueueFull:
            # キューが満杯の場合、古いイベントを削除
            try:
                await self.event_queue.get_nowait()
                await self.event_queue.put((priority, event))
            except asyncio.QueueEmpty:
                pass
                
    async def start_processing(self):
        """イベント処理を開始"""
        if self.is_processing:
            return
            
        self.is_processing = True
        self.processing_task = asyncio.create_task(self._process_events())
        
    async def stop_processing(self):
        """イベント処理を停止"""
        self.is_processing = False
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
                
    async def _process_events(self):
        """イベント処理メインループ"""
        while self.is_processing:
            try:
                # イベントを取得（タイムアウト付き）
                priority, event = await asyncio.wait_for(
                    self.event_queue.get(), 
                    timeout=1.0
                )
                
                # イベントを処理
                await self._handle_event(event)
                
            except asyncio.TimeoutError:
                # タイムアウトは正常な動作
                continue
            except Exception as e:
                print(f"イベント処理エラー: {e}")
                
    async def _handle_event(self, event: SimulationEvent):
        """単一イベントを処理"""
        start_time = datetime.now()
        
        try:
            # マッチするハンドラーを取得
            handlers = self.get_matching_handlers(event)
            
            # 各ハンドラーで処理
            for handler in handlers:
                try:
                    success = await handler.handle(event)
                    if success:
                        self.stats["handlers_executed"] += 1
                except Exception as e:
                    print(f"ハンドラー {handler.handler_id} でエラー: {e}")
                    self.stats["events_failed"] += 1
                    
            # 履歴に追加
            self.event_history.append(event)
            
            # 履歴サイズ制限
            if len(self.event_history) > 1000:
                self.event_history = self.event_history[-800:]  # 800件に削減
                
            self.stats["events_processed"] += 1
            
            # 処理時間を更新
            processing_time = (datetime.now() - start_time).total_seconds()
            self.stats["average_processing_time"] = (
                (self.stats["average_processing_time"] * (self.stats["events_processed"] - 1) + processing_time) /
                self.stats["events_processed"]
            )
            
        except Exception as e:
            print(f"イベント処理エラー: {e}")
            self.stats["events_failed"] += 1
            
    def get_event_history(self, event_type: Optional[str] = None, limit: int = 100) -> List[SimulationEvent]:
        """イベント履歴を取得"""
        if event_type:
            filtered_events = [e for e in self.event_history if e.event_type == event_type]
        else:
            filtered_events = self.event_history
            
        return filtered_events[-limit:]
        
    def get_statistics(self) -> Dict[str, Any]:
        """統計情報を取得"""
        return {
            **self.stats,
            "queue_size": self.event_queue.qsize(),
            "handlers_count": len(self.handlers),
            "history_size": len(self.event_history)
        }
        
    def clear_history(self):
        """イベント履歴をクリア"""
        self.event_history.clear()

class RealtimeEventHandler(EventHandler):
    """リアルタイムデータ配信用ハンドラー"""
    
    def __init__(self, websocket_manager, redis_client=None):
        super().__init__(
            "realtime_handler", 
            ["state_update", "process_start", "process_complete", "alert"],
            EventPriority.HIGH
        )
        self.websocket_manager = websocket_manager
        self.redis_client = redis_client
        
    async def handle(self, event: SimulationEvent) -> bool:
        """リアルタイムデータを配信"""
        try:
            # WebSocketで配信
            if self.websocket_manager:
                await self.websocket_manager.broadcast(event.to_dict())
                
            # Redisにキャッシュ
            if self.redis_client:
                await self.redis_client.set(
                    f"latest_event:{event.event_type}",
                    json.dumps(event.to_dict()),
                    ex=300  # 5分で期限切れ
                )
                
            return True
        except Exception as e:
            print(f"リアルタイム配信エラー: {e}")
            return False

class StatisticsEventHandler(EventHandler):
    """統計収集用ハンドラー"""
    
    def __init__(self):
        super().__init__(
            "statistics_handler",
            ["process_complete", "lot_arrival", "equipment_status"],
            EventPriority.NORMAL
        )
        self.production_stats = {}
        self.equipment_stats = {}
        
    async def handle(self, event: SimulationEvent) -> bool:
        """統計データを収集"""
        try:
            if event.event_type == "process_complete":
                process_id = event.process_id
                if process_id not in self.production_stats:
                    self.production_stats[process_id] = {
                        "total_products": 0,
                        "total_time": 0.0,
                        "defect_count": 0
                    }
                
                self.production_stats[process_id]["total_products"] += 1
                
                # 処理時間を記録
                if "processing_time" in event.data:
                    self.production_stats[process_id]["total_time"] += event.data["processing_time"]
                    
            elif event.event_type == "equipment_status":
                equipment_id = event.equipment_id
                if equipment_id not in self.equipment_stats:
                    self.equipment_stats[equipment_id] = {
                        "running_time": 0.0,
                        "idle_time": 0.0,
                        "breakdown_time": 0.0
                    }
                    
                status = event.data.get("status", "unknown")
                duration = event.data.get("duration", 0.0)
                
                if status == "running":
                    self.equipment_stats[equipment_id]["running_time"] += duration
                elif status == "idle":
                    self.equipment_stats[equipment_id]["idle_time"] += duration
                elif status == "breakdown":
                    self.equipment_stats[equipment_id]["breakdown_time"] += duration
                    
            return True
        except Exception as e:
            print(f"統計収集エラー: {e}")
            return False
            
    def get_production_statistics(self) -> Dict[str, Any]:
        """生産統計を取得"""
        return self.production_stats.copy()
        
    def get_equipment_statistics(self) -> Dict[str, Any]:
        """設備統計を取得"""
        return self.equipment_stats.copy()
