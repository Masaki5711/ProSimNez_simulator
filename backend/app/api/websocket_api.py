"""
WebSocket API エンドポイント
"""
import asyncio
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
import uuid
import logging

from app.websocket.realtime_manager import RealtimeDataManager
from app.core.enhanced_simulator import EnhancedSimulationEngine
from app.models.factory import Factory

logger = logging.getLogger(__name__)

# グローバルインスタンス（通常は依存性注入で管理）
realtime_manager = RealtimeDataManager()

router = APIRouter()

# Note: startup/shutdown events are handled in main.py

@router.websocket("/ws/simulation/{project_id}")
async def websocket_simulation_endpoint(
    websocket: WebSocket,
    project_id: str,
    user_id: Optional[str] = Query(None),
    client_type: Optional[str] = Query("web")
):
    """シミュレーション用WebSocketエンドポイント"""
    client_id = str(uuid.uuid4())
    
    try:
        # 接続を受け入れ
        connection = await realtime_manager.websocket_manager.connect(
            websocket, client_id, project_id, user_id
        )
        
        logger.info(f"WebSocket接続開始: プロジェクト={project_id}, クライアント={client_id}")
        
        # 初期データを送信
        await _send_initial_data(websocket, project_id)
        
        # メッセージループ
        while True:
            try:
                # クライアントからのメッセージを受信
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # メッセージを処理
                await _handle_client_message(message, connection, project_id)
                
            except WebSocketDisconnect:
                logger.info(f"WebSocket切断: {client_id}")
                break
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "無効なJSONメッセージです"
                }))
            except Exception as e:
                logger.error(f"WebSocketメッセージ処理エラー: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error", 
                    "message": f"メッセージ処理エラー: {str(e)}"
                }))
                
    except Exception as e:
        logger.error(f"WebSocket接続エラー: {e}")
    finally:
        # 接続をクリーンアップ
        await realtime_manager.websocket_manager.disconnect(client_id)

async def _send_initial_data(websocket: WebSocket, project_id: str):
    """初期データを送信"""
    try:
        # 最新のKPIデータを取得
        latest_kpis = await realtime_manager.get_latest_kpis(project_id)
        
        # 接続確認メッセージ
        welcome_message = {
            "type": "connection_established",
            "project_id": project_id,
            "timestamp": realtime_manager.redis_cache.redis_client is not None,
            "redis_connected": True,
            "latest_kpis": latest_kpis
        }
        
        await websocket.send_text(json.dumps(welcome_message))
        
    except Exception as e:
        logger.error(f"初期データ送信エラー: {e}")

async def _handle_client_message(message: Dict[str, Any], connection, project_id: str):
    """クライアントからのメッセージを処理"""
    message_type = message.get("type")
    
    if message_type == "ping":
        # ハートビート応答
        await connection.websocket.send_text(json.dumps({
            "type": "pong",
            "timestamp": message.get("timestamp")
        }))
        connection.update_activity()
        
    elif message_type == "subscribe":
        # チャンネル購読
        channels = message.get("channels", [])
        for channel in channels:
            connection.subscriptions.add(channel)
        
        await connection.websocket.send_text(json.dumps({
            "type": "subscription_confirmed",
            "channels": list(connection.subscriptions)
        }))
        
    elif message_type == "unsubscribe":
        # チャンネル購読解除
        channels = message.get("channels", [])
        for channel in channels:
            connection.subscriptions.discard(channel)
            
        await connection.websocket.send_text(json.dumps({
            "type": "unsubscription_confirmed", 
            "channels": list(connection.subscriptions)
        }))
        
    elif message_type == "request_data":
        # データ要求
        data_type = message.get("data_type")
        await _handle_data_request(connection, project_id, data_type, message)
        
    else:
        logger.warning(f"未知のメッセージタイプ: {message_type}")

async def _handle_data_request(connection, project_id: str, 
                              data_type: str, message: Dict[str, Any]):
    """データ要求を処理"""
    try:
        response_data = None
        
        if data_type == "kpis":
            response_data = await realtime_manager.get_latest_kpis(project_id)
            
        elif data_type == "resource_status":
            resource_id = message.get("resource_id")
            if resource_id:
                response_data = await realtime_manager.get_resource_status(
                    resource_id, project_id
                )
                
        elif data_type == "connection_stats":
            response_data = realtime_manager.get_connection_stats()
            
        elif data_type == "cached_events":
            # 最近のイベントを取得
            event_type = message.get("event_type", "state_update")
            cache_key = f"latest_event:{event_type}"
            response_data = await realtime_manager.get_cached_data(cache_key, project_id)
            
        # 応答を送信
        response = {
            "type": "data_response",
            "request_id": message.get("request_id"),
            "data_type": data_type,
            "data": response_data,
            "timestamp": realtime_manager.redis_cache.redis_client is not None
        }
        
        await connection.websocket.send_text(json.dumps(response))
        
    except Exception as e:
        logger.error(f"データ要求処理エラー: {e}")
        error_response = {
            "type": "error_response",
            "request_id": message.get("request_id"),
            "error": str(e)
        }
        await connection.websocket.send_text(json.dumps(error_response))

@router.websocket("/ws/monitoring")
async def websocket_monitoring_endpoint(websocket: WebSocket):
    """システム監視用WebSocketエンドポイント"""
    client_id = str(uuid.uuid4())
    
    try:
        connection = await realtime_manager.websocket_manager.connect(
            websocket, client_id
        )
        
        logger.info(f"監視WebSocket接続開始: {client_id}")
        
        # 定期的にシステム統計を送信
        while True:
            try:
                # システム統計を取得
                stats = {
                    "type": "system_stats",
                    "data": {
                        "connections": realtime_manager.get_connection_stats(),
                        "timestamp": realtime_manager.redis_cache.redis_client is not None,
                        "redis_connected": realtime_manager.redis_cache.redis_client is not None
                    }
                }
                
                await websocket.send_text(json.dumps(stats))
                await asyncio.sleep(10)  # 10秒ごとに送信
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"監視データ送信エラー: {e}")
                break
                
    except Exception as e:
        logger.error(f"監視WebSocket接続エラー: {e}")
    finally:
        await realtime_manager.websocket_manager.disconnect(client_id)

# APIエンドポイント（REST）

@router.get("/realtime/stats")
async def get_realtime_stats():
    """リアルタイム統計を取得"""
    return {
        "connections": realtime_manager.get_connection_stats(),
        "redis_connected": realtime_manager.redis_cache.redis_client is not None
    }

@router.post("/realtime/broadcast")
async def broadcast_message(message: Dict[str, Any]):
    """メッセージをブロードキャスト"""
    try:
        sent_count = await realtime_manager.websocket_manager.broadcast(message)
        return {
            "success": True,
            "sent_count": sent_count
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/realtime/emit/event")
async def emit_simulation_event(
    event_data: Dict[str, Any],
    project_id: Optional[str] = None
):
    """シミュレーションイベントを配信"""
    try:
        await realtime_manager.emit_simulation_event(event_data, project_id)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/realtime/emit/kpi")
async def emit_kpi_update(
    kpi_data: Dict[str, Any],
    project_id: Optional[str] = None
):
    """KPI更新を配信"""
    try:
        await realtime_manager.emit_kpi_update(kpi_data, project_id)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/realtime/emit/alert")
async def emit_alert(
    alert_data: Dict[str, Any],
    project_id: Optional[str] = None,
    user_id: Optional[str] = None
):
    """アラートを配信"""
    try:
        await realtime_manager.emit_alert(alert_data, project_id, user_id)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/realtime/data/{data_type}")
async def get_cached_data(
    data_type: str,
    project_id: Optional[str] = None
):
    """キャッシュされたデータを取得"""
    try:
        data = await realtime_manager.get_cached_data(data_type, project_id)
        return {
            "success": True,
            "data": data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
