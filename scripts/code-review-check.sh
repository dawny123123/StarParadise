#!/bin/bash
set -euo pipefail

# 编码规范综合检查脚本

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== 编码规范检查 ==="

# --- BEGIN PARAMETERIZED ---
# 检查1: 无 debugger 语句
echo "检查 debugger 语句..."
DEBUGGER_COUNT=$(grep -rn "debugger" --include="*.js" --include="*.vue" --include="*.ts" \
  "$PROJECT_DIR/star-park/" 2>/dev/null | grep -v node_modules | grep -v dist | wc -l | tr -d ' ')
if [ "$DEBUGGER_COUNT" -gt 0 ]; then
  echo "✗ 发现 $DEBUGGER_COUNT 个 debugger 语句"
  grep -rn "debugger" --include="*.js" --include="*.vue" --include="*.ts" \
    "$PROJECT_DIR/star-park/" | grep -v node_modules | grep -v dist
  exit 1
fi
echo "✓ 无 debugger 语句"

# 检查2: 无 TODO 硬编码（可选提醒）
echo "检查 TODO 标记..."
TODO_COUNT=$(grep -rn "TODO" --include="*.js" --include="*.vue" --include="*.ts" \
  "$PROJECT_DIR/star-park/server/src/" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TODO_COUNT" -gt 0 ]; then
  echo "⚠ 发现 $TODO_COUNT 个 TODO 标记（提醒）"
fi
echo "✓ 编码规范检查通过"
# --- END PARAMETERIZED ---

echo "✓ 编码规范检查完成"
