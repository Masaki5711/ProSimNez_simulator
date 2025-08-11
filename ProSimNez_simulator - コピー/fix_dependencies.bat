@echo off
echo ========================================
echo 依存関係の問題を修正します
echo ========================================
echo.

echo バックエンドディレクトリに移動...
cd backend

echo 仮想環境をアクティベート...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo エラー: 仮想環境が見つかりません
    echo setup_env.bat を先に実行してください
    pause
    exit /b 1
)

echo.
echo [1/3] setuptoolsを更新しています...
pip install --upgrade setuptools

echo [2/3] pipを最新版に更新しています...
pip install --upgrade pip

echo [3/3] 依存関係を再インストールしています...
pip install -r requirements.txt --force-reinstall

echo.
echo ========================================
echo 修正完了！
echo ========================================
echo start_dev.bat でサーバーを起動してください。
echo ========================================
pause