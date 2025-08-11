# 混流生産ライン離散シミュレーター

複雑な前後工程関係を持つ混流生産システムをシミュレートし、在庫量の時間変化を可視化するWebアプリケーションです。

## 📋 目次

- [概要](#概要)
- [システムアーキテクチャ](#システムアーキテクチャ)
- [機能仕様](#機能仕様)
- [技術仕様](#技術仕様)
- [通信仕様](#通信仕様)
- [データベース構造](#データベース構造)
- [シミュレーション仕様](#シミュレーション仕様)
- [セットアップ](#セットアップ)
- [使用方法](#使用方法)
- [開発ガイド](#開発ガイド)

## 🎯 概要

本システムは、製造業における混流生産ラインの離散イベントシミュレーションを実行し、リアルタイムで生産状況を可視化するWebアプリケーションです。複数の製品を同時に生産する複雑な生産ネットワークにおいて、在庫量の時間変化、設備稼働率、生産効率などのKPIを動的に監視・分析できます。

### 主要な特徴

- **工程ネットワークのビジュアル編集**: ドラッグ&ドロップによる直感的な生産ライン設計
- **リアルタイムシミュレーション**: SimPyベースの離散イベントシミュレーション
- **在庫量・稼働率のリアルタイム可視化**: チャート・グラフによる動的なデータ表示
- **複数設備の並列処理**: 複数設備による同時処理のシミュレーション
- **可変ロットサイズ対応**: 製品別の最適ロットサイズ設定
- **リアルタイム協調編集**: 複数ユーザーによる同時編集とWebSocket通信
- **プロジェクト管理**: 複数プロジェクトの管理と履歴追跡

## 🏗️ システムアーキテクチャ

### 全体構成

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   フロントエンド   │◄──►│    バックエンド    │◄──►│   データベース    │
│   (React/TS)    │    │   (FastAPI)     │    │  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └─────────────►│   WebSocket     │◄─────────────┘
                        │   (リアルタイム)   │
                        └─────────────────┘
```

### レイヤー構成

1. **プレゼンテーション層**: React + TypeScript + Material-UI
2. **ビジネスロジック層**: FastAPI + Python
3. **シミュレーション層**: SimPy + カスタムエンジン
4. **データアクセス層**: SQLAlchemy + PostgreSQL
5. **リアルタイム通信層**: WebSocket + Socket.IO

## ⚙️ 機能仕様

### 1. 工程ネットワーク管理

#### 1.1 ネットワークエディタ
- **ノード管理**: 工程、バッファ、接続点の作成・編集・削除
- **エッジ管理**: 工程間の接続関係の定義
- **レイアウト**: 自動レイアウトと手動調整の両対応
- **検証**: ネットワークの整合性チェック

#### 1.2 工程定義
- **工程タイプ**: 加工、組立、検査、保管、出荷、キッティング
- **設備管理**: 複数設備の並列処理対応
- **処理時間**: 製品別の標準処理時間設定
- **段取り替え**: 製品変更時の段取り替え時間

#### 1.3 バッファ管理
- **在庫管理**: 製品別・ロット別の在庫追跡
- **容量制限**: バッファ容量の設定と制御
- **FIFO/LIFO**: 出庫方式の選択
- **在庫アラート**: 在庫不足・過多の警告

### 2. シミュレーション機能

#### 2.1 シミュレーション制御
- **開始/停止**: シミュレーションの実行制御
- **一時停止/再開**: 実行中の一時停止と再開
- **速度制御**: 0.1倍〜100倍の速度調整
- **ステップ実行**: 1ステップずつの実行

#### 2.2 シミュレーション設定
- **開始時刻**: シミュレーション開始時刻の設定
- **実行時間**: シミュレーション実行時間の指定
- **初期在庫**: 各バッファの初期在庫設定
- **生産計画**: 製品別の生産量計画

#### 2.3 リアルタイム監視
- **在庫変化**: 各バッファの在庫量の時間変化
- **設備状態**: 各設備の稼働・停止・故障状態
- **生産進捗**: 製品別の生産完了数
- **KPI表示**: 稼働率、在庫回転率、リードタイム

### 3. プロジェクト管理

#### 3.1 プロジェクト作成・編集
- **基本情報**: プロジェクト名、説明、カテゴリ
- **メンバー管理**: ユーザーの追加・削除・権限設定
- **バージョン管理**: プロジェクトの履歴追跡
- **テンプレート**: 既存プロジェクトのテンプレート化

#### 3.2 協調編集
- **リアルタイム同期**: 複数ユーザーによる同時編集
- **ユーザー位置**: 他のユーザーのカーソル位置表示
- **編集履歴**: 変更内容の履歴管理
- **競合解決**: 編集競合の自動解決

### 4. 分析・レポート機能

#### 4.1 リアルタイム分析
- **在庫分析**: 在庫量の統計分析
- **設備分析**: 設備稼働率の分析
- **生産分析**: 生産効率の分析
- **ボトルネック分析**: 生産ラインのボトルネック特定

#### 4.2 レポート生成
- **日次レポート**: 日次の生産実績レポート
- **週次レポート**: 週次の生産効率レポート
- **月次レポート**: 月次のKPIサマリーレポート
- **カスタムレポート**: ユーザー定義のレポート

## 🛠️ 技術仕様

### フロントエンド技術スタック

#### コア技術
- **React 18.2.0**: ユーザーインターフェース構築
- **TypeScript 4.9.5**: 型安全な開発
- **Material-UI 5.14.19**: モダンなUIコンポーネント

#### 状態管理
- **Redux Toolkit 1.9.7**: アプリケーション状態管理
- **React Redux 8.1.3**: ReactとReduxの連携

#### 可視化・グラフ
- **Chart.js 4.4.1**: 基本的なチャート表示
- **React Chart.js 2 5.2.0**: React用Chart.jsラッパー
- **D3.js 7.8.5**: 高度なデータ可視化
- **Konva 9.3.0**: 2Dキャンバス描画

#### ネットワーク編集
- **React XYFlow 12.8.2**: フローチャート・ネットワーク図編集
- **React Konva 18.2.10**: キャンバスベースの描画

#### 通信・ルーティング
- **Axios 1.6.2**: HTTP通信
- **Socket.IO Client 4.7.2**: WebSocket通信
- **React Router DOM 6.20.1**: ページルーティング

#### 開発ツール
- **ESLint 8.38.0**: コード品質チェック
- **Prettier 2.8.8**: コードフォーマット
- **TypeScript ESLint**: TypeScript用ESLint

### バックエンド技術スタック

#### コア技術
- **Python 3.8+**: メイン開発言語
- **FastAPI 0.104.1**: 高速Webフレームワーク
- **Uvicorn 0.24.0**: ASGIサーバー

#### シミュレーション
- **SimPy 4.0.2**: 離散イベントシミュレーション
- **Pandas 2.1.3**: データ処理・分析
- **NumPy 1.26.2**: 数値計算

#### データベース
- **SQLAlchemy 2.0.23**: ORM
- **Alembic 1.12.1**: データベースマイグレーション
- **PostgreSQL**: メインデータベース
- **Redis 5.0.1**: キャッシュ・セッション管理

#### 非同期処理
- **Celery 5.3.4**: バックグラウンドタスク
- **WebSockets 12.0**: リアルタイム通信

#### セキュリティ
- **Python-Jose 3.3.0**: JWT認証
- **Passlib 1.7.4**: パスワードハッシュ
- **Bcrypt**: パスワード暗号化

#### 設定・テスト
- **Pydantic 2.5.0**: データバリデーション
- **Pydantic-Settings 2.1.0**: 設定管理
- **Pytest 7.4.3**: テストフレームワーク
- **Pytest-Asyncio 0.21.1**: 非同期テスト

## 📡 通信仕様

### HTTP API仕様

#### 認証API
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

#### プロジェクト管理API
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
PUT    /api/projects/{project_id}
DELETE /api/projects/{project_id}
GET    /api/projects/{project_id}/members
POST   /api/projects/{project_id}/members
```

#### ネットワーク管理API
```
GET    /api/network/sample
POST   /api/network/save
GET    /api/network/load
POST   /api/network/validate
GET    /api/network/templates
GET    /api/network/demo/automotive
```

#### シミュレーション制御API
```
POST   /api/simulation/start
POST   /api/simulation/pause
POST   /api/simulation/resume
POST   /api/simulation/stop
GET    /api/simulation/status
POST   /api/simulation/speed
GET    /api/simulation/data
```

#### ユーザー管理API
```
GET    /api/users
POST   /api/users
GET    /api/users/{user_id}
PUT    /api/users/{user_id}
DELETE /api/users/{user_id}
```

### WebSocket通信仕様

#### シミュレーションWebSocket
```
エンドポイント: /ws/simulation
プロトコル: WebSocket
認証: JWTトークン（ヘッダー）
```

#### メッセージ形式

**クライアント→サーバー**
```json
{
  "type": "control",
  "action": "start|pause|resume|stop|step"
}
```

**サーバー→クライアント**
```json
{
  "type": "control_response",
  "action": "start|pause|resume|stop|step",
  "status": "success|error|use_api"
}
```

#### プロジェクト協調編集WebSocket
```
エンドポイント: /api/projects/{project_id}/ws/{user_id}
プロトコル: WebSocket
認証: JWTトークン（クエリパラメータ）
```

#### メッセージ形式

**ネットワーク更新通知**
```json
{
  "type": "network_update",
  "user_id": "user123",
  "data": { /* ネットワークデータ */ },
  "timestamp": "2024-01-01T08:00:00Z"
}
```

**ユーザーアクティビティ通知**
```json
{
  "type": "user_activity",
  "user_id": "user123",
  "activity": "editing_node",
  "timestamp": "2024-01-01T08:00:00Z"
}
```

**カーソル位置通知**
```json
{
  "type": "cursor_position",
  "user_id": "user123",
  "position": {"x": 100, "y": 200},
  "timestamp": "2024-01-01T08:00:00Z"
}
```

### リアルタイム通信の特徴

- **双方向通信**: クライアント・サーバー間の双方向リアルタイム通信
- **自動再接続**: 接続断時の自動再接続機能
- **ハートビート**: 接続状態の監視と維持
- **スケーラビリティ**: 複数プロジェクト・複数ユーザーの同時接続対応

## 🗄️ データベース構造

### データベース概要

- **データベース**: PostgreSQL 15
- **ORM**: SQLAlchemy 2.0
- **マイグレーション**: Alembic
- **接続プール**: SQLAlchemy接続プール

### テーブル構造

#### 1. projects（プロジェクト）
```sql
CREATE TABLE projects (
    id VARCHAR PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'manufacturing',
    status VARCHAR(20) DEFAULT 'active',
    version VARCHAR(20) DEFAULT '1.0.0',
    tags JSONB DEFAULT '[]',
    thumbnail VARCHAR(500),
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings JSONB DEFAULT '{}'
);
```

#### 2. project_members（プロジェクトメンバー）
```sql
CREATE TABLE project_members (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR REFERENCES projects(id),
    user_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    permissions JSONB DEFAULT '[]'
);
```

#### 3. project_network_data（プロジェクトネットワークデータ）
```sql
CREATE TABLE project_network_data (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR REFERENCES projects(id) UNIQUE,
    nodes JSONB DEFAULT '[]',
    edges JSONB DEFAULT '[]',
    products JSONB DEFAULT '[]',
    bom_items JSONB DEFAULT '[]',
    variants JSONB DEFAULT '[]',
    process_advanced_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified_by VARCHAR(100)
);
```

#### 4. project_history（プロジェクト履歴）
```sql
CREATE TABLE project_history (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR REFERENCES projects(id),
    user_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 5. project_sessions（プロジェクトセッション）
```sql
CREATE TABLE project_sessions (
    id VARCHAR PRIMARY KEY,
    project_id VARCHAR REFERENCES projects(id),
    user_id VARCHAR(100) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    current_node VARCHAR(100),
    current_tab VARCHAR(50),
    cursor_position JSONB
);
```

#### 6. users（ユーザー）
```sql
CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### データモデル

#### プロジェクトモデル
```python
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
```

#### ネットワークデータモデル
```python
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
```

### データベース設計の特徴

- **JSONB型の活用**: 柔軟なスキーマ変更に対応
- **リレーション管理**: 適切な外部キー制約とカスケード削除
- **履歴追跡**: 全ての変更の履歴を保持
- **セッション管理**: リアルタイム協調編集のためのセッション情報
- **スケーラビリティ**: 大量のプロジェクトとユーザーに対応

## 🎮 シミュレーション仕様

### シミュレーションエンジン

#### 基本仕様
- **エンジン**: SimPy 4.0.2ベースのカスタムエンジン
- **タイプ**: 離散イベントシミュレーション
- **時間単位**: 秒（内部）、分・時間（表示）
- **速度制御**: 0.1倍〜100倍の速度調整

#### シミュレーションクラス
```python
class SimulationEngine:
    def __init__(self, factory: Factory, start_time: datetime, speed: float = 1.0):
        self.factory = factory
        self.env = simpy.Environment()
        self.start_time = start_time
        self.current_time = start_time
        self.speed = speed
        self.is_running = False
        self.is_paused = False
        
        # イベントリスナー
        self.event_listeners: List[Callable] = []
        
        # データ収集用
        self.inventory_history = []
        self.equipment_history = []
        self.event_log = []
```

#### シミュレーション制御
- **開始**: `start(duration: Optional[float] = None)`
- **停止**: `stop()`
- **一時停止**: `pause()`
- **再開**: `resume()`
- **速度設定**: `set_speed(speed: float)`

### シミュレーションモデル

#### 工場モデル
```python
class Factory(BaseModel):
    id: str
    name: str
    description: str = ""
    
    # 構成要素
    products: Dict[str, Product] = {}
    processes: Dict[str, Process] = {}
    buffers: Dict[str, Buffer] = {}
    connections: Dict[str, Connection] = {}
    
    # メタデータ
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()
```

#### 工程モデル
```python
class Process(BaseModel):
    id: str
    name: str
    type: str  # "machining", "assembly", "inspection", etc.
    equipments: Dict[str, Equipment] = {}
    inputs: List[ProcessInput] = []
    outputs: List[ProcessOutput] = []
    processing_time: Dict[str, float] = {}  # 製品ID別の処理時間
    
    # バッファ
    input_buffer_id: Optional[str] = None
    output_buffer_id: Optional[str] = None
```

#### 設備モデル
```python
class Equipment(BaseModel):
    id: str
    name: str
    process_id: str  # 所属工程ID
    capacity: int = 1  # 同時処理可能数
    setup_time: float = 0.0  # 段取り替え時間（秒）
    status: str = "idle"  # "idle", "running", "setup", "breakdown"
    current_product_id: Optional[str] = None
    current_lot_id: Optional[str] = None
```

#### バッファモデル
```python
class Buffer(BaseModel):
    id: str
    name: str
    capacity: Optional[int] = None  # None = 無制限
    location_type: str  # "process_input", "process_output", "intermediate"
    
    # 在庫データ（メモリ内管理）
    inventory: Dict[str, List[Dict]] = {}  # product_id -> List of lots
    transactions: List[BufferTransaction] = []
```

### シミュレーションイベント

#### イベントタイプ
- **process_start**: 工程開始
- **process_complete**: 工程完了
- **lot_arrival**: ロット到着
- **state_update**: 状態更新
- **equipment_status**: 設備状態変更
- **inventory_change**: 在庫変化

#### イベントモデル
```python
class SimulationEvent(BaseModel):
    timestamp: datetime
    event_type: str
    process_id: Optional[str] = None
    equipment_id: Optional[str] = None
    product_id: Optional[str] = None
    lot_id: Optional[str] = None
    data: Dict[str, Any] = {}
```

### シミュレーション実行フロー

1. **初期化**: 工場モデルの読み込みとシミュレーション環境の設定
2. **プロセス開始**: 各工程のプロセスを開始
3. **イベントループ**: シミュレーション時間の進行とイベント処理
4. **状態更新**: 定期的な状態更新とWebSocket配信
5. **データ収集**: 在庫、設備状態、KPIの収集

### KPI計算

#### 主要KPI
- **総生産数**: 完成品バッファの在庫総数
- **平均リードタイム**: 製品の平均製造時間
- **設備稼働率**: 稼働中の設備の割合
- **在庫回転率**: 時間あたりの生産数

#### KPI計算ロジック
```python
def calculate_kpis(self) -> Dict:
    total_production = 0
    total_inventory = 0
    running_equipment = 0
    total_equipment = 0
    
    # 生産数を計算（完成品バッファの在庫）
    for buffer_id, buffer in self.factory.buffers.items():
        if "FINAL" in buffer_id:
            total_production += buffer.get_total_quantity()
        total_inventory += buffer.get_total_quantity()
    
    # 設備稼働率を計算
    for process in self.factory.processes.values():
        for equipment in process.equipments.values():
            total_equipment += 1
            if equipment.status == "running":
                running_equipment += 1
    
    equipment_utilization = (running_equipment / total_equipment * 100) if total_equipment > 0 else 0
    
    # 簡易的な在庫回転率（実行時間に基づく）
    runtime_hours = self.env.now / 3600 if self.env.now > 0 else 0.01
    inventory_turnover = total_production / runtime_hours if runtime_hours > 0 else 0
    
    # 平均リードタイム（簡易計算）
    average_lead_time = (self.env.now / 60) if total_production > 0 else 0  # 分単位
    
    return {
        "total_production": int(total_production),
        "average_lead_time": round(average_lead_time, 1),
        "equipment_utilization": round(equipment_utilization, 1),
        "inventory_turnover": round(inventory_turnover, 2)
    }
```

## 🚀 セットアップ

### 前提条件

- **Python 3.8+**: https://www.python.org/
- **Node.js 16+**: https://nodejs.org/
- **PostgreSQL 15+**: https://www.postgresql.org/
- **Git**: https://git-scm.com/

### 環境チェック

```cmd
check_env.bat
```

### 初回セットアップ

```cmd
setup_env.bat
```

### 開発環境起動

```cmd
start_dev.bat
```

### サーバー停止

```cmd
stop_dev.bat
```

### 手動セットアップ

#### バックエンド

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### フロントエンド

```bash
cd frontend
npm install
npm start
```

#### データベース

```bash
# PostgreSQLの起動
docker-compose up postgres -d

# データベースの初期化
cd backend
alembic upgrade head
```

### 環境変数設定

#### バックエンド環境変数
```env
DATABASE_URL=postgresql+psycopg2://simulator:simulator@localhost:5432/plant_simulator
JWT_SECRET=your_jwt_secret_key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
REDIS_URL=redis://localhost:6379
```

#### フロントエンド環境変数
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

## 📖 使用方法

### 1. アプリケーション起動

1. **環境チェック**: `check_env.bat`で環境を確認
2. **セットアップ**: `setup_env.bat`で初回セットアップ
3. **起動**: `start_dev.bat`で開発サーバー起動
4. **アクセス**: ブラウザで`http://localhost:3000`にアクセス

### 2. プロジェクト作成

1. **ログイン**: 管理者アカウントでログイン
2. **プロジェクト作成**: 新規プロジェクトを作成
3. **基本設定**: プロジェクト名、説明、カテゴリを設定

### 3. ネットワーク設計

1. **ネットワークエディタ**: プロジェクトのネットワークエディタを開く
2. **工程追加**: ドラッグ&ドロップで工程を追加
3. **接続設定**: 工程間の接続関係を定義
4. **パラメータ設定**: 各工程の処理時間、設備数を設定

### 4. シミュレーション実行

1. **シミュレーション設定**: 開始時刻、実行時間、速度を設定
2. **実行開始**: シミュレーションを開始
3. **リアルタイム監視**: ダッシュボードで状況を監視
4. **結果分析**: チャート・グラフで結果を分析

### 5. 協調編集

1. **メンバー招待**: プロジェクトにメンバーを招待
2. **権限設定**: 各メンバーの編集権限を設定
3. **同時編集**: 複数ユーザーで同時にネットワークを編集
4. **変更追跡**: 変更履歴で変更内容を確認

## 🛠️ 開発ガイド

### 開発環境の構築

#### 1. リポジトリのクローン
```bash
git clone <repository_url>
cd Plant_simulator
```

#### 2. 依存関係のインストール
```bash
# バックエンド
cd backend
pip install -r requirements.txt

# フロントエンド
cd ../frontend
npm install
```

#### 3. データベースのセットアップ
```bash
# PostgreSQLコンテナの起動
docker-compose up postgres -d

# データベースの初期化
cd backend
alembic upgrade head
```

### 開発サーバーの起動

#### バックエンド（開発モード）
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### フロントエンド（開発モード）
```bash
cd frontend
npm start
```

### テストの実行

#### バックエンドテスト
```bash
cd backend
pytest
```

#### フロントエンドテスト
```bash
cd frontend
npm test
```

### コード品質チェック

#### バックエンド
```bash
cd backend
# コードフォーマット
black app/
# リンター
flake8 app/
```

#### フロントエンド
```bash
cd frontend
# リンター
npm run lint
# フォーマット
npm run format
```

### データベースマイグレーション

#### マイグレーションファイルの作成
```bash
cd backend
alembic revision --autogenerate -m "Description of changes"
```

#### マイグレーションの実行
```bash
alembic upgrade head
```

#### マイグレーションのロールバック
```bash
alembic downgrade -1
```

### デプロイメント

#### Docker Composeでの本番環境起動
```bash
docker-compose -f docker-compose.prod.yml up -d
```

#### 個別サービスの起動
```bash
# PostgreSQL
docker-compose up postgres -d

# バックエンド
docker-compose up backend -d

# フロントエンド
docker-compose up frontend -d
```

### ログの確認

#### アプリケーションログ
```bash
# バックエンドログ
docker-compose logs backend

# フロントエンドログ
docker-compose logs frontend
```

#### データベースログ
```bash
docker-compose logs postgres
```

## 🔧 トラブルシューティング

### よくある問題と解決方法

#### 1. 依存関係の問題
```bash
# 依存関係の再インストール
cd backend
pip uninstall -r requirements.txt -y
pip install -r requirements.txt
```

#### 2. データベース接続エラー
```bash
# PostgreSQLコンテナの再起動
docker-compose restart postgres

# 接続確認
docker-compose exec postgres psql -U simulator -d plant_simulator
```

#### 3. ポート競合
```bash
# 使用中のポートを確認
netstat -ano | findstr :8000
netstat -ano | findstr :3000

# プロセスの終了
taskkill /PID <process_id> /F
```

#### 4. メモリ不足
```bash
# Node.jsのメモリ制限を増加
set NODE_OPTIONS=--max-old-space-size=4096
npm start
```

## 📚 参考資料

### 技術ドキュメント
- [FastAPI公式ドキュメント](https://fastapi.tiangolo.com/)
- [React公式ドキュメント](https://reactjs.org/docs/)
- [SimPy公式ドキュメント](https://simpy.readthedocs.io/)
- [SQLAlchemy公式ドキュメント](https://docs.sqlalchemy.org/)

### 関連プロジェクト
- [Plant Simulator GitHub](https://github.com/your-username/plant-simulator)
- [API仕様書](http://localhost:8000/docs)
- [ReDoc](http://localhost:8000/redoc)

### サポート・フィードバック
- **Issues**: GitHubのIssuesページ
- **Discussions**: GitHubのDiscussionsページ
- **Wiki**: プロジェクトWikiページ

---

**混流生産ライン離散シミュレーター** - 製造業のデジタルツインを実現する次世代シミュレーションシステム