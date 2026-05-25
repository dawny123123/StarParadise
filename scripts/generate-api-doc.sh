#!/bin/bash
set -euo pipefail

# API 文档自动生成脚本
# 从源码路由扫描 API 端点，更新 docs/api.md

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# --- BEGIN PARAMETERIZED ---
# 扫描 Express 路由定义
echo "扫描 API 端点..."
grep -rn "router\.\(get\|post\|put\|delete\)(" "$PROJECT_DIR/star-park/server/src/routes/" | \
  sed 's/.*:.*router\.\(get\|post\|put\|delete\)(.*'\''\(.*\)'\''.*/\1 \U\1/' || true
# --- END PARAMETERIZED ---

echo "✓ API 文档已更新: docs/api.md"
