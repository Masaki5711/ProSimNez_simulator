"""
FastAPI メインアプリケーション
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
from datetime import datetime

# ロガーの設定
logger = logging.getLogger(__name__)

# 設定のインポート
from app.config import app_settings

# APIルーターのインポート
from app.api import simulation, network, auth, projects
from app.api.simulation import get_simulation_engine
from app.api import integration_api, project_management_api, websocket_api, fact_checker_api, test_simulation, project_info
from app.database import create_tables

app = FastAPI(
    title="混流生産ライン離散シミュレーター",
    description="複雑な生産ネットワークのシミュレーションシステム",
    version="1.0.0"
)

# アプリケーション起動時にデータベーステーブルを作成
@app.on_event("startup")
async def startup_event():
    create_tables()
    # リアルタイムデータマネージャーを初期化
    from app.api.websocket_api import realtime_manager
    await realtime_manager.initialize()
    logger.info("Realtime data manager initialized")

@app.on_event("shutdown")  
async def shutdown_event():
    """アプリケーション終了時のクリーンアップ"""
    from app.api.websocket_api import realtime_manager
    await realtime_manager.shutdown()
    logger.info("Realtime data manager shutdown")

# CORS設定 - 全オリジン許可（開発用）
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

class CORSAllowAll(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.method == "OPTIONS":
            response = StarletteResponse(status_code=200)
        else:
            response = await call_next(request)
        origin = request.headers.get("origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
        return response

app.add_middleware(CORSAllowAll)

@app.get("/")
async def root():
    return {"message": "混流生産ライン離散シミュレーター API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# 基本WebSocketエンドポイント（realtime_managerを使用）
@app.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    """基本的なシミュレーションWebSocketエンドポイント"""
    import uuid
    from app.api.websocket_api import realtime_manager

    client_id = str(uuid.uuid4())
    connection = await realtime_manager.websocket_manager.connect(websocket, client_id)

    try:
        # 接続確認メッセージを送信
        await realtime_manager.websocket_manager.send_to_client(client_id, {
            "type": "connection_established",
            "message": "WebSocket connection established",
            "client_id": client_id,
            "timestamp": datetime.now().isoformat()
        })

        while True:
            # クライアントからのメッセージを受信
            data = await websocket.receive_text()
            message = json.loads(data)

            # ping/pongハンドリング
            if message.get("type") == "ping":
                await realtime_manager.websocket_manager.send_to_client(client_id, {
                    "type": "pong",
                    "timestamp": datetime.now().isoformat()
                })
            elif message.get("type") == "simulation_start":
                # シミュレーション開始コマンドをwebsocket_apiのハンドラに委譲
                from app.api.websocket_api import _handle_client_message
                await _handle_client_message(message, connection, None)
            elif message.get("type") == "simulation_control":
                # シミュレーション制御コマンド
                from app.api.websocket_api import enhanced_simulator
                control = message.get("control")
                if control == "pause" and enhanced_simulator:
                    await enhanced_simulator.pause_simulation()
                elif control == "resume" and enhanced_simulator:
                    await enhanced_simulator.resume_simulation()
                elif control == "stop" and enhanced_simulator:
                    await enhanced_simulator.stop_simulation()
            elif message.get("type") == "subscribe_realtime":
                # リアルタイムデータ購読（現在はすべてのクライアントが自動的に受信）
                await realtime_manager.websocket_manager.send_to_client(client_id, {
                    "type": "subscription_confirmed",
                    "timestamp": datetime.now().isoformat()
                })
            else:
                # その他のメッセージに応答
                await realtime_manager.websocket_manager.send_to_client(client_id, {
                    "type": "message_received",
                    "original_type": message.get("type", "unknown")
                })

    except WebSocketDisconnect:
        await realtime_manager.websocket_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await realtime_manager.websocket_manager.disconnect(client_id)

# APIルーターの登録
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(network.router, prefix="/api/network", tags=["network"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

# 新しいAPIルーターの追加
app.include_router(integration_api.router, prefix="/api/integration", tags=["integration"])
app.include_router(project_management_api.router, prefix="/api/project-management", tags=["project-management"])
app.include_router(websocket_api.router, tags=["websocket"])  # プレフィックスを削除してルートレベルで登録
app.include_router(fact_checker_api.router, prefix="/api/fact-check", tags=["fact-check"])
app.include_router(test_simulation.router, prefix="/api/test", tags=["test-simulation"])
app.include_router(project_info.router, prefix="/api", tags=["project-info"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)