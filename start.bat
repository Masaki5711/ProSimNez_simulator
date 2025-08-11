@echo off
echo 混流生産ライン離散シミュレーターを起動します...

REM バックエンドを起動
echo バックエンドサーバーを起動中...
cd backend
start cmd /k "pip install -r requirements.txt && uvicorn app.main:app --reload"

REM 少し待機
timeout /t 5

REM フロントエンドを起動
echo フロントエンドサーバーを起動中...
cd ../frontend
start cmd /k "npm install && npm start"

echo.
echo 起動が完了しました。
echo ブラウザで http://localhost:3000 にアクセスしてください。
echo.
pause