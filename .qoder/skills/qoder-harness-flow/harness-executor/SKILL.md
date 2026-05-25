---
name: harness-executor
description: "从结构化规格执行开发任务并自我验证。读取 harness-spec 生成的规格产物（tasks.md + acceptance.md），生成子代理进行代码更改，运行四层验证，然后交接给 harness-recorder。纯执行引擎——不生成规格，不记录。"
---

# Harness Executor

从规格执行开发任务：加载 → 执行 → 验证 → 核查 → 交接给 recorder。

> **核心哲学**："Agent Harness 是操作系统。LLM 只是 CPU。" 通过自动化检查机械地验证你的更改，而非寄希望于运气。

> **架构原则**：**Coordinator 管理状态，Subagent 执行代码。** Coordinator 生成子代理进行代码更改和验证。子代理从不调用 task_state.py——它返回 JSON 结果，只有 coordinator 基于该结果调用 task_state.py。

> **范围边界**：Executor 不生成规格（harness-spec 的工作）也不记录 episode（harness-recorder 的工作）。它读取规格、编写代码、运行验证，然后交接。

## 术语

- **Spec**：`docs/exec-specs/<slug>/` 目录，含 3 个产物文件（spec.md、tasks.md、acceptance.md），由 harness-spec 生成
- **Task**：tasks.md 中的每个 `## Task N` 是一个执行单元
- **Step**：执行流程中的一个阶段（加载/执行/验证/核查/交接）
- **Coordinator**：管理状态和生成子代理的主代理
- **Subagent**：从干净上下文执行代码的一次性代理

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`python3 "$SKILL_DIR/scripts/xxx.py"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

---

## 执行流程

每个任务遵循相同的五步。**无例外，无捷径。**

```
COORDINATOR
═══════════════════════════════════════════

 1. LOAD       读取 task.json → 加载规格产物 → 加载上下文
 2. EXECUTE    [复杂: worktree] → 对每个 Task N: 生成 executor → Layer 1 验证 → 标记复选框 ✓ → checkpoint
 3. VALIDATE   (阻塞) 项目级构建/lint/测试 → acceptance.md 全局验证 (强制) → 记录失败
 3.5 REVIEW    [复杂/安全: 跨模型 review] → 记录重复模式
 4. VERIFY     (阻塞) 生成 verifier 子代理 → 功能验证 → 记录失败
 5. HANDOFF    (仅在 Steps 3+4 通过后) 输出执行摘要 → 询问用户确认 → 调用 harness-recorder

═══════════════════════════════════════════

四层验证：
  Layer 1 (每任务):    Step 2 循环，命令来自 acceptance.md
  Layer 2 (项目级):    Step 3，命令来自 DEVELOPMENT.md (build/lint/test)
  Layer 3 (回归):      Step 3 在 Layer 2 之后，命令来自 acceptance.md 全局验证部分
  Layer 4 (功能):      Step 4 通过 verifier 子代理
```

> ⚠️ **关键**：Steps 3 和 4 对所有任务都是**强制**的。静态验证证明代码能编译。功能验证证明代码*能工作*。永远不要跳过 Step 4。

---

## Step 1: 加载

### 1.1 读取任务状态

```bash
python3 "$SKILL_DIR/scripts/task_state.py" show --json
```

从 task.json 读取：
- `TASK_ID`：全局唯一任务标识符
- `spec_path`：规格目录路径（例如 `docs/exec-specs/fix-batch-timeout/`）
- `plan_path`：tasks.md 路径（如果未设置 `spec_path` 则作为后备）
- `total_tasks`：要执行的任务数
- `status`：应为 `in_progress`

> 如果 `task.json` 不存在：报告错误"请先运行 harness-spec 生成 spec"并退出。

### 1.2 加载规格产物

```bash
SPEC_DIR=$(python3 -c "import json; d=json.load(open('harness/tasks/current/state/task.json')); print(d.get('spec_path', ''))")
# 如果未设置 spec_path，则后备到 plan_path 目录
if [ -z "$SPEC_DIR" ]; then
  PLAN_PATH=$(python3 -c "import json; d=json.load(open('harness/tasks/current/state/task.json')); print(d.get('plan_path', ''))")
  SPEC_DIR=$(dirname "$PLAN_PATH")
fi
```

仅加载 executor 需要的内容：
- **tasks.md**：带复选框进度的任务列表，每个任务有文件路径、描述和代码预览
- **acceptance.md**：带 SHALL 约束的验证命令、预期输出、边界情况、强制全局验证

> Executor 不加载 spec.md——那是规格生成阶段和人类上下文专用的。这减少上下文窗口使用。

### 1.3 加载项目上下文

读取：`AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`。提取：构建/测试/lint 命令、验证脚本路径。

### 1.4 检查恢复

如果 `context.json` 有 `task_checkpoints`，找到第一个未 checkpoint 的任务并从那里恢复。

```bash
python3 "$SKILL_DIR/scripts/task_state.py" show --task-id "$TASK_ID" --json
```

---

## Step 2: 执行

> ⛔ **前置条件检查**：进入此步骤前，验证：
> - [ ] task.json 存在且 TASK_ID 有效
> - [ ] 规格产物已加载（tasks.md + acceptance.md 可读）
> - [ ] DEVELOPMENT.md 已加载（构建/测试命令可用）
>
> 如果任何检查失败，**报告错误并退出**。

生成一个 executor 子代理来进行代码更改。**Coordinator 从不直接编写代码。**

> ⛔ **阻塞**：Executor 子代理在任何情况下都**绝不**调用 `task_state.py`。它返回 JSON 结果。只有 coordinator 基于该结果调用 `task_state.py`。

### 执行前验证（结构性操作）

生成 executor 子代理前，检查任务是否涉及结构性操作（在新位置创建文件、添加跨包 imports）。如果是，预验证：

```bash
python3 "$SKILL_DIR/scripts/verify_action.py" --action "create file path/to/new.go" --json
python3 "$SKILL_DIR/scripts/verify_action.py" --action "import pkg/B from pkg/A" --json
```

规则：
- 在现有包中创建文件：跳过（无结构性风险）
- 修改现有文件体：跳过
- 在新位置创建新文件或跨包 import：必须预验证
- 如果无效：在生成 executor 前调整执行方法

### 模型选择

快速修复 → 轻量模型 | 代码搜索 → 快速检索 | 深度推理 → 重量级模型 | 交叉 review → **与 executor 不同**的模型

### 任务门控执行（多任务）

```
对 tasks.md 中的每个 Task N：
  0. 预验证结构性操作（如果 Task 涉及新文件或跨包 imports）
  1. 仅生成 Task N 范围的 executor 子代理（读取 executor-core.md 模板，从规格填充）
  2. Executor 返回 "success" 时：coordinator 验证（Layer 1——使用 acceptance.md Task N 标准）
     - 如果 Layer 1 失败 → coordinator 生成新的 executor，附带错误输出 + "修复此特定失败"
     - 每个任务最多 2 次 Layer 1 重试，然后标记任务为 FAILED 并上报用户
  3. Layer 1 通过时：
     a. 在 tasks.md 中标记复选框：`- [ ]` → `- [x]`（立即，在其他任何事之前）
     b. 通过 task_state.py checkpoint Task N
  4. 然后才继续 Task N+1
```

⛔ **阻塞**：Coordinator 在 Task N 复选框被标记**且**checkpoint 之前不得生成 Task N+1。
⛔ **阻塞**：标记复选框（`- [x]`）不是可选的——它是用户和其他 Skill 依赖的可见进度指示器。

### Worktree 隔离（仅复杂任务）

| 复杂度 | Worktree？ |
|--------|-----------|
| 简单 / 标准 | 否 |
| 复杂 | **是** — 始终隔离 |

> `references/subagent-patterns.md#Worktree Bash Commands` 获取生命周期命令。

### Executor 子代理提示词

填充 `[from spec]` 占位符，通过读取 tasks.md。不要改写。

> `agents/templates/executor-core.md#Coordinator Spawn Template` 获取完整提示词模板。

### Checkpoint（成功返回 executor 后）

```bash
python3 "$SKILL_DIR/scripts/task_state.py" checkpoint \
  --task-id "$TASK_ID" --task-num <N> \
  --summary "<task summary>" --files-changed <file1> <file2> \
  --decisions '["key decisions"]'
```

### 失败处理

| 子代理状态 | 操作 |
|-----------|------|
| `success` | 继续到 Layer 1 验证 |
| `failed` | 生成新的 executor，附带额外上下文：粘贴失败 executor 的 `validation_output` + `blockers` 到新提示词中作为"Previous attempt failed. Fix this: [exact error]"。最多 2 次重试。 |
| `blocked` | 将子代理 JSON 结果中的 `blockers` 字段上报用户 |

---

## Step 3: 验证（静态 + 回归）

代码更改后运行验证。Layers 2 和 3 在所有任务完成后运行。

**Layer 1 — 每任务（在 Step 2 循环内）：**
每个任务的 executor 返回 `success` 后，coordinator 使用 acceptance.md Task N 标准进行验证。如果验证失败，coordinator 生成新的 executor，附带确切错误输出。每个任务最多 2 次重试。如果仍失败 → 标记任务 FAILED，记录到 `harness/trace/failures/`，上报用户。

**Layer 2 — 项目级（所有任务完成后）：** 如果存在则运行 `scripts/validate.py .`，否则运行 `<build> && <lint> && <test>`。

**Layer 2 Web 应用条件检查（在 Layer 2 之后、Layer 3 之前）：**

如果项目是 Web 应用（检测信号：存在 `scripts/run-api-tests.sh` 或 `docs/api.md`），运行以下条件检查：

1. **编码规范检查**：如果 `scripts/code-review-check.sh` 存在，运行 `bash scripts/code-review-check.sh`。仅阻塞**新增**违规，历史违规记录为警告。参考 `references/code-convention-guide.md`。

2. **DDL 一致性检查**：如果 `scripts/check-db-consistency.sh` 存在，运行 `bash scripts/check-db-consistency.sh`。如果任务变更不涉及 Entity/DDL，DDL 检查失败记录为警告而非阻塞。参考 `references/ddl-consistency-guide.md`。

**Layer 2.5 — 变异测试突击检查（可选）：**

仅在以下条件**同时满足**时执行：
- 用户明确要求，**或**任务涉及安全/认证/核心 Service 变更
- 项目 Makefile 包含 `mutation-test` target 或有 `scripts/mutation-spot-check.sh`
- Layer 1 和 Layer 2 已通过

运行 `make mutation-test` 或 `bash scripts/mutation-spot-check.sh`。变异测试结果是**建议性**的，不阻塞执行流程。参考 `references/mutation-test-guide.md`。

**Layer 3 — 规格回归（强制，所有任务完成后）：** 运行 acceptance.md `## 全局验证 (MANDATORY)` 部分中的每个命令。Executor 必须执行此部分中的所有命令。Executor 在所有全局验证命令通过之前不得声明任务完成或继续到 Step 4。如果任何命令失败，报告错误并尝试修复（返回 Step 2），最多 2 次重试然后上报用户。

> 所有必需层都必须在 Step 4 之前通过。Layer 2 通过但 Layer 3 失败意味着通用检查通过但任务特定要求失败。Layer 2.5（变异测试）是可选建议性的，不阻塞。

如果静态验证失败：记录失败（`references/validation-guide.md#Failure Recording Template`），分析，返回 Step 2，最多 2 次重试然后上报。

---

## Step 3.5: 跨模型 Review（复杂 + 安全任务）

使用**与 executor 不同**的模型来捕获盲点。

| 复杂度 | Review 需要？ |
|--------|--------------|
| 简单 | 跳过 |
| 标准 | 可选（核心逻辑推荐） |
| 复杂 / 安全/认证/DB | **强制** |

生成 reviewer 子代理（不同模型），读取 `$SKILL_DIR/agents/reviewer.md`，附带：任务描述、executor 模型、git diff、ARCHITECTURE.md 层表、规格内容。

| 裁决 | 操作 |
|------|------|
| `approve` | 继续到 Step 4 |
| `changes_requested` | 返回 Step 2，最多 1 次重试 |

将 `recurring_patterns` 记录到 `harness/trace/review-patterns.jsonl`。

---

## Step 4: 核查（功能）— 强制

> ⚠️ **此步骤对所有任务都是强制的。** 在完成核查之前不要跳到 Step 5。

静态检查仅证明代码能编译。功能验证证明代码*能工作*。

### 4.1 设计验证场景

从 acceptance.md 设计，每个任务至少 2 个场景：
1. **acceptance.md 验证命令** → 基线场景（运行列出的每个命令）
2. **spec.md 目标** → 至少 1 个证明目标达成的场景（从 acceptance.md 读取，而非直接读取 spec.md）
3. **每个 Task 的代码块** → 验证预期更改是否到位
4. **更改类型场景**（每种更改至少 1 个）：
   - 新端点/功能：测试成功场景 + 至少 1 个错误场景
   - 修改端点/功能：测试新行为 + 验证旧行为仍有效
   - Bug 修复：测试特定 bug 是否已修复
   - 安全/认证/权限更改：测试授权 + 未授权访问

**Web 应用增强场景**（如果是 Web 应用且存在 API 测试脚本）：
5. **API 接口测试**：如果 `scripts/run-api-tests.sh` 存在，优先使用 API 测试替代或增强冒烟测试。参考 `references/api-test-guide.md`。
   - 新增 API 端点 → 在 API 测试脚本中添加对应测试
   - 修改 API 行为 → 验证新行为 + 旧行为兼容性
   - 废弃 API 端点 → 验证废弃响应
6. **API 文档同步**：如果任务涉及 API 变更，验证 `docs/api.md` 已同步更新

> `references/scenario-design-guide.md` 获取模式。

### 4.2 生成 Verifier 子代理

填充 `[from spec]` 占位符，通过读取 acceptance.md。不要改写。

> `agents/templates/verifier-core.md#Coordinator Spawn Template` 获取完整提示词模板。

### 4.3 处理 Verifier 结果

| 结果 | 操作 |
|------|------|
| `pass` | 继续到 Step 5 |
| `partial` | 修复任务相关失败场景，将无关记录为警告 |
| `fail` | 记录失败，返回 Step 2，最多 2 次重试，然后上报到 **Step 5-F** |

### 4.4 如果验证无法运行

验证仅在以下情况跳过：(1) 项目是没有可运行入口点的库，且 (2) environment.json 中没有启动命令，且 (3) 所有 3 次引导尝试失败。Web 服务和 CLI 工具必须有验证。

> `references/validation-guide.md#Verification Skip Report` 获取跳过报告模板。

---

## Step 5: 交接给 Recorder

> ⛔ **前置条件检查**：进入此步骤前，验证：
> - [ ] tasks.md 中所有任务都标记为 `- [x]`（或显式 FAILED）
> - [ ] Layer 2（项目级构建/lint/测试）通过
> - [ ] Layer 3（acceptance.md 全局验证 强制）通过 — 所有命令已执行
> - [ ] Layer 4（功能验证）通过或记录了跳过原因
>
> 如果任何检查失败，**返回相应步骤并修复**。除非重试次数用尽，否则不要带着未解决的失败交接。

### 5.1 执行摘要

为 recorder 收集执行数据：
- 所有任务中更改/创建的文件（来自 checkpoints）
- 验证结果（Layer 1-4 状态）
- 遇到的任何失败和使用的重试次数
- 验证报告

### 5-F 失败交接

任务在最大重试后失败时：
- 仍然交接给 recorder（它将调用 `task_state.py fail` 而非 `complete`）
- 在交接上下文中包含失败原因和尝试的修复

### 5.2 交接前检测模式

**交接给 recorder 前，检测当前模式：**

```bash
MODE=$(python3 "$SKILL_DIR/scripts/task_state.py" detect-mode --json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('mode','CDD'))")
```

| 模式 | 操作 |
|------|------|
| **SDD** | 继续标准交接 → 询问用户确认 → `Skill(skill="harness-recorder")` |
| **CDD** | 任务在 CDD 模式下创建（无规格）。仍然交接给 recorder，但 recorder 将使用 CDD 工作流。 |

> **注意**：Executor 不应在 MODE=CDD 时失败。Recorder 自动处理 SDD 和 CDD。

### 5.3 询问用户确认后再调用 Recorder

输出执行摘要并**等待用户确认**再调用 recorder：

```
✅ 验证通过
- TASK_ID: $TASK_ID
- 完成 Tasks: N/M
- 验证状态: Layer 1 ✓ | Layer 2 ✓ | Layer 3 ✓ | Layer 4 ✓
- 文件变更: [count] files changed, [count] files created

是否归档？
```

**不要自动调用 recorder。** 等待用户显式确认（例如，"归档"、"是"、"go"、"yes"）后再调用：

调用：`Skill(skill="harness-recorder")`

> Recorder 读取相同的 task.json，计数交互，记录 episode，归档规格，触发 evolver。

---

## 恢复协议

当 Step 1.4 发现 checkpoint 数据时：

1. 检查外部更改：
   ```bash
   git diff --name-only
   ```
2. 读取 `context.json` → 找到第一个不在 `task_checkpoints` 中的任务 → 验证其前置条件 → 进入 Step 2。
3. Step 5 交接时，recorder 将包含任何恢复相关的交互数据。

---

## 参考文件

| 文件 | 步骤 | 内容 |
|------|------|------|
| `agents/templates/executor-core.md` | 2 | Executor 生成模板 |
| `agents/templates/verifier-core.md` | 4.2 | Verifier 生成模板 |
| `agents/verifier.md` | 4.2 | Verifier 子代理协议 |
| `agents/reviewer.md` | 3.5 | Reviewer 子代理检查清单 |
| `references/scenario-design-guide.md` | 4.1 | 场景设计模式 |
| `references/functional-verification-guide.md` | 3-4 | 静态 → 功能架构 |
| `references/environment-schema.md` | 1.3 | 契约：启动、服务、env_vars |
| `references/validation-guide.md` | 3 | 验证顺序、失败/跳过模板 |
| `references/state-management.md` | 1 | task.json/context.json/checkpoint 模式 |
| `references/subagent-patterns.md` | 2 | 子代理生成、worktree 命令 |
| `references/verify-schema.md` | 4 | 验证场景模式 |
| `references/verification-guide.md` | 4 | 功能验证设计 |
| `references/task-verification-guide.md` | 4.1 | 任务特定验证模式 |
| `references/ddl-consistency-guide.md` | 3 | Web 应用 DDL/Entity 一致性验证 |
| `references/api-test-guide.md` | 4 | Web 应用 API 接口测试验证 |
| `references/mutation-test-guide.md` | 3 | 变异测试突击检查 |
| `references/code-convention-guide.md` | 3 | 编码规范检查 |
| `references/self-review-guide.md` | 3.5 | 提交前自检清单 |
| `scripts/verify_action.py` | 2 | 结构性操作的执行前验证 |
