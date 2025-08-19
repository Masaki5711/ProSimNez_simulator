"""
データ統合API
フロントエンドとバックエンドのデータ統合を管理
"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import json

from app.core.data_integration import DataIntegrationEngine, DynamicConfigurationManager
from app.core.enhanced_simulator import EnhancedSimulationEngine
from app.websocket.realtime_manager import RealtimeDataManager

router = APIRouter()

# グローバルインスタンス
integration_engine = DataIntegrationEngine()
config_manager = DynamicConfigurationManager(integration_engine)
active_simulators: Dict[str, EnhancedSimulationEngine] = {}

class NetworkDataRequest(BaseModel):
    """ネットワークデータリクエスト"""
    project_id: str
    network_data: Dict[str, Any]
    
class SimulationRequest(BaseModel):
    """シミュレーション実行リクエスト"""
    project_id: str
    duration: float = 3600.0  # デフォルト1時間
    speed: float = 1.0
    
class ConfigurationUpdateRequest(BaseModel):
    """設定更新リクエスト"""
    project_id: str
    network_data: Dict[str, Any]
    apply_immediately: bool = True

@router.post("/integration/transform")
async def transform_network_data(request: NetworkDataRequest):
    """NetworkEditorデータをシミュレーション用に変換"""
    try:
        result = await integration_engine.transform_network_data(
            request.network_data, 
            request.project_id
        )
        
        return {
            "success": True,
            "project_id": request.project_id,
            "validation_errors": result.validation_errors,
            "warnings": result.warnings,
            "statistics": result.statistics,
            "factory_summary": {
                "name": result.factory.name,
                "processes_count": len(result.factory.processes),
                "products_count": len(result.factory.products),
                "connections_count": len(result.factory.connections)
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"変換エラー: {str(e)}")

@router.post("/integration/update-configuration")
async def update_configuration(request: ConfigurationUpdateRequest):
    """設定を動的更新"""
    try:
        result = await config_manager.update_configuration(
            request.project_id, 
            request.network_data
        )
        
        if result.validation_errors:
            return {
                "success": False,
                "errors": result.validation_errors,
                "warnings": result.warnings
            }
            
        # 即座に適用する場合
        if request.apply_immediately:
            await _apply_configuration_to_simulator(request.project_id, result)
            
        return {
            "success": True,
            "project_id": request.project_id,
            "warnings": result.warnings,
            "statistics": result.statistics,
            "applied_immediately": request.apply_immediately
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定更新エラー: {str(e)}")

@router.get("/integration/configuration/{project_id}")
async def get_configuration(project_id: str):
    """設定を取得"""
    try:
        config = config_manager.get_configuration(project_id)
        
        if not config:
            raise HTTPException(status_code=404, detail="設定が見つかりません")
            
        return {
            "success": True,
            "project_id": project_id,
            "statistics": config.statistics,
            "validation_errors": config.validation_errors,
            "warnings": config.warnings,
            "factory_info": {
                "id": config.factory.id,
                "name": config.factory.name,
                "description": config.factory.description,
                "created_at": config.factory.created_at.isoformat(),
                "updated_at": config.factory.updated_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定取得エラー: {str(e)}")

@router.post("/integration/start-simulation")
async def start_simulation(request: SimulationRequest):
    """シミュレーションを開始"""
    try:
        # 設定を取得
        config = config_manager.get_configuration(request.project_id)
        if not config:
            raise HTTPException(status_code=404, detail="設定が見つかりません")
            
        if config.validation_errors:
            raise HTTPException(
                status_code=400, 
                detail=f"設定にエラーがあります: {config.validation_errors}"
            )
            
        # 既存のシミュレーターを停止
        if request.project_id in active_simulators:
            await active_simulators[request.project_id].stop_simulation()
            
        # 新しいシミュレーターを作成
        # リアルタイムマネージャーを取得（通常は依存性注入で管理）
        realtime_manager = RealtimeDataManager()
        
        simulator = EnhancedSimulationEngine(
            config.factory,
            websocket_manager=realtime_manager.websocket_manager,
            redis_client=realtime_manager.redis_cache
        )
        
        # シミュレーション開始
        success = await simulator.start_simulation(request.duration)
        
        if success:
            active_simulators[request.project_id] = simulator
            
            return {
                "success": True,
                "project_id": request.project_id,
                "simulation_started": True,
                "duration": request.duration,
                "message": "シミュレーションが開始されました"
            }
        else:
            return {
                "success": False,
                "project_id": request.project_id,
                "error": "シミュレーションの開始に失敗しました"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション開始エラー: {str(e)}")

@router.post("/integration/stop-simulation/{project_id}")
async def stop_simulation(project_id: str):
    """シミュレーションを停止"""
    try:
        if project_id not in active_simulators:
            raise HTTPException(status_code=404, detail="アクティブなシミュレーションが見つかりません")
            
        simulator = active_simulators[project_id]
        success = await simulator.stop_simulation()
        
        if success:
            del active_simulators[project_id]
            
        return {
            "success": success,
            "project_id": project_id,
            "message": "シミュレーションが停止されました" if success else "停止に失敗しました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"シミュレーション停止エラー: {str(e)}")

@router.get("/integration/simulation-status/{project_id}")
async def get_simulation_status(project_id: str):
    """シミュレーション状態を取得"""
    try:
        if project_id not in active_simulators:
            return {
                "success": True,
                "project_id": project_id,
                "is_running": False,
                "status": "stopped"
            }
            
        simulator = active_simulators[project_id]
        state = simulator.get_simulation_state()
        
        return {
            "success": True,
            "project_id": project_id,
            "is_running": state["state"]["status"] in ["running", "paused"],
            "simulation_state": state
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"状態取得エラー: {str(e)}")

@router.get("/integration/realtime-data/{project_id}")
async def get_realtime_data(project_id: str):
    """リアルタイムデータを取得"""
    try:
        if project_id not in active_simulators:
            raise HTTPException(status_code=404, detail="アクティブなシミュレーションが見つかりません")
            
        simulator = active_simulators[project_id]
        data = simulator.get_real_time_data()
        
        return {
            "success": True,
            "project_id": project_id,
            "data": data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"リアルタイムデータ取得エラー: {str(e)}")

@router.post("/integration/pause-simulation/{project_id}")
async def pause_simulation(project_id: str):
    """シミュレーションを一時停止"""
    try:
        if project_id not in active_simulators:
            raise HTTPException(status_code=404, detail="アクティブなシミュレーションが見つかりません")
            
        simulator = active_simulators[project_id]
        success = await simulator.pause_simulation()
        
        return {
            "success": success,
            "project_id": project_id,
            "message": "シミュレーションが一時停止されました" if success else "一時停止に失敗しました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"一時停止エラー: {str(e)}")

@router.post("/integration/resume-simulation/{project_id}")
async def resume_simulation(project_id: str):
    """シミュレーションを再開"""
    try:
        if project_id not in active_simulators:
            raise HTTPException(status_code=404, detail="アクティブなシミュレーションが見つかりません")
            
        simulator = active_simulators[project_id]
        success = await simulator.resume_simulation()
        
        return {
            "success": success,
            "project_id": project_id,
            "message": "シミュレーションが再開されました" if success else "再開に失敗しました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"再開エラー: {str(e)}")

@router.get("/integration/validate-network")
async def validate_network_data(project_id: str):
    """ネットワークデータの妥当性を検証"""
    try:
        config = config_manager.get_configuration(project_id)
        if not config:
            raise HTTPException(status_code=404, detail="設定が見つかりません")
            
        return {
            "success": True,
            "project_id": project_id,
            "is_valid": len(config.validation_errors) == 0,
            "validation_errors": config.validation_errors,
            "warnings": config.warnings,
            "statistics": config.statistics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"検証エラー: {str(e)}")

@router.get("/integration/active-projects")
async def get_active_projects():
    """アクティブなプロジェクト一覧を取得"""
    try:
        configurations = config_manager.get_all_configurations()
        active_projects = []
        
        for project_id, config in configurations.items():
            is_simulating = project_id in active_simulators
            
            active_projects.append({
                "project_id": project_id,
                "factory_name": config.factory.name,
                "is_simulating": is_simulating,
                "processes_count": len(config.factory.processes),
                "products_count": len(config.factory.products),
                "has_errors": len(config.validation_errors) > 0,
                "last_updated": config.factory.updated_at.isoformat()
            })
            
        return {
            "success": True,
            "active_projects": active_projects,
            "total_count": len(active_projects),
            "simulating_count": len(active_simulators)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"プロジェクト一覧取得エラー: {str(e)}")

@router.delete("/integration/configuration/{project_id}")
async def delete_configuration(project_id: str):
    """設定を削除"""
    try:
        # シミュレーションが実行中の場合は停止
        if project_id in active_simulators:
            await active_simulators[project_id].stop_simulation()
            del active_simulators[project_id]
            
        # 設定を削除
        config_manager.remove_configuration(project_id)
        
        return {
            "success": True,
            "project_id": project_id,
            "message": "設定が削除されました"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"設定削除エラー: {str(e)}")

# ヘルパー関数

async def _apply_configuration_to_simulator(project_id: str, config):
    """設定をシミュレーターに適用"""
    if project_id in active_simulators:
        simulator = active_simulators[project_id]
        await simulator.update_factory_configuration(config.factory)

# 依存性注入用のファクトリ関数

def get_integration_engine() -> DataIntegrationEngine:
    """データ統合エンジンを取得"""
    return integration_engine

def get_config_manager() -> DynamicConfigurationManager:
    """設定マネージャーを取得"""
    return config_manager

def get_active_simulators() -> Dict[str, EnhancedSimulationEngine]:
    """アクティブなシミュレーターを取得"""
    return active_simulators



