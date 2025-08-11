#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

stop_pid() {
  local pid_file="$1"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file" || true)
    if [ -n "${pid:-}" ] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping PID $pid from $pid_file ..."
      kill "$pid" || true
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        echo "Force killing PID $pid"
        kill -9 "$pid" || true
      fi
    fi
    rm -f "$pid_file"
  fi
}

stop_pid "$LOG_DIR/backend.pid"
stop_pid "$LOG_DIR/frontend.pid"

echo "All services stopped."

