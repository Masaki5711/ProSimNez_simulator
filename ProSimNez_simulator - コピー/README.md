# 混流生産ライン離散シミュレーター

複雑な前後工程関係を持つ混流生産システムをシミュレートし、在庫量の時間変化を可視化するWebアプリケーションです。

## 機能

- 工程ネットワークのビジュアル編集
- リアルタイムシミュレーション
- 在庫量・稼働率のリアルタイム可視化
- 複数設備の並列処理
- 可変ロットサイズ対応

## 技術スタック

- **フロントエンド**: React + TypeScript
- **バックエンド**: FastAPI (Python)
- **シミュレーション**: SimPy
- **リアルタイム通信**: WebSocket
- **可視化**: D3.js, Chart.js

## セットアップ

### バックエンド

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### フロントエンド

```bash
cd frontend
npm install
npm start
```

## 使用方法

1. ブラウザで`http://localhost:3000`にアクセス
2. 工程ネットワークエディタで生産ラインを設計
3. シミュレーション設定を行い、実行
4. リアルタイムダッシュボードで結果を確認