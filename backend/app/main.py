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

# レガシーWebSocketイベントリスナー（無効化）
async def websocket_event_listener(event):
    """レガシーシミュレーションイベントリスナー - 無効化済み"""
    # enhanced_simulatorに統合されたため、このリスナーは使用しない
    pass

@app.get("/")
async def root():
    return {"message": "混流生産ライン離散シミュレーター API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# 簡易WebSocketエンドポイント（基本機能のみ）
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
            
            # 基本的な応答のみ
            response = {"type": "message_received", "original_type": message.get("type", "unknown")}
            await manager.send_personal_message(json.dumps(response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocketエラー: {e}")
        manager.disconnect(websocket)

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