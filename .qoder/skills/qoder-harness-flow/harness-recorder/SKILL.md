---
name: harness-recorder
description: "记录执行结果、归档规格并触发进化。计数交互、通过 task_state.py 编写 episode、归档已完成的规格、条件满足时触发 harness-evolver。在 harness-executor 完成或失败后使用。"
---

# Harness Recorder

记录执行结果：计数交互 → 记录 episode → 归档规格 → 触发 evolver → 呈现结果。

> **核心哲学**："每次执行都产生数据。缺失数据会打断进化链。" Recorder 确保没有执行未被记录。

> **架构原则**：Recorder 是 spec → executor → recorder 链中的最后一个 Skill。它读取执行结果、准确计数交互、通过 `task_state.py` 记录 episode、条件满足时触发进化。它从不编写代码或修改规格。

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`python3 "$SKILL_DIR/scripts/xxx.py"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

---

## 执行流程

```
COORDINATOR
═══════════════════════════════════════════

 1. LOAD           读取 task.json → 确定成功/失败
 2. COUNT          扫描对话 → 计数交互（逐条列举）
 3. RECORD         task_state.py complete/fail (强制)
 4. ARCHIVE        将规格移至 completed/
 5. TRIGGER        检查 evolver 阈值 → 条件满足则调用
 6. PRESENT        向用户呈现结果摘要

═══════════════════════════════════════════
```

> ⛔ **阻塞**：Step 3（记录）不能跳过。`task_state.py complete` 是情景记忆的**唯一**入口点。跳过 = 进化链断裂。

---

## CDD 模式：对话驱动开发

> **CDD 模式** 适用于用户直接对话驱动代码修改、未经过 `harness-spec → harness-executor` 完整链路的场景。这是日常开发中最常见的模式。

### CDD vs SDD 检测

在 Step 1 开始前，检测当前任务的来源：

```bash
# 检查是否有活跃的 task.json
python3 "$SKILL_DIR/scripts/task_state.py" show --json 2>/dev/null
```

| 检测结果 | 模式 | 处理方式 |
|----------|------|----------|
| 有 task.json + `spec_path` 存在 | **SDD** | 走标准流程（Step 1.1–1.3） |
| 有 task.json 但无 `spec_path` | **CDD** | 走 CDD 适配流程（见下文） |
| 无 task.json | **CDD** | 先创建轻量级任务，再走 CDD 流程 |

### CDD 模式执行流程

当检测到 CDD 模式时，自动补充缺失的信息：

```
CDD RECORDER
═══════════════════════════════════════════

 0. DETECT    检查 task.json / spec_path → 确认 CDD 模式
 1. INIT      如无 task.json → task_state.py init --cdd-mode
 2. COLLECT   git diff → files_changed / files_created
 3. COUNT     扫描对话历史 → 计数 interactions（同 Step 2）
 4. EXTRACT   lesson_extractor.py → 自动提取 lessons 候选
 5. RECORD    task_state.py complete --structured-lessons ...
 6. TRIGGER   检查 evolver 阈值 → 触发
 7. PRESENT   输出结果摘要

═══════════════════════════════════════════
```

### CDD Step 0: 检测模式

**Agent 自检测命令**（每次执行 Recorder 前自动运行）：

```bash
python3 "$SKILL_DIR/scripts/task_state.py" detect-mode
```

输出示例（CDD 模式）：
```
💬 当前模式: CDD
   原因: no_spec_path
   任务: cdd-20260505-1430
   💡 使用 CDD 工作流: 调用 harness-recorder 进行完整记录
```

输出示例（SDD 模式）：
```
📋 当前模式: SDD
   原因: spec_path_exists
   规格: docs/exec-specs/fix-batch-timeout/
   任务: fix-batch-timeout-20260505-1030
   💡 使用 SDD 工作流: harness-executor → harness-recorder
```

JSON 输出（供脚本解析）：
```bash
python3 "$SKILL_DIR/scripts/task_state.py" detect-mode --json
# {"mode": "CDD", "reason": "no_spec_path", "current_task": "...", "recommendation": "..."}
```

**检测逻辑**：

```bash
# 尝试读取当前任务
TASK_JSON=$(python3 "$SKILL_DIR/scripts/task_state.py" show --json 2>/dev/null || echo "{}")

# 检测 spec_path
SPEC_PATH=$(echo "$TASK_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('task',{}).get('spec_path',''))" 2>/dev/null)

if [ -n "$SPEC_PATH" ] && [ -d "$SPEC_PATH" ]; then
  echo "MODE=SDD"
else
  echo "MODE=CDD"
fi
```

### CDD Step 1: 初始化轻量级任务（如需要）

如果没有活跃的 task.json，创建一个 CDD 专用任务：

```bash
# 生成任务描述（从对话主题推断，或询问用户）
TASK_NAME="cdd-$(date +%Y%m%d-%H%M)"

# CDD 模式允许无 plan-path 创建轻量级任务
python3 "$SKILL_DIR/scripts/task_state.py" init "$TASK_NAME" \
  --description "CDD session: $(git log -1 --pretty=format:%s 2>/dev/null || echo 'conversation-driven changes')" \
  --cdd-mode
```

### CDD Step 2: 从 Git Diff 收集文件

```bash
# 检测本次对话中的文件变更
FILES_CHANGED=$(git diff --name-only HEAD 2>/dev/null | tr '\n' ' ')
FILES_CREATED=$(git diff --name-status HEAD 2>/dev/null | grep '^A' | cut -f2 | tr '\n' ' ')

echo "Files changed: $FILES_CHANGED"
echo "Files created: $FILES_CREATED"
```

### CDD Step 3–4: 计数 + 提取（与 SDD 相同）

CDD 模式下，Step 3 (COUNT) 和 Step 4 (EXTRACT) 与 SDD 模式**完全相同**：
- 扫描完整对话历史计数 interactions（Step 2 信号词表）
- 用 `lesson_extractor.py` 自动提取 lessons 候选
- 人工 review 并确认 lessons 质量

### CDD Step 5: 使用自动检测数据记录

```bash
# 构建结构化 lessons（从 lesson_extractor.py 输出或人工整理）
STRUCTURED_LESSONS='{"decisions": [...], "conventions": [...], "pitfalls": [...], "patterns": [...]}'

# CDD 模式默认启用 strict-lessons，确保经验不被遗漏
python3 "$SKILL_DIR/scripts/task_state.py" complete \
  --task-id "$TASK_ID" \
  --summary "CDD: $(git log -1 --pretty=format:%s 2>/dev/null || echo 'conversation-driven changes')" \
  --files-changed $FILES_CHANGED \
  --files-created $FILES_CREATED \
  --friction '{"corrections": <N>, "takeovers": <N>, "retries": <N>}' \
  --structured-lessons "$STRUCTURED_LESSONS" \
  --strict-lessons
```

> **CDD 模式关键点**：
> - `--strict-lessons` 默认启用，强制记录 lessons（避免 CDD 模式下遗漏）
> - 无 `spec_path` 时跳过 Step 4 (ARCHIVE)
> - validation 字段可选（CDD 模式通常无 Layer 1-4 验证）

---

## Step 1: 加载执行上下文

### 1.1 读取任务状态

```bash
python3 "$SKILL_DIR/scripts/task_state.py" show --json
```

从 task.json 提取：
- `TASK_ID`：全局唯一任务标识符
- `spec_path`：规格目录路径
- `status`：`in_progress`（正常）或失败信息
- `task_checkpoints`：哪些任务已完成

### 1.2 确定结果

| Executor 交接 | Recorder 操作 |
|--------------|--------------|
| "验证通过，开始归档" | `outcome = success` → 使用 `complete` 命令 |
| "验证失败" 或 task FAILED | `outcome = failure` → 使用 `fail` 命令 |

### 1.3 收集执行数据

从 executor 的交接和 task.json 上下文：
- 更改/创建的文件（来自 checkpoints）
- 验证结果
- 失败原因（如有）
- 执行期间学到的教训

---

## Step 2: 计数交互（强制）

> ⛔ **阻塞**：你必须在调用 `complete` 或 `fail` **之前**审查**整个**对话历史并计数交互。不要默认为零——实际回读对话。

扫描本次对话中的每条用户消息（包括规格和执行阶段）以查找这些信号：

| 字段 | 信号词 / 事件 | 示例 |
|------|--------------|------|
| `corrections` | "不对", "改一下", "should be", "不要", "少写", "不能超过", "这样写不对", 用户纠正方法 | User: "不对，这样写不对，应该用xxx" → corrections = 1 |
| `interruptions` | 用户在子代理运行时发送消息, "等一下", "先看看", 日志中显示 "Interrupted" | 子代理执行显示 "Interrupted" → interruptions = 1 |
| `takeovers` | "算了我自己来", 用户直接编辑文件, `git diff` 显示意外更改 | 用户直接修改代码 → takeovers = 1 |
| `plan_revisions` | 规格/计划在规格阶段因用户反馈被重写/更新 | 用户说 "这样不对" 后重写规格 → plan_revisions = 1 |
| `retries` | Task N 失败并在执行期间重新生成 | Executor 失败，附带错误上下文重新生成 → retries = 1 |

将你的计数输出为检查清单。**每个计数必须列出每个实例**——不要估计或四舍五入：

```
交互审查：
- corrections: <N>
  - [turn X] 用户说 "不对，应该用xxx" → 1
  - [turn Y] 用户说 "这样写不对" → 1
- interruptions: <N>
  - [turn X] 用户打断子代理执行 → 1
- takeovers: <N>
  - [turn X] 用户直接编辑文件 → 1
- plan_revisions: <N>
  - [turn X] 用户说 "添加扫描批量插入" → 规格更新 → 1
  - [turn Y] 用户说 "性能问题也考虑" → 规格再次更新 → 1
- retries: <N>
  - (无)
```

> ⛔ **错误**：用户请求 2 个独立的规格更改时 `plan_revisions: 1` ← 你将它们合并为一个
> **正确**：将每个导致规格/计划更新的用户请求计为单独的修订

> `references/interaction-counting-guide.md` 获取详细的信号词和示例。

### Step 2.5: 生成结构化 Lessons（强制——增强版）

⛔ **关键**：此步骤不能跳过。空 lessons = 断裂的进化链。

**为何 lessons 重要**：Lessons 是 evolver 自学习的唯一输入。没有 lessons：
- Evolver 无法识别模式 → 无 Skill 进化
- 知识提取不产生任何内容 → 知识库无增长
- 未来任务无法从过去经验受益 → 重复错误

**生成 lessons 前，审查**：
1. 整个对话历史（所有轮次）
2. 所有代码更改（git diff）
3. 遇到的任何错误及修复方式
4. 用户纠正或反馈

**对每个类别，你必须提供至少 1 项或明确说明为何不适用**：

| 桶 | 必需？ | 来源 | 检测信号 |
|----|--------|------|----------|
| `decisions` | 是 | 对话中的设计选择 | "选择...", "决定...", "用 X 而不是 Y" |
| `conventions` | 是 | 观察到的编码模式 | "规范...", "约定...", "必须...", "always/never" |
| `pitfalls` | 是 | 错误、bug、用户纠正 | "不对", "错了", "改一下", "should be" |
| `patterns` | 是 | 可复用方案 | "统一用...", "最佳实践...", 成功的解决方案 |

**分类规则**：
- 执行期间的用户纠正 → `pitfalls`
- 包含 "规范/约定/必须/always/never" → `conventions`
- 包含 "选择/而非/instead of/over" → `decisions`
- 可复用方案或成功方法 → `patterns`

**质量标准**（由 task_state.py 强制执行）：
- 每条 lesson 必须 ≥ 10 字符
- 每条 lesson 必须是可操作的（不只是描述）
- 每条 lesson 必须是项目特定的（不是通用建议）
- 每个任务推荐 2-5 条 lessons（质量 > 数量）

**好的 lessons 示例**：
```json
{
  "decisions": ["选择 Redis 缓存而非本地缓存，因为多实例部署需要共享缓存"],
  "conventions": ["所有 API 使用 /data/api.json 统一入口"],
  "pitfalls": ["H2 和 MySQL DDL 必须同步，否则测试失败"],
  "patterns": ["批量操作统一用 BatchValidator 校验后再写入"]
}
```

**坏的 lessons 示例（不要这样做）**：
```json
{
  "decisions": [],  // ❌ 空且无理由
  "conventions": [],  // ❌ 空且无理由
  "pitfalls": [],  // ❌ 空且无理由
  "patterns": ["write good code"]  // ❌ 太通用（< 10 字符规则）
}
```

**如果确实没有适用的 lessons**（罕见），使用 `--structured-lessons` 并附带说明：
```json
{
  "decisions": ["No design decisions — straightforward implementation following existing patterns"],
  "conventions": ["Followed existing conventions without new discoveries"],
  "pitfalls": [],
  "patterns": []
}
```

### Step 2.6: 构建任务画像

从可用数据计算任务复杂度指标：

```json
{
  "complexity": "<trivial|standard|complex>",
  "modules_touched": ["<module1>", "<module2>"],
  "layers_touched": ["<layer1>", "<layer2>"]
}
```

**计算方式**：
- `complexity`：从 `task.json` 读取（初始化时设置）
- `modules_touched`：从 `files_changed` 提取顶层目录（例如 `src/auth/login.ts` → `src/auth`）
- `layers_touched`：识别受影响的层（例如 `controller`、`service`、`repository`、`config`、`test`）

---

## Step 3: 记录 Episode（强制）

<HARD-GATE>
Step 3 必须自动执行，无需等待用户指令。
必须调用 task_state.py complete 或 fail，不可跳过。
</HARD-GATE>

### 预检查

```bash
test -n "$TASK_ID" || echo "ERROR: TASK_ID 未设置"
test -f "harness/tasks/current/state/task.json" || echo "ERROR: 无活跃任务"
```

### 3.1 记录成功

> ⛔ **禁止**：不要手动构建 episode JSON 并写入 `harness/memory/episodes/`。`task_state.py complete` 是记录 episode 的**唯一**方式。

```bash
python3 "$SKILL_DIR/scripts/task_state.py" complete \
  --task-id "$TASK_ID" \
  --summary "Completed: <overall summary>" \
  --files-changed file1 file2 \
  --files-created new_file \
  --validation '{"build": "pass", "lint": "pass", "test": "pass"}' \
  --friction '{"corrections": <N>, "takeovers": <N>, "retries": <N>}' \
  --structured-lessons '{"decisions": [...], "conventions": [...], "pitfalls": [...], "patterns": [...]}' \
  --task-profile '{"complexity": "standard", "modules_touched": ["src/auth"], "layers_touched": ["controller", "service"]}'
```

> **新功能**：task_state.py 现在自动验证 lessons 质量：
> - ⚠️ 如果未记录 lessons 则显示**警告**（默认非阻塞）
> - ❌ 如果使用 `--strict-lessons` 标志且 lessons 为空则**阻塞**
> - 记录后显示**质量报告**（lessons 计数、friction 摘要）
>
> 使用 `--strict-lessons` 强制执行 lessons 要求（生产环境推荐）：
> ```bash
> python3 "$SKILL_DIR/scripts/task_state.py" complete \
>   --strict-lessons \
>   --structured-lessons '{"decisions": [...], ...}' \
>   ...
> ```
>
> 仅在例外情况下使用 `--skip-lessons-check`（不推荐）。

### 3.2 记录失败

当 executor 报告失败时：

```bash
python3 "$SKILL_DIR/scripts/task_state.py" fail \
  --task-id "$TASK_ID" \
  --summary "Failed: <what was attempted>" \
  --reason "<root cause of failure>" \
  --lessons '["lesson from failure 1", "lesson from failure 2"]' \
  --files-changed file1 file2 \
  --friction '{"corrections": <N>, "takeovers": <N>, "retries": <N>}' \
  --structured-lessons '{"decisions": [...], "conventions": [...], "pitfalls": [...], "patterns": [...]}' \
  --task-profile '{"complexity": "standard", "modules_touched": ["src/auth"], "layers_touched": ["controller", "service"]}'
```

> `fail` 同时写入 `harness/memory/episodes/<task_id>.json`（outcome="failure"）和 `harness/trace/failures/`。

---

## Step 4: 归档规格

### 4.1 将规格移至 Completed

```bash
SPEC_DIR=$(python3 -c "import json; d=json.load(open('harness/tasks/current/state/task.json')); print(d.get('spec_path', ''))")
if [ -n "$SPEC_DIR" ] && [ -d "$SPEC_DIR" ]; then
  mkdir -p docs/exec-specs/completed
  SLUG=$(basename "$SPEC_DIR")
  mv "$SPEC_DIR" "docs/exec-specs/completed/$SLUG"
  echo "✅ 规格已归档: docs/exec-specs/completed/$SLUG/"
fi
```

> 如果未设置 spec_path，记录警告："task.json 中无 spec_path — 跳过规格归档。"

---

## Step 5: 触发 Evolver（自动 + 监控）

通过计数**自上次进化以来的新任务**来检查 evolver 是否应运行，并执行监控。

### 5.1 计数新 Episode

```bash
WATERMARK_FILE="harness/trace/evolver-watermark.json"

read TASK_COUNT FAILURE_COUNT << EOF
$(python3 - << 'PY'
import json, glob, sys
from pathlib import Path
from datetime import datetime

last_run = ""
wm = Path("harness/trace/evolver-watermark.json")
if wm.exists():
    last_run = json.loads(wm.read_text()).get("last_run", "")

def parse_ts(s):
    s = s.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s)
    except Exception:
        return None

last_dt = parse_ts(last_run) if last_run else None

task_cnt = fail_cnt = 0

# 从独立的 .json 文件加载（新格式）
for fp in Path("harness/memory/episodes").glob("*.json"):
    try:
        ep = json.loads(fp.read_text())
    except (json.JSONDecodeError, OSError):
        continue
    ts = ep.get("timestamp", "")
    if last_dt:
        ep_dt = parse_ts(ts)
        if ep_dt and ep_dt <= last_dt:
            continue
    task_cnt += 1
    if ep.get("outcome") == "failure":
        fail_cnt += 1

# 旧版：从 .jsonl 文件加载
for fp in Path("harness/memory/episodes").glob("*.jsonl"):
    for line in fp.read_text().splitlines():
        if not line.strip():
            continue
        try:
            ep = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = ep.get("timestamp", "")
        if last_dt:
            ep_dt = parse_ts(ts)
            if ep_dt and ep_dt <= last_dt:
                continue
        task_cnt += 1
        if ep.get("outcome") == "failure":
            fail_cnt += 1

print(task_cnt, fail_cnt)
PY
)
EOF
```

### 5.2 触发决策

| 条件 | 操作 |
|------|------|
| `TASK_COUNT ≥ 3` 或 `FAILURE_COUNT ≥ 5` | 触发 evolver |
| 均不满足 | 跳过——自上次进化以来新数据不足 |

### 5.3 带监控的触发（增强版）

⛔ **关键**：触发 Evolver 后，验证它是否成功运行：

```bash
# 记录触发前状态
OLD_WATERMARK=$(python3 -c "import json; d=json.load(open('harness/trace/evolver-watermark.json')); print(d.get('last_run',''))" 2>/dev/null || echo "")
OLD_EPISODES_PROCESSED=$(python3 -c "import json; d=json.load(open('harness/trace/evolver-watermark.json')); print(d.get('episodes_processed','0'))" 2>/dev/null || echo "0")

echo "触发前状态:"
echo "  水印: ${OLD_WATERMARK:-'(无)'}}"
echo "  已处理 episode: $OLD_EPISODES_PROCESSED"

# 触发 evolver
Skill(skill="harness-evolver", args="--mode auto --project-root <root> --task-id <id> --trigger-reason <batch|failures>")

# 检查触发后状态（等待 evolver 完成）
sleep 2

NEW_WATERMARK=$(python3 -c "import json; d=json.load(open('harness/trace/evolver-watermark.json')); print(d.get('last_run',''))" 2>/dev/null || echo "")
NEW_EPISODES_PROCESSED=$(python3 -c "import json; d=json.load(open('harness/trace/evolver-watermark.json')); print(d.get('episodes_processed','0'))" 2>/dev/null || echo "0")

echo "触发后状态:"
echo "  水印: ${NEW_WATERMARK:-'(无)'}}"
echo "  已处理 episode: $NEW_EPISODES_PROCESSED"

# 验证水印是否已更新
if [ "$NEW_WATERMARK" = "$OLD_WATERMARK" ]; then
  echo "⚠️  警告: Evolver 已触发但水印未更新"
  echo "   可能原因:"
  echo "   - Evolver 在完成前崩溃"
  echo "   - Evolver 未发现数据可处理"
  echo "   - Evolver 已在运行（锁冲突）"
  echo ""
  echo "   记录到 improvements.jsonl 以供调查..."
  echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"evolver_trigger_failed","old_watermark":"'"$OLD_WATERMARK"'","reason":"watermark_not_updated"}' >> harness/trace/improvements.jsonl
else
  echo "✅ Evolver 成功完成"
  echo "   新处理的 episode: $((NEW_EPISODES_PROCESSED - OLD_EPISODES_PROCESSED))"
fi
```

### 5.4 触发后报告

触发后（无论成功与否），记录到 `harness/trace/improvements.jsonl`：

```bash
echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"evolver_trigger","task_count":'"$TASK_COUNT"',"failure_count":'"$FAILURE_COUNT"',"trigger_reason":"batch","watermark_updated":'"$([ "$NEW_WATERMARK" != "$OLD_WATERMARK" ] && echo "true" || echo "false")"'}' >> harness/trace/improvements.jsonl
```

> **关键**：水印确保 evolver 仅在**新**数据上运行。
> `references/evolver-integration.md` 获取数据契约。

### 5.5 Evolver 未运行故障排除

如果你注意到 evolver 长时间未运行（水印已过期）：

1. **检查触发条件**：
   ```bash
   echo "水印以来 episode: $TASK_COUNT"
   echo "水印以来失败: $FAILURE_COUNT"
   echo "要求: TASK_COUNT ≥ 3 或 FAILURE_COUNT ≥ 5"
   ```

2. **检查 evolver 崩溃**：
   ```bash
   grep "evolver" harness/trace/improvements.jsonl | tail -5
   ```

3. **手动触发**（如果自动触发持续失败）：
   ```bash
   Skill(skill="harness-evolver", args="--mode manual")
   ```

---

## Step 6: 呈现结果

输出执行结果摘要：

```markdown
## 执行结果

| 项目 | 状态 |
|------|------|
| 任务 | <task name> |
| 结果 | ✅ 成功 / ❌ 失败 |
| TASK_ID | <task_id> |
| 文件变更 | <N> files changed, <M> files created |
| 验证 | Build ✓ | Lint ✓ | Test ✓ | Verify ✓ |
| Friction Score | <score> |
| Evolver | 已触发 / 未触发 (N/3 tasks) |

### Lessons
- lesson 1
- lesson 2
```

> `$EXECUTOR_SKILL_DIR/references/results-template.md` 获取详细展示模板（如果可用）。否则使用上述格式。

---

## 参考文件

| 文件 | 步骤 | 内容 |
|------|------|------|
| `agents/interaction-counter.md` | 2 | 交互计数子代理提示词（信号词、计数规则、输出格式） |
| `agents/lesson-extractor.md` | 2.5 | Lesson 提取子代理提示词（分类、质量标准、反模式） |
| `references/interaction-counting-guide.md` | 2 | 信号词、计数规则、错误/正确示例 |
| `references/evolver-integration.md` | 5 | 数据契约、触发条件、水印 |
| `references/state-management.md` | 1 | task.json/context.json 模式 |
| `scripts/task_state.py` | 3 | 任务状态管理（complete/fail 命令） |
