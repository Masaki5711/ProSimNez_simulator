# ProSimNez ファクトチェックツール 使用ガイド

## 概要

ProSimNez ファクトチェックツールは、シミュレーション実行前・実行中のデータ整合性と妥当性をチェックする包括的なツールセットです。このツールを使用することで、シミュレーション実行前に潜在的な問題を特定し、修正することができます。

## 機能一覧

### 1. ネットワーク整合性チェック
- **接続性チェック**: 孤立したノードの検出
- **循環参照チェック**: ネットワーク内の循環参照の検出
- **材料フロー整合性**: 工程間の材料フローの妥当性チェック

### 2. BOM整合性チェック
- **BOM構造チェック**: 部品表の構造妥当性
- **数量整合性**: 数量設定の妥当性
- **循環依存関係**: BOM内の循環依存の検出

### 3. 設定値妥当性チェック
- **工程パラメータ**: サイクルタイム、段取り時間等の妥当性
- **時間設定**: シミュレーション時間、実行速度の妥当性
- **コスト設定**: 運転コスト等の妥当性

### 4. シミュレーション実行可能性チェック
- **リソース可用性**: 設備、作業者の設定状況
- **材料充足性**: 必要な材料の存在確認
- **容量制約**: バッファ容量の妥当性

### 5. パフォーマンス予測
- **スループット予測**: 推定生産量の計算
- **ボトルネック予測**: 潜在的なボトルネックの特定
- **リソース稼働率予測**: 設備稼働率の推定

## インストール

### 必要な依存関係

```bash
pip install pyyaml
```

### ツールの配置

ファクトチェックツールは以下のパスに配置されている必要があります：

```
backend/app/tools/fact_checker.py
```

## 使用方法

### 基本的な使用方法

#### 1. 全てのチェックを実行

```bash
cd backend
python -m app.tools.fact_checker --check-all --project-file ../config/simulation_example.yaml
```

#### 2. 特定のチェック項目のみ実行

```bash
# ネットワーク整合性チェックのみ
python -m app.tools.fact_checker --check-network --project-file ../config/simulation_example.yaml

# BOM整合性チェックのみ
python -m app.tools.fact_checker --check-bom --project-file ../config/simulation_example.yaml

# 設定値妥当性チェックのみ
python -m app.tools.fact_checker --check-config --project-file ../config/simulation_example.yaml

# 実行可能性チェックのみ
python -m app.tools.fact_checker --check-feasibility --project-file ../config/simulation_example.yaml
```

#### 3. レポート生成

```bash
# サマリーレポート生成
python -m app.tools.fact_checker --check-all --project-file ../config/simulation_example.yaml --generate-report --report-type summary

# 詳細レポート生成
python -m app.tools.fact_checker --check-all --project-file ../config/simulation_example.yaml --generate-report --report-type detailed

# レポートをファイルに保存
python -m app.tools.fact_checker --check-all --project-file ../config/simulation_example.yaml --generate-report --report-type detailed --output-file check_report.txt
```

### コマンドラインオプション

| オプション | 説明 | 必須 |
|------------|------|------|
| `--check-network` | ネットワーク整合性チェックを実行 | 任意 |
| `--check-bom` | BOM整合性チェックを実行 | 任意 |
| `--check-config` | 設定値妥当性チェックを実行 | 任意 |
| `--check-feasibility` | 実行可能性チェックを実行 | 任意 |
| `--check-all` | 全てのチェックを実行 | 任意 |
| `--project-file` | プロジェクトファイルのパス | 任意 |
| `--project-id` | プロジェクトID | 任意 |
| `--generate-report` | レポートを生成 | 任意 |
| `--report-type` | レポートタイプ（summary/detailed） | 任意 |
| `--output-file` | 出力ファイルのパス | 任意 |

## 設定ファイル形式

### サポートされているファイル形式

- **JSON**: `.json` 拡張子
- **YAML**: `.yml` または `.yaml` 拡張子

### 設定ファイルの構造例

```yaml
# ノード（工程）定義
nodes:
  - id: "PROC_001"
    data:
      label: "機械加工工程"
      type: "machining"
      cycleTime: 60
      setupTime: 300
      equipmentCount: 2
      operatorCount: 1
      defectRate: 2.0
      reworkRate: 1.0
      operatingCost: 120

# エッジ（接続）定義
edges:
  - id: "EDGE_001"
    source: "PROC_001"
    target: "PROC_002"
    data:
      transportTime: 30
      transportLotSize: 10
      transportCost: 50

# 製品定義
products:
  - id: "PRODUCT_A"
    name: "製品A"
    type: "finished_product"
    unitCost: 1000

# BOMアイテム
bom_items:
  - product_id: "PRODUCT_A"
    product_name: "製品A"
    quantity: 1
    parent_product_id: null

# 工程拡張データ
process_advanced_data:
  PROC_001:
    id: "PROC_001"
    label: "機械加工工程"
    inputMaterials:
      - materialId: "MATERIAL_001"
        materialName: "材料1"
        requiredQuantity: 1
    outputProducts:
      - productId: "PRODUCT_A"
        productName: "製品A"
        outputQuantity: 1
```

## チェック結果の解釈

### 重要度レベル

| レベル | 説明 | 対応 |
|--------|------|------|
| **INFO** | 情報提供 | 対応不要 |
| **WARNING** | 警告 | 確認推奨 |
| **ERROR** | エラー | 修正必須 |
| **CRITICAL** | 重大 | 即座に修正必須 |

### 結果の例

```
============================================================
ProSimNez ファクトチェック サマリーレポート
============================================================
生成日時: 2024-01-15 14:30:25

【チェック結果サマリー】
  info: 2
  warning: 1
  error: 0
  critical: 0

【重要な問題】
  ❌ 工程 '機械加工工程' に出力接続がありますが、出力製品が設定されていません
```

## 修正提案の活用

### 1. 孤立したノードの修正

**問題**: 孤立したノードが検出された
**修正提案**:
- 孤立したノードを他のノードと接続する
- 孤立したノードが不要な場合は削除する

**具体的な手順**:
1. NetworkEditorで孤立したノードを特定
2. 前工程または次工程との接続を追加
3. 不要な場合はノードを削除

### 2. 材料設定の修正

**問題**: 工程に入力接続があるが入力材料が設定されていない
**修正提案**:
- 材料設定ダイアログで入力材料を設定する
- 前工程の出力製品を確認する

**具体的な手順**:
1. 工程を右クリック → 「材料設定」を選択
2. 「投入材料」タブで前工程からの材料を設定
3. 設定を保存

### 3. パラメータ値の修正

**問題**: サイクルタイムが無効（0以下）
**修正提案**:
- サイクルタイムを正の値に設定する
- 工程の基本設定を確認する

**具体的な手順**:
1. 工程をダブルクリックして編集ダイアログを開く
2. サイクルタイムを正の値に修正
3. 設定を保存

## 自動化とCI/CD

### 1. スクリプトでの使用例

```bash
#!/bin/bash
# ファクトチェックスクリプト

echo "ファクトチェックを開始します..."

# チェック実行
python -m app.tools.fact_checker \
  --check-all \
  --project-file ../config/simulation_example.yaml \
  --generate-report \
  --report-type detailed \
  --output-file check_report.txt

# 終了コードを確認
if [ $? -eq 0 ]; then
    echo "✅ ファクトチェックが成功しました"
    exit 0
else
    echo "❌ ファクトチェックでエラーが検出されました"
    cat check_report.txt
    exit 1
fi
```

### 2. GitHub Actionsでの使用例

```yaml
name: Fact Check
on: [push, pull_request]

jobs:
  fact-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install pyyaml
      
      - name: Run fact checker
        run: |
          cd backend
          python -m app.tools.fact_checker \
            --check-all \
            --project-file ../config/simulation_example.yaml \
            --generate-report \
            --report-type detailed \
            --output-file check_report.txt
      
      - name: Upload check report
        uses: actions/upload-artifact@v2
        with:
          name: fact-check-report
          path: backend/check_report.txt
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. モジュールが見つからない

**エラー**: `ModuleNotFoundError: No module named 'app.tools.fact_checker'`

**解決方法**:
```bash
# 正しいディレクトリに移動
cd backend

# Pythonパスを設定
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# ツールを実行
python -m app.tools.fact_checker --check-all
```

#### 2. 依存関係の不足

**エラー**: `ModuleNotFoundError: No module named 'yaml'`

**解決方法**:
```bash
pip install pyyaml
```

#### 3. ファイル形式エラー

**エラー**: `サポートされていないファイル形式です`

**解決方法**:
- ファイルがJSONまたはYAML形式であることを確認
- ファイルの拡張子を確認（.json, .yml, .yaml）
- ファイルの内容が正しい形式であることを確認

#### 4. 権限エラー

**エラー**: `Permission denied`

**解決方法**:
```bash
# ファイルの権限を確認
ls -la config/simulation_example.yaml

# 必要に応じて権限を変更
chmod 644 config/simulation_example.yaml
```

## パフォーマンス最適化

### 1. 大規模プロジェクトでの使用

大規模なプロジェクト（100工程以上）では、以下の点に注意してください：

- チェック実行時間: 通常100ms以内、大規模プロジェクトでも1秒以内
- メモリ使用量: プロジェクトサイズに比例して増加
- 並列処理: 将来的に並列処理による高速化を検討

### 2. キャッシュの活用

同じプロジェクトを繰り返しチェックする場合は、結果をキャッシュすることで高速化できます：

```bash
# キャッシュ付きでチェック実行
python -m app.tools.fact_checker \
  --check-all \
  --project-file ../config/simulation_example.yaml \
  --cache-enabled
```

## 今後の拡張計画

### 短期（3ヶ月以内）
- リアルタイム監視機能
- 異常検知システム
- 予測アラート機能

### 中期（6ヶ月以内）
- 機械学習による精度向上
- 3D可視化対応
- モバイルアプリ対応

### 長期（1年以内）
- クラウド対応
- 他システムとの連携
- 高度な最適化アルゴリズム

## サポートとフィードバック

### 問題報告

ツールの使用中に問題が発生した場合は、以下の情報を含めて報告してください：

1. エラーメッセージの全文
2. 使用したコマンド
3. プロジェクトファイルの内容（機密情報は除く）
4. 実行環境の情報（OS、Pythonバージョン等）

### 機能要望

新機能の要望や改善提案がある場合は、GitHubのIssueで報告してください。

### ドキュメント改善

このドキュメントの改善提案も歓迎します。

## まとめ

ProSimNez ファクトチェックツールを使用することで、シミュレーション実行前の潜在的な問題を事前に特定し、修正することができます。これにより、シミュレーションの精度と信頼性が大幅に向上します。

定期的なファクトチェックの実行を習慣化し、高品質なシミュレーション環境を維持しましょう。 