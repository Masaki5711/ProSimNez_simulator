@echo off
echo ========================================
echo 混流生産ライン離散シミュレーター 環境セットアップ
echo ========================================
echo.

REM バックエンドディレクトリに移動
echo [1/3] バックエンドディレクトリに移動しています...
cd backend

REM Python仮想環境を作成
echo [2/3] Python仮想環境を作成しています...
python -m venv venv
if errorlevel 1 (
    echo エラー: 仮想環境の作成に失敗しました
    echo Pythonがインストールされているか確認してください
    pause
    exit /b 1
)

REM 仮想環境をアクティベート
echo [3/3] 仮想環境をアクティベートしています...
call venv\Scripts\activate.bat

REM バックエンドの依存関係をインストール
echo [4/5] pipとsetuptoolsを更新しています...
pip install --upgrade pip setuptools

echo [5/5] バックエンドの依存関係をインストールしています...
pip install -r requirements.txt
if errorlevel 1 (
    echo エラー: バックエンドの依存関係インストールに失敗しました
    pause
    exit /b 1
)

cd ..

echo.
echo ========================================
echo セットアップ完了！
echo ========================================
echo 次は start_dev.bat を実行してサーバーを起動してください。
echo ========================================
pause