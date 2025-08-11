@echo off
echo ========================================
echo 混流生産ライン離散シミュレーター 停止
echo ========================================
echo.

echo サーバーを停止しています...

REM Node.jsプロセス（フロントエンド）を停止
echo フロントエンドサーバーを停止中...
taskkill /f /im node.exe 2>nul
if errorlevel 1 (
    echo フロントエンドサーバーは既に停止しているか、見つかりませんでした。
) else (
    echo フロントエンドサーバーを停止しました。
)

REM Pythonプロセス（バックエンド）を停止
echo バックエンドサーバーを停止中...
taskkill /f /im python.exe 2>nul
if errorlevel 1 (
    echo バックエンドサーバーは既に停止しているか、見つかりませんでした。
) else (
    echo バックエンドサーバーを停止しました。
)

REM uvicornプロセスを停止（念のため）
taskkill /f /im uvicorn.exe 2>nul

echo.
echo ========================================
echo 全てのサーバーを停止しました。
echo ========================================
pause