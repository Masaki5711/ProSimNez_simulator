# Plant Simulator サーバー設置手順（Ubuntu + PostgreSQL 永続化 / Nginx リバースプロキシ）

本ドキュメントは、GitHub からソースを取得して Ubuntu サーバーに本アプリを設置・運用するための完全な手順です。
- データベースは PostgreSQL で永続化
- バックエンドは FastAPI (Uvicorn)
- フロントエンドは React（本書では Nginx リバースプロキシで公開）
- 2パターンに対応: 1) Docker Compose で一括起動, 2) Docker なし（ネイティブ）での構築

---

## 前提
- 対象 OS: Ubuntu 22.04 LTS（その他の Debian 系でも概ね同様）
- サーバーのパブリック IP / ドメイン名があること（HTTPS 化する場合）
- sudo 実行権限のあるアカウントを持つこと

---

## 1. 事前準備（共通）

### 1.1 パッケージ更新と基本ツール
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates gnupg lsb-release ufw
```

### 1.2 ファイアウォール（UFW）設定（任意）
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 2. GitHub からソース取得
```bash
cd /opt
sudo mkdir -p /opt/plant_simulator
sudo chown -R "$USER":"$USER" /opt/plant_simulator
cd /opt/plant_simulator

# GitHub からクローン
# 例: https://github.com/masaki5711-program/Plant_simulator
# （必要に応じてご自身のフォークURLに変更してください）

git clone https://github.com/masaki5711-program/Plant_simulator.git .
```

---

# パターン A: Docker Compose で一括起動

## A-1. Docker / Docker Compose インストール
```bash
# Docker Engine (公式手順の簡略版)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# 反映のためログインし直す or `newgrp docker`
```

Docker Compose v2 は Docker に同梱されます（`docker compose` コマンドが使えます）。

## A-2. docker-compose.yml の確認
リポジトリ直下に `docker-compose.yml` を用意済みです。（PostgreSQL + Backend + Frontend 構成）

編集ポイント（必要に応じて修正）:
- `backend.environment.JWT_SECRET` を推測困難な値に変更
- `backend.environment.CORS_ORIGINS` に実際のフロントURL（例: `http://your.domain`）を追加

## A-3. 起動
```bash
cd /opt/plant_simulator
sudo docker compose up -d --build
```

- 初回起動で Postgres コンテナ・バックエンド・フロントエンドが立ち上がります
- データは `postgres_data` ボリュームに永続化されます

## A-4. 動作確認
- バックエンド API: `http://<サーバーIP>:8000/health` → `{"status":"healthy"}`
- フロント（開発モード表示）: `http://<サーバーIP>:3000`

初期ユーザー（自動投入）
- ユーザー名: `user1`
- パスワード: `user123`

## A-5. Nginx リバースプロキシ（Docker パターン）
Docker のポートを Nginx で公開・HTTPS 化します。

### Nginx インストール
```bash
sudo apt install -y nginx
```

### サーバーブロック設定例（/etc/nginx/sites-available/plant.conf）
```nginx
server {
    listen 80;
    server_name your.domain;  # ←あなたのドメイン

    # Let's Encrypt 取得時の一時リダイレクトは後述

    location /api/ {
        proxy_pass http://127.0.0.1:8000;  # backend(Uvicorn) へ
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket (必要に応じて)
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # フロントエンド（開発時 3000 番）
    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

有効化・テスト
```bash
sudo ln -s /etc/nginx/sites-available/plant.conf /etc/nginx/sites-enabled/plant.conf
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS 化（Let’s Encrypt）
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain
# 自動更新は systemd timer により有効（/etc/letsencrypt/renewal に登録）
```

> 本番では Nginx → Backend/Frontend の間は 127.0.0.1 のみ公開にすると安全です（docker の publish ポートをローカルネットワークのみに制限するなど）。

---

# パターン B: Docker を使わずネイティブ構築

## B-1. PostgreSQL インストールと DB 作成
```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'SQL'
CREATE USER plant_user WITH PASSWORD 'plant_pass';
CREATE DATABASE plant_sim OWNER plant_user;
GRANT ALL PRIVILEGES ON DATABASE plant_sim TO plant_user;
SQL
```
必要に応じて `/etc/postgresql/*/main/pg_hba.conf` を編集し、ローカル接続を許可後に再起動:
```bash
sudo systemctl restart postgresql
```

## B-2. バックエンド（FastAPI）
```bash
cd /opt/plant_simulator/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# .env を作成
cat > .env <<'ENV'
DATABASE_URL=postgresql+psycopg2://plant_user:plant_pass@localhost:5432/plant_sim
JWT_SECRET=change_me_to_random_string
CORS_ORIGINS=http://your.domain,http://localhost:3000
UVICORN_HOST=127.0.0.1
UVICORN_PORT=8000
ENV

# 起動（開発）
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
> 起動時に DB テーブルが自動作成され、初期ユーザー `user1/user123` が投入されます。

### B-2-1. systemd サービス化（本番）
`/etc/systemd/system/plant-backend.service`
```ini
[Unit]
Description=Plant Simulator Backend (FastAPI)
After=network.target

[Service]
WorkingDirectory=/opt/plant_simulator/backend
EnvironmentFile=/opt/plant_simulator/backend/.env
ExecStart=/opt/plant_simulator/backend/venv/bin/uvicorn app.main:app --host ${UVICORN_HOST} --port ${UVICORN_PORT}
Restart=always
RestartSec=5
User=%i

[Install]
WantedBy=multi-user.target
```
反映:
```bash
sudo systemctl daemon-reload
sudo systemctl enable plant-backend
sudo systemctl start plant-backend
sudo systemctl status plant-backend
```

## B-3. フロントエンド（ビルド + Nginx 配信）
```bash
cd /opt/plant_simulator/frontend
npm ci || npm install
npm run build

# Nginx 配信用に配置（例）
sudo mkdir -p /var/www/plant_frontend
sudo cp -r build/* /var/www/plant_frontend/
```
Nginx 設定（/etc/nginx/sites-available/plant.conf）
```nginx
server {
    listen 80;
    server_name your.domain;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        root /var/www/plant_frontend;
        try_files $uri /index.html;
    }
}
```
有効化/HTTPS は A-5 と同様。

---

## 運用

### 更新（GitHub から最新版反映）
```bash
cd /opt/plant_simulator
git pull
# Docker
sudo docker compose up -d --build
# ネイティブ
# バックエンド
cd backend && source venv/bin/activate && pip install -r requirements.txt
sudo systemctl restart plant-backend
# フロントエンド
cd ../frontend && npm ci || npm install && npm run build
sudo rsync -a --delete build/ /var/www/plant_frontend/
sudo systemctl reload nginx
```

### バックアップ
```bash
# DB バックアップ
pg_dump -U plant_user -h localhost -Fc -f /backup/plant_sim_$(date +%F).dump plant_sim

# 復元（例）
pg_restore -U plant_user -h localhost -d plant_sim -c /backup/plant_sim_YYYY-MM-DD.dump
```

### ログ
- Nginx: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- FastAPI(Uvicorn): systemd の `journalctl -u plant-backend -f`
- Postgres: `/var/log/postgresql/postgresql-*.log`（設定により）

### ヘルスチェック
- API ヘルス: `GET /health` → `{ "status": "healthy" }`
- WebSocket: `GET /ws/simulation`（ブラウザ開発者ツールで接続確認）

---

## トラブルシュート
- 403/CORS エラー
  - `backend` の `CORS_ORIGINS` に実際のフロントURLを追加したか確認
- ログインできない
  - ユーザー名＝ID。管理者ダッシュボードから作成したユーザーで、正しい初期パスワードか確認
  - Backendログ（`journalctl -u plant-backend -f` もしくは `docker logs`）を確認
- DB 接続エラー
  - `DATABASE_URL` が Docker なら `postgres:5432`、ネイティブなら `localhost:5432` になっているか確認
  - ユーザー/パスワード/DB 名の一致
- 500 エラー
  - 追加した .env / docker-compose の環境変数（特に `JWT_SECRET`）が設定されているか

---

## セキュリティの注意
- `JWT_SECRET` は必ず推測困難なランダム文字列に変更
- `POSTGRES_PASSWORD` も強力なものに変更し、`DATABASE_URL` と一致させる
- 管理者アカウントの初期パスワードは必ず変更
- Nginx で HTTPS を有効化し、80→443 リダイレクト
- 不要なポートは閉じる（ufw / セキュリティグループ）

---

## 初期ログイン
- 初期ユーザー（自動投入）: `user1 / user123`
- 管理者権限ユーザーは管理者ダッシュボードから作成してください

以上で、GitHub からの取得 → 永続化付き DB → Nginx リバースプロキシ/HTTPS → 運用（更新/バックアップ/ログ/トラブルシュート）までの手順は完了です。