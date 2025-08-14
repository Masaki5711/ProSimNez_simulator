"""
データベース接続とセッション管理
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator
import os
from dotenv import load_dotenv

# 環境変数を読み込み
load_dotenv()

# データベースURL（デフォルトはSQLite、PostgreSQL用の環境変数も設定可能）
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

# SQLiteの場合のエンジン設定
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}  # SQLiteでのスレッド制限を無効化
    )
else:
    # PostgreSQLなど他のDBの場合
    engine = create_engine(DATABASE_URL)

# セッションファクトリ
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ベースクラス
Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """
    データベースセッションを取得する依存関数
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """
    全テーブルを作成
    """
    # モデルをインポートして登録
    from .models.project import Project, ProjectMember, ProjectNetworkData, ProjectHistory
    
    Base.metadata.create_all(bind=engine)

def drop_tables():
    """
    全テーブルを削除（開発時のみ使用）
    """
    Base.metadata.drop_all(bind=engine)
