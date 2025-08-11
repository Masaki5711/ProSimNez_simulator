"""
FastAPI メインアプリケーション
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import json

# APIルーターのインポート
from app.api import simulation, network, auth
from app.api.simulation import get_simulation_engine

app = FastAPI(
    title="混流生産ライン離散シミュレーター",
    description="複雑な生産ネットワークのシミュレーションシステム",
    version="1.0.0"
)

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

# WebSocketエンドポイント
@app.websocket("/ws/simulation")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
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
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# APIルーターの登録
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(simulation.router, prefix="/api/simulation", tags=["simulation"])
app.include_router(network.router, prefix="/api/network", tags=["network"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)