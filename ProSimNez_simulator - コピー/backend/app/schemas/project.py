from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "manufacturing"
    tags: Optional[List[str]] = []
    settings: Optional[Dict[str, Any]] = {}

class ProjectCreate(ProjectBase):
    created_by: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    updated_by: str

class ProjectResponse(ProjectBase):
    id: str
    status: str
    version: str
    thumbnail: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    settings: Dict[str, Any] = {}

    class Config:
        from_attributes = True

class ProjectNetworkDataUpdate(BaseModel):
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    products: Optional[List[Dict[str, Any]]] = None
    bom_items: Optional[List[Dict[str, Any]]] = None
    variants: Optional[List[Dict[str, Any]]] = None
    process_advanced_data: Optional[Dict[str, Any]] = None
    modified_by: str

class ProjectMemberCreate(BaseModel):
    user_id: str
    role: str = "viewer"
    permissions: Optional[List[str]] = []

class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: str
    joined_at: datetime
    permissions: List[str] = []

    class Config:
        from_attributes = True

class ProjectSessionUpdate(BaseModel):
    current_node: Optional[str] = None
    current_tab: Optional[str] = None
    cursor_position: Optional[Dict[str, Any]] = None

class ProjectHistoryResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    action: str
    description: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        from_attributes = True 