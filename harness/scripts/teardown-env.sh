#!/bin/bash
set -euo pipefail

# --- BEGIN PARAMETERIZED ---
# SQLite 嵌入式数据库无需停止
# 停止后端服务进程
pkill -f "node src/index.js" 2>/dev/null || true
# --- END PARAMETERIZED ---

# Kill any remaining server process (fixed logic)
pkill -f "start-server" 2>/dev/null || true

echo "✓ 已清理"
