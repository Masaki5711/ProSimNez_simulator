@echo off
echo ========================================
echo 環境チェック
echo ========================================
echo.

echo [1/4] Pythonバージョンを確認しています...
python --version
if errorlevel 1 (
    echo ❌ Pythonがインストールされていません
    echo https://www.python.org/ からPythonをインストールしてください
) else (
    echo ✅ Python がインストールされています
)
echo.

echo [2/4] Node.jsバージョンを確認しています...
node --version
if errorlevel 1 (
    echo ❌ Node.jsがインストールされていません
    echo https://nodejs.org/ からNode.jsをインストールしてください
) else (
    echo ✅ Node.js がインストールされています
)
echo.

echo [3/4] npmバージョンを確認しています...
npm --version
if errorlevel 1 (
    echo ❌ npmが利用できません
) else (
    echo ✅ npm が利用できます
)
echo.

echo [4/4] 仮想環境を確認しています...
if exist "backend\venv\Scripts\activate.bat" (
    echo ✅ 仮想環境が作成されています (backend\venv)
) else (
    echo ❌ 仮想環境が作成されていません
    echo setup_env.bat を実行して環境をセットアップしてください
)
echo.

echo [追加] プロジェクトファイルを確認しています...
if exist "backend\app\main.py" (
    echo ✅ バックエンドファイルが存在します
) else (
    echo ❌ バックエンドファイルが見つかりません
)

if exist "frontend\package.json" (
    echo ✅ フロントエンドファイルが存在します
) else (
    echo ❌ フロントエンドファイルが見つかりません
)

echo.
echo ========================================
echo 環境チェック完了
echo ========================================
echo 全て✅の場合、start_dev.bat を実行してサーバーを起動できます。
echo ❌がある場合は、該当する項目をインストール/セットアップしてください。
echo ========================================
pause