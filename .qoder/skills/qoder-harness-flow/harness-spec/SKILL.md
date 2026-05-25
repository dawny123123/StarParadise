---
name: harness-spec
description: "通过多轮交互分析生成结构化需求规格。生成三层规格产物（spec/tasks/acceptance），harness-executor 可以机械执行。当用户要求实现功能、修复 bug 或进行任何代码更改时使用。"
---

# Harness Spec

生成结构化需求规格：设置 → 分析 → 多轮交互 → 初始化 TASK_ID → 交接给 executor。

> **核心哲学**："AI 是需求工程师，不是提问机器。" 先分析，推荐完整方案，然后让用户确认或调整。

> **架构原则**：harness-spec 是 spec → executor → recorder 链中的第一个 Skill。它生成结构化规格产物、初始化任务状态、交接给 harness-executor。它从不编写代码或运行测试。

## 术语

- **Spec**：`docs/exec-specs/<slug>/` 目录，包含 3 个产物文件
- **Artifact**：spec.md、tasks.md、acceptance.md 之一
- **Round**：一个交互周期（AI 推荐 → 用户确认/调整）
- **Slug**：URL 友好的任务名称（例如 `fix-batch-update-timeout`）

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`python3 "$SKILL_DIR/scripts/xxx.py"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

---

## 执行流程

每个任务遵循相同的步骤。**无例外，无捷径。**

```
COORDINATOR
═══════════════════════════════════════════

 1. SETUP      引导 → 检查中断 → 查询记忆 → 加载上下文
 2. CLASSIFY   任务分类（简单/标准/复杂）
 3. ANALYZE    代码分析 → 代码分析报告
 4. INTERACT   Round 1-N: 推荐 → 用户确认 → 编写产物
 5. REVIEW     自检所有 3 个产物
 6. INIT       task_state.py init → 生成 TASK_ID
 7. HANDOFF    询问用户确认 → 调用 harness-executor

═══════════════════════════════════════════
```

> ⛔ **阻塞**：你必须在调用 `task_state.py init` 之前生成所有 3 个产物并获得用户批准。AskUserQuestion 是主要交互工具。

---

## Step 1: 设置

### 1.1 引导 Harness

```bash
test -f AGENTS.md && echo "HARNESS_EXISTS=true" || echo "HARNESS_EXISTS=false"
```

如果 `HARNESS_EXISTS=false`：先调用 `Skill(skill="harness-creator")`。

### 1.2 检查中断任务

```bash
python3 "$SKILL_DIR/scripts/task_state.py" list
```

清理过期孤儿任务（>7 天 in_progress）：

```bash
python3 "$SKILL_DIR/scripts/task_state.py" sweep --project-root "$PROJECT_ROOT" --stale-days 7
```

如果 `in_progress` 任务与当前请求匹配 → 检查 `spec_path` 处的规格目录是否存在，从上次中断处恢复。

### 1.3 查询记忆（智能召回）

两层记忆召回，含智能评分。

**情景——智能召回**：
1. 从用户任务描述中提取 3-5 个关键词（技术术语 + 业务概念）
2. 设置 `TASK_KEYWORDS` 变量（逗号分隔）
3. 调用 `memory_query.py recall` → 返回按 `recall_score` 排名的前 10 个 episode
4. `recall_score = recency * 0.3 + friction * 0.3 + correction * 0.2 + file_overlap * 0.2`

**知识——完整加载**：
- 读取 `harness/memory/knowledge/*.json` 中的所有文件（architecture、conventions、domain、tech_stack）
- 所有读取用 `2>/dev/null` 包装——缺失文件 = 跳过，不是错误

> `references/setup-scripts.md#Memory Query Script` 获取完整 bash 脚本。

### 1.4 加载上下文

读取：`AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`。提取：构建/测试/lint 命令、层结构、现有模式。

---

## Step 2: 任务分类（强制）

输出此决策表：

| 标准 | 值 | 简单？ |
|------|-----|--------|
| 修改文件 | [列表] | [1 个文件？是/否] |
| 新文件 | [列表/无] | [无？是/否] |
| 跨层更改 | [是/否] | [否？是/否] |
| 单个 diff | [是/否] | [是？是/否] |
| 安全/认证/DB | [是/否] | [否？是/否] |

**分类**：[简单/标准/复杂] — **理由**：[必需]

| 复杂度 | 标准 | 交互轮次 | 规格深度 |
|--------|------|----------|----------|
| **简单** | 全部 5 项 = 是 | 1 轮（spec.md + tasks 合并） | 轻量级 |
| **标准** | 任何 = 否 | 2 轮 | 完整 3 个产物 |
| **复杂** | 5+ 文件 / 架构 / 多阶段 | 2-3 轮 | 完整 3 个产物 + 详细技术方案 |

> ⚠️ **不确定时，向上分类。** 将标准误分类为简单会导致不完整的规格。

---

## Step 3: 分析需求（强制）

在交互前分析任务：读取相关代码 → 识别未知项 → 发现风险 → 草拟范围。

输出**代码分析报告** → `references/spec-interaction-guide.md#Code Analysis Report Format`

> 读取 ARCHITECTURE.md → 追踪 1 层直接 imports → 检查循环依赖 → 停止。时间限制：<3 分钟。

---

## Step 4: 交互式规格生成（强制）

> ⛔ **阻塞**：你必须完成至少 1 轮用户交互。没有用户批准不要跳到 Step 6。

### 4.1 确定轮次策略

| 复杂度 | 轮次策略 |
|--------|----------|
| 简单 | Round 1: spec.md + tasks 合并确认 → 编写所有 3 个文件 |
| 标准 | Round 1: spec.md → Round 2: tasks + acceptance → 编写文件 |
| 复杂 | Round 1: spec.md → Round 2: tasks → Round 3: acceptance → 编写文件 |

### 4.2 执行轮次

每轮遵循**推荐 → 确认 → 编写**模式：

1. **推荐**：基于代码分析呈现你的完整推荐方案
2. **确认**：使用 AskUserQuestion，选项为"采用推荐 / 微调 / 重新分析"
3. **编写**：确认后，将产物写入 `docs/exec-specs/<slug>/`

> `references/spec-interaction-guide.md` 获取每轮详细的 AskUserQuestion 模板。

### 4.3 将产物写入磁盘

<HARD-GATE>
在对话中展示规格 ≠ 写规格。你必须将产物内容写入磁盘文件。
未写入磁盘的产物视为不存在，禁止进入 Step 5。
</HARD-GATE>

```bash
SLUG="<task-slug>"
SPEC_DIR="docs/exec-specs/$SLUG"
mkdir -p "$SPEC_DIR"
```

使用 `create_file` / `write_to_file` 工具编写每个产物。写入后验证：

```bash
for f in spec.md tasks.md acceptance.md; do
  test -f "$SPEC_DIR/$f" && echo "✅ $f 存在" || echo "❌ $f 未写入 — 停止"
done
```

> `references/spec-template-guide.md` 获取每个产物的强制格式。

### 4.4 最终批准

所有 3 个产物写入后，呈现最终批准：

> `references/spec-interaction-guide.md#Round 4: 最终审批` 获取 AskUserQuestion 模板。

| 用户选择 | 操作 |
|----------|------|
| **批准并执行** | 继续到 Step 5 |
| **审查更改** | 显示请求的产物详情、修改、重新批准 |
| **拒绝** | 返回 Step 3，重新分析 |

---

## Step 5: 自检（强制）

运行 `references/spec-template-guide.md#Self-Review 检查清单` 中的自检检查清单。继续前修复任何问题：

- [ ] 所有 3 个文件存在于磁盘（spec.md、tasks.md、acceptance.md）
- [ ] 任何文件中无 `[TODO]` / `[TBD]` / `<placeholder>`
- [ ] tasks.md 任务数 = acceptance.md 任务数
- [ ] 每个有代码更改的任务都有描述和代码块
- [ ] acceptance.md 有带 SHALL 约束的具体验证命令（不只是"run tests"）
- [ ] acceptance.md 有 `## 全局验证 (MANDATORY)` 部分，含编译验证

---

## Step 6: 初始化任务状态

```bash
SPEC_DIR="docs/exec-specs/$SLUG"
PLAN_PATH="$SPEC_DIR/tasks.md"

TASK_ID=$(python3 "$SKILL_DIR/scripts/task_state.py" init "<task-name>" \
  --tasks <N> \
  --description "<description>" \
  --complexity "<trivial|standard|complex>" \
  --plan-path "$PLAN_PATH" \
  --spec-path "$SPEC_DIR" \
  --trivial-reason "<justification if trivial>")
echo "任务 ID: $TASK_ID"
```

> `task_state.py` 强制执行：所有任务都需要 `--plan-path`。`--trivial-reason` 在 `--complexity=trivial` 时**必需**。

---

## Step 7: 交接给 Executor

输出交接消息并**等待用户确认**再调用 executor：

```
✅ 规格完成
- TASK_ID: $TASK_ID
- 规格目录: docs/exec-specs/$SLUG/
- 产物: spec.md, tasks.md, acceptance.md
- 任务: <N> 个
- 分类: <简单/标准/复杂>

准备就绪，是否开始执行？
```

**不要自动调用 executor。** 等待用户显式确认（例如，"开始"、"执行"、"go"、"yes"）后再调用：

```
调用: Skill(skill="harness-executor")
```

> Executor 将读取 task.json（状态文件，`harness/tasks/<id>/state/task.json`），找到 `spec_path`，加载 tasks.md（执行计划，`docs/exec-specs/<slug>/tasks.md`）+ acceptance.md，然后开始执行。
>
> 注意：task.json 是 JSON 状态文件，tasks.md 是 Markdown 计划文件——两者不要混淆。task.json 的 `plan_path` 指向 tasks.md。

---

## 恢复协议

当 Step 1.2 发现带规格目录的中断任务时：

1. 检查 `$SPEC_DIR` 中存在哪些产物
2. 从第一个缺失的产物恢复
3. 如果所有产物存在但 init 未调用 → 进入 Step 6
4. 如果 init 已调用 → 交接给 executor（它有自己的恢复机制）

---

## 参考文件

| 文件 | 步骤 | 内容 |
|------|------|------|
| `agents/code-analyzer.md` | 3 | 代码分析子代理提示词（影响分析、风险评估、复杂度） |
| `agents/memory-recall.md` | 1.3 | 记忆召回子代理提示词（召回评分、知识加载） |
| `references/spec-template-guide.md` | 4.3, 5 | 三个产物格式模板（spec.md、tasks.md、acceptance.md）、自检检查清单 |
| `references/spec-interaction-guide.md` | 4.2 | 每轮 AskUserQuestion 模板、交互策略 |
| `references/setup-scripts.md` | 1.3 | 记忆查询脚本 |
| `scripts/task_state.py` | 6 | 任务状态管理（本 Skill 仅使用 `init` 命令） |
