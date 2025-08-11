"""
シミュレーション関連のAPIエンドポイント
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
import asyncio
import json

from app.core.simulator import SimulationEngine
from app.models.factory import Factory
from app.models.process import Process, Equipment
from app.models.buffer import Buffer
from app.models.product import Product

router = APIRouter()

# グローバルシミュレーションエンジンインスタンス
simulation_engine: Optional[SimulationEngine] = None
simulation_task: Optional[asyncio.Task] = None

class SimulationConfig(BaseModel):
    """シミュレーション設定"""
    start_time: str = "2024-01-01T08:00:00"
    duration: Optional[float] = None  # None = 無制限
    speed: float = 1.0

class SimulationStatus(BaseModel):
    """シミュレーション状態"""
    status: str
    current_time: str
    speed: float
    is_connected: bool

# サンプル工場データを作成
def create_sample_factory() -> Factory:
    """サンプル工場を作成"""
    factory = Factory(
        id="sample_factory",
        name="サンプル混流生産ライン",
        description="デモ用の工場設定"
    )
    
    # 製品定義
    part_a = Product(id="PART_A", name="部品A", type="component", processing_time=30)
    part_b = Product(id="PART_B", name="部品B", type="component", processing_time=45)
    sub_assy = Product(id="SUB_ASSY_1", name="サブアッシ1", type="subassembly", processing_time=120)
    product_x = Product(id="PRODUCT_X", name="製品X", type="finished_product", processing_time=180)
    
    factory.add_product(part_a)
    factory.add_product(part_b)
    factory.add_product(sub_assy)
    factory.add_product(product_x)
    
    # 工程定義
    proc_a = Process(
        id="PROC_PART_A",
        name="部品A加工",
        type="machining",
        processing_time={"PART_A": 30}
    )
    proc_a.add_equipment(Equipment(id="EQ_A_1", name="設備A1", process_id="PROC_PART_A"))
    proc_a.add_equipment(Equipment(id="EQ_A_2", name="設備A2", process_id="PROC_PART_A"))
    
    proc_b = Process(
        id="PROC_PART_B",
        name="部品B加工",
        type="machining",
        processing_time={"PART_B": 45}
    )
    proc_b.add_equipment(Equipment(id="EQ_B_1", name="設備B1", process_id="PROC_PART_B"))
    
    proc_sub = Process(
        id="PROC_SUB_ASSY",
        name="サブアッシ組立",
        type="assembly",
        processing_time={"SUB_ASSY_1": 120}
    )
    proc_sub.add_equipment(Equipment(id="EQ_SUB_1", name="組立設備1", process_id="PROC_SUB_ASSY"))
    
    proc_final = Process(
        id="PROC_FINAL",
        name="最終組立",
        type="assembly", 
        processing_time={"PRODUCT_X": 180}
    )
    proc_final.add_equipment(Equipment(id="EQ_FINAL_1", name="最終組立設備", process_id="PROC_FINAL"))
    
    factory.add_process(proc_a)
    factory.add_process(proc_b)
    factory.add_process(proc_sub)
    factory.add_process(proc_final)
    
    # バッファ定義
    buffers = [
        Buffer(id="BUF_PART_A", name="部品Aバッファ", location_type="process_output"),
        Buffer(id="BUF_PART_B", name="部品Bバッファ", location_type="process_output"), 
        Buffer(id="BUF_SUB_ASSY", name="サブアッシバッファ", location_type="process_output"),
        Buffer(id="BUF_FINAL", name="完成品バッファ", location_type="process_output"),
    ]
    
    for buffer in buffers:
        factory.add_buffer(buffer)
        
    # 工程の出力バッファを設定
    proc_a.output_buffer_id = "BUF_PART_A"
    proc_b.output_buffer_id = "BUF_PART_B"
    proc_sub.output_buffer_id = "BUF_SUB_ASSY"
    proc_final.output_buffer_id = "BUF_FINAL"
        
    # 初期在庫を追加
    factory.buffers["BUF_PART_A"].add_lot("PART_A", "LOT_A_001", 50, "initial")
    factory.buffers["BUF_PART_B"].add_lot("PART_B", "LOT_B_001", 30, "initial")
    
    return factory

@router.post("/start")
async def start_simulation(config: SimulationConfig, background_tasks: BackgroundTasks):
    """シミュレーションを開始"""
    global simulation_engine, simulation_task
    
    try:
        # 既存のシミュレーションを停止
        if simulation_engine and simulation_engine.is_running:
            await simulation_engine.stop()
            
        if simulation_task and not simulation_task.done():
            simulation_task.cancel()
        
        # 新しいシミュレーションエンジンを作成
        factory = create_sample_factory()
        start_time = datetime.fromisoformat(config.start_time.replace('Z', '+00:00'))
        
        simulation_engine = SimulationEngine(
            factory=factory,
            start_time=start_time,
            speed=config.speed
        )
        
        # WebSocketイベントリスナーを追加
        from app.main import websocket_event_listener
        simulation_engine.add_event_listener(websocket_event_listener)
        
        # バックグラウンドでシミュレーションを開始
        simulation_task = asyncio.create_task(simulation_engine.start(config.duration))
        
        return {
            "message": "シミュレーションが開始されました",
            "status": "running",
            "config": config.dict()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション開始エラー: {str(e)}")

@router.post("/pause")
async def pause_simulation():
    """シミュレーションを一時停止"""
    global simulation_engine
    
    if not simulation_engine:
        raise HTTPException(status_code=400, detail="シミュレーションが開始されていません")
        
    try:
        await simulation_engine.pause()
        return {"message": "シミュレーションが一時停止されました", "status": "paused"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"一時停止エラー: {str(e)}")

@router.post("/resume")
async def resume_simulation():
    """シミュレーションを再開"""
    global simulation_engine
    
    if not simulation_engine:
        raise HTTPException(status_code=400, detail="シミュレーションが開始されていません")
        
    try:
        await simulation_engine.resume()
        return {"message": "シミュレーションが再開されました", "status": "running"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"再開エラー: {str(e)}")

@router.post("/stop")
async def stop_simulation():
    """シミュレーションを停止"""
    global simulation_engine, simulation_task
    
    if not simulation_engine:
        raise HTTPException(status_code=400, detail="シミュレーションが開始されていません")
        
    try:
        await simulation_engine.stop()
        
        if simulation_task and not simulation_task.done():
            simulation_task.cancel()
            
        return {"message": "シミュレーションが停止されました", "status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停止エラー: {str(e)}")

@router.get("/status")
async def get_simulation_status():
    """シミュレーション状態を取得"""
    global simulation_engine
    
    if not simulation_engine:
        return {
            "status": "idle",
            "current_time": datetime.now().isoformat(),
            "speed": 1.0,
            "is_running": False
        }
        
    return {
        "status": "running" if simulation_engine.is_running else "paused" if simulation_engine.is_paused else "idle",
        "current_time": simulation_engine.get_current_datetime().isoformat(),
        "speed": simulation_engine.speed,
        "is_running": simulation_engine.is_running
    }

@router.post("/speed")
async def set_simulation_speed(speed: float):
    """シミュレーション速度を設定"""
    global simulation_engine
    
    if not simulation_engine:
        raise HTTPException(status_code=400, detail="シミュレーションが開始されていません")
        
    try:
        simulation_engine.set_speed(speed)
        return {"message": f"シミュレーション速度が{speed}倍に設定されました", "speed": speed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"速度設定エラー: {str(e)}")

@router.get("/data")
async def get_simulation_data():
    """現在のシミュレーションデータを取得"""
    global simulation_engine
    
    if not simulation_engine:
        raise HTTPException(status_code=400, detail="シミュレーションが開始されていません")
        
    try:
        return {
            "inventories": simulation_engine.get_current_inventories(),
            "equipment_states": simulation_engine.get_equipment_states(),
            "kpis": simulation_engine.calculate_kpis(),
            "timestamp": simulation_engine.get_current_datetime().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"データ取得エラー: {str(e)}")

# グローバルアクセス用関数
def get_simulation_engine() -> Optional[SimulationEngine]:
    """現在のシミュレーションエンジンを取得"""
    global simulation_engine
    return simulation_engine