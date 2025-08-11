@echo off
echo ========================================
echo 混流生産ライン離散シミュレーター 開発環境起動
echo ========================================
echo.

REM バックエンドディレクトリに移動
echo [1/4] バックエンドディレクトリに移動しています...
cd backend

REM 仮想環境をアクティベート
echo [2/4] 仮想環境をアクティベートしています...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo エラー: 仮想環境のアクティベートに失敗しました
    echo 先に仮想環境を作成してください: cd backend && python -m venv venv
    pause
    exit /b 1
)

REM バックエンドの依存関係をインストール
echo [3/4] バックエンドの依存関係をインストールしています...
pip install --upgrade setuptools --quiet
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo エラー: バックエンドの依存関係インストールに失敗しました
    pause
    exit /b 1
)

REM バックエンドサーバーを起動（バックグラウンド）
echo [3/4] バックエンドサーバーを起動しています...
start "Backend Server" cmd /k "uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM フロントエンドディレクトリに移動
cd ..\frontend

REM フロントエンドの依存関係をインストール
echo [4/4] フロントエンドの依存関係をインストールしています...
call npm install
if errorlevel 1 (
    echo エラー: フロントエンドの依存関係インストールに失敗しました
    echo Node.jsがインストールされているか確認してください
    pause
    exit /b 1
)

REM uuidパッケージとその型定義をインストール
echo [4.5/5] uuidパッケージをインストールしています...
call npm install uuid @types/uuid
if errorlevel 1 (
    echo 警告: uuidパッケージのインストールに失敗しました
    echo 手動でインストールしてください: npm install uuid @types/uuid
)

REM フロントエンドサーバーを起動
echo [5/5] フロントエンドサーバーを起動しています...
echo.
echo ========================================
echo 起動完了！
echo ========================================
echo バックエンド: http://localhost:8000
echo フロントエンド: http://localhost:3000
echo API仕様書: http://localhost:8000/docs
echo ========================================
echo.
echo ブラウザが自動で開かない場合は、手動で以下にアクセスしてください:
echo http://localhost:3000
echo.
echo 終了するには、両方のコマンドウィンドウを閉じてください。
echo ========================================

start "Frontend Server" cmd /k "npm start"

echo 起動処理が完了しました。
pause