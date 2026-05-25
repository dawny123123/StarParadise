#!/bin/bash
set -euo pipefail

# API 接口测试脚本
# 启动应用并通过 HTTP 请求验证端到端流程

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# --- BEGIN PARAMETERIZED ---
BASE_URL="${BASE_URL:-http://localhost:3001/api}"

# 测试健康检查
echo "测试健康检查..."
HEALTH=$(curl -sf "${BASE_URL}/health" 2>/dev/null) || { echo "✗ 健康检查失败: 服务未启动"; exit 1; }
echo "$HEALTH" | grep -q '"ok"' || { echo "✗ 健康检查返回异常"; exit 1; }
echo "✓ 健康检查通过"

# 测试获取孩子列表
echo "测试获取孩子列表..."
CHILDREN=$(curl -sf "${BASE_URL}/children" 2>/dev/null) || { echo "✗ 获取孩子列表失败"; exit 1; }
echo "✓ 获取孩子列表通过"

# 测试获取任务列表
echo "测试获取任务列表..."
curl -sf "${BASE_URL}/tasks" > /dev/null 2>&1 || { echo "✗ 获取任务列表失败"; exit 1; }
echo "✓ 获取任务列表通过"

# 测试获取仪表盘数据
echo "测试获取仪表盘数据..."
curl -sf "${BASE_URL}/dashboard" > /dev/null 2>&1 || { echo "✗ 获取仪表盘失败"; exit 1; }
echo "✓ 获取仪表盘通过"
# --- END PARAMETERIZED ---

echo "✓ API 测试通过"
