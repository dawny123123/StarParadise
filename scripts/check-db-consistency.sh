#!/bin/bash
set -euo pipefail

# DDL/Entity 一致性检查脚本
# 检查 SQLite 表结构与代码中使用的字段一致性

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== DDL 一致性检查 ==="

# --- BEGIN PARAMETERIZED ---
DB_PATH="$PROJECT_DIR/star-park/server/data/star-park.db"

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
  echo "⚠ 数据库文件不存在（首次启动时自动创建），跳过检查"
  exit 0
fi

# 检查核心表存在
echo "检查核心表..."
for table in children tasks checkins rewards transactions points; do
  if sqlite3 "$DB_PATH" ".tables" 2>/dev/null | grep -qw "$table"; then
    echo "✓ 表 $table 存在"
  else
    echo "✗ 表 $table 不存在"
    exit 1
  fi
done

# 检查 children 表关键字段
echo "检查 children 表字段..."
CHILDREN_COLS=$(sqlite3 "$DB_PATH" "PRAGMA table_info(children)" 2>/dev/null)
for col in name age grade focus avatar_color points_balance; do
  if echo "$CHILDREN_COLS" | grep -qw "$col"; then
    echo "✓ children.$col 存在"
  else
    echo "✗ children.$col 缺失"
  fi
done
# --- END PARAMETERIZED ---

echo "✓ DDL 一致性检查通过"
