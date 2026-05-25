# 设置脚本

Step 1 中使用的内联脚本。协调器在 Setup 阶段直接执行这些脚本，无需外部依赖。

## 内存查询脚本

Step 1.3: 从文件系统直接读取 memory，无需外部脚本。

```bash
if [ -d "harness/memory" ]; then
  # Episodic memory — recent events, failures, recoveries (last 7 days)
  if [ -d "harness/memory/episodes" ]; then
    echo "=== Recent Episodes ==="
    for f in $(find harness/memory/episodes -name "*.jsonl" -mtime -7 2>/dev/null | sort -r | head -5); do
      tail -5 "$f" 2>/dev/null
    done
  fi

  # Knowledge — accumulated project knowledge (architecture, conventions, domain, tech_stack)
  if [ -d "harness/memory/knowledge" ]; then
    echo "=== Project Knowledge ==="
    for f in harness/memory/knowledge/*.json; do
      if [ -f "$f" ]; then
        echo "--- $(basename "$f" .json) ---"
        cat "$f" 2>/dev/null
      fi
    done
  fi

  # Pass episodic + knowledge memory to executor subagent as warnings/context
else
  echo "No memory store yet — skipping"
fi
```
