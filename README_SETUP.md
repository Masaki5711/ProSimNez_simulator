# 混流生産ライン離散シミュレーター セットアップガイド

## 🚀 クイックスタート

### 1. 環境チェック
```cmd
check_env.bat
```
必要な環境（Python, Node.js）がインストールされているか確認します。

### 2. 初回セットアップ
```cmd
setup_env.bat
```
仮想環境の作成とバックエンドの依存関係をインストールします。

### 3. 開発環境起動
```cmd
start_dev.bat
```
フロントエンドとバックエンドの両方を起動します。

### 4. サーバー停止
```cmd
stop_dev.bat
```
起動中の全てのサーバーを停止します。

## 📁 提供されるBatファイル

| ファイル名 | 説明 |
|-----------|------|
| `check_env.bat` | 開発環境の要件チェック |
| `setup_env.bat` | 初回環境セットアップ |
| `start_dev.bat` | 開発サーバー起動 |
| `stop_dev.bat` | サーバー停止 |
| `fix_dependencies.bat` | 依存関係の問題修正 |

## 🖥️ 起動後のアクセス

| サービス | URL |
|---------|-----|
| フロントエンド | http://localhost:3000 |
| バックエンドAPI | http://localhost:8000 |
| API仕様書 | http://localhost:8000/docs |

## 🔧 前提条件

- **Python 3.8+** - https://www.python.org/
- **Node.js 16+** - https://nodejs.org/
- **Git** (推奨) - https://git-scm.com/

## 📋 初回セットアップ手順

1. **環境確認**
   ```cmd
   check_env.bat
   ```

2. **セットアップ実行**
   ```cmd
   setup_env.bat
   ```

3. **開発サーバー起動**
   ```cmd
   start_dev.bat
   ```

4. **ブラウザでアクセス**
   - http://localhost:3000 にアクセス

## 🔑 認証情報

開発環境では以下のユーザーが利用できます：

| ユーザー名 | パスワード | 権限 |
|-----------|----------|------|
| admin | secret | 管理者 |
| operator | secret | オペレーター |

## ⚠️ トラブルシューティング

### ポートが既に使用されている
```
Error: listen EADDRINUSE: address already in use :::3000
```
**解決策**: `stop_dev.bat` を実行してプロセスを停止してから再起動

### Python仮想環境が見つからない
```
エラー: 仮想環境のアクティベートに失敗しました
```
**解決策**: `setup_env.bat` を実行して仮想環境を作成（backend/venv に作成されます）

### Node.js依存関係エラー
```
npm ERR! 
```
**解決策**: Node.jsを最新版に更新、または `frontend` フォルダで `npm cache clean --force` を実行

### バックエンド起動エラー
```
ModuleNotFoundError: No module named 'fastapi'
ModuleNotFoundError: No module named 'pkg_resources'
```
**解決策**: 
1. `fix_dependencies.bat` を実行（推奨）
2. または `setup_env.bat` を再実行して依存関係をインストール

## 📝 開発時のワークフロー

1. **毎日の開発開始時**
   ```cmd
   start_dev.bat
   ```

2. **開発終了時**
   ```cmd
   stop_dev.bat
   ```

3. **依存関係を追加した場合**
   - バックエンド: `cd backend` → `venv\Scripts\activate.bat` → `pip install package_name`
   - フロントエンド: `frontend` フォルダで `npm install package_name`

## 🐳 Docker使用の場合

Dockerが利用可能な場合は、以下でも起動できます：
```cmd
docker-compose up
```

## 📞 サポート

問題が発生した場合は、以下を確認してください：
1. `check_env.bat` の結果
2. エラーメッセージの内容
3. 使用しているOS・ブラウザのバージョン