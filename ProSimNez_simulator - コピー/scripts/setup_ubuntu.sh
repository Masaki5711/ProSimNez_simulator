#!/usr/bin/env bash
set -euo pipefail

# Ubuntu setup script for Plant_simulator
# - Installs system dependencies (Python, Node.js)
# - Prepares Python venv and installs backend deps
# - Installs frontend deps and builds production assets

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_DIR="$PROJECT_ROOT/logs"

echo "[1/7] Updating apt package index..."
sudo apt-get update -y

echo "[2/7] Installing base packages..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  python3 python3-venv python3-pip \
  build-essential curl git ca-certificates

echo "[3/7] Installing Node.js LTS (via NodeSource)..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "Node.js already installed: $(node -v)"
fi

mkdir -p "$LOG_DIR"

echo "[4/7] Setting up Python virtual environment for backend..."
if [ -d "$BACKEND_DIR" ]; then
  cd "$BACKEND_DIR"
  if [ ! -d .venv ]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  pip install --upgrade pip wheel

  if [ -f requirements.txt ]; then
    echo "Installing backend dependencies from requirements.txt..."
    pip install -r requirements.txt
  else
    echo "requirements.txt not found. Installing common backend deps..."
    pip install fastapi uvicorn[standard] pydantic sqlalchemy python-jose[cryptography] passlib[bcrypt] redis psycopg2-binary
  fi
  deactivate
else
  echo "[WARN] Backend directory not found: $BACKEND_DIR (skipping backend setup)"
fi

echo "[5/7] Installing frontend dependencies..."
if [ -d "$FRONTEND_DIR" ]; then
  cd "$FRONTEND_DIR"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi

  echo "[6/7] Building frontend..."
  npm run build

  echo "[7/7] Installing static server (serve) if needed..."
  # Prefer using npx at runtime, but install globally if not present
  if ! command -v serve >/dev/null 2>&1; then
    npm install -g serve || true
  fi
else
  echo "[WARN] Frontend directory not found: $FRONTEND_DIR (skipping frontend setup)"
fi

echo "\nSetup complete. Next steps:"
echo "  1) Make start script executable:  chmod +x scripts/start_server.sh"
echo "  2) Start services:                ./scripts/start_server.sh"
echo "  3) Backend API:                   http://<server-ip>:8000/docs"
echo "  4) Frontend:                      http://<server-ip>:3000"

