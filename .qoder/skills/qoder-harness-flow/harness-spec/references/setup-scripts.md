# 设置脚本

Step 1 中使用的内联脚本。协调器在 Setup 阶段直接执行这些脚本，无需外部依赖。

## 内存查询脚本

Step 1.3: 从文件系统读取 memory，使用 smart recall 替代暴力截断。

### 情景记忆 — 智能召回

从用户的任务描述中提取 3-5 个关键词，调用 `memory_query.py recall` 返回按 recall_score 排序的 top-10 episodes。

```bash
# Resolve evolver script path (cross-skill reference)
EVOLVER_DIR="$(cd "$(dirname "$SKILL_DIR")" && cd harness-evolver 2>/dev/null && pwd)"

if [ -n "$EVOLVER_DIR" ] && [ -f "$EVOLVER_DIR/scripts/memory_query.py" ]; then
  # Extract keywords from user's task description (coordinator fills TASK_KEYWORDS)
  # TASK_KEYWORDS should be a comma-separated string, e.g. "认证,JWT,登录"
  RECALL_RESULT=$(python3 "$EVOLVER_DIR/scripts/memory_query.py" recall \
    --keywords "$TASK_KEYWORDS" \
    --top 10 --json 2>/dev/null)
  if [ -n "$RECALL_RESULT" ] && [ "$RECALL_RESULT" != "[]" ]; then
    echo "=== Recalled Episodes (by relevance) ==="
    echo "$RECALL_RESULT"
  fi
else
  # Fallback: basic recent episodes if evolver script not available
  if [ -d "harness/memory/episodes" ]; then
    echo "=== Recent Episodes (fallback) ==="
    for f in $(find harness/memory/episodes -name "*.jsonl" -mtime -7 2>/dev/null | sort -r | head -5); do
      tail -5 "$f" 2>/dev/null
    done
  fi
fi
```

### 知识记忆 — 全量加载

Knowledge 层仍然全量加载，逻辑不变。

```bash
if [ -d "harness/memory/knowledge" ]; then
  echo "=== Project Knowledge ==="
  for f in harness/memory/knowledge/*.json; do
    if [ -f "$f" ]; then
      echo "--- $(basename "$f" .json) ---"
      cat "$f" 2>/dev/null
    fi
  done
fi
```

> **关键词提取策略**：协调器在调用此脚本前，必须从用户的任务描述中提取 3-5 个关键词并设置 `TASK_KEYWORDS` 变量。提取规则：
> - 从用户原始请求中提取动词 + 名词短语
> - 优先保留技术术语和业务概念
> - 中英文均可，用逗号分隔
> - 示例：用户说"实现用户认证功能" → TASK_KEYWORDS="认证,用户,auth,登录"
