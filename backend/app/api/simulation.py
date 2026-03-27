"""
シミュレーション関連のAPIエンドポイント
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
from datetime import datetime
import asyncio
import logging
import os
import glob
import json
import uuid

from app.config import simulation_settings

logger = logging.getLogger(__name__)


# カスタム例外クラス
class SimulationError(Exception):
    """シミュレーション関連の基底例外"""
    pass


class SimulationNotFoundError(SimulationError):
    """シミュレーションが見つからない"""
    pass


class SimulationAlreadyRunningError(SimulationError):
    """シミュレーションが既に実行中"""
    pass


class SimulationNotRunningError(SimulationError):
    """シミュレーションが実行されていない"""
    pass


class InvalidConfigurationError(SimulationError):
    """設定が無効"""
    pass


def handle_simulation_error(e: Exception) -> HTTPException:
    """シミュレーションエラーをHTTPExceptionに変換"""
    if isinstance(e, SimulationNotFoundError):
        return HTTPException(status_code=404, detail=str(e))
    elif isinstance(e, SimulationAlreadyRunningError):
        return HTTPException(status_code=409, detail=str(e))
    elif isinstance(e, SimulationNotRunningError):
        return HTTPException(status_code=400, detail=str(e))
    elif isinstance(e, InvalidConfigurationError):
        return HTTPException(status_code=422, detail=str(e))
    elif isinstance(e, SimulationError):
        return HTTPException(status_code=500, detail=str(e))
    else:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return HTTPException(status_code=500, detail="Internal server error")


from app.core.simulator import SimulationEngine
from app.core.master_simulator import MasterSimulator, SimulationConfig as MasterSimulationConfig, SimulationResults
from app.models.factory import Factory
from app.models.process import Process, Equipment
from app.models.buffer import Buffer
from app.models.product import Product

router = APIRouter()


class SimulationManager:
    """シミュレーション状態を管理するシングルトンクラス"""
    _instance: Optional['SimulationManager'] = None

    def __new__(cls) -> 'SimulationManager':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        # シミュレーションエンジン
        self.simulation_engine: Optional[SimulationEngine] = None
        self.simulation_task: Optional[asyncio.Task] = None

        # マスターシミュレータ
        self.master_simulator: Optional[MasterSimulator] = None
        self.simulation_results: Dict[str, SimulationResults] = {}

        # ネットワークベースシミュレータ
        self.network_based_simulator: Optional['NetworkBasedSimulator'] = None
        self.network_simulation_task: Optional[asyncio.Task] = None

    def reset(self):
        """シミュレーション状態をリセット"""
        self.simulation_engine = None
        self.simulation_task = None
        self.master_simulator = None
        self.network_based_simulator = None
        self.network_simulation_task = None

    def is_running(self) -> bool:
        """いずれかのシミュレーションが実行中かどうか"""
        if self.simulation_engine and self.simulation_engine.is_running:
            return True
        if self.network_based_simulator:
            return True
        return False


# シングルトンインスタンス
sim_manager = SimulationManager()

# 後方互換性のためのエイリアス（段階的に削除予定）
simulation_engine = None  # sim_manager.simulation_engine を使用
simulation_task = None  # sim_manager.simulation_task を使用
master_simulator = None  # sim_manager.master_simulator を使用
simulation_results: Dict[str, SimulationResults] = {}  # sim_manager.simulation_results を使用
network_based_simulator = None  # sim_manager.network_based_simulator を使用
network_simulation_task = None  # sim_manager.network_simulation_task を使用

# ネットワークベースシミュレーション用の設定
class NetworkSimulationConfig(BaseModel):
    start_time: str
    speed: float = simulation_settings.default_time_scale
    duration: float = simulation_settings.default_duration
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
    speed: float = simulation_settings.default_time_scale
    network_data: Optional[Dict[str, Any]] = None  # ネットワークエディターからのデータ

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
    """シミュレーションを開始（enhanced_simulatorを使用）"""
    import app.api.websocket_api as ws_api
    import logging
    logger = logging.getLogger(__name__)

    try:
        # 全てのシミュレーションエンジンを停止
        global simulation_engine, master_simulator, network_based_simulator, simulation_task, network_simulation_task

        # 古いSimulationEngineを停止
        if simulation_engine:
            try:
                await simulation_engine.stop()
            except Exception:
                pass
            simulation_engine = None

        # MasterSimulatorを停止
        if master_simulator:
            try:
                await master_simulator.stop_simulation()
            except Exception:
                pass
            master_simulator = None

        # NetworkBasedSimulatorを停止
        if network_based_simulator:
            try:
                await network_based_simulator.stop()
            except Exception:
                pass
            network_based_simulator = None

        # タスクをキャンセル
        if simulation_task and not simulation_task.done():
            simulation_task.cancel()
            simulation_task = None
        if network_simulation_task and not network_simulation_task.done():
            network_simulation_task.cancel()
            network_simulation_task = None

        # 既存のenhanced_simulatorも停止
        if ws_api.enhanced_simulator:
            try:
                await ws_api.enhanced_simulator.stop_simulation()
            except Exception:
                pass

        # 新しいenhanced_simulatorを作成
        from app.core.enhanced_simulator import EnhancedSimulationEngine

        # ネットワークデータが提供されている場合はそれを使用
        if config.network_data:
            nd = config.network_data
            logger.info(f"[DEBUG] network_data received: nodes={len(nd.get('nodes',[]))}, edges={len(nd.get('edges',[]))}")
            for n in nd.get('nodes', [])[:3]:
                logger.info(f"[DEBUG]   node: id={n.get('id')} type={n.get('type')} data_keys={list(n.get('data',{}).keys())}")
            factory = Factory(
                id="temp_factory",
                name="Temp",
                description="Will be rebuilt from network data",
            )
            ws_api.enhanced_simulator = EnhancedSimulationEngine(factory=factory)
            ws_api.enhanced_simulator.build_factory_from_network(config.network_data)
            # デバッグ: 初期在庫確認
            for bid, buf in ws_api.enhanced_simulator.factory.buffers.items():
                q = buf.get_total_quantity()
                if q > 0:
                    logger.info(f"[DEBUG] Initial buffer: {bid} = {q}")
            logger.info(f"[DEBUG] Store feeds: {len(getattr(ws_api.enhanced_simulator, '_store_feeds', []))}")
            logger.info(f"[DEBUG] Start processes: {ws_api.enhanced_simulator._start_processes}")
            logger.info("ネットワークデータから工場モデルを構築しました")
        else:
            # ネットワークデータがない場合はサンプル工場を使用
            factory = create_sample_factory()
            ws_api.enhanced_simulator = EnhancedSimulationEngine(factory=factory)
            logger.info("サンプル工場データを使用します")

        # WebSocketブロードキャスト用のイベントハンドラーを登録
        from app.api.websocket_api import WebSocketEventHandler
        ws_handler = WebSocketEventHandler()
        ws_api.enhanced_simulator.event_manager.register_handler(ws_handler)

        enhanced_simulator = ws_api.enhanced_simulator

        # duration: Noneの場合は3600秒（1時間）をデフォルトにする
        sim_duration = config.duration if config.duration else 3600.0

        # シミュレーション開始
        success = await enhanced_simulator.start_simulation(sim_duration)

        if success:
            sim_id = enhanced_simulator.state.simulation_id
            return {
                "success": True,
                "message": "シミュレーションが開始されました",
                "engine_type": "enhanced",
                "simulation_id": str(sim_id),
                "config": config.dict(),
            }
        else:
            return {
                "success": False,
                "message": "シミュレーションの開始に失敗しました",
            }

    except Exception as e:
        logger.error(f"シミュレーション開始エラー: {e}", exc_info=True)
        return {
            "success": False,
            "message": f"シミュレーション開始エラー: {str(e)}",
        }

@router.post("/pause")
async def pause_simulation():
    """シミュレーションを一時停止（enhanced_simulatorを使用）"""
    import app.api.websocket_api as ws_api
    
    if not ws_api.enhanced_simulator:
        return {"success": False, "message": "シミュレーションが開始されていません"}
        
    try:
        success = await ws_api.enhanced_simulator.pause_simulation()
        if success:
            return {"success": True, "message": "シミュレーションが一時停止されました", "status": "paused"}
        else:
            return {"success": False, "message": "一時停止に失敗しました"}
    except Exception as e:
        return {"success": False, "message": f"一時停止エラー: {str(e)}"}

@router.post("/resume")
async def resume_simulation():
    """シミュレーションを再開（enhanced_simulatorを使用）"""
    import app.api.websocket_api as ws_api
    
    if not ws_api.enhanced_simulator:
        return {"success": False, "message": "シミュレーションが開始されていません"}
        
    try:
        success = await ws_api.enhanced_simulator.resume_simulation()
        if success:
            return {"success": True, "message": "シミュレーションが再開されました", "status": "running"}
        else:
            return {"success": False, "message": "再開に失敗しました"}
    except Exception as e:
        return {"success": False, "message": f"再開エラー: {str(e)}"}

@router.post("/stop")
async def stop_simulation():
    """シミュレーションを停止（enhanced_simulatorを使用）"""
    import app.api.websocket_api as ws_api
    
    if not ws_api.enhanced_simulator:
        return {"success": False, "message": "シミュレーションが開始されていません"}
        
    try:
        success = await ws_api.enhanced_simulator.stop_simulation()
        if success:
            return {
                "success": True, 
                "message": "シミュレーションが停止されました", 
                "status": "stopped",
                "final_time": ws_api.enhanced_simulator.state.current_time
            }
        else:
            return {"success": False, "message": "停止に失敗しました"}
    except Exception as e:
        return {"success": False, "message": f"停止エラー: {str(e)}"}

@router.get("/results")
async def get_simulation_results_api():
    """シミュレーション結果を取得"""
    import app.api.websocket_api as ws_api
    if not ws_api.enhanced_simulator:
        raise HTTPException(status_code=400, detail="シミュレーションが存在しません")
    return ws_api.enhanced_simulator.get_results()

@router.post("/speed")
async def set_speed(speed: float):
    """シミュレーション速度を変更"""
    import app.api.websocket_api as ws_api
    if not ws_api.enhanced_simulator:
        raise HTTPException(status_code=400, detail="シミュレーションが存在しません")
    ws_api.enhanced_simulator.set_speed(speed)
    return {"speed": speed}

@router.get("/status")
async def get_simulation_status():
    """シミュレーション状態を取得"""
    import app.api.websocket_api as ws_api

    if not ws_api.enhanced_simulator:
        return {
            "status": "idle",
            "current_time": datetime.now().isoformat(),
            "simulation_time": 0,
            "speed": 1.0,
            "is_running": False
        }
        
    state = ws_api.enhanced_simulator.state
    return {
        "status": state.status,
        "current_time": datetime.now().isoformat(),
        "simulation_time": state.current_time,
        "speed": 1.0,  # enhanced_simulatorに速度設定があれば使用
        "is_running": state.status == "running",
        "progress": state.progress
    }

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
                logger.error(f"Simulation execution error: {e}")
                
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
        if _detect_cycles(edges):
            validation_result["errors"].append({
                "type": "circular_reference",
                "message": "循環参照が検出されました",
                "severity": "error"
            })
            validation_result["is_valid"] = False

        # 材料フローの検証
        flow_validation = _validate_material_flow(nodes, edges)
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
        
        # ノードの変換（データをそのまま通す）
        for node in network_data.get('nodes', []):
            converted_node = {
                "id": node.get('id'),
                "type": node.get('type', 'unknown'),
                "data": node.get('data', {}),
                "position": node.get('position'),
            }
            converted_data["nodes"].append(converted_node)

        # エッジの変換
        for edge in network_data.get('edges', []):
            converted_edge = {
                "id": edge.get('id'),
                "source": edge.get('source'),
                "target": edge.get('target'),
                "data": edge.get('data', {}),
            }
            converted_data["edges"].append(converted_edge)

        # 製品情報の抽出
        for node in network_data.get('nodes', []):
            if node.get('type') in ['machining', 'assembly', 'inspection']:
                nd = node.get('data', {})
                converted_data["products"].append({
                    "id": f"PRODUCT_{node.get('id')}",
                    "name": nd.get('label', f'Product {node.get("id")}'),
                    "type": "component" if node.get('type') == 'machining' else "assembly",
                    "processing_time": nd.get('cycleTime', 60),
                    "source_process": node.get('id'),
                })

        # BOM情報の抽出
        for edge in network_data.get('edges', []):
            src = next((n for n in network_data.get('nodes', []) if n.get('id') == edge.get('source')), None)
            tgt = next((n for n in network_data.get('nodes', []) if n.get('id') == edge.get('target')), None)
            if src and tgt:
                converted_data["bom_items"].append({
                    "id": f"BOM_{edge.get('id')}",
                    "parent_product": f"PRODUCT_{tgt.get('id')}",
                    "child_product": f"PRODUCT_{src.get('id')}",
                    "quantity": 1,
                    "source_edge": edge.get('id'),
                })
        
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

def _detect_cycles(edges: List[dict]) -> bool:
    """循環参照を検出"""
    graph = {}
    for edge in edges:
        source = edge.get('source')
        target = edge.get('target')
        if source not in graph:
            graph[source] = []
        graph[source].append(target)

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


def _validate_material_flow(nodes: List[dict], edges: List[dict]) -> dict:
    """材料フローの妥当性を検証"""
    validation = {"is_valid": True, "errors": [], "warnings": []}

    process_nodes = [n for n in nodes if n.get('type') in ['machining', 'assembly', 'inspection']]

    for process_node in process_nodes:
        node_id = process_node.get('id')
        node_data = process_node.get('data', {})

        for param in ['cycleTime', 'equipmentCount']:
            if param not in node_data:
                validation["errors"].append({
                    "node_id": node_id, "param": param,
                    "message": f"必須パラメータ '{param}' が設定されていません", "severity": "error"
                })
                validation["is_valid"] = False

        if 'cycleTime' in node_data:
            ct = node_data['cycleTime']
            if not isinstance(ct, (int, float)) or ct <= 0:
                validation["errors"].append({
                    "node_id": node_id, "param": "cycleTime",
                    "message": f"サイクルタイムは正の数値である必要があります: {ct}", "severity": "error"
                })
                validation["is_valid"] = False

        if 'equipmentCount' in node_data:
            ec = node_data['equipmentCount']
            if not isinstance(ec, int) or ec <= 0:
                validation["errors"].append({
                    "node_id": node_id, "param": "equipmentCount",
                    "message": f"設備数は正の整数である必要があります: {ec}", "severity": "error"
                })
                validation["is_valid"] = False

    for edge in edges:
        source_id = edge.get('source')
        target_id = edge.get('target')
        if not any(n.get('id') == source_id for n in nodes):
            validation["errors"].append({
                "edge_id": edge.get('id'),
                "message": f"接続元ノード '{source_id}' が存在しません", "severity": "error"
            })
            validation["is_valid"] = False
        if not any(n.get('id') == target_id for n in nodes):
            validation["errors"].append({
                "edge_id": edge.get('id'),
                "message": f"接続先ノード '{target_id}' が存在しません", "severity": "error"
            })
            validation["is_valid"] = False

    return validation

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
        logger.error(f"Simulation monitoring error: {e}")