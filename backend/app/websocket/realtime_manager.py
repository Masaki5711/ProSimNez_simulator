"""
リアルタイムデータ管理システム
WebSocket + Redis を使用した高速データ配信
"""
import asyncio
import json
try:
    import redis.asyncio as redis
except ImportError:
    try:
        import aioredis as redis
    except ImportError:
        redis = None
from typing import Dict, List, Set, Optional, Any, Callable
from datetime import datetime, timedelta
import uuid
from fastapi import WebSocket, WebSocketDisconnect
import logging

logger = logging.getLogger(__name__)

class ConnectionInfo:
    """WebSocket接続情報"""
    
    def __init__(self, websocket: WebSocket, client_id: str, 
                 project_id: Optional[str] = None,
                 user_id: Optional[str] = None):
        self.websocket = websocket
        self.client_id = client_id
        self.project_id = project_id
        self.user_id = user_id
        self.connected_at = datetime.now()
        self.last_activity = datetime.now()
        self.subscriptions: Set[str] = set()
        
    def update_activity(self):
        """最終活動時刻を更新"""
        self.last_activity = datetime.now()
        
    def is_active(self, timeout_seconds: int = 300) -> bool:
        """接続がアクティブかチェック（5分間のタイムアウト）"""
        return (datetime.now() - self.last_activity).seconds < timeout_seconds

class WebSocketManager:
    """WebSocket接続管理"""
    
    def __init__(self):
        self.connections: Dict[str, ConnectionInfo] = {}
        self.project_connections: Dict[str, Set[str]] = {}  # project_id -> client_ids
        self.user_connections: Dict[str, Set[str]] = {}     # user_id -> client_ids
        self.heartbeat_task: Optional[asyncio.Task] = None
        
    async def connect(self, websocket: WebSocket, client_id: str, 
                     project_id: Optional[str] = None,
                     user_id: Optional[str] = None) -> ConnectionInfo:
        """新しい接続を受け入れ"""
        await websocket.accept()
        
        connection = ConnectionInfo(websocket, client_id, project_id, user_id)
        self.connections[client_id] = connection
        
        # プロジェクト別接続管理
        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = set()
            self.project_connections[project_id].add(client_id)
            
        # ユーザー別接続管理
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(client_id)
            
        logger.info(f"新しい接続: {client_id} (プロジェクト: {project_id}, ユーザー: {user_id})")
        
        # ハートビートタスクを開始（まだ開始していない場合）
        if not self.heartbeat_task:
            self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
        return connection
        
    async def disconnect(self, client_id: str):
        """接続を切断"""
        if client_id not in self.connections:
            return
            
        connection = self.connections[client_id]
        
        # プロジェクト別接続から削除
        if connection.project_id and connection.project_id in self.project_connections:
            self.project_connections[connection.project_id].discard(client_id)
            if not self.project_connections[connection.project_id]:
                del self.project_connections[connection.project_id]
                
        # ユーザー別接続から削除
        if connection.user_id and connection.user_id in self.user_connections:
            self.user_connections[connection.user_id].discard(client_id)
            if not self.user_connections[connection.user_id]:
                del self.user_connections[connection.user_id]
                
        # 接続リストから削除
        del self.connections[client_id]
        
        logger.info(f"接続切断: {client_id}")
        
    async def send_to_client(self, client_id: str, message: Dict[str, Any]) -> bool:
        """特定のクライアントにメッセージを送信"""
        if client_id not in self.connections:
            return False
            
        connection = self.connections[client_id]
        try:
            await connection.websocket.send_text(json.dumps(message))
            connection.update_activity()
            return True
        except Exception as e:
            logger.error(f"クライアント {client_id} への送信エラー: {e}")
            await self.disconnect(client_id)
            return False
            
    async def send_to_project(self, project_id: str, message: Dict[str, Any]) -> int:
        """プロジェクトの全クライアントにメッセージを送信"""
        if project_id not in self.project_connections:
            return 0
            
        sent_count = 0
        client_ids = list(self.project_connections[project_id])  # コピーを作成
        
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                sent_count += 1
                
        return sent_count
        
    async def send_to_user(self, user_id: str, message: Dict[str, Any]) -> int:
        """ユーザーの全クライアントにメッセージを送信"""
        if user_id not in self.user_connections:
            return 0
            
        sent_count = 0
        client_ids = list(self.user_connections[user_id])  # コピーを作成
        
        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                sent_count += 1
                
        return sent_count
        
    async def broadcast(self, message: Dict[str, Any]) -> int:
        """全クライアントにメッセージをブロードキャスト"""
        sent_count = 0
        client_ids = list(self.connections.keys())  # コピーを作成

        for client_id in client_ids:
            if await self.send_to_client(client_id, message):
                sent_count += 1

        return sent_count

    async def broadcast_to_all(self, message) -> int:
        """全クライアントにメッセージをブロードキャスト（文字列またはdict対応）"""
        if isinstance(message, str):
            message = json.loads(message)
        return await self.broadcast(message)
        
    async def _heartbeat_loop(self):
        """ハートビートループ - 非アクティブな接続を検出"""
        while True:
            try:
                await asyncio.sleep(30)  # 30秒ごとにチェック
                
                inactive_clients = []
                for client_id, connection in self.connections.items():
                    if not connection.is_active():
                        inactive_clients.append(client_id)
                        
                # 非アクティブな接続を切断
                for client_id in inactive_clients:
                    await self.disconnect(client_id)
                    
            except Exception as e:
                logger.error(f"ハートビートエラー: {e}")
                
    def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計を取得"""
        return {
            "total_connections": len(self.connections),
            "project_connections": {pid: len(clients) for pid, clients in self.project_connections.items()},
            "user_connections": {uid: len(clients) for uid, clients in self.user_connections.items()},
            "active_connections": len([c for c in self.connections.values() if c.is_active()])
        }

class RedisCache:
    """Redis キャッシュマネージャー"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis_url = redis_url
        self.redis_client: Optional[Any] = None
        self.pubsub: Optional[Any] = None
        
    async def connect(self):
        """Redisに接続"""
        if redis is None:
            logger.warning("Redis未インストール（Redis機能は無効になります）")
            return
            
        try:
            self.redis_client = redis.from_url(self.redis_url)
            await self.redis_client.ping()
            self.pubsub = self.redis_client.pubsub()
            logger.info("Redis接続成功")
        except Exception as e:
            logger.warning(f"Redis接続エラー（Redis機能は無効になります）: {e}")
            self.redis_client = None
            
    async def disconnect(self):
        """Redis接続を切断"""
        if self.pubsub:
            await self.pubsub.close()
        if self.redis_client:
            await self.redis_client.close()
            
    async def set_data(self, key: str, data: Dict[str, Any], 
                      expire_seconds: Optional[int] = None):
        """データをキャッシュに保存"""
        if not self.redis_client:
            return False
            
        try:
            json_data = json.dumps(data, default=str)
            if expire_seconds:
                await self.redis_client.setex(key, expire_seconds, json_data)
            else:
                await self.redis_client.set(key, json_data)
            return True
        except Exception as e:
            logger.error(f"Redis保存エラー: {e}")
            return False
            
    async def get_data(self, key: str) -> Optional[Dict[str, Any]]:
        """キャッシュからデータを取得"""
        if not self.redis_client:
            return None
            
        try:
            data = await self.redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Redis取得エラー: {e}")
            return None
            
    async def publish(self, channel: str, message: Dict[str, Any]):
        """メッセージをパブリッシュ"""
        if not self.redis_client:
            return False
            
        try:
            json_message = json.dumps(message, default=str)
            await self.redis_client.publish(channel, json_message)
            return True
        except Exception as e:
            logger.error(f"Redisパブリッシュエラー: {e}")
            return False
            
    async def subscribe(self, channels: List[str], 
                       callback: Callable[[str, Dict[str, Any]], None]):
        """チャンネルを購読"""
        if not self.pubsub:
            return
            
        try:
            await self.pubsub.subscribe(*channels)
            
            async for message in self.pubsub.listen():
                if message['type'] == 'message':
                    channel = message['channel'].decode('utf-8')
                    data = json.loads(message['data'].decode('utf-8'))
                    await callback(channel, data)
                    
        except Exception as e:
            logger.error(f"Redis購読エラー: {e}")

class RealtimeDataManager:
    """リアルタイムデータ管理システム"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.websocket_manager = WebSocketManager()
        self.redis_cache = RedisCache(redis_url)
        self.data_streams: Dict[str, Any] = {}
        self.subscription_task: Optional[asyncio.Task] = None
        
    async def initialize(self):
        """システムを初期化"""
        await self.redis_cache.connect()
        
        # Redisチャンネルを購読（Redis接続が成功した場合のみ）
        if self.redis_cache.redis_client:
            self.subscription_task = asyncio.create_task(
                self._subscribe_to_channels()
            )
        else:
            logger.info("Redis not connected, realtime broadcast will use WebSocket only")
            
    async def shutdown(self):
        """システムを終了"""
        if self.subscription_task:
            self.subscription_task.cancel()
            
        await self.redis_cache.disconnect()
        
    async def _subscribe_to_channels(self):
        """Redisチャンネルを購読"""
        channels = [
            "simulation_events",
            "resource_updates", 
            "kpi_updates",
            "alert_notifications"
        ]
        
        await self.redis_cache.subscribe(channels, self._handle_redis_message)
        
    async def _handle_redis_message(self, channel: str, data: Dict[str, Any]):
        """Redisメッセージを処理"""
        # WebSocketクライアントに配信
        message = {
            "type": "realtime_update",
            "channel": channel,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        
        # プロジェクト固有の場合は、そのプロジェクトのクライアントのみに送信
        if "project_id" in data:
            await self.websocket_manager.send_to_project(data["project_id"], message)
        else:
            await self.websocket_manager.broadcast(message)
            
    async def emit_simulation_event(self, event_data: Dict[str, Any], 
                                   project_id: Optional[str] = None):
        """シミュレーションイベントを配信"""
        # データを拡張
        enhanced_data = {
            **event_data,
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "project_id": project_id
        }
        
        # Redisにキャッシュ
        cache_key = f"latest_event:{enhanced_data['event_type']}"
        if project_id:
            cache_key = f"project:{project_id}:{cache_key}"
            
        await self.redis_cache.set_data(cache_key, enhanced_data, expire_seconds=300)
        
        # Redisチャンネルにパブリッシュ
        await self.redis_cache.publish("simulation_events", enhanced_data)
        
    async def emit_resource_update(self, resource_data: Dict[str, Any],
                                  project_id: Optional[str] = None):
        """リソース更新を配信"""
        enhanced_data = {
            **resource_data,
            "timestamp": datetime.now().isoformat(),
            "project_id": project_id
        }
        
        # Redisにキャッシュ
        cache_key = f"resource_status:{resource_data.get('resource_id', 'unknown')}"
        if project_id:
            cache_key = f"project:{project_id}:{cache_key}"
            
        await self.redis_cache.set_data(cache_key, enhanced_data, expire_seconds=600)
        
        # Redisチャンネルにパブリッシュ
        await self.redis_cache.publish("resource_updates", enhanced_data)
        
    async def emit_kpi_update(self, kpi_data: Dict[str, Any],
                             project_id: Optional[str] = None):
        """KPI更新を配信"""
        enhanced_data = {
            **kpi_data,
            "timestamp": datetime.now().isoformat(),
            "project_id": project_id
        }
        
        # Redisにキャッシュ
        cache_key = "latest_kpis"
        if project_id:
            cache_key = f"project:{project_id}:{cache_key}"
            
        await self.redis_cache.set_data(cache_key, enhanced_data, expire_seconds=60)
        
        # Redisチャンネルにパブリッシュ
        await self.redis_cache.publish("kpi_updates", enhanced_data)
        
    async def emit_alert(self, alert_data: Dict[str, Any],
                        project_id: Optional[str] = None,
                        user_id: Optional[str] = None):
        """アラートを配信"""
        enhanced_data = {
            **alert_data,
            "alert_id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "project_id": project_id,
            "user_id": user_id
        }
        
        # Redisにキャッシュ
        cache_key = f"alert:{enhanced_data['alert_id']}"
        await self.redis_cache.set_data(cache_key, enhanced_data, expire_seconds=3600)
        
        # Redisチャンネルにパブリッシュ
        await self.redis_cache.publish("alert_notifications", enhanced_data)
        
        # 特定ユーザーへの配信
        if user_id:
            await self.websocket_manager.send_to_user(user_id, {
                "type": "alert",
                "data": enhanced_data
            })
            
    async def get_cached_data(self, data_type: str, 
                             project_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """キャッシュされたデータを取得"""
        cache_key = data_type
        if project_id:
            cache_key = f"project:{project_id}:{data_type}"
            
        return await self.redis_cache.get_data(cache_key)
        
    async def broadcast_kpis(self, kpi_data: Dict[str, Any]):
        """KPIデータをWebSocketでブロードキャスト"""
        message = {
            "type": "kpi_update",
            "event_type": "kpi_update",
            "data": kpi_data,
            "timestamp": datetime.now().isoformat()
        }
        await self.websocket_manager.broadcast(message)

    async def get_latest_kpis(self, project_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """最新のKPIを取得"""
        return await self.get_cached_data("latest_kpis", project_id)
        
    async def get_resource_status(self, resource_id: str,
                                 project_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """リソース状態を取得"""
        return await self.get_cached_data(f"resource_status:{resource_id}", project_id)
        
    def get_connection_stats(self) -> Dict[str, Any]:
        """接続統計を取得"""
        return self.websocket_manager.get_connection_stats()
