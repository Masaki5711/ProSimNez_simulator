"""
シミュレーション関連のAPIエンドポイント
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
import os
import glob
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

# ネットワークベースシミュレーション用のグローバル変数
network_based_simulator: Optional['NetworkBasedSimulator'] = None
network_simulation_task: Optional[asyncio.Task] = None

# ネットワークベースシミュレーション用の設定
class NetworkSimulationConfig(BaseModel):
    start_time: str
    speed: float = 1.0
    duration: float = 3600.0  # 1時間
    network_data: dict  # フロントエンドから送信されるネットワークデータ
    simulation_mode: str = "normal"  # "normal", "test", "optimization"
    enable_scheduling_control: bool = True  # スケジューリング制御の有効/無効
    enable_real_time_update: bool = True  # リアルタイム更新の有効/無効

# ネットワークベースシミュレーション用の結果
class NetworkSimulationResult(BaseModel):
    simulation_id: str
    status: str
    start_time: str
    end_time: str
    duration: float
    total_events: int
    production_summary: dict
    scheduling_analysis: dict
    network_performance: dict
    created_at: str

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
    """サンプル工場を作成（フェーズ2改良版）"""
    factory = Factory(
        id="sample_factory",
        name="サンプル混流生産ライン（フェーズ2改良版）",
        description="部品ごとのスケジューリング設定とストア計画管理を含むデモ用工場"
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
    
    # 工程定義（スケジューリング設定付き）
    from app.models.process import ProcessInput, KanbanSettings
    
    # 部品A加工工程（プッシュ型）
    proc_a = Process(
        id="PROC_PART_A",
        name="部品A加工",
        type="machining",
        processing_time={"PART_A": 30}
    )
    proc_a.add_equipment(Equipment(id="EQ_A_1", name="設備A1", process_id="PROC_PART_A"))
    proc_a.add_equipment(Equipment(id="EQ_A_2", name="設備A2", process_id="PROC_PART_A"))
    
    # 部品B加工工程（プル型）
    proc_b = Process(
        id="PROC_PART_B",
        name="部品B加工",
        type="machining",
        processing_time={"PART_B": 45}
    )
    proc_b.add_equipment(Equipment(id="EQ_B_1", name="設備B1", process_id="PROC_PART_B"))
    
    # サブアッシ組立工程（かんばん型）
    proc_sub = Process(
        id="PROC_SUB_ASSY",
        name="サブアッシ組立",
        type="assembly",
        processing_time={"SUB_ASSY_1": 120}
    )
    proc_sub.add_equipment(Equipment(id="EQ_SUB_1", name="組立設備1", process_id="PROC_SUB_ASSY"))
    
    # 最終組立工程（ハイブリッド型）
    proc_final = Process(
        id="PROC_FINAL",
        name="最終組立",
        type="assembly", 
        processing_time={"PRODUCT_X": 180}
    )
    proc_final.add_equipment(Equipment(id="EQ_FINAL_1", name="最終組立設備", process_id="PROC_FINAL"))
    
    # 工程の入力材料設定（スケジューリング設定付き）
    # サブアッシ組立工程の入力材料
    proc_sub.inputs = [
        ProcessInput(
            from_process_id="PROC_PART_A",
            product_id="PART_A",
            required_quantity=2,
            scheduling_mode="push",  # プッシュ型
            batch_size=20,
            min_batch_size=10,
            max_batch_size=50,
            input_buffer_id="BUF_PART_A",
            safety_stock=5,
            max_capacity=100
        ),
        ProcessInput(
            from_process_id="PROC_PART_B",
            product_id="PART_B",
            required_quantity=1,
            scheduling_mode="pull",  # プル型
            batch_size=10,
            min_batch_size=5,
            max_batch_size=30,
            input_buffer_id="BUF_PART_B",
            safety_stock=3,
            max_capacity=50,
            kanban_settings=KanbanSettings(
                enabled=True,
                card_count=3,
                reorder_point=8,
                max_inventory=25,
                supplier_lead_time=2,
                kanban_type="withdrawal"
            )
        )
    ]
    
    # 最終組立工程の入力材料
    proc_final.inputs = [
        ProcessInput(
            from_process_id="PROC_SUB_ASSY",
            product_id="SUB_ASSY_1",
            required_quantity=1,
            scheduling_mode="hybrid",  # ハイブリッド型
            batch_size=5,
            min_batch_size=1,
            max_batch_size=10,
            input_buffer_id="BUF_SUB_ASSY",
            safety_stock=2,
            max_capacity=20,
            kanban_settings=KanbanSettings(
                enabled=True,
                card_count=2,
                reorder_point=3,
                max_inventory=15,
                supplier_lead_time=1,
                kanban_type="production"
            )
        ),
        ProcessInput(
            from_process_id="PROC_PART_A",
            product_id="PART_A",
            required_quantity=1,
            scheduling_mode="push",  # プッシュ型
            batch_size=10,
            min_batch_size=5,
            max_batch_size=20,
            input_buffer_id="BUF_PART_A",
            safety_stock=3,
            max_capacity=50
        )
    ]
    
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
        
        # フェーズ２テスト設定を追加
        config_dict = {
            "start_time": config.start_time,
            "speed": config.speed,
            "duration": config.duration,
            "factory_processes": len(factory.processes),
            "factory_buffers": len(factory.buffers),
            "test_mode": True,
            "event_generation_interval": 10  # 10秒ごとにテストイベント生成
        }
        simulation_engine.start_phase2_test(config_dict)
        
        # WebSocketイベントリスナーを追加
        from app.main import websocket_event_listener
        simulation_engine.add_event_listener(websocket_event_listener)
        
        # バックグラウンドでシミュレーションを開始
        simulation_task = asyncio.create_task(simulation_engine.start(config.duration))
        
        return {
            "message": "シミュレーションが開始されました（フェーズ２テストログ有効）",
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
        report_path = None
        
        # フェーズ２テスト終了処理
        try:
            simulation_engine.end_phase2_test()
            print("✅ フェーズ２テスト終了処理完了")
        except Exception as end_error:
            print(f"⚠️ フェーズ２テスト終了処理エラー: {str(end_error)}")
        
        # MDレポート生成
        try:
            report_path = simulation_engine.generate_phase2_test_report()
            print(f"📄 テストレポートが生成されました: {report_path}")
        except Exception as report_error:
            print(f"⚠️ レポート生成エラー: {str(report_error)}")
            report_path = None
        
        # シミュレーション停止
        try:
            await simulation_engine.stop()
            print("✅ シミュレーション停止完了")
        except Exception as stop_error:
            print(f"⚠️ シミュレーション停止エラー: {str(stop_error)}")
        
        if simulation_task and not simulation_task.done():
            simulation_task.cancel()
            
        return {
            "message": "シミュレーションが停止されました（フェーズ２テストレポート生成完了）",
            "status": "stopped",
            "report_path": report_path,
            "html_report_path": report_path.replace('.md', '.html') if report_path else None
        }
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

@router.get("/reports")
async def list_phase2_reports():
    """フェーズ２テストレポート一覧を取得"""
    try:
        reports_dir = "reports"
        if not os.path.exists(reports_dir):
            return {"reports": []}
            
        report_files = glob.glob(os.path.join(reports_dir, "phase2_test_report_*.md"))
        reports = []
        
        for filepath in sorted(report_files, reverse=True):  # 新しい順
            filename = os.path.basename(filepath)
            file_stats = os.stat(filepath)
            
            reports.append({
                "filename": filename,
                "filepath": filepath,
                "size": file_stats.st_size,
                "created_at": datetime.fromtimestamp(file_stats.st_ctime).isoformat(),
                "modified_at": datetime.fromtimestamp(file_stats.st_mtime).isoformat()
            })
            
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"レポート一覧取得エラー: {str(e)}")

@router.get("/reports/download/{filename}")
async def download_phase2_report(filename: str):
    """フェーズ２テストレポートをダウンロード"""
    try:
        # セキュリティチェック: ファイル名に不正なパスが含まれていないか確認
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="不正なファイル名です")
            
        if not filename.startswith("phase2_test_report_") or not filename.endswith(".md"):
            raise HTTPException(status_code=400, detail="フェーズ２テストレポートファイルではありません")
            
        filepath = os.path.join("reports", filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="レポートファイルが見つかりません")
            
        return FileResponse(
            filepath,
            media_type="text/markdown",
            filename=filename,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ダウンロードエラー: {str(e)}")

@router.delete("/reports/{filename}")
async def delete_phase2_report(filename: str):
    """フェーズ２テストレポートを削除"""
    try:
        # セキュリティチェック
        if ".." in filename or "/" in filename or "\\" in filename:
            raise HTTPException(status_code=400, detail="不正なファイル名です")
            
        if not filename.startswith("phase2_test_report_") or not filename.endswith(".md"):
            raise HTTPException(status_code=400, detail="フェーズ２テストレポートファイルではありません")
            
        filepath = os.path.join("reports", filename)
        
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="レポートファイルが見つかりません")
            
        os.remove(filepath)
        
        return {"message": f"レポート {filename} を削除しました"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"削除エラー: {str(e)}")

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

@router.post("/start-network-simulation")
async def start_network_simulation(config: NetworkSimulationConfig, background_tasks: BackgroundTasks):
    """ネットワークベースシミュレーションを開始"""
    global network_based_simulator, network_simulation_task
    
    try:
        # 既存のシミュレーションを停止
        if network_based_simulator and hasattr(network_based_simulator, 'is_running') and network_based_simulator.is_running:
            await network_based_simulator.stop()
            
        if network_simulation_task and not network_simulation_task.done():
            network_simulation_task.cancel()
        
        # ネットワークベースシミュレーターを作成
        from app.core.network_simulator import NetworkBasedSimulator
        
        network_based_simulator = NetworkBasedSimulator(
            network_data=config.network_data,
            start_time=datetime.fromisoformat(config.start_time.replace('Z', '+00:00')),
            speed=config.speed,
            enable_scheduling_control=config.enable_scheduling_control,
            enable_real_time_update=config.enable_real_time_update
        )
        
        # シミュレーションを開始
        network_simulation_task = asyncio.create_task(
            network_based_simulator.run_simulation(duration=config.duration)
        )
        
        # バックグラウンドタスクとしてシミュレーション監視を開始
        background_tasks.add_task(
            monitor_network_simulation,
            network_based_simulator,
            config.duration
        )
        
        return {
            "status": "success",
            "message": "ネットワークベースシミュレーションを開始しました",
            "simulation_id": network_based_simulator.simulation_id,
            "start_time": config.start_time,
            "duration": config.duration
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション開始エラー: {str(e)}")

@router.get("/network-simulation/status")
async def get_network_simulation_status():
    """ネットワークベースシミュレーションの状態を取得"""
    global network_based_simulator
    
    if not network_based_simulator:
        return {"status": "not_started", "message": "シミュレーションが開始されていません"}
    
    return {
        "status": network_based_simulator.get_status(),
        "simulation_id": network_based_simulator.simulation_id,
        "current_time": network_based_simulator.get_current_time(),
        "progress": network_based_simulator.get_progress(),
        "production_summary": network_based_simulator.get_production_summary(),
        "scheduling_analysis": network_based_simulator.get_scheduling_analysis()
    }

@router.post("/network-simulation/stop")
async def stop_network_simulation():
    """ネットワークベースシミュレーションを停止"""
    global network_based_simulator, network_simulation_task
    
    try:
        if network_based_simulator:
            await network_based_simulator.stop()
            
        if network_simulation_task and not network_simulation_task.done():
            network_simulation_task.cancel()
            
        return {"status": "success", "message": "シミュレーションを停止しました"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション停止エラー: {str(e)}")

@router.get("/network-simulation/results")
async def get_network_simulation_results():
    """ネットワークベースシミュレーションの結果を取得"""
    global network_based_simulator
    
    if not network_based_simulator:
        raise HTTPException(status_code=404, detail="シミュレーション結果が見つかりません")
    
    try:
        results = network_based_simulator.get_simulation_results()
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"結果取得エラー: {str(e)}")

@router.post("/network-simulation/validate")
async def validate_network_data(network_data: dict):
    """ネットワークデータの妥当性を検証"""
    try:
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "summary": {}
        }
        
        # ノードの検証
        nodes = network_data.get('nodes', [])
        validation_result["summary"]["total_nodes"] = len(nodes)
        
        # 工程ノードの検証
        process_nodes = [n for n in nodes if n.get('type') in ['machining', 'assembly', 'inspection']]
        validation_result["summary"]["process_nodes"] = len(process_nodes)
        
        # エッジの検証
        edges = network_data.get('edges', [])
        validation_result["summary"]["total_edges"] = len(edges)
        
        # 接続性の検証
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge.get('source'))
            connected_nodes.add(edge.get('target'))
        
        # 孤立ノードの検出
        all_node_ids = {n.get('id') for n in nodes}
        isolated_nodes = all_node_ids - connected_nodes
        
        if isolated_nodes:
            validation_result["warnings"].append({
                "type": "isolated_nodes",
                "message": f"孤立ノードが検出されました: {list(isolated_nodes)}",
                "severity": "warning"
            })
        
        # 循環参照の検出
        if network_based_simulator._detect_cycles(edges):
            validation_result["errors"].append({
                "type": "circular_reference",
                "message": "循環参照が検出されました",
                "severity": "error"
            })
            validation_result["is_valid"] = False
        
        # 材料フローの検証
        flow_validation = network_based_simulator._validate_material_flow(nodes, edges)
        validation_result["summary"]["material_flow"] = flow_validation
        
        if not flow_validation["is_valid"]:
            validation_result["errors"].extend(flow_validation["errors"])
            validation_result["is_valid"] = False
        
        return validation_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"検証エラー: {str(e)}")

@router.post("/network-simulation/convert")
async def convert_network_data(network_data: dict):
    """ネットワークデータをシミュレーション用に変換"""
    try:
        # ネットワークデータの変換
        converted_data = {
            "nodes": [],
            "edges": [],
            "products": [],
            "bom_items": [],
            "metadata": {
                "conversion_timestamp": datetime.now().isoformat(),
                "version": "1.0"
            }
        }
        
        # ノードの変換
        for node in network_data.get('nodes', []):
            converted_node = {
                "id": node.get('id'),
                "type": node.get('type', 'unknown'),
                "data": network_based_simulator._convert_node_data(node.get('data', {})),
                "position": node.get('position')
            }
            converted_data["nodes"].append(converted_node)
        
        # エッジの変換
        for edge in network_data.get('edges', []):
            converted_edge = {
                "id": edge.get('id'),
                "source": edge.get('source'),
                "target": edge.get('target'),
                "data": network_based_simulator._convert_edge_data(edge.get('data', {}))
            }
            converted_data["edges"].append(converted_edge)
        
        # 製品情報の変換
        converted_data["products"] = network_based_simulator._extract_products(network_data)
        
        # BOM情報の変換
        converted_data["bom_items"] = network_based_simulator._extract_bom_items(network_data)
        
        return {
            "status": "success",
            "converted_data": converted_data,
            "conversion_summary": {
                "nodes_converted": len(converted_data["nodes"]),
                "edges_converted": len(converted_data["edges"]),
                "products_extracted": len(converted_data["products"]),
                "bom_items_extracted": len(converted_data["bom_items"])
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"変換エラー: {str(e)}")

@router.get("/network-simulation/sample-data")
async def get_sample_network_data():
    """テスト用のサンプルネットワークデータを生成"""
    sample_data = {
        "nodes": [
            {
                "id": "node_machining_1",
                "type": "machining",
                "position": {"x": 100, "y": 100},
                "data": {
                    "label": "部品A加工",
                    "cycleTime": 30,
                    "setupTime": 60,
                    "equipmentCount": 2,
                    "operatorCount": 1,
                    "inputBufferCapacity": 50,
                    "outputBufferCapacity": 50,
                    "defectRate": 2.0,
                    "reworkRate": 1.0,
                    "operatingCost": 100,
                    "schedulingMode": "push",
                    "batchSize": 20,
                    "minBatchSize": 10,
                    "maxBatchSize": 50
                }
            },
            {
                "id": "node_machining_2",
                "type": "machining",
                "position": {"x": 300, "y": 100},
                "data": {
                    "label": "部品B加工",
                    "cycleTime": 45,
                    "setupTime": 90,
                    "equipmentCount": 1,
                    "operatorCount": 1,
                    "inputBufferCapacity": 30,
                    "outputBufferCapacity": 30,
                    "defectRate": 1.5,
                    "reworkRate": 0.5,
                    "operatingCost": 80,
                    "schedulingMode": "pull",
                    "batchSize": 15,
                    "minBatchSize": 5,
                    "maxBatchSize": 30,
                    "kanbanEnabled": True,
                    "kanbanCardCount": 3,
                    "reorderPoint": 8,
                    "maxInventory": 25,
                    "supplierLeadTime": 2,
                    "kanbanType": "withdrawal"
                }
            },
            {
                "id": "node_assembly_1",
                "type": "assembly",
                "position": {"x": 200, "y": 250},
                "data": {
                    "label": "サブアッシ組立",
                    "cycleTime": 120,
                    "setupTime": 180,
                    "equipmentCount": 1,
                    "operatorCount": 2,
                    "inputBufferCapacity": 40,
                    "outputBufferCapacity": 40,
                    "defectRate": 1.0,
                    "reworkRate": 0.8,
                    "operatingCost": 150,
                    "schedulingMode": "hybrid",
                    "batchSize": 10,
                    "minBatchSize": 5,
                    "maxBatchSize": 20,
                    "kanbanEnabled": True,
                    "kanbanCardCount": 2,
                    "reorderPoint": 5,
                    "maxInventory": 20,
                    "supplierLeadTime": 1,
                    "kanbanType": "production"
                }
            },
            {
                "id": "node_assembly_2",
                "type": "assembly",
                "position": {"x": 400, "y": 250},
                "data": {
                    "label": "最終組立",
                    "cycleTime": 180,
                    "setupTime": 240,
                    "equipmentCount": 1,
                    "operatorCount": 2,
                    "inputBufferCapacity": 30,
                    "outputBufferCapacity": 30,
                    "defectRate": 0.5,
                    "reworkRate": 0.3,
                    "operatingCost": 200,
                    "schedulingMode": "push",
                    "batchSize": 5,
                    "minBatchSize": 1,
                    "maxBatchSize": 10
                }
            },
            {
                "id": "node_inspection_1",
                "type": "inspection",
                "position": {"x": 500, "y": 100},
                "data": {
                    "label": "最終検査",
                    "cycleTime": 60,
                    "setupTime": 30,
                    "equipmentCount": 1,
                    "operatorCount": 1,
                    "inputBufferCapacity": 20,
                    "outputBufferCapacity": 20,
                    "defectRate": 0.0,
                    "reworkRate": 0.0,
                    "operatingCost": 50,
                    "schedulingMode": "pull",
                    "batchSize": 5,
                    "minBatchSize": 1,
                    "maxBatchSize": 10
                }
            }
        ],
        "edges": [
            {
                "id": "edge_1",
                "source": "node_machining_1",
                "target": "node_assembly_1",
                "data": {
                    "transportTime": 15,
                    "transportLotSize": 20,
                    "transportCost": 5,
                    "distance": 50,
                    "transportType": "conveyor",
                    "maxCapacity": 100
                }
            },
            {
                "id": "edge_2",
                "source": "node_machining_2",
                "target": "node_assembly_1",
                "data": {
                    "transportTime": 20,
                    "transportLotSize": 15,
                    "transportCost": 8,
                    "distance": 80,
                    "transportType": "agv",
                    "maxCapacity": 50
                }
            },
            {
                "id": "edge_3",
                "source": "node_assembly_1",
                "target": "node_assembly_2",
                "data": {
                    "transportTime": 25,
                    "transportLotSize": 10,
                    "transportCost": 10,
                    "distance": 100,
                    "transportType": "conveyor",
                    "maxCapacity": 30
                }
            },
            {
                "id": "edge_4",
                "source": "node_assembly_2",
                "target": "node_inspection_1",
                "data": {
                    "transportTime": 10,
                    "transportLotSize": 5,
                    "transportCost": 3,
                    "distance": 30,
                    "transportType": "manual",
                    "maxCapacity": 20
                }
            }
        ],
        "products": [
            {
                "id": "PRODUCT_PART_A",
                "name": "部品A",
                "type": "component",
                "processing_time": 30,
                "source_process": "node_machining_1"
            },
            {
                "id": "PRODUCT_PART_B",
                "name": "部品B",
                "type": "component",
                "processing_time": 45,
                "source_process": "node_machining_2"
            },
            {
                "id": "PRODUCT_SUB_ASSY",
                "name": "サブアッシ",
                "type": "subassembly",
                "processing_time": 120,
                "source_process": "node_assembly_1"
            },
            {
                "id": "PRODUCT_FINAL",
                "name": "最終製品",
                "type": "finished_product",
                "processing_time": 180,
                "source_process": "node_assembly_2"
            }
        ],
        "bom_items": [
            {
                "id": "BOM_1",
                "parent_product": "PRODUCT_SUB_ASSY",
                "child_product": "PRODUCT_PART_A",
                "quantity": 2,
                "source_edge": "edge_1"
            },
            {
                "id": "BOM_2",
                "parent_product": "PRODUCT_SUB_ASSY",
                "child_product": "PRODUCT_PART_B",
                "quantity": 1,
                "source_edge": "edge_2"
            },
            {
                "id": "BOM_3",
                "parent_product": "PRODUCT_FINAL",
                "child_product": "PRODUCT_SUB_ASSY",
                "quantity": 1,
                "source_edge": "edge_3"
            }
        ]
    }
    
    return {
        "status": "success",
        "sample_data": sample_data,
        "description": "テスト用のサンプルネットワークデータ（5工程、4接続、4製品、3BOM関係）",
        "features": [
            "プッシュ型制御（部品A加工、最終組立）",
            "プル型制御（部品B加工、最終検査）",
            "ハイブリッド型制御（サブアッシ組立）",
            "かんばん制御（部品B加工、サブアッシ組立）",
            "複数搬送方式（コンベヤ、AGV、手動）"
        ]
    }

def _detect_cycles(self, edges: List[dict]) -> bool:
    """循環参照を検出"""
    # 簡易的な循環参照検出
    # 実際の実装では、より高度なアルゴリズムを使用
    graph = {}
    for edge in edges:
        source = edge.get('source')
        target = edge.get('target')
        if source not in graph:
            graph[source] = []
        graph[source].append(target)
    
    # 深さ優先探索で循環を検出
    visited = set()
    rec_stack = set()
    
    def has_cycle(node):
        if node in rec_stack:
            return True
        if node in visited:
            return False
        
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if has_cycle(neighbor):
                return True
        
        rec_stack.remove(node)
        return False
    
    for node in graph:
        if has_cycle(node):
            return True
    
    return False

def _validate_material_flow(self, nodes: List[dict], edges: List[dict]) -> dict:
    """材料フローの妥当性を検証"""
    validation = {
        "is_valid": True,
        "errors": [],
        "warnings": []
    }
    
    # 工程ノードの検証
    process_nodes = [n for n in nodes if n.get('type') in ['machining', 'assembly', 'inspection']]
    
    for process_node in process_nodes:
        node_id = process_node.get('id')
        node_data = process_node.get('data', {})
        
        # 必須パラメータの検証
        required_params = ['cycleTime', 'equipmentCount']
        for param in required_params:
            if param not in node_data:
                validation["errors"].append({
                    "node_id": node_id,
                    "param": param,
                    "message": f"必須パラメータ '{param}' が設定されていません",
                    "severity": "error"
                })
                validation["is_valid"] = False
        
        # 数値パラメータの妥当性検証
        if 'cycleTime' in node_data:
            cycle_time = node_data['cycleTime']
            if not isinstance(cycle_time, (int, float)) or cycle_time <= 0:
                validation["errors"].append({
                    "node_id": node_id,
                    "param": "cycleTime",
                    "message": f"サイクルタイムは正の数値である必要があります: {cycle_time}",
                    "severity": "error"
                })
                validation["is_valid"] = False
        
        if 'equipmentCount' in node_data:
            equipment_count = node_data['equipmentCount']
            if not isinstance(equipment_count, int) or equipment_count <= 0:
                validation["errors"].append({
                    "node_id": node_id,
                    "param": "equipmentCount",
                    "message": f"設備数は正の整数である必要があります: {equipment_count}",
                    "severity": "error"
                })
                validation["is_valid"] = False
    
    # 接続関係の検証
    for edge in edges:
        source_id = edge.get('source')
        target_id = edge.get('target')
        
        # 存在しないノードへの接続
        source_exists = any(n.get('id') == source_id for n in nodes)
        target_exists = any(n.get('id') == target_id for n in nodes)
        
        if not source_exists:
            validation["errors"].append({
                "edge_id": edge.get('id'),
                "message": f"接続元ノード '{source_id}' が存在しません",
                "severity": "error"
            })
            validation["is_valid"] = False
        
        if not target_exists:
            validation["errors"].append({
                "edge_id": edge.get('id'),
                "message": f"接続先ノード '{target_id}' が存在しません",
                "severity": "error"
            })
            validation["is_valid"] = False
    
    return validation

def _convert_node_data(self, node_data: dict) -> dict:
    """ノードデータをシミュレーション用に変換"""
    converted = {}
    
    # 基本パラメータの変換
    param_mapping = {
        'cycleTime': 'cycleTime',
        'setupTime': 'setupTime',
        'equipmentCount': 'equipmentCount',
        'operatorCount': 'operatorCount',
        'inputBufferCapacity': 'inputBufferCapacity',
        'outputBufferCapacity': 'outputBufferCapacity',
        'defectRate': 'defectRate',
        'reworkRate': 'reworkRate',
        'operatingCost': 'operatingCost'
    }
    
    for source_key, target_key in param_mapping.items():
        if source_key in node_data:
            converted[target_key] = node_data[source_key]
    
    # スケジューリング設定の変換
    if 'schedulingMode' in node_data:
        converted['schedulingMode'] = node_data['schedulingMode']
    
    if 'batchSize' in node_data:
        converted['batchSize'] = node_data['batchSize']
    
    if 'minBatchSize' in node_data:
        converted['minBatchSize'] = node_data['minBatchSize']
    
    if 'maxBatchSize' in node_data:
        converted['maxBatchSize'] = node_data['maxBatchSize']
    
    # かんばん設定の変換
    if node_data.get('kanbanEnabled', False):
        converted['kanbanEnabled'] = True
        converted['kanbanCardCount'] = node_data.get('kanbanCardCount', 5)
        converted['reorderPoint'] = node_data.get('reorderPoint', 10)
        converted['maxInventory'] = node_data.get('maxInventory', 50)
        converted['supplierLeadTime'] = node_data.get('supplierLeadTime', 3)
        converted['kanbanType'] = node_data.get('kanbanType', 'production')
    
    return converted

def _convert_edge_data(self, edge_data: dict) -> dict:
    """エッジデータをシミュレーション用に変換"""
    converted = {}
    
    # 搬送設定の変換
    param_mapping = {
        'transportTime': 'transportTime',
        'transportLotSize': 'transportLotSize',
        'transportCost': 'transportCost',
        'distance': 'distance',
        'transportType': 'transportType',
        'maxCapacity': 'maxCapacity'
    }
    
    for source_key, target_key in param_mapping.items():
        if source_key in edge_data:
            converted[target_key] = edge_data[source_key]
    
    return converted

def _extract_products(self, network_data: dict) -> List[dict]:
    """ネットワークデータから製品情報を抽出"""
    products = []
    
    # ノードから製品情報を抽出
    for node in network_data.get('nodes', []):
        if node.get('type') in ['machining', 'assembly', 'inspection']:
            node_data = node.get('data', {})
            
            product = {
                "id": f"PRODUCT_{node.get('id')}",
                "name": node_data.get('label', f'Product {node.get("id")}'),
                "type": "component" if node.get('type') == 'machining' else "assembly",
                "processing_time": node_data.get('cycleTime', 60),
                "source_process": node.get('id')
            }
            products.append(product)
    
    return products

def _extract_bom_items(self, network_data: dict) -> List[dict]:
    """ネットワークデータからBOM情報を抽出"""
    bom_items = []
    
    # エッジからBOM関係を抽出
    for edge in network_data.get('edges', []):
        source_node = next((n for n in network_data.get('nodes', []) if n.get('id') == edge.get('source')), None)
        target_node = next((n for n in network_data.get('nodes', []) if n.get('id') == edge.get('target')), None)
        
        if source_node and target_node:
            bom_item = {
                "id": f"BOM_{edge.get('id')}",
                "parent_product": f"PRODUCT_{target_node.get('id')}",
                "child_product": f"PRODUCT_{source_node.get('id')}",
                "quantity": 1,  # デフォルト値
                "source_edge": edge.get('id')
            }
            bom_items.append(bom_item)
    
    return bom_items

async def monitor_network_simulation(simulator: 'NetworkBasedSimulator', duration: float):
    """ネットワークベースシミュレーションの監視"""
    try:
        # シミュレーション完了まで待機
        await asyncio.sleep(duration)
        
        # 完了後の処理
        if simulator.is_running:
            await simulator.stop()
            
    except asyncio.CancelledError:
        # タスクがキャンセルされた場合
        pass
    except Exception as e:
        print(f"シミュレーション監視エラー: {e}")