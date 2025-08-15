"""
データ永続化とバージョン管理システム
"""
import json
import asyncio
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
from pathlib import Path
import uuid
import pickle
import gzip
from enum import Enum
import hashlib

from pydantic import BaseModel
from app.models.factory import Factory
from app.core.resource_manager import ResourceManager
from app.core.data_integration import DataTransformationResult

class VersionType(Enum):
    """バージョンタイプ"""
    MAJOR = "major"
    MINOR = "minor"
    PATCH = "patch"
    AUTO = "auto"

class ChangeType(Enum):
    """変更タイプ"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    MERGE = "merge"

class ProjectVersion(BaseModel):
    """プロジェクトバージョン"""
    version_id: str
    project_id: str
    version_number: str
    version_type: VersionType
    created_at: datetime
    created_by: str
    description: str
    change_type: ChangeType
    parent_version_id: Optional[str] = None
    data_hash: str
    file_path: str
    metadata: Dict[str, Any] = {}
    
    class Config:
        arbitrary_types_allowed = True
    
class ChangeRecord(BaseModel):
    """変更記録"""
    change_id: str
    project_id: str
    version_id: str
    timestamp: datetime
    user_id: str
    change_type: ChangeType
    affected_objects: List[str]
    details: Dict[str, Any]
    diff_data: Optional[Dict[str, Any]] = None
    
    class Config:
        arbitrary_types_allowed = True

class ProjectSnapshot(BaseModel):
    """プロジェクトスナップショット"""
    snapshot_id: str
    project_id: str
    version_id: str
    timestamp: datetime
    factory_data: Dict[str, Any]
    resource_data: Dict[str, Any]
    simulation_results: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = {}
    
    class Config:
        arbitrary_types_allowed = True

class PersistenceManager:
    """永続化マネージャー"""
    
    def __init__(self, storage_path: str = "data/projects"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        # バージョン管理
        self.versions: Dict[str, List[ProjectVersion]] = {}  # project_id -> versions
        self.changes: Dict[str, List[ChangeRecord]] = {}     # project_id -> changes
        self.snapshots: Dict[str, List[ProjectSnapshot]] = {} # project_id -> snapshots
        
        # キャッシュ
        self.cache: Dict[str, Any] = {}
        self.cache_expiry: Dict[str, datetime] = {}
        
        # 設定
        self.max_versions_per_project = 100
        self.max_changes_per_project = 1000
        self.cache_ttl = timedelta(minutes=30)
        self.auto_backup_interval = timedelta(hours=1)
        
    async def initialize(self):
        """初期化"""
        await self._load_metadata()
        await self._start_auto_backup()
        
    async def save_project(self, project_id: str, 
                          transformation_result: DataTransformationResult,
                          user_id: str,
                          description: str = "",
                          version_type: VersionType = VersionType.AUTO) -> ProjectVersion:
        """プロジェクトを保存"""
        try:
            # データハッシュを計算
            data_hash = self._calculate_data_hash(transformation_result)
            
            # 既存バージョンと同じかチェック
            if await self._is_duplicate_version(project_id, data_hash):
                raise ValueError("同じ内容のバージョンが既に存在します")
                
            # バージョン番号を生成
            version_number = await self._generate_version_number(project_id, version_type)
            
            # バージョンIDを生成
            version_id = str(uuid.uuid4())
            
            # ファイルパスを生成
            file_path = self._get_version_file_path(project_id, version_id)
            
            # データを保存
            await self._save_version_data(file_path, transformation_result)
            
            # バージョン情報を作成
            parent_version_id = await self._get_latest_version_id(project_id)
            
            version = ProjectVersion(
                version_id=version_id,
                project_id=project_id,
                version_number=version_number,
                version_type=version_type,
                created_at=datetime.now(),
                created_by=user_id,
                description=description,
                change_type=ChangeType.UPDATE if parent_version_id else ChangeType.CREATE,
                parent_version_id=parent_version_id,
                data_hash=data_hash,
                file_path=str(file_path),
                metadata={
                    "statistics": transformation_result.statistics,
                    "validation_errors": len(transformation_result.validation_errors),
                    "warnings": len(transformation_result.warnings)
                }
            )
            
            # バージョンを記録
            if project_id not in self.versions:
                self.versions[project_id] = []
            self.versions[project_id].append(version)
            
            # 変更記録を作成
            change_record = ChangeRecord(
                change_id=str(uuid.uuid4()),
                project_id=project_id,
                version_id=version_id,
                timestamp=datetime.now(),
                user_id=user_id,
                change_type=version.change_type,
                affected_objects=self._get_affected_objects(transformation_result),
                details={
                    "version_number": version_number,
                    "description": description,
                    "statistics": transformation_result.statistics
                }
            )
            
            if project_id not in self.changes:
                self.changes[project_id] = []
            self.changes[project_id].append(change_record)
            
            # メタデータを保存
            await self._save_metadata()
            
            # 古いバージョンをクリーンアップ
            await self._cleanup_old_versions(project_id)
            
            return version
            
        except Exception as e:
            raise Exception(f"プロジェクト保存エラー: {str(e)}")
            
    async def load_project(self, project_id: str, 
                          version_id: Optional[str] = None) -> Optional[DataTransformationResult]:
        """プロジェクトを読み込み"""
        try:
            # キャッシュをチェック
            cache_key = f"{project_id}:{version_id or 'latest'}"
            if cache_key in self.cache and not self._is_cache_expired(cache_key):
                return self.cache[cache_key]
                
            # バージョンを特定
            if version_id is None:
                version = await self._get_latest_version(project_id)
            else:
                version = await self._get_version(project_id, version_id)
                
            if not version:
                return None
                
            # データを読み込み
            file_path = Path(version.file_path)
            if not file_path.exists():
                raise FileNotFoundError(f"バージョンファイルが見つかりません: {file_path}")
                
            result = await self._load_version_data(file_path)
            
            # キャッシュに保存
            self.cache[cache_key] = result
            self.cache_expiry[cache_key] = datetime.now() + self.cache_ttl
            
            return result
            
        except Exception as e:
            raise Exception(f"プロジェクト読み込みエラー: {str(e)}")
            
    async def get_project_versions(self, project_id: str) -> List[ProjectVersion]:
        """プロジェクトのバージョン一覧を取得"""
        return self.versions.get(project_id, [])
        
    async def get_project_changes(self, project_id: str, 
                                 limit: int = 100) -> List[ChangeRecord]:
        """プロジェクトの変更履歴を取得"""
        changes = self.changes.get(project_id, [])
        return sorted(changes, key=lambda x: x.timestamp, reverse=True)[:limit]
        
    async def delete_version(self, project_id: str, version_id: str, 
                           user_id: str) -> bool:
        """バージョンを削除"""
        try:
            version = await self._get_version(project_id, version_id)
            if not version:
                return False
                
            # ファイルを削除
            file_path = Path(version.file_path)
            if file_path.exists():
                file_path.unlink()
                
            # バージョンリストから削除
            if project_id in self.versions:
                self.versions[project_id] = [
                    v for v in self.versions[project_id] 
                    if v.version_id != version_id
                ]
                
            # 変更記録を追加
            change_record = ChangeRecord(
                change_id=str(uuid.uuid4()),
                project_id=project_id,
                version_id=version_id,
                timestamp=datetime.now(),
                user_id=user_id,
                change_type=ChangeType.DELETE,
                affected_objects=[version_id],
                details={
                    "deleted_version": version.version_number,
                    "deleted_at": datetime.now().isoformat()
                }
            )
            
            if project_id not in self.changes:
                self.changes[project_id] = []
            self.changes[project_id].append(change_record)
            
            # キャッシュをクリア
            self._clear_project_cache(project_id)
            
            # メタデータを保存
            await self._save_metadata()
            
            return True
            
        except Exception as e:
            print(f"バージョン削除エラー: {e}")
            return False
            
    async def create_snapshot(self, project_id: str, version_id: str,
                            simulation_results: Optional[Dict[str, Any]] = None) -> ProjectSnapshot:
        """スナップショットを作成"""
        try:
            # バージョンデータを読み込み
            result = await self.load_project(project_id, version_id)
            if not result:
                raise ValueError("指定されたバージョンが見つかりません")
                
            # スナップショットを作成
            snapshot = ProjectSnapshot(
                snapshot_id=str(uuid.uuid4()),
                project_id=project_id,
                version_id=version_id,
                timestamp=datetime.now(),
                factory_data=result.factory.to_dict(),
                resource_data=result.resource_manager.get_resource_utilization_report(),
                simulation_results=simulation_results,
                metadata={
                    "statistics": result.statistics,
                    "validation_errors": result.validation_errors,
                    "warnings": result.warnings
                }
            )
            
            # スナップショットを保存
            snapshot_path = self._get_snapshot_file_path(project_id, snapshot.snapshot_id)
            await self._save_snapshot_data(snapshot_path, snapshot)
            
            # スナップショットリストに追加
            if project_id not in self.snapshots:
                self.snapshots[project_id] = []
            self.snapshots[project_id].append(snapshot)
            
            await self._save_metadata()
            
            return snapshot
            
        except Exception as e:
            raise Exception(f"スナップショット作成エラー: {str(e)}")
            
    async def get_project_snapshots(self, project_id: str) -> List[ProjectSnapshot]:
        """プロジェクトのスナップショット一覧を取得"""
        return self.snapshots.get(project_id, [])
        
    async def restore_from_snapshot(self, project_id: str, snapshot_id: str,
                                  user_id: str) -> Optional[DataTransformationResult]:
        """スナップショットから復元"""
        try:
            # スナップショットを取得
            snapshot = None
            for snap in self.snapshots.get(project_id, []):
                if snap.snapshot_id == snapshot_id:
                    snapshot = snap
                    break
                    
            if not snapshot:
                return None
                
            # スナップショットデータを読み込み
            snapshot_path = self._get_snapshot_file_path(project_id, snapshot_id)
            snapshot_data = await self._load_snapshot_data(snapshot_path)
            
            # バージョンデータから復元
            original_result = await self.load_project(project_id, snapshot.version_id)
            if not original_result:
                return None
                
            # 新しいバージョンとして保存
            new_version = await self.save_project(
                project_id,
                original_result,
                user_id,
                f"スナップショット {snapshot_id[:8]} から復元",
                VersionType.MINOR
            )
            
            return original_result
            
        except Exception as e:
            raise Exception(f"スナップショット復元エラー: {str(e)}")
            
    async def compare_versions(self, project_id: str, 
                             version_id1: str, version_id2: str) -> Dict[str, Any]:
        """バージョン間の差分を比較"""
        try:
            result1 = await self.load_project(project_id, version_id1)
            result2 = await self.load_project(project_id, version_id2)
            
            if not result1 or not result2:
                raise ValueError("比較対象のバージョンが見つかりません")
                
            # 差分を計算
            differences = {
                "processes": self._compare_processes(result1.factory, result2.factory),
                "products": self._compare_products(result1.factory, result2.factory),
                "connections": self._compare_connections(result1.factory, result2.factory),
                "statistics": self._compare_statistics(result1.statistics, result2.statistics)
            }
            
            return differences
            
        except Exception as e:
            raise Exception(f"バージョン比較エラー: {str(e)}")
            
    # プライベートメソッド
    
    def _calculate_data_hash(self, result: DataTransformationResult) -> str:
        """データハッシュを計算"""
        data_str = json.dumps({
            "factory": result.factory.to_dict(),
            "statistics": result.statistics
        }, sort_keys=True, default=str)
        
        return hashlib.sha256(data_str.encode()).hexdigest()
        
    async def _is_duplicate_version(self, project_id: str, data_hash: str) -> bool:
        """重複バージョンかチェック"""
        versions = self.versions.get(project_id, [])
        return any(v.data_hash == data_hash for v in versions)
        
    async def _generate_version_number(self, project_id: str, 
                                     version_type: VersionType) -> str:
        """バージョン番号を生成"""
        versions = self.versions.get(project_id, [])
        
        if not versions:
            return "1.0.0"
            
        latest_version = max(versions, key=lambda v: v.created_at)
        parts = latest_version.version_number.split('.')
        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])
        
        if version_type == VersionType.MAJOR:
            major += 1
            minor = 0
            patch = 0
        elif version_type == VersionType.MINOR:
            minor += 1
            patch = 0
        elif version_type == VersionType.PATCH or version_type == VersionType.AUTO:
            patch += 1
            
        return f"{major}.{minor}.{patch}"
        
    def _get_version_file_path(self, project_id: str, version_id: str) -> Path:
        """バージョンファイルパスを取得"""
        project_dir = self.storage_path / project_id / "versions"
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir / f"{version_id}.dat"
        
    def _get_snapshot_file_path(self, project_id: str, snapshot_id: str) -> Path:
        """スナップショットファイルパスを取得"""
        project_dir = self.storage_path / project_id / "snapshots"
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir / f"{snapshot_id}.snap"
        
    async def _save_version_data(self, file_path: Path, result: DataTransformationResult):
        """バージョンデータを保存"""
        data = {
            "factory": result.factory.dict(),
            "resource_manager_data": {
                "resources": [r.get_state() for r in result.resource_manager.resources.values()],
                "allocation_history": result.resource_manager.allocation_history
            },
            "validation_errors": result.validation_errors,
            "warnings": result.warnings,
            "statistics": result.statistics
        }
        
        # 圧縮して保存
        compressed_data = gzip.compress(pickle.dumps(data))
        
        with open(file_path, 'wb') as f:
            f.write(compressed_data)
            
    async def _load_version_data(self, file_path: Path) -> DataTransformationResult:
        """バージョンデータを読み込み"""
        with open(file_path, 'rb') as f:
            compressed_data = f.read()
            
        data = pickle.loads(gzip.decompress(compressed_data))
        
        # Factoryオブジェクトを再構築
        factory = Factory(**data["factory"])
        
        # ResourceManagerを再構築
        resource_manager = ResourceManager()
        # TODO: リソースの再構築実装
        
        return DataTransformationResult(
            factory=factory,
            resource_manager=resource_manager,
            validation_errors=data["validation_errors"],
            warnings=data["warnings"],
            statistics=data["statistics"]
        )
        
    async def _save_snapshot_data(self, file_path: Path, snapshot: ProjectSnapshot):
        """スナップショットデータを保存"""
        with open(file_path, 'wb') as f:
            f.write(gzip.compress(pickle.dumps(snapshot.dict())))
            
    async def _load_snapshot_data(self, file_path: Path) -> ProjectSnapshot:
        """スナップショットデータを読み込み"""
        with open(file_path, 'rb') as f:
            data = pickle.loads(gzip.decompress(f.read()))
        return ProjectSnapshot(**data)
        
    async def _get_latest_version(self, project_id: str) -> Optional[ProjectVersion]:
        """最新バージョンを取得"""
        versions = self.versions.get(project_id, [])
        if not versions:
            return None
        return max(versions, key=lambda v: v.created_at)
        
    async def _get_latest_version_id(self, project_id: str) -> Optional[str]:
        """最新バージョンIDを取得"""
        version = await self._get_latest_version(project_id)
        return version.version_id if version else None
        
    async def _get_version(self, project_id: str, version_id: str) -> Optional[ProjectVersion]:
        """指定バージョンを取得"""
        versions = self.versions.get(project_id, [])
        for version in versions:
            if version.version_id == version_id:
                return version
        return None
        
    def _get_affected_objects(self, result: DataTransformationResult) -> List[str]:
        """影響を受けたオブジェクトを取得"""
        objects = []
        objects.extend(list(result.factory.processes.keys()))
        objects.extend(list(result.factory.products.keys()))
        objects.extend(list(result.factory.connections.keys()))
        return objects
        
    def _is_cache_expired(self, cache_key: str) -> bool:
        """キャッシュが期限切れかチェック"""
        if cache_key not in self.cache_expiry:
            return True
        return datetime.now() > self.cache_expiry[cache_key]
        
    def _clear_project_cache(self, project_id: str):
        """プロジェクトのキャッシュをクリア"""
        keys_to_remove = [
            key for key in self.cache.keys() 
            if key.startswith(f"{project_id}:")
        ]
        for key in keys_to_remove:
            del self.cache[key]
            del self.cache_expiry[key]
            
    async def _cleanup_old_versions(self, project_id: str):
        """古いバージョンをクリーンアップ"""
        versions = self.versions.get(project_id, [])
        if len(versions) <= self.max_versions_per_project:
            return
            
        # 古いバージョンを削除
        versions_sorted = sorted(versions, key=lambda v: v.created_at, reverse=True)
        versions_to_keep = versions_sorted[:self.max_versions_per_project]
        versions_to_remove = versions_sorted[self.max_versions_per_project:]
        
        for version in versions_to_remove:
            file_path = Path(version.file_path)
            if file_path.exists():
                file_path.unlink()
                
        self.versions[project_id] = versions_to_keep
        
    async def _save_metadata(self):
        """メタデータを保存"""
        metadata = {
            "versions": {pid: [v.dict() for v in versions] for pid, versions in self.versions.items()},
            "changes": {pid: [c.dict() for c in changes] for pid, changes in self.changes.items()},
            "snapshots": {pid: [s.dict() for s in snapshots] for pid, snapshots in self.snapshots.items()}
        }
        
        metadata_path = self.storage_path / "metadata.json"
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, default=str, ensure_ascii=False)
            
    async def _load_metadata(self):
        """メタデータを読み込み"""
        metadata_path = self.storage_path / "metadata.json"
        if not metadata_path.exists():
            return
            
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                
            # バージョン情報を復元
            for pid, versions_data in metadata.get("versions", {}).items():
                self.versions[pid] = [ProjectVersion(**v) for v in versions_data]
                
            # 変更履歴を復元
            for pid, changes_data in metadata.get("changes", {}).items():
                self.changes[pid] = [ChangeRecord(**c) for c in changes_data]
                
            # スナップショット情報を復元
            for pid, snapshots_data in metadata.get("snapshots", {}).items():
                self.snapshots[pid] = [ProjectSnapshot(**s) for s in snapshots_data]
                
        except Exception as e:
            print(f"メタデータ読み込みエラー: {e}")
            
    async def _start_auto_backup(self):
        """自動バックアップを開始"""
        async def backup_loop():
            while True:
                try:
                    await asyncio.sleep(self.auto_backup_interval.total_seconds())
                    await self._save_metadata()
                except Exception as e:
                    print(f"自動バックアップエラー: {e}")
                    
        asyncio.create_task(backup_loop())
        
    def _compare_processes(self, factory1: Factory, factory2: Factory) -> Dict[str, Any]:
        """工程の差分を比較"""
        # TODO: 詳細な比較ロジック実装
        return {
            "added": list(set(factory2.processes.keys()) - set(factory1.processes.keys())),
            "removed": list(set(factory1.processes.keys()) - set(factory2.processes.keys())),
            "modified": []  # TODO: 変更検出ロジック
        }
        
    def _compare_products(self, factory1: Factory, factory2: Factory) -> Dict[str, Any]:
        """製品の差分を比較"""
        return {
            "added": list(set(factory2.products.keys()) - set(factory1.products.keys())),
            "removed": list(set(factory1.products.keys()) - set(factory2.products.keys())),
            "modified": []
        }
        
    def _compare_connections(self, factory1: Factory, factory2: Factory) -> Dict[str, Any]:
        """接続の差分を比較"""
        return {
            "added": list(set(factory2.connections.keys()) - set(factory1.connections.keys())),
            "removed": list(set(factory1.connections.keys()) - set(factory2.connections.keys())),
            "modified": []
        }
        
    def _compare_statistics(self, stats1: Dict[str, Any], stats2: Dict[str, Any]) -> Dict[str, Any]:
        """統計の差分を比較"""
        differences = {}
        all_keys = set(stats1.keys()) | set(stats2.keys())
        
        for key in all_keys:
            val1 = stats1.get(key)
            val2 = stats2.get(key)
            
            if val1 != val2:
                differences[key] = {
                    "from": val1,
                    "to": val2
                }
                
        return differences
