"""
シミュレーション関連のAPIエンドポイント
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime
import asyncio
import json
import uuid

from app.core.simulator import SimulationEngine
from app.core.master_simulator import MasterSimulator, SimulationConfig as MasterSimulationConfig, SimulationResults
from app.models.factory import Factory
from app.models.process import Process, Equipment
from app.models.buffer import Buffer
from app.models.product import Product

router = APIRouter()

# グローバルシミュレーションエンジンインスタンス
simulation_engine: Optional[SimulationEngine] = None
simulation_task: Optional[asyncio.Task] = None

# 新しいマスターシミュレータ
master_simulator: Optional[MasterSimulator] = None
simulation_results: Dict[str, SimulationResults] = {}

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

# 新しいマスターシミュレータ用APIエンドポイント

class MasterSimulationConfigRequest(BaseModel):
    """マスターシミュレーション設定リクエスト"""
    project_id: str = "1"  # プロジェクトID
    name: str = "生産シミュレーション"
    description: str = ""
    duration_hours: float = 24.0
    time_scale: float = 1.0
    random_seed: Optional[int] = None
    enable_detailed_process: bool = True
    enable_material_flow: bool = True
    enable_transport: bool = True
    enable_quality: bool = True
    enable_scheduling: bool = True
    real_time_monitoring: bool = True

@router.post("/master/start")
async def start_master_simulation(config: MasterSimulationConfigRequest, background_tasks: BackgroundTasks):
    """マスターシミュレーションを開始"""
    global master_simulator
    
    try:
        # 既存のシミュレーションが実行中の場合は停止
        if master_simulator and master_simulator.is_running:
            await master_simulator.stop_simulation()
            
        # プロジェクトデータからファクトリーを生成
        from app.core.project_data_converter import convert_project_to_simulation_model
        factory = await convert_project_to_simulation_model(config.project_id)
        
        # マスターシミュレータを初期化
        master_simulator = MasterSimulator(factory)
        
        # シミュレーション設定を作成
        simulation_config = MasterSimulationConfig(
            simulation_id=str(uuid.uuid4()),
            project_id=config.project_id,
            name=config.name,
            description=config.description,
            duration_hours=config.duration_hours,
            time_scale=config.time_scale,
            random_seed=config.random_seed,
            enable_detailed_process=config.enable_detailed_process,
            enable_material_flow=config.enable_material_flow,
            enable_transport=config.enable_transport,
            enable_quality=config.enable_quality,
            enable_scheduling=config.enable_scheduling,
            real_time_monitoring=config.real_time_monitoring
        )
        
        # シミュレーションを設定
        await master_simulator.configure_simulation(simulation_config)
        
        # バックグラウンドでシミュレーションを開始
        async def run_simulation():
            try:
                simulation_id = await master_simulator.start_simulation()
                results = master_simulator.get_simulation_results()
                if results:
                    simulation_results[simulation_id] = results
            except Exception as e:
                print(f"シミュレーション実行エラー: {e}")
                
        background_tasks.add_task(run_simulation)
        
        return {
            "simulation_id": simulation_config.simulation_id,
            "project_id": config.project_id,
            "status": "started",
            "message": f"プロジェクト {config.project_id} のマスターシミュレーションを開始しました",
            "config": simulation_config.__dict__
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション開始エラー: {str(e)}")

@router.post("/master/pause")
async def pause_master_simulation():
    """マスターシミュレーションを一時停止"""
    global master_simulator
    
    if not master_simulator:
        raise HTTPException(status_code=404, detail="シミュレーションが見つかりません")
        
    if not master_simulator.is_running:
        raise HTTPException(status_code=400, detail="シミュレーションが実行されていません")
        
    try:
        await master_simulator.pause_simulation()
        return {"status": "paused", "message": "シミュレーションを一時停止しました"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"一時停止エラー: {str(e)}")

@router.post("/master/resume")
async def resume_master_simulation():
    """マスターシミュレーションを再開"""
    global master_simulator
    
    if not master_simulator:
        raise HTTPException(status_code=404, detail="シミュレーションが見つかりません")
        
    if not master_simulator.is_running:
        raise HTTPException(status_code=400, detail="シミュレーションが実行されていません")
        
    try:
        await master_simulator.resume_simulation()
        return {"status": "resumed", "message": "シミュレーションを再開しました"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"再開エラー: {str(e)}")

@router.post("/master/stop")
async def stop_master_simulation():
    """マスターシミュレーションを停止"""
    global master_simulator
    
    if not master_simulator:
        raise HTTPException(status_code=404, detail="シミュレーションが見つかりません")
        
    try:
        await master_simulator.stop_simulation()
        return {"status": "stopped", "message": "シミュレーションを停止しました"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"停止エラー: {str(e)}")

@router.get("/master/status")
async def get_master_simulation_status():
    """マスターシミュレーション状況を取得"""
    global master_simulator
    
    if not master_simulator:
        return {"status": "not_initialized", "message": "シミュレーションが初期化されていません"}
        
    try:
        status = master_simulator.get_simulation_status()
        return {
            "status": "active" if master_simulator.is_running else "stopped",
            "details": status,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"状況取得エラー: {str(e)}")

@router.get("/master/results/{simulation_id}")
async def get_simulation_results(simulation_id: str):
    """シミュレーション結果を取得"""
    global simulation_results, master_simulator
    
    # 保存された結果から取得
    if simulation_id in simulation_results:
        results = simulation_results[simulation_id]
        return {
            "simulation_id": simulation_id,
            "results": results.__dict__,
            "timestamp": datetime.now().isoformat()
        }
        
    # 現在実行中のシミュレーションの場合
    if (master_simulator and master_simulator.config and 
        master_simulator.config.simulation_id == simulation_id):
        current_results = master_simulator.get_simulation_results()
        if current_results:
            return {
                "simulation_id": simulation_id,
                "results": current_results.__dict__,
                "timestamp": datetime.now().isoformat()
            }
            
    raise HTTPException(status_code=404, detail="シミュレーション結果が見つかりません")

@router.get("/master/kpis")
async def get_current_kpis():
    """現在のKPIを取得"""
    global master_simulator
    
    if not master_simulator or not master_simulator.is_running:
        raise HTTPException(status_code=404, detail="実行中のシミュレーションがありません")
        
    try:
        kpis = master_simulator._collect_current_kpis()
        return {
            "kpis": kpis,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"KPI取得エラー: {str(e)}")

# グローバルアクセス用関数
def get_simulation_engine() -> Optional[SimulationEngine]:
    """現在のシミュレーションエンジンを取得"""
    global simulation_engine
    return simulation_engine

def get_master_simulator() -> Optional[MasterSimulator]:
    """現在のマスターシミュレータを取得"""
    global master_simulator
    return master_simulator