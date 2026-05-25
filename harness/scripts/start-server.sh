#!/bin/bash
set -euo pipefail

# Navigate to project root (FIXED — do not modify)
cd "$(dirname "$0")/../.."

# --- BEGIN PARAMETERIZED ---
export PORT="${PORT:-3001}"
export NODE_ENV="${NODE_ENV:-development}"

# 启动后端服务器
cd star-park/server
node src/index.js &
# --- END PARAMETERIZED ---

SERVER_PID=$!

# Wait for server readiness (fixed logic)
for i in $(seq 1 30); do
  if curl -s "http://localhost:${PORT:-3001}/api/health" > /dev/null 2>&1; then
    echo "✓ 服务器就绪 (PID: $SERVER_PID)"
    exit 0
  fi
  sleep 1
done

echo "✗ 服务器在 30 秒内未能启动"
exit 1
