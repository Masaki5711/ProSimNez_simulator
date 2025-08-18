"""
プロジェクト管理API
データ永続化とバージョン管理
"""
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from datetime import datetime

from app.core.persistence_manager import (
    PersistenceManager, 
    VersionType, 
    ChangeType,
    ProjectVersion,
    ChangeRecord,
    ProjectSnapshot
)
from app.core.data_integration import DataIntegrationEngine
from app.api.integration_api import get_config_manager

router = APIRouter()

# グローバルインスタンス
persistence_manager = PersistenceManager()

class SaveProjectRequest(BaseModel):
    """プロジェクト保存リクエスト"""
    project_id: str
    user_id: str
    description: str = ""
    version_type: VersionType = VersionType.AUTO

class RestoreRequest(BaseModel):
    """復元リクエスト"""
    project_id: str
    snapshot_id: str
    user_id: str

class CompareVersionsRequest(BaseModel):
    """バージョン比較リクエスト"""
    project_id: str
    version_id1: str
    version_id2: str

@router.on_event("startup")
async def startup_event():
    """アプリケーション開始時の初期化"""
    await persistence_manager.initialize()

@router.post("/projects/save")
async def save_project(request: SaveProjectRequest):
    """プロジェクトを保存"""
    try:
        # 現在の設定を取得
        config_manager = get_config_manager()
        config = config_manager.get_configuration(request.project_id)
        
        if not config:
            raise HTTPException(status_code=404, detail="プロジェクト設定が見つかりません")
            
        if config.validation_errors:
            raise HTTPException(
                status_code=400, 
                detail=f"設定にエラーがあります: {config.validation_errors}"
            )
            
        # プロジェクトを保存
        version = await persistence_manager.save_project(
            request.project_id,
            config,
            request.user_id,
            request.description,
            request.version_type
        )
        
        return {
            "success": True,
            "version": {
                "version_id": version.version_id,
                "version_number": version.version_number,
                "created_at": version.created_at.isoformat(),
                "description": version.description
            },
            "message": "プロジェクトが保存されました"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存エラー: {str(e)}")

@router.get("/projects/{project_id}/load")
async def load_project(project_id: str, version_id: Optional[str] = None):
    """プロジェクトを読み込み"""
    try:
        result = await persistence_manager.load_project(project_id, version_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
            
        # 設定マネージャーに復元
        config_manager = get_config_manager()
        config_manager.active_configurations[project_id] = result
        
        return {
            "success": True,
            "project_id": project_id,
            "version_id": version_id,
            "statistics": result.statistics,
            "validation_errors": result.validation_errors,
            "warnings": result.warnings,
            "factory_info": {
                "name": result.factory.name,
                "processes_count": len(result.factory.processes),
                "products_count": len(result.factory.products),
                "connections_count": len(result.factory.connections)
            },
            "message": "プロジェクトが読み込まれました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"読み込みエラー: {str(e)}")

@router.get("/projects/{project_id}/versions")
async def get_project_versions(project_id: str):
    """プロジェクトのバージョン一覧を取得"""
    try:
        versions = await persistence_manager.get_project_versions(project_id)
        
        version_list = []
        for version in versions:
            version_list.append({
                "version_id": version.version_id,
                "version_number": version.version_number,
                "version_type": version.version_type.value,
                "created_at": version.created_at.isoformat(),
                "created_by": version.created_by,
                "description": version.description,
                "change_type": version.change_type.value,
                "metadata": version.metadata
            })
            
        return {
            "success": True,
            "project_id": project_id,
            "versions": sorted(version_list, key=lambda x: x["created_at"], reverse=True),
            "total_count": len(version_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"バージョン取得エラー: {str(e)}")

@router.get("/projects/{project_id}/changes")
async def get_project_changes(project_id: str, limit: int = Query(100, ge=1, le=1000)):
    """プロジェクトの変更履歴を取得"""
    try:
        changes = await persistence_manager.get_project_changes(project_id, limit)
        
        change_list = []
        for change in changes:
            change_list.append({
                "change_id": change.change_id,
                "version_id": change.version_id,
                "timestamp": change.timestamp.isoformat(),
                "user_id": change.user_id,
                "change_type": change.change_type.value,
                "affected_objects": change.affected_objects,
                "details": change.details
            })
            
        return {
            "success": True,
            "project_id": project_id,
            "changes": change_list,
            "total_count": len(change_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"変更履歴取得エラー: {str(e)}")

@router.delete("/projects/{project_id}/versions/{version_id}")
async def delete_version(project_id: str, version_id: str, user_id: str):
    """バージョンを削除"""
    try:
        success = await persistence_manager.delete_version(project_id, version_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="バージョンが見つかりません")
            
        return {
            "success": True,
            "project_id": project_id,
            "version_id": version_id,
            "message": "バージョンが削除されました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"削除エラー: {str(e)}")

@router.post("/projects/{project_id}/snapshots")
async def create_snapshot(project_id: str, version_id: str, 
                         simulation_results: Optional[Dict[str, Any]] = None):
    """スナップショットを作成"""
    try:
        snapshot = await persistence_manager.create_snapshot(
            project_id, 
            version_id, 
            simulation_results
        )
        
        return {
            "success": True,
            "snapshot": {
                "snapshot_id": snapshot.snapshot_id,
                "project_id": snapshot.project_id,
                "version_id": snapshot.version_id,
                "timestamp": snapshot.timestamp.isoformat(),
                "metadata": snapshot.metadata
            },
            "message": "スナップショットが作成されました"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"スナップショット作成エラー: {str(e)}")

@router.get("/projects/{project_id}/snapshots")
async def get_project_snapshots(project_id: str):
    """プロジェクトのスナップショット一覧を取得"""
    try:
        snapshots = await persistence_manager.get_project_snapshots(project_id)
        
        snapshot_list = []
        for snapshot in snapshots:
            snapshot_list.append({
                "snapshot_id": snapshot.snapshot_id,
                "version_id": snapshot.version_id,
                "timestamp": snapshot.timestamp.isoformat(),
                "has_simulation_results": snapshot.simulation_results is not None,
                "metadata": snapshot.metadata
            })
            
        return {
            "success": True,
            "project_id": project_id,
            "snapshots": sorted(snapshot_list, key=lambda x: x["timestamp"], reverse=True),
            "total_count": len(snapshot_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"スナップショット取得エラー: {str(e)}")

@router.post("/projects/restore")
async def restore_from_snapshot(request: RestoreRequest):
    """スナップショットから復元"""
    try:
        result = await persistence_manager.restore_from_snapshot(
            request.project_id,
            request.snapshot_id,
            request.user_id
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="スナップショットが見つかりません")
            
        # 設定マネージャーに復元
        config_manager = get_config_manager()
        config_manager.active_configurations[request.project_id] = result
        
        return {
            "success": True,
            "project_id": request.project_id,
            "snapshot_id": request.snapshot_id,
            "message": "スナップショットから復元されました"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"復元エラー: {str(e)}")

@router.post("/projects/compare-versions")
async def compare_versions(request: CompareVersionsRequest):
    """バージョン間の差分を比較"""
    try:
        differences = await persistence_manager.compare_versions(
            request.project_id,
            request.version_id1,
            request.version_id2
        )
        
        return {
            "success": True,
            "project_id": request.project_id,
            "version_id1": request.version_id1,
            "version_id2": request.version_id2,
            "differences": differences
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"比較エラー: {str(e)}")

@router.get("/projects/{project_id}/export")
async def export_project(project_id: str, version_id: Optional[str] = None, 
                        format: str = Query("json", regex="^(json|csv|xml)$")):
    """プロジェクトをエクスポート"""
    try:
        result = await persistence_manager.load_project(project_id, version_id)
        
        if not result:
            raise HTTPException(status_code=404, detail="プロジェクトが見つかりません")
            
        if format == "json":
            export_data = {
                "project_id": project_id,
                "version_id": version_id,
                "export_timestamp": datetime.now().isoformat(),
                "factory": result.factory.to_dict(),
                "statistics": result.statistics,
                "validation_errors": result.validation_errors,
                "warnings": result.warnings
            }
            
            return {
                "success": True,
                "format": format,
                "data": export_data
            }
        else:
            # TODO: CSV, XML形式の実装
            raise HTTPException(status_code=501, detail=f"{format}形式はまだ実装されていません")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"エクスポートエラー: {str(e)}")

@router.get("/projects/summary")
async def get_projects_summary():
    """全プロジェクトの要約を取得"""
    try:
        all_versions = persistence_manager.versions
        all_changes = persistence_manager.changes
        all_snapshots = persistence_manager.snapshots
        
        projects_summary = []
        
        for project_id in all_versions.keys():
            versions = all_versions.get(project_id, [])
            changes = all_changes.get(project_id, [])
            snapshots = all_snapshots.get(project_id, [])
            
            latest_version = max(versions, key=lambda v: v.created_at) if versions else None
            latest_change = max(changes, key=lambda c: c.timestamp) if changes else None
            
            projects_summary.append({
                "project_id": project_id,
                "versions_count": len(versions),
                "changes_count": len(changes),
                "snapshots_count": len(snapshots),
                "latest_version": {
                    "version_number": latest_version.version_number,
                    "created_at": latest_version.created_at.isoformat(),
                    "created_by": latest_version.created_by
                } if latest_version else None,
                "last_activity": latest_change.timestamp.isoformat() if latest_change else None
            })
            
        return {
            "success": True,
            "projects": sorted(projects_summary, key=lambda x: x.get("last_activity", ""), reverse=True),
            "total_projects": len(projects_summary)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"要約取得エラー: {str(e)}")

@router.post("/projects/{project_id}/cleanup")
async def cleanup_project(project_id: str, keep_versions: int = Query(10, ge=1, le=100)):
    """プロジェクトのクリーンアップ"""
    try:
        # 古いバージョンを削除
        versions = await persistence_manager.get_project_versions(project_id)
        
        if len(versions) <= keep_versions:
            return {
                "success": True,
                "project_id": project_id,
                "message": "クリーンアップの必要はありません",
                "versions_removed": 0
            }
            
        # 新しい順にソートして、保持する分を除いた古いバージョンを削除
        versions_sorted = sorted(versions, key=lambda v: v.created_at, reverse=True)
        versions_to_remove = versions_sorted[keep_versions:]
        
        removed_count = 0
        for version in versions_to_remove:
            success = await persistence_manager.delete_version(
                project_id, 
                version.version_id, 
                "system_cleanup"
            )
            if success:
                removed_count += 1
                
        return {
            "success": True,
            "project_id": project_id,
            "versions_removed": removed_count,
            "versions_remaining": len(versions) - removed_count,
            "message": f"{removed_count}個の古いバージョンが削除されました"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"クリーンアップエラー: {str(e)}")

# 依存性注入用のファクトリ関数

def get_persistence_manager() -> PersistenceManager:
    """永続化マネージャーを取得"""
    return persistence_manager

