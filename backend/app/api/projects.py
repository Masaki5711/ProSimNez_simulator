from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
import json
import uuid

from ..database import get_db
from ..models.project import Project, ProjectMember, ProjectNetworkData, ProjectHistory
from ..schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, 
    ProjectNetworkDataUpdate, ProjectMemberCreate
)

router = APIRouter()

# WebSocket接続管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.user_sessions: Dict[str, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, project_id: str, user_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)
        
        # ユーザーセッション情報を保存
        session_id = str(uuid.uuid4())
        self.user_sessions[session_id] = {
            "websocket": websocket,
            "project_id": project_id,
            "user_id": user_id,
            "connected_at": datetime.utcnow()
        }
        
        # 他のユーザーに接続通知
        await self.broadcast_to_project(
            project_id,
            {
                "type": "user_connected",
                "user_id": user_id,
                "session_id": session_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            exclude_websocket=websocket
        )
        
        return session_id

    def disconnect(self, websocket: WebSocket, project_id: str, user_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        
        # セッション情報を削除
        session_id = None
        for sid, session in self.user_sessions.items():
            if session["websocket"] == websocket:
                session_id = sid
                break
        
        if session_id:
            del self.user_sessions[session_id]

    async def broadcast_to_project(self, project_id: str, message: Dict[str, Any], exclude_websocket: WebSocket = None):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                if connection != exclude_websocket:
                    try:
                        await connection.send_text(json.dumps(message))
                    except:
                        # 接続が切れている場合は削除
                        self.active_connections[project_id].remove(connection)

manager = ConnectionManager()

# プロジェクト一覧取得
@router.get("/", response_model=List[ProjectResponse])
def get_projects(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Project)
    
    if category:
        query = query.filter(Project.category == category)
    if status:
        query = query.filter(Project.status == status)
    if search:
        query = query.filter(
            (Project.name.contains(search)) | 
            (Project.description.contains(search))
        )
    
    projects = query.offset(skip).limit(limit).all()
    return projects

# プロジェクト作成
@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(
        name=project.name,
        description=project.description,
        category=project.category,
        tags=project.tags or [],
        created_by=project.created_by,
        settings=project.settings or {}
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    # 作成履歴を記録
    history = ProjectHistory(
        project_id=db_project.id,
        user_id=project.created_by,
        action="create",
        description=f"プロジェクト '{project.name}' を作成しました"
    )
    db.add(history)
    db.commit()
    
    return db_project

# プロジェクト詳細取得
@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

# プロジェクト更新
@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: str, 
    project_update: ProjectUpdate, 
    db: Session = Depends(get_db)
):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 更新フィールドを設定
    for field, value in project_update.dict(exclude_unset=True).items():
        setattr(db_project, field, value)
    
    db_project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_project)
    
    # 更新履歴を記録
    history = ProjectHistory(
        project_id=project_id,
        user_id=project_update.updated_by,
        action="update",
        description=f"プロジェクト '{db_project.name}' を更新しました"
    )
    db.add(history)
    db.commit()
    
    return db_project

# プロジェクト削除
@router.delete("/{project_id}")
def delete_project(project_id: str, user_id: str, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 削除履歴を記録
    history = ProjectHistory(
        project_id=project_id,
        user_id=user_id,
        action="delete",
        description=f"プロジェクト '{db_project.name}' を削除しました"
    )
    db.add(history)
    
    db.delete(db_project)
    db.commit()
    
    return {"message": "Project deleted successfully"}

# プロジェクトネットワークデータ取得
@router.get("/{project_id}/network")
def get_project_network(project_id: str, db: Session = Depends(get_db)):
    network_data = db.query(ProjectNetworkData).filter(
        ProjectNetworkData.project_id == project_id
    ).first()
    
    if not network_data:
        # 初期データを作成
        network_data = ProjectNetworkData(
            project_id=project_id,
            nodes=[],
            edges=[],
            products=[],
            bom_items=[],
            variants=[],
            process_advanced_data={}
        )
        db.add(network_data)
        db.commit()
        db.refresh(network_data)
    
    return {
        "nodes": network_data.nodes,
        "edges": network_data.edges,
        "products": network_data.products,
        "bom_items": network_data.bom_items,
        "variants": network_data.variants,
        "process_advanced_data": network_data.process_advanced_data,
        "last_modified_by": network_data.last_modified_by,
        "updated_at": network_data.updated_at
    }

# プロジェクトネットワークデータ更新
@router.put("/{project_id}/network")
def update_project_network(
    project_id: str,
    network_update: ProjectNetworkDataUpdate,
    db: Session = Depends(get_db)
):
    network_data = db.query(ProjectNetworkData).filter(
        ProjectNetworkData.project_id == project_id
    ).first()
    
    if not network_data:
        network_data = ProjectNetworkData(project_id=project_id)
        db.add(network_data)
    
    # 更新フィールドを設定
    for field, value in network_update.dict(exclude_unset=True).items():
        setattr(network_data, field, value)
    
    network_data.updated_at = datetime.utcnow()
    network_data.last_modified_by = network_update.modified_by
    db.commit()
    db.refresh(network_data)
    
    return {
        "message": "Network data updated successfully",
        "updated_at": network_data.updated_at
    }

# プロジェクトメンバー一覧取得
@router.get("/{project_id}/members")
def get_project_members(project_id: str, db: Session = Depends(get_db)):
    members = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id
    ).all()
    return members

# プロジェクトメンバー追加
@router.post("/{project_id}/members")
def add_project_member(
    project_id: str,
    member: ProjectMemberCreate,
    db: Session = Depends(get_db)
):
    # 既存メンバーをチェック
    existing_member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == member.user_id
    ).first()
    
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    db_member = ProjectMember(
        project_id=project_id,
        user_id=member.user_id,
        role=member.role,
        permissions=member.permissions or []
    )
    
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    
    return db_member

# WebSocket接続
@router.websocket("/{project_id}/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str, user_id: str):
    session_id = await manager.connect(websocket, project_id, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # メッセージタイプに応じて処理
            if message["type"] == "network_update":
                # ネットワークデータ更新を他のユーザーに通知
                await manager.broadcast_to_project(
                    project_id,
                    {
                        "type": "network_update",
                        "user_id": user_id,
                        "data": message["data"],
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    exclude_websocket=websocket
                )
            
            elif message["type"] == "user_activity":
                # ユーザーアクティビティを通知
                await manager.broadcast_to_project(
                    project_id,
                    {
                        "type": "user_activity",
                        "user_id": user_id,
                        "activity": message["activity"],
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    exclude_websocket=websocket
                )
            
            elif message["type"] == "cursor_position":
                # カーソル位置を通知
                await manager.broadcast_to_project(
                    project_id,
                    {
                        "type": "cursor_position",
                        "user_id": user_id,
                        "position": message["position"],
                        "timestamp": datetime.utcnow().isoformat()
                    },
                    exclude_websocket=websocket
                )
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id, user_id)
        
        # 切断通知を他のユーザーに送信
        await manager.broadcast_to_project(
            project_id,
            {
                "type": "user_disconnected",
                "user_id": user_id,
                "timestamp": datetime.utcnow().isoformat()
            }
        ) 