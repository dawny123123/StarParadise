# 结果展示模板

Step 7: 任务完成后向用户展示结果的模板。

> **数据来源**：读取计划文件和 context.json 来填充此模板。不要使用通用占位符。

## Template

```
## Task Complete

### 背景 (from plan)
[复制 plan 的背景 section] → **[ACHIEVED / PARTIALLY ACHIEVED / NOT ACHIEVED]**
[1 sentence explaining why — reference verification evidence]

### Tasks Completed
| Task | Name | Status |
|------|------|--------|
| Task 1 | [name from plan] | ✅ Completed |
| Task 2 | [name from plan] | ✅ Completed |

### Changes Made (plan vs actual)
| Planned (from 涉及文件汇总) | Actual | Status |
|-------------------------------|--------|--------|
| `path/to/file1` — Modify [what] | Modified as planned | ✅ Match |
| `path/to/file2` — Create [purpose] | Created as planned | ✅ Match |
| (unplanned) | `path/to/file3` — [why] | ⚠️ Scope drift |

### Validation & Regression Results (Step 4)
- Layer 1 (per-task): All tasks validated → PASS
- Layer 2 (project-wide): Build: PASS | Lint: PASS | Test: PASS
- Layer 3 (plan regression): [list each 验证方式 command and result]

### Functional Verification Results (Step 5)
- Server started: YES
- Plan Goal verified: [YES/NO — how]
- Scenarios: [N] designed, [N] passed
- Evidence: [summary of what was verified]

### Scope Drift Warnings
[from context.json deviations, or "None — all changes within plan scope"]

### Lessons Recorded
- [aggregated lessons]

### Next Steps
1. Create PR
2. Commit to current branch
```
