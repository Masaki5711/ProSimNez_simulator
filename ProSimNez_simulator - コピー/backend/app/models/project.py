from sqlalchemy import Column, String, DateTime, Text, JSON, Integer, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(50), default='manufacturing')
    status = Column(String(20), default='active')
    version = Column(String(20), default='1.0.0')
    tags = Column(JSON, default=list)
    thumbnail = Column(String(500))
    
    # 作成・更新情報
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # プロジェクト設定
    settings = Column(JSON, default=dict)
    
    # リレーション
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    network_data = relationship("ProjectNetworkData", back_populates="project", uselist=False, cascade="all, delete-orphan")
    history = relationship("ProjectHistory", back_populates="project", cascade="all, delete-orphan")

class ProjectMember(Base):
    __tablename__ = "project_members"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String(100), nullable=False)
    role = Column(String(20), default='viewer')  # owner, admin, editor, viewer
    joined_at = Column(DateTime, default=datetime.utcnow)
    permissions = Column(JSON, default=list)
    
    # リレーション
    project = relationship("Project", back_populates="members")

class ProjectNetworkData(Base):
    __tablename__ = "project_network_data"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False, unique=True)
    
    # ネットワークデータ
    nodes = Column(JSON, default=list)
    edges = Column(JSON, default=list)
    
    # プロジェクト固有のデータ
    products = Column(JSON, default=list)
    bom_items = Column(JSON, default=list)
    variants = Column(JSON, default=list)
    process_advanced_data = Column(JSON, default=dict)
    
    # メタデータ
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_modified_by = Column(String(100))
    
    # リレーション
    project = relationship("Project", back_populates="network_data")

class ProjectHistory(Base):
    __tablename__ = "project_history"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)  # create, update, delete, share, etc.
    description = Column(Text)
    details = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # リレーション
    project = relationship("Project", back_populates="history")

class ProjectSession(Base):
    __tablename__ = "project_sessions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    user_id = Column(String(100), nullable=False)
    session_id = Column(String(100), nullable=False)
    connected_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # ユーザーの現在の状態
    current_node = Column(String(100))  # 現在選択中のノード
    current_tab = Column(String(50))    # 現在のタブ
    cursor_position = Column(JSON)      # カーソル位置
    
    # リレーション
    project = relationship("Project") 