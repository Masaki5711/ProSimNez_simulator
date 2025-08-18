# ProSimNez 強化シミュレーションシステム

SIMULATION_IMPLEMENTATION_PLAN.mdの仕様に基づいて実装された、高度なシミュレーション基盤システムです。

## 🎯 実装された機能

### Phase 1: 基盤システムの構築 ✅

#### 1.1 シミュレーションエンジンの強化
- **非同期シミュレーション実行**: 強化されたSimPyベースエンジン
- **イベント管理システム**: 高度なイベント処理とリスナー機能
- **リソース管理システム**: 設備・作業者・搬送リソースの統合管理
- **統計収集システム**: リアルタイムKPI計算と分析

#### 1.2 フロントエンドデータとの完全統合
- **NetworkEditorデータ統合**: フロントエンドデータの完全変換
- **工程ネットワーク動的更新**: リアルタイム設定変更対応
- **設定変更即座反映**: WebSocket経由での即時更新

#### 1.3 リアルタイムデータ同期
- **WebSocket双方向通信**: 高速リアルタイム通信
- **Redisキャッシュ**: 高速データアクセスとキャッシュ
- **データストリーミング**: 継続的な状態配信

#### 1.4 データ永続化とバージョン管理
- **プロジェクトデータ永続化**: 圧縮保存とメタデータ管理
- **バージョン管理**: Major/Minor/Patchバージョニング
- **変更履歴追跡**: 詳細な変更ログとスナップショット

#### 1.5 ファクトチェックツール
- **ネットワーク整合性チェック**: 接続性・循環参照・材料フロー検証
- **BOM整合性チェック**: 部品表の構造・数量・依存関係チェック
- **設定値妥当性チェック**: パラメータ検証と推奨事項生成
- **リアルタイム監視**: 異常検知と予測アラート

## 🏗️ システム構成

```
backend/app/
├── core/                     # コアシステム
│   ├── enhanced_simulator.py  # 強化シミュレーションエンジン
│   ├── event_manager.py      # イベント管理システム
│   ├── resource_manager.py   # リソース管理システム
│   ├── data_integration.py   # データ統合エンジン
│   └── persistence_manager.py # 永続化・バージョン管理
├── websocket/               # リアルタイム通信
│   └── realtime_manager.py  # WebSocket + Redis管理
├── tools/                   # ツール
│   ├── fact_checker.py      # 基本ファクトチェック
│   └── enhanced_fact_checker.py # 強化ファクトチェック
└── api/                     # API
    ├── integration_api.py    # データ統合API
    ├── project_management_api.py # プロジェクト管理API
    ├── websocket_api.py      # WebSocket API
    └── fact_checker_api.py   # ファクトチェックAPI
```

## 🚀 使用方法

### 1. システム初期化

```python
# セットアップスクリプトの実行
python -m app.setup_new_system
```

### 2. APIエンドポイント

#### データ統合
```bash
# NetworkEditorデータを変換
POST /api/integration/transform

# 設定を動的更新
POST /api/integration/update-configuration

# シミュレーション開始
POST /api/integration/start-simulation
```

#### プロジェクト管理
```bash
# プロジェクト保存
POST /api/project-management/projects/save

# プロジェクト読み込み
GET /api/project-management/projects/{project_id}/load

# バージョン一覧
GET /api/project-management/projects/{project_id}/versions
```

#### ファクトチェック
```bash
# 包括的チェック
POST /api/fact-check/comprehensive

# ネットワーク整合性チェック
POST /api/fact-check/network-integrity

# リアルタイム監視開始
POST /api/fact-check/realtime-monitor/start
```

### 3. WebSocket接続

```javascript
// シミュレーション専用WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/simulation/{project_id}');

// メッセージ受信
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'realtime_update') {
    // リアルタイムデータ処理
  }
};
```

## 📊 主要機能詳細

### 1. 強化シミュレーションエンジン

```python
from app.core.enhanced_simulator import EnhancedSimulationEngine

# シミュレーターの作成
simulator = EnhancedSimulationEngine(
    factory=factory_instance,
    websocket_manager=websocket_manager,
    redis_client=redis_client
)

# 非同期シミュレーション実行
await simulator.start_simulation(duration=3600.0)
```

### 2. データ統合エンジン

```python
from app.core.data_integration import DataIntegrationEngine

# NetworkEditorデータを変換
integration_engine = DataIntegrationEngine()
result = await integration_engine.transform_network_data(
    network_data, 
    project_id
)
```

### 3. ファクトチェック

```python
from app.tools.enhanced_fact_checker import EnhancedFactChecker

# 包括的チェック実行
fact_checker = EnhancedFactChecker()
check_result = await fact_checker.comprehensive_check(transformation_result)
```

## 🔧 設定

### 環境変数

```bash
# Redis接続
REDIS_URL=redis://localhost:6379

# データベース
DATABASE_URL=sqlite:///./prosmnez.db

# WebSocket設定
WEBSOCKET_TIMEOUT=300
```

### requirements.txt追加分

```
aioredis==2.0.1
```

## 📈 パフォーマンス指標

### 技術的指標
- シミュレーション実行時間: < 1秒（小規模）、< 10秒（大規模）
- チェック実行時間: < 100ms（小規模）、< 1秒（大規模）
- データ同期遅延: < 100ms（WebSocket + Redis）
- リアルタイム更新頻度: > 10Hz

### 監視・分析指標
- 在庫・滞留ヒートマップ更新: > 5Hz
- 搬送リソース追跡精度: > 95%
- リードタイム分解精度: > 90%

## 🧪 テスト

```bash
# システム統合テスト
python -m app.setup_new_system

# ファクトチェックテスト
python -m app.tools.fact_checker --check-all --project-file sample_project.json

# APIテスト
pytest tests/
```

## 🔗 重要なクラス・関数

### コアエンジン
- `EnhancedSimulationEngine`: メインシミュレーションエンジン
- `DataIntegrationEngine`: フロントエンドデータ変換
- `PersistenceManager`: データ永続化・バージョン管理
- `RealtimeDataManager`: リアルタイム通信管理

### チェックツール
- `NetworkIntegrityChecker`: ネットワーク整合性チェック
- `BOMIntegrityChecker`: BOM整合性チェック
- `EnhancedFactChecker`: 包括的ファクトチェック

### リソース管理
- `ResourceManager`: 統合リソース管理
- `Equipment`, `Worker`, `TransportResource`: リソースタイプ

## 🔄 次のステップ

### Phase 2: コアシミュレーション機能（Week 3-4）
- 工程シミュレーションの詳細化
- 材料フロー管理の高度化
- 搬送・物流シミュレーションの実装

### Phase 3: 高度なシミュレーション機能（Week 5-6）
- 品質管理シミュレーション
- スケジューリング最適化
- リアルタイム監視の拡張

### Phase 4: 分析・最適化機能（Week 7-8）
- 統計分析機能
- 最適化アルゴリズム
- What-Ifシナリオ比較

## 📝 注意事項

1. **Redis依存**: リアルタイム機能にはRedisサーバーが必要
2. **メモリ使用量**: 大規模シミュレーションでは要メモリ監視
3. **同期処理**: WebSocket接続の適切な管理が重要
4. **バージョン管理**: 大量データによるストレージ使用量増加に注意

## 🤝 貢献

1. 新機能の実装時は該当フェーズの仕様書を参照
2. テストケースの追加
3. パフォーマンス最適化
4. ドキュメントの更新

---

このシステムは SIMULATION_IMPLEMENTATION_PLAN.md の Phase 1 仕様を完全実装しており、
高度な製造業シミュレーションの基盤として機能します。

