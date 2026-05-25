---
name: harness-evolver
description: "分析 Agent 执行模式并进化 harness 基础设施。在累积的任务数据上运行 Critic→Refiner 流水线，从 episode 中提取知识。由 harness-executor 在任务批次后自动触发，或手动调用进行 harness 审计。"
---

# Harness Evolver

分析执行历史并进化 harness 基础设施：上下文 → 分析 → 精炼 → 记忆 → 验证 → 报告。

> **核心哲学**："竞争优势不再是 prompt。而是你的 Harness 捕获的轨迹。" Evolver 将原始执行数据转化为永久的基础设施改进。

> **安全原则**：每次进化必须是可验证的。Evolver 从不应用绕过项目验证流水线的更改。

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`python3 "$SKILL_DIR/scripts/xxx.py"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

> ⛔ **禁止**：不要写内联 Python（`python3 -c "..."`）来解析 episode JSONL 文件或读取记忆数据。始终使用提供的脚本（`memory_query.py`、`harness_critic.py`、`skill_nudge.py`）。内联解析很脆弱，会绕过脚本内置的错误处理。

---

## 执行流程

```
COORDINATOR
═══════════════════════════════════════════

 1. CONTEXT     加载项目根 → 评估数据可用性 → 确定范围
 2. ANALYZE     Critic：扫描失败 + episode → 进化评分：计算 3D 评分 → Nudge：检测 Skill 候选
 3. REFINE      Refiner：P0 自动修复 → P1 用户确认 → P2/P3 队列
 3.5 EVOLVE     Skill Patcher：从 Critic 发现修补 Skill
 4. MEMORY      提取知识 → 合并记忆 → 修剪过期条目
 4.5 DOC SYNC   episode files_changed → 分类影响 → 增量文档更新
 5. VALIDATE    验证更改不破坏现有系统 → 如需则回滚
 6. REPORT      改进摘要 + Skill 进化日志 + 更新水印

═══════════════════════════════════════════
```

> **注意**：Steps 2-4.5 可能各自不产生任何更改（未发现失败、无需文档更新等）。这很正常——evolver 是机会性地运行的。然而，Step 4.3（知识提取）必须无条件始终调用——它是幂等的，内部处理"无新内容"的情况。Step 2.4（Skill Nudge）由 evolution_score 阈值控制。

---

## 两个入口点

| 入口 | 触发方式 | 范围 | 行为 |
|------|----------|------|------|
| **自动** | harness-recorder Step 5（≥3 个已完成任务或近期失败后） | `incremental` — 最近 7 天 | 静默运行，仅报告改进 |
| **手动** | 用户直接调用 `Skill(skill="harness-evolver")` | `full` — 所有历史数据 | 完整分析，交互式（AskUserQuestion 用于 P1+ 修复） |

自动触发时，evolver 从 recorder 接收上下文：
- 项目根路径、最近完成任务 ID/描述、触发原因

自动触发条件（由 harness-recorder Step 5 检查）：
- `TASK_COUNT ≥ 3` 个已完成任务 → 以 `--trigger-reason batch` 触发
- `FAILURE_COUNT ≥ 5` 个最近 7 天内的失败 → 以 `--trigger-reason failures` 触发

---

## Step 1: Context

**目标**：了解项目状态并确定有哪些数据可用。

### 1.1 加载项目根

验证 `harness/` 目录存在。如果不存在：报告"未找到 harness，无内容可进化"并退出。

### 1.2 确定触发来源

| 来源 | 方式 | 范围 |
|------|------|------|
| **自动** | Executor 传递 `--trigger-reason`（`batch` 或 `failures`） | 自上次进化（水印）以来 |
| **手动** | 用户直接调用 `Skill(skill="harness-evolver")` | 完整历史 |

### 1.2.1 读取高水位标记

```bash
WATERMARK_FILE="harness/trace/evolver-watermark.json"
if [ -f "$WATERMARK_FILE" ]; then
  LAST_RUN=$(python3 -c "import json; print(json.load(open('$WATERMARK_FILE')).get('last_run',''))")
  LAST_TASK_ID=$(python3 -c "import json; print(json.load(open('$WATERMARK_FILE')).get('last_task_id',''))")
  echo "上次进化: $LAST_RUN (任务: $LAST_TASK_ID)"
else
  LAST_RUN=""
  echo "首次进化运行——处理所有历史"
fi
```

**自动**模式：仅处理 `timestamp > LAST_RUN` 的 episode。将 `LAST_RUN` 传递给 Critic（`--since`）、进化评分分析和编译步骤。
**手动**模式：忽略水印，处理完整历史。

### 1.3 评估数据可用性

统计每个数据源中的记录数。Episode 以独立 JSON 文件存储（每个任务一个）。Failure 是 JSONL（每行一条记录）：

```bash
FAILURE_COUNT=$(cat harness/trace/failures/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
EPISODE_COUNT=$(find harness/memory/episodes -name "*.json" 2>/dev/null | wc -l | tr -d ' ')
REVIEW_COUNT=$(cat harness/trace/review-patterns.jsonl 2>/dev/null | wc -l | tr -d ' ')
echo "Failures: $FAILURE_COUNT  Episodes: $EPISODE_COUNT  Reviews: $REVIEW_COUNT"
```

> Episode 是独立的 `.json` 文件（一个文件 = 一个 episode）。统计文件数，不是行数。
> 为向后兼容，也检查旧版 `.jsonl` 文件：`cat harness/memory/episodes/*.jsonl 2>/dev/null | wc -l`

如果所有计数为 0：报告"尚未发现执行数据"并退出。

### 1.4 呈现上下文摘要

显示表格：Failure 记录、情景记忆、编译注册表、Review 模式、范围（增量/完整）。

> **跟踪 `processed_episodes`**：从此时起，维护 Step 1.3 中加载的所有 episode 列表。在 Steps 2.3（进化评分）、2.4（Nudge）、4.5（文档同步）和 6.1（水印）中都需要此列表。每个 episode 有 `timestamp`、`task_id`、`files_changed`、`files_created`、`friction`、`structured_lessons`、`task_profile` 等。进化评分在读取时计算（见 Step 2.3）。

---

## Step 2: Analyze (Critic)

**目标**：从累积的执行数据中识别改进模式。

> ⛔ **阻塞**：Critic 是**只读**的。它不修改任何项目文件。

### 2.1 运行 Critic 分析

```bash
python3 "$SKILL_DIR/scripts/harness_critic.py" --json [--since "$LAST_RUN"] --output harness/trace/critic-report.json
```

当范围是 `incremental`（自动模式）时使用 `--since "$LAST_RUN"`（来自水印）。`LAST_RUN` 为 ISO 8601 格式（如 `2026-03-24T16:00:00`），来源于 `harness/trace/evolver-watermark.json` 的 `last_run` 字段。如果没有水印，省略 `--since` 以处理所有历史。Critic 命令完成后：

1. 检查 `harness/trace/critic-report.json` 是否存在：
   - 如果**不存在**（未发现失败）：这很正常——没有 Critic 数据。继续到 Step 2.3（进化评分分析）。
   - 如果**存在但为空**（`wc -c < harness/trace/critic-report.json` 返回 0）：记录到 `harness/trace/improvements.jsonl`，继续到 Step 2.3。
2. 如果 Critic 脚本以**非零**退出：记录失败：`echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","type":"critic_failure","error":"<stderr output>"}' >> harness/trace/improvements.jsonl`，继续到 Step 2.3

### 2.2 解析 Critic 结果

从 `harness/trace/critic-report.json` 中提取按优先级（P0/P1/P2/P3）分组的建议。

### 2.3 进化评分分析（强制）

> ⛔ **阻塞**：你必须在读取时为每个 episode 计算三维进化评分。不要跳过此步骤。不要依赖预计算信号——进化评分始终重新计算。

为 `processed_episodes`（Step 1.3 中加载）中的每个 episode 计算 `evolution_score`：

```
evolution_score = task_signal × interaction_signal × knowledge_signal
```

**三个维度**：

| 维度 | 公式 | 范围 |
|------|------|------|
| `task_signal` | 基础 `{complex: 1.0, standard: 0.5, trivial: 0.2}` + 跨模块加成（modules_touched > 2 则 +0.2）+ 跨层加成（layers_touched > 3 则 +0.1），上限 1.0 | 0.2–1.0 |
| `interaction_signal` | 取**最高**适用值：takeovers > 0 → 0.6，corrections > 0 → 0.4，retries > 0 → 0.3，全部为零 → 0.1 | 0.1–0.6 |
| `knowledge_signal` | `min(1.0, lesson_count × 0.2)`，其中 lesson_count = 所有 `lessons` 桶长度之和 | 0.0–1.0 |

**伪代码**：
```
对 processed_episodes 中的每个 episode：
  # Task signal（基础 + 跨模块/层加成）
  complexity = episode.get("complexity", "standard")
  base = {"complex": 1.0, "standard": 0.5, "trivial": 0.2}.get(complexity, 0.5)
  modules = episode.get("modules_touched", [])
  layers = episode.get("layers_touched", [])
  task_signal = min(1.0, base + (0.2 if len(modules) > 2 else 0) + (0.1 if len(layers) > 3 else 0))

  # Interaction signal（取最高适用值）
  friction = episode.get("friction", {})
  IF friction.get("takeovers", 0) > 0 → interaction_signal = 0.6
  ELIF friction.get("corrections", 0) > 0 → interaction_signal = 0.4
  ELIF friction.get("retries", 0) > 0 → interaction_signal = 0.3
  ELSE → interaction_signal = 0.1

  # Knowledge signal
  lessons = episode.get("lessons", {})
  total_lessons = sum(len(lessons.get(k, [])) for k in ["decisions", "conventions", "pitfalls", "patterns"])
  knowledge_signal = min(1.0, total_lessons * 0.2)

  evolution_score = task_signal * interaction_signal * knowledge_signal

  IF evolution_score >= 0.1 → 添加到 evolution_candidates 列表
  IF friction.get("takeovers", 0) >= 1 → 添加到 takeover_list
```

**双层进化流水线**：
1. **评分过滤**（此步骤）：`evolution_score >= 0.1` → 进化候选
2. **模式聚类**（Step 2.4 Skill Nudge）：2+ 个相似候选 → 可操作模式

记录摘要：`"进化扫描：{N} 个候选（score >= 0.1），{K} 个接管 episode"`

### 2.4 Skill Nudge（LLM 语义聚类）

> **由 evolution_score 控制**：运行 Skill Nudge 前，检查 Step 2.3 的 evolution_candidates：
> - 如果**任何**候选有 `evolution_score >= 0.3` → 必须运行 Skill Nudge（强制）
> - 如果存在候选但全部 `< 0.3` → 运行 Skill Nudge（推荐）
> - 如果没有候选（全部 score `< 0.1`） → 完全跳过 Skill Nudge（为其他步骤节省上下文）

> **独立**：Skill Nudge 无论 Critic 结果如何都运行——它直接使用 episode 数据，而非 Critic 输出。

> ⛔ **阻塞**：如果发现模式，你必须创建草稿 Skill。不要说"暂跳过"或"需用户确认"——草稿进入 `harness/drafts/skills/` 供人工审核，它们**不会**自动激活。

加载情景记忆数据，然后使用你的语义理解检测模式：

**步骤 A：加载数据**
```bash
python3 "$SKILL_DIR/scripts/skill_nudge.py" evaluate --project-root "$PROJECT_ROOT" --json
```

这输出所有 episode 及其任务、结果和教训——加上现有 Skill 名称。

**步骤 B：语义模式分析（由你执行）**

分析 episode 输出并识别模式：
1. **重复模式**：2+ 个语义相似目标的成功任务（例如"修复伪批量"、"改为批量更新"、"创建批量方法"都是"批量操作优化"）
2. **复杂任务**：单个任务有 5+ 条教训或 500+ 字符的教训
3. **用户纠正**：教训提到修复错误、变通方法或纠正

对每个发现的模式，检查现有 Skill 是否已覆盖它。如果已覆盖则跳过。

**步骤 C：从上下文数据创建 Skill**

对每个候选模式，首先导出上下文数据：
```bash
python3 "$SKILL_DIR/scripts/skill_nudge.py" context \
  --project-root "$PROJECT_ROOT" \
  --name "<skill-name>" \
  --pattern "<human-readable description>" \
  --episodes '[<index1>, <index2>, ...]' \
  --reason "<why this Skill should be created>" \
  --confidence 0.8 \
  --json
```

然后遵循 `$SKILL_DIR/references/skill-creation-guide.md` 创建正式的 SKILL.md：
1. 归纳模式：从 sample_tasks 提炼通用任务模式
2. 提炼规则：将每条 lesson 转为可执行的规则
3. 编排步骤：按执行顺序组织为 Step 1/2/3...
4. 补充陷阱：从 failure_reasons 提炼常见错误
5. 定义验证：怎么判断 Skill 执行成功
6. 写入文件：创建 `harness/drafts/skills/<name>/SKILL.md`

> **自检**：参照 skill-creation-guide.md 第 5 节质量检查清单，确保草稿合格。

草稿放在 `harness/drafts/skills/<name>/SKILL.md` 供人工审核。**草稿绝不自动激活。**

记录到 `harness/trace/improvements.jsonl`：
```json
{"timestamp": "...", "type": "skill_nudge", "pattern": "<pattern>", "confidence": 0.85, "draft_path": "..."}
```

### 2.5 决策：继续精炼？

合并**所有三次分析通过**的结果（Critic + Friction + Nudge）：

| 条件 | 操作 |
|------|------|
| Critic 有 P0/P1 建议 **或** 进化评分 >= 0.3 的候选 | 继续到 Step 3（Refine） |
| 仅 Critic 的 P2/P3 + 低分候选 | 记录到 improvements.jsonl，跳到 Step 4（Memory） |
| 任何来源都没有建议 | 跳到 Step 4（Memory） |

> ⛔ **关键**：不要仅基于 Critic 结果跳到 Step 4。你还必须检查进化评分分析（2.3）的结果。`evolution_score >= 0.3` 的成功 episode 是有效信号，即使 Critic 未发现任何问题。

---

## Step 3: Refine

**目标**：基于 Critic 建议和 Friction 信号应用或提议修复。

### 3.1 先运行 Refiner 干运行

```bash
python3 "$SKILL_DIR/scripts/harness_refiner.py" --report harness/trace/critic-report.json --dry-run --json
```

### 3.2 按优先级处理

| 优先级 | 自动模式 | 手动模式 |
|--------|----------|----------|
| **P0**（关键：盲点、缺失规则） | 直接应用修复（不问） | 直接应用修复（不问） |
| **P1**（重要：不清晰错误、覆盖缺口） | 记录到 improvements.jsonl（不问——静默运行） | 提议修复，询问用户（**是** — AskUserQuestion） |
| **P2**（锦上添花：优化） | 记录到 improvements.jsonl | 记录到 improvements.jsonl |
| **P3**（低：外观、风格） | 记录到 improvements.jsonl | 记录到 improvements.jsonl |

> **关键区别**：自动模式是**静默运行**——它只应用 P0 安全修复并记录其他所有内容。手动模式是**交互式**——它询问用户关于 P1 修复。

### 3.3 P0 自动修复

Refiner 处理整个 Critic 报告。要应用 P0 修复：

```bash
# 运行 refiner（它自动应用 P0 修复，提议 P1+ 供审核）
python3 "$SKILL_DIR/scripts/harness_refiner.py" --report harness/trace/critic-report.json --json
```

Refiner 内部自动应用 P0 修复。将应用的修复记录到 `harness/trace/improvements.jsonl`，附带时间戳和类型 `refiner_applied`。

### 3.4 P1 用户确认（仅手动模式）

> ⛔ **自动模式**：完全跳过此步骤。P1 修复记录到 improvements.jsonl 但不应用。自动模式是静默运行。

**仅手动模式**：使用 AskUserQuestion："Critic 发现 {N} 个 P1 改进。应用这些修复？" 选项：全部应用 / 先显示详情 / 暂时跳过。如果 AskUserQuestion 不可用，列出每个修复（What/Why/Fix）并询问用户确认。

### 3.5 记录 P2/P3

将 P2/P3 项追加到 `harness/trace/improvements.jsonl`，状态为 `pending`。

---

## Step 3.5: Skill 进化

**目标**：基于 Critic 发现中 `fix_type="patch_skill"` 的项修补 Skill 文件。

> **安全**：所有修补在应用前都会备份。安全扫描器阻止 prompt-injection / 凭证外泄模式。

### 3.5.1 过滤 Skill 相关建议

从 Critic 报告中提取 `fix_type == "patch_skill"` 的模式。如果没有，跳到 Step 4。

### 3.5.2 干运行预览

```bash
python3 "$SKILL_DIR/scripts/skill_patcher.py" patch \
  --skill-dir "$SKILL_DIR" \
  --old "<original_text>" --new "<improved_text>" \
  --project-root "$PROJECT_ROOT" --dry-run --json
```

审核 diff 预览。如果修补看起来不对，跳过此建议。

### 3.5.3 应用修补

对每个批准的修补：

```bash
python3 "$SKILL_DIR/scripts/skill_patcher.py" patch \
  --skill-dir "$TARGET_SKILL_DIR" \
  --old "<original_text>" --new "<improved_text>" \
  --file "<target_file>" \
  --project-root "$PROJECT_ROOT" --json
```

### 3.5.4 修补后验证

```bash
python3 "$SKILL_DIR/scripts/skill_patcher.py" validate --skill-dir "$TARGET_SKILL_DIR" --json
```

如果验证失败，备份在 `harness/trace/skill-backups/<timestamp>/` 自动可用于回滚。

### 3.5.5 记录进化

追加到 `harness/trace/improvements.jsonl`：
```json
{"timestamp": "...", "type": "skill_evolution", "skill": "<name>", "file": "<file>", "strategy": "<fuzzy_strategy>", "status": "applied"}
```

---

## Step 4: 记忆合并

**目标**：从 episode 中提取知识，维护记忆健康——修剪过期数据、合并重复项、更新统计。

> **阻塞**：记忆修剪在删除前始终在 `harness/trace/` 中创建 `tar.gz` 备份。

### 4.0 获取内存锁

```bash
LOCK_FILE="harness/memory/.evolver-lock"
if test -f "harness/memory/.doctor-lock"; then
  echo "WARN: Doctor 正在操作记忆。跳过记忆合并。"
  # 跳到 Step 5
fi
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT
```

### 4.1 检查状态

```bash
python3 "$SKILL_DIR/scripts/memory_query.py" stats --json
```

### 4.2 修剪过期情景记忆

删除超过 90 天的 `harness/memory/episodes/*.json` 文件。**必须先创建备份：**

```bash
# 先备份——删除前强制
mkdir -p harness/trace
BACKUP_FILE="harness/trace/memory-backup-$(date +%Y-%m-%d).tar.gz"
tar -czf "$BACKUP_FILE" harness/memory/episodes/ 2>/dev/null
test -f "$BACKUP_FILE" || { echo "ERROR: 备份失败——中止修剪"; exit 1; }

# 现在可以安全修剪（新的 .json 和旧版的 .jsonl）
find harness/memory/episodes -name "*.json" -mtime +90 -delete 2>/dev/null
find harness/memory/episodes -name "*.jsonl" -mtime +90 -delete 2>/dev/null
```

### 4.3 提取与合并知识（强制——无条件）

> ⛔ **阻塞**：你必须在每次 evolver 运行上无条件调用下面的 extract 命令，无论水印位置、episode 数量或任何其他条件。不要跳过此步骤。不要写内联 Python 解析 episode——使用提供的脚本。

```bash
python3 "$SKILL_DIR/scripts/memory_query.py" knowledge extract --json
```

这扫描所有 episode，将教训提取到 `harness/memory/knowledge/*.json`（按 tech_stack / architecture / conventions / domain 分类）。每条通过噪声过滤的 ≥ 8 字符的教训都成为一个知识条目。该命令是幂等的——现有条目不会重复。

提取后，检查 `harness/memory/knowledge/*.json` 中的过期条目。报告计数（新提取的条目、总条目数、删除的重复项）。

> **原理**：知识提取是 evolver 的专属职责。没有其他 Skill 写入 `harness/memory/knowledge/`。这确保知识层的单一事实来源。

---

## Step 4.5: 任务范围文档同步（强制）

**目标**：基于最近任务实际更改的内容，增量检查和更新项目文档。这不是完整的项目扫描（那是 Doctor 的工作）——它是目标性的、任务驱动的文档修补。

> **关键区别**：Doctor = 完整项目扫描 → 完整文档重建（重量级、手动）。文档同步 = 任务 files_changed → 精确文档修补（轻量级、自动）。

> ⛔ **阻塞**：你必须执行 4.5.1 从 episode 收集更改的文件。在没有实际读取 episode 数据之前不要假设"无更改"。`files_changed` 和 `files_created` 字段与你 Step 2 中加载的 episode 在同一位置。

### 4.5.1 收集更改的文件

> ⛔ **阻塞**：使用 **Step 1.3 的 `processed_episodes` 列表**——不要用内联 Python/bash 重新解析 episode 文件。Episode 已在内存中。

从你已加载的 episode 聚合 `files_changed` + `files_created`：

```
all_changed = set()
for ep in processed_episodes:        # ← Step 1.3 的同一列表
    all_changed.update(ep.get("files_changed", []))   # 防御：历史 episode 可能无此字段
    all_changed.update(ep.get("files_created", []))   # 防御：历史 episode 可能无此字段

project_changes = [f for f in all_changed if not f.startswith("harness/")]
```

> **错误**：写新的 bash/Python 扫描 `harness/memory/episodes/*.json` ← **禁止**，你已有数据。
> **正确**：直接迭代 `processed_episodes`——这些与 Step 2.3 和 2.4 中使用的对象是相同的。

如果 `project_changes` 为空：跳到 Step 6（无项目文件更改，无需文档同步）。

### 4.5.2 跳过条件——更改过多

如果 `len(project_changes) > 20`：
```
echo "跳过文档同步：{N} 个文件更改（>20）。运行 harness-doctor 进行完整同步。"
```
记录到 `harness/trace/improvements.jsonl`：
```json
{"timestamp": "...", "type": "doc_sync_skipped", "reason": "too_many_changes", "file_count": N}
```
跳到 Step 6。

### 4.5.3 分类更改影响

扫描 `project_changes` 并将每个文件分类到影响类别：

| 更改类型 | 检测 | 需检查的文档 |
|----------|------|-------------|
| **新源文件（新包/模块）** | 文件路径不在 ARCHITECTURE.md 层表列出的任何包下 | ARCHITECTURE.md 层表、AGENTS.md、lint-deps LAYER_MAP |
| **接口/Controller 更改** | 文件名包含 Controller、Service、Handler、API、Router，或是公共接口文件 | 对应的 `docs/design-docs/{component}.md` |
| **构建配置更改** | pom.xml、go.mod、package.json、build.gradle、Makefile 修改 | DEVELOPMENT.md 命令部分 |
| **新外部依赖** | pom.xml/go.mod/package.json 有新的依赖条目 | harness/environment.json 服务列表 |
| **配置文件更改** | application.yml、.env、docker-compose.yml 修改 | harness/environment.json、DEVELOPMENT.md |

对每个命中的类别，继续到 4.5.4。

### 4.5.4 增量文档更新

对每个检测到的影响类别，生成一个**专注的子代理**来进行最小必要更新。每个关注点一个子代理——不要合并。

#### A. 新包/模块 → ARCHITECTURE.md

当新源文件属于 ARCHITECTURE.md 中不存在的包时：

```
读取 {FILE_PATHS} 处的新源文件。
确定它们属于什么包/模块。
读取 docs/ARCHITECTURE.md 并检查此包是否已在层表中。
如果不存在：
  1. 分析文件的 imports 以确定其层（L0-L5）
  2. 在 ARCHITECTURE.md 的层表中添加一行
  3. 在 Mermaid 依赖图中添加包及其正确箭头
  4. 如果 AGENTS.md 有层表，则更新其架构部分
不要重写整个文档——仅做精确添加。
```

#### B. 接口/Controller 更改 → 设计文档

当接口或 controller 文件被修改时：

```
读取 {FILE_PATHS} 处的更改源文件。
确定它们属于哪个组件（从目录结构或包名）。
检查 docs/design-docs/{component}.md 是否存在：
  - 如果存在：读取它，检查更改的接口/方法是否已记录。
    仅更新过时的部分（关键接口表、方法签名）。
  - 如果不存在：使用 documentation-templates.md 设计文档模板创建它。
    读取 $CREATOR_SKILL_DIR/references/documentation-templates.md 获取模板。
更新后，验证 docs/design-docs/index.md 包含此组件。
```

#### C. 构建配置更改 → DEVELOPMENT.md

当构建配置文件被修改时：

```
读取 {FILE_PATHS} 处的更改构建文件。
与当前 docs/DEVELOPMENT.md 比较：
  - 如果构建/测试/lint 命令更改：更新记录的命令
  - 如果添加了新的 Makefile target：添加到命令部分
  - 如果先决条件更改（例如 Java 版本、Node 版本）：更新先决条件
不要重写——仅修补过时的部分。
```

#### D. 新依赖 → environment.json

当依赖文件显示新的外部依赖时：

```
读取 {FILE_PATHS} 处的更改依赖文件。
检测新的外部服务（数据库驱动、缓存客户端、消息队列客户端、HTTP 客户端）。
如果 harness/environment.json 存在：
  - 检查新依赖是否已在服务列表中
  - 如果没有：添加 type、name 和 evidence
如果 harness/environment.json 不存在：跳过（Doctor 会创建它）。
```

### 4.5.5 记录文档同步结果

追加到 `harness/trace/improvements.jsonl`：
```json
{"timestamp": "...", "type": "doc_sync", "files_checked": 8, "docs_updated": ["docs/design-docs/order-service.md", "docs/ARCHITECTURE.md"], "docs_skipped": [], "trigger_episodes": ["task-id-1", "task-id-2"]}
```

---

## Step 5: 验证进化

**目标**：确保 Steps 3-4 的更改不破坏现有系统。

> **阻塞**：如果验证失败，更改会自动回滚。进化从不破坏工作系统。

### 5.1 如果没有更改则跳过

如果 Steps 3-4.5 未产生**任何项目文件更改**（仅 `harness/` 下的分析/记录），跳到 Step 6。

### 5.2 如果更改则运行验证

检查项目文件更改（排除 `harness/`）：
```bash
CHANGED_FILES=$(git diff --name-only 2>/dev/null | grep -v "^harness/" | head -20)
```

如果 `$CHANGED_FILES` 非空：
1. 运行 `make lint-arch` → 如果失败：
   ```bash
   git checkout -- $CHANGED_FILES 2>/dev/null
   mkdir -p harness/trace/failures
   echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","task_id":"evolution","failure_type":"evolution_validation_failure","details":{"files":"'"$CHANGED_FILES"'","action":"rolled_back"}}' >> harness/trace/failures/$(date +%Y-%m-%d).jsonl
   ```
2. 运行 `make build` → 如果失败：相同回滚 + 记录失败

---

## Step 6: 报告

**目标**：呈现 evolver 所做事情的清晰摘要，并更新高水位标记。

### 6.1 更新高水位标记

**必须**在成功运行后更新水印，以便下次进化只处理新数据：

使用 `processed_episodes`（Step 1.3）计算水印——不要重新解析 episode 文件：

```
LAST_PROCESSED_TS = max(ep["timestamp"] for ep in processed_episodes)
LAST_TASK_ID = max(processed_episodes, key=lambda ep: ep["timestamp"])["task_id"]
```

> ⛔ **禁止**：不要写内联 Python/bash 扫描 `harness/memory/episodes/` 来提取时间戳。你 Step 1.3 中已有 `processed_episodes` 在内存中。直接使用它。

然后写入：

```bash
cat > harness/trace/evolver-watermark.json << EOF
{
  "last_run": "$LAST_PROCESSED_TS",
  "last_task_id": "<most-recent-task-id-processed>",
  "episodes_processed": <count>,
  "run_mode": "<auto|manual>"
}
EOF
```

> **关键**：`last_run` 必须是**实际处理的最新 episode 时间戳**，不是 `date -u`（当前挂钟时间）。使用挂钟时间会跳过进化运行期间并发任务写入的 episode。
>
> **错误**：`"last_run": "2026-04-15T13:22:00Z"`（四舍五入/估计时间）
> **正确**：`"last_run": "2026-04-15T13:29:32.721020Z"`（`max(ep["timestamp"] for ep in processed_episodes)` 的精确值）
>
> 如果 evolver 在到达 Step 6 之前崩溃，水印**不**更新——下次触发将用相同数据重试。这是有意为之（崩溃安全）。

### 6.2 呈现摘要

呈现涵盖以下内容的摘要：
- **Critic**：扫描的模式、按优先级的建议计数
- **Refiner**：应用的 P0 修复、提议/应用的 P1 修复、P2/P3 排队
- **Memory**：episode 计数 + 修剪数、知识条目数
- **Doc Sync**：`{N}` 个项目文件触发检查、`{M}` 个文档更新、`{K}` 个跳过（需 Doctor）
- **Validation**：lint-arch/build 状态（PASS/FAIL/SKIPPED）
- **Watermark**：从 `<old>` 更新到 `<new>`，处理了 `<N>` 个新 episode
- **Next Steps**：基于发现的上下文建议

---

## 参考文件

| 文件 | 何时读取 | 内容 |
|------|----------|------|
| `references/feedback-pipeline.md` | Step 2-3: Critic→Refiner | 失败分析模式、建议优先级 |
| `references/evolution-safety.md` | Step 3/6: 修复和验证 | P0-P3 分类、回滚步骤、安全约束 |
| `scripts/skill_patcher.py` | Step 3.5: Skill 进化 | 安全 Skill 修改，含 9 策略模糊匹配、原子写入、自动回滚 |
| `scripts/content_scanner.py` | Step 3.5: 安全扫描 | 80+ 模式安全扫描，含信任级别、结构检查、安装策略 |
| `scripts/skill_nudge.py` | Step 2.4: Skill 创建 | 评估 episode 以获取 Skill 候选、生成 SKILL.md 草稿 |
