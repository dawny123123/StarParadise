#!/bin/bash
set -euo pipefail
echo "=== 设置环境 ==="

# --- BEGIN PARAMETERIZED ---
# SQLite 是嵌入式数据库，无需启动外部服务
# 数据库文件在首次启动时由 server/src/database.js 自动创建
echo "SQLite 嵌入式数据库 — 无需启动外部服务"

# 安装依赖（如果尚未安装）
if [ ! -d "star-park/server/node_modules" ]; then
  echo "安装后端依赖..."
  cd star-park/server && npm install && cd ../..
fi

if [ ! -d "star-park/pc-admin/node_modules" ]; then
  echo "安装管理后台依赖..."
  cd star-park/pc-admin && npm install && cd ../..
fi
# --- END PARAMETERIZED ---

echo "✓ 环境就绪"
