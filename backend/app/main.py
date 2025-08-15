"""
FastAPI メインアプリケーション
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json
from datetime import datetime

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
    print("リアルタイムデータマネージャーを初期化しました")

@app.on_event("shutdown")  
async def shutdown_event():
    """アプリケーション終了時のクリーンアップ"""
    from app.api.websocket_api import realtime_manager
    await realtime_manager.shutdown()
    print("リアルタイムデータマネージャーを終了しました")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Reactのデフォルトポート
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket接続管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# シミュレーションエンジンにWebSocketマネージャーを登録する関数
async def websocket_event_listener(event):
    """シミュレーションイベントをWebSocketで配信"""
    try:
        message = json.dumps(event.to_dict())
        await manager.broadcast(message)
    except Exception as e:
        print(f"WebSocket配信エラー: {e}")

@app.get("/")
async def root():
    return {"message": "混流生産ライン離散シミュレーター API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# WebSocketエンドポイント（後方互換性のため）
@app.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # 接続確認メッセージを送信
        await manager.send_personal_message(json.dumps({
            "type": "connection_established",
            "message": "WebSocket接続が確立されました",
            "timestamp": datetime.now().isoformat()
        }), websocket)
        
        while True:
            # クライアントからのメッセージを受信
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # メッセージタイプに応じて処理
            if message["type"] == "control":
                # シミュレーション制御コマンド
                action = message.get("action")
                engine = get_simulation_engine()
                
                if action == "start":
                    # シミュレーション開始は別途APIで処理
                    response = {"type": "control_response", "action": action, "status": "use_api"}
                elif action == "pause" and engine:
                    await engine.pause()
                    response = {"type": "control_response", "action": action, "status": "paused"}
                elif action == "resume" and engine:
                    await engine.resume()
                    response = {"type": "control_response", "action": action, "status": "resumed"}
                elif action == "stop" and engine:
                    await engine.stop()
                    response = {"type": "control_response", "action": action, "status": "stopped"}
                elif action == "speed_change" and engine:
                    speed = message.get("params", {}).get("speed", 1.0)
                    engine.set_speed(speed)
                    response = {"type": "control_response", "action": action, "status": "speed_changed", "speed": speed}
                else:
                    response = {"type": "control_response", "action": action, "status": "no_engine"}
                    
                await manager.send_personal_message(json.dumps(response), websocket)
            
            elif message["type"] == "ping":
                # 接続確認
                await manager.send_personal_message(json.dumps({"type": "pong"}), websocket)
                
            else:
                # その他のメッセージタイプ
                response = {"type": "message_received", "original_type": message.get("type", "unknown")}
                await manager.send_personal_message(json.dumps(response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocketエラー: {e}")
        try:
            await manager.send_personal_message(json.dumps({
                "type": "error",
                "message": f"サーバーエラー: {str(e)}"
            }), websocket)
        except:
            pass
        manager.disconnect(websocket)

# APIルーターの登録
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(network.router, prefix="/api/network", tags=["network"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

# 新しいAPIルーターの追加
app.include_router(integration_api.router, prefix="/api/integration", tags=["integration"])
app.include_router(project_management_api.router, prefix="/api/project-management", tags=["project-management"])
app.include_router(websocket_api.router, prefix="/api/websocket", tags=["websocket"])
app.include_router(fact_checker_api.router, prefix="/api/fact-check", tags=["fact-check"])
app.include_router(test_simulation.router, prefix="/api/test", tags=["test-simulation"])
app.include_router(project_info.router, prefix="/api", tags=["project-info"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)