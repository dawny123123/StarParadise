# 子代理委托模式

如何将任务执行委托给子代理以防止上下文爆炸。

## 为什么使用子代理

长任务会累积上下文 → 上下文压缩 → 丢失关键信息 → 代理困惑。子代理通过给每个任务一个全新上下文来解决这个问题。子代理完成后，其上下文被释放 —— 协调器只保留摘要。

实践中最常见的失败模式：协调器"就快速"直接开始编辑代码，而不是生成子代理。这总是会升级 —— 一次编辑变成五次，五次变成二十次，到那时上下文已被消耗，协调器失去了大局观。修复很简单：协调器为代码变更生成子代理，并且**绝不**在源文件上使用编辑/写入工具。

```
主代理（协调器）          子代理（执行器）
─────────────────────────  ─────────────────────
小上下文（~2K tokens）     每个任务全新上下文
规划、审批、收集            执行、验证
绝不写代码                 写所有代码
跨任务存活                 任务后释放
```

## 生成执行器

子代理提示词必须自包含 —— 它对项目没有任何上下文。在提示词中包含它所需的一切。

### 模型选择指南

| 任务类型 | 模型 | 理由 |
|-----------|-------|-----------|
| 快速修复（拼写错误、重命名） | 轻量级（haiku） | 快速、低成本 |
| 代码搜索 | 快速检索（flash） | 速度 > 深度 |
| 深度推理（重构） | 重量级（opus/codex） | 质量 > 速度 |
| 交叉审查 | 与执行器不同 | 避免盲点 |

### 执行器提示词模板

完整的执行器子代理提示词模板在 `agents/templates/executor-core.md#Coordinator Spawn Template` 中。通过读取计划文件填充所有 `[from plan]` 字段 —— 不要改写。

模板包括：背景、当前任务（含范围）、涉及文件、验证命令、先前经验、输出格式（JSON）和规则（包括写之前预验证）。

### Worktree 隔离子代理（复杂任务）

相同的提示词，但如果环境支持，使用 `isolation="worktree"`：

```
Agent(
  description="Execute: [short-task-name]",
  isolation="worktree",    # ← 如可用则优先，不支持则省略
  prompt="... (same as above) ..."
)
```

Worktree 隔离给子代理自己的仓库副本，防止任务失败时的部分变更影响主分支。并非所有环境都支持 —— 如果不可用，改用标准子代理。

### Worktree Bash 命令（完整生命周期）

协调器在 Step 3 中管理 worktree 的完整生命周期：

```bash
# 1. 创建隔离 worktree
git worktree add ../worktree-$TASK_ID -b task/$TASK_ID

# 2. 在 worktree 中执行 —— 传递 --project-root 以便任务状态保留在原仓库
 cd ../worktree-$TASK_ID
# ... executor subagent works here ...
# task_state.py calls use: --project-root "$ORIGINAL_PROJECT_ROOT"

# 3. 所有验证通过后 —— 合并回来
 cd "$ORIGINAL_PROJECT_ROOT"
git merge task/$TASK_ID --no-ff -m "task($TASK_ID): [summary]"

# 4. 清理
 git worktree remove ../worktree-$TASK_ID
git branch -d task/$TASK_ID
```

> `task_state.py` 已支持 worktree 模式的 `--project-root`。任务状态始终保留在原仓库中。

## 多任务模式

### 独立性检查

在决定并行 vs 顺序之前：
1. 比较 `files_to_modify` 列表 —— 有任何重叠 → 顺序
2. 检查任务是否触及具有相互依赖的同一架构层 → 顺序
3. 如果真正独立 → 并行

### 并行执行（独立任务）

```
# 在同一条消息中生成所有 —— 它们并发运行
Agent(description="Execute: add-logging", prompt="...", run_in_background=True)
Agent(description="Execute: fix-error-msgs", prompt="...", run_in_background=True)
Agent(description="Execute: update-readme", prompt="...", run_in_background=True)
```

每个都有自己的上下文、自己的状态目录、自己的验证。主代理保持精简。

### 顺序执行（依赖任务）

```
# 先执行 A
result_a = Agent(description="Execute: define-types", prompt="...")
# 读取结果，然后执行 B
result_b = Agent(description="Execute: implement-handler", prompt="...")
```

### 冲突任务（触及相同文件）

```
# 使用 worktree 隔离 —— 每个都有自己的仓库副本
Agent(description="Execute: refactor-auth", isolation="worktree", prompt="...", run_in_background=True)
Agent(description="Execute: add-oauth", isolation="worktree", prompt="...", run_in_background=True)
# 两者完成后合并结果
```

## 收集结果

每个子代理完成后，**协调器**从子代理响应中的 JSON 块读取其结果。然后协调器检查点状态：

```bash
python3 scripts/task_state.py checkpoint --task-id ${TASK_ID} --task-num N --summary "subagent summary"
```

协调器的上下文现在只包含**摘要**，而不是 50+ 次执行详情的工具调用。

**如果成功** → 继续完成。
**如果失败或被阻塞** → 决定：
- 可修复？ → 用阻塞上下文生成新子代理（再次全新上下文）
- 需要用户输入？ → 用阻塞详情上报用户
- 方法错误？ → 回到规划（重新规划）

## 动作验证循环（AutoHarness 模式）

来自 [AutoHarness](https://arxiv.org/abs/2603.03329) 的一个关键洞察：78% 的代理失败来自"非法移动" —— 违反环境规则的动作。与其仅在验证时捕获这些（执行后），Propose-Verify-Refine 模式在执行前捕获它们，节省上下文和时间。

### 为什么预验证很重要

| 方法 | 何时捕获错误 | 上下文成本 | 恢复工作量 |
|----------|------------------|-------------|-----------------|
| 仅执行后 | 代码写入后 | 高（撤销变更） | 高（重写） |
| **预验证** | 代码写入前 | 低（重新规划） | 低（选择替代方案） |

对于中等/复杂任务，差异巨大：在写入 50 行代码之前捕获的层违规修复成本约为 ~2 次工具调用。写入后捕获的相同违规需要 ~10 次工具调用来撤销和重写。

### 执行前验证模式

子代理应在执行重大动作前进行验证：

```python
# 在新位置创建文件前
result = subprocess.run(
    ["python3", "scripts/verify_action.py", "--action", f"create file {filepath}", "--json"],
    capture_output=True, text=True
)
verification = json.loads(result.stdout)

if not verification["valid"]:
    # 不要创建文件 —— 使用拒绝原因重新规划
    # rejection_reason 和 fix_suggestions 告诉你该做什么
    pass
```

### 何时验证

不是每个动作都需要预验证 —— 那会是无益的开销。在以下情况验证：

| 动作 | 验证？ | 为什么 |
|--------|---------|-----|
| 在 `internal/` 或 `pkg/` 中创建文件 | **是** | 层放置很重要 |
| 添加新导入 | **是** | 层违规是 #1 失败原因 |
| 修改 `AGENTS.md`、`ARCHITECTURE.md` | **是** | 受保护/关键文件 |
| 编辑现有函数体 | 否 | 已经在正确的层 |
| 添加测试文件 | 否 | 测试没有层约束 |
| 跨目录重命名/移动文件 | **是** | 可能跨越层边界 |

### 集成到标准子代理提示词

将此添加到子代理的 "Your Job" 部分，用于中等及以上任务：

```markdown
## 动作验证（结构变更）
Before creating files in new locations or adding cross-package imports:
1. Run: python3 scripts/verify_action.py --action "your proposed action" --suggest
2. If VALID → proceed
3. If INVALID → read the fix_suggestions and choose an alternative approach
4. Log the rejection to harness/trace/failures/ for future harness improvement
```

### 用于 Critic 分析的失败日志

当动作被拒绝（由预验证或后验证），记录它：

```json
{
    "timestamp": "2026-03-24T10:30:00Z",
    "failure_type": "verify",
    "error_message": "Layer violation: L0 (internal/types) cannot import L2 (internal/core)",
    "file_path": "internal/types/user.go",
    "attempted_fix": "Moved dependency to constructor parameter",
    "outcome": "fixed"
}
```

保存到 `harness/trace/failures/YYYY-MM-DD.jsonl`（每行一个事件）。Harness Critic 脚本（`harness-evolver/scripts/harness_critic.py`）定期分析这些日志以建议 harness 改进。

### Critic → Refiner 流水线

一批任务执行后，Critic 分析失败模式。这由 `harness-evolver` 处理（由执行器第 6 步自动触发）：

```bash
# 由 harness-evolver 运行，而非直接由执行器
# python3 "$SKILL_DIR/scripts/harness_critic.py" --json --output harness/trace/critic-report.json
#（此处 SKILL_DIR 指 harness-evolver 的目录）

# 报告包含：
# - 检测到的模式（重复的层违规、模糊错误等）
# - 根因假设
# - 建议的修复（更新层图、改进错误消息、添加规则）
# - 优先级排序（P0-P3）
```

协调器可以使用此报告来决定是否在继续更多任务之前调用 `harness-creator` 进行 harness 改进。

---

## 子代理内部的上下文管理

子代理执行器应遵循以下节奏：

- **每 10 次工具调用**：快速心智检查点 —— 我还在正轨上吗？
- **每 20 次工具调用**：在响应中写一个简短的进度说明（协调器将提取此内容用于检查点）
- **每个阶段完成**：返回 JSON 结果块

协调器读取子代理的响应并调用 `task_state.py checkpoint` —— 子代理本身从不管理状态。

## 示例：三任务工作流

```
User: "1) Add logging to auth, 2) Fix API error messages, 3) Update README"
```

**协调器分析：**
- 任务 1：3-4 个文件，认证模块
- 任务 2：5 个文件，API 层
- 任务 3：1 个文件，README

**独立性检查：** 认证 vs API → 不同层 ✓，README → 仅文档 ✓

**执行：**
```
# 全部独立 → 并行化
Agent(description="Execute: add-auth-logging", ..., run_in_background=True)
Agent(description="Execute: fix-api-errors", ..., run_in_background=True)
Agent(description="Execute: update-readme", ..., run_in_background=True)
```

**结果：** 每个子代理在隔离上下文中使用 20-40 次工具调用，协调器总共使用 ~10 次。
