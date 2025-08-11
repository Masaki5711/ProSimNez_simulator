#!/usr/bin/env bash
set -euo pipefail

# Start backend (FastAPI) and serve frontend build

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
LOG_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOG_DIR"

# Backend start
if [ -d "$BACKEND_DIR" ]; then
  echo "Starting backend (FastAPI) on :8000..."
  (
    cd "$BACKEND_DIR"
    # shellcheck disable=SC1091
    source .venv/bin/activate
    # Detect app entrypoint
    APP_MODULE="app.main:app"
    if [ -f app/main.py ]; then APP_MODULE="app.main:app"; fi
    if [ -f main.py ]; then APP_MODULE="main:app"; fi
    nohup uvicorn "$APP_MODULE" --host 0.0.0.0 --port 8000 --workers 2 > "$LOG_DIR/backend.out" 2>&1 &
    echo $! > "$LOG_DIR/backend.pid"
    deactivate
  )
else
  echo "[WARN] Backend directory not found: $BACKEND_DIR (skipping backend start)"
fi

# Frontend start (serve static build)
if [ -d "$FRONTEND_DIR" ]; then
  if [ -d "$FRONTEND_DIR/build" ]; then
    echo "Serving frontend build on :3000..."
    (
      cd "$FRONTEND_DIR"
      nohup npx serve -s build -l 3000 > "$LOG_DIR/frontend.out" 2>&1 &
      echo $! > "$LOG_DIR/frontend.pid"
    )
  else
    echo "[WARN] Frontend build not found. Run npm run build in $FRONTEND_DIR"
  fi
else
  echo "[WARN] Frontend directory not found: $FRONTEND_DIR (skipping frontend serve)"
fi

echo "All services started. Logs in $LOG_DIR"

