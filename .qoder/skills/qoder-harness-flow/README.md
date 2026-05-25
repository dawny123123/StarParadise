# Qoder Harness Flow

> 七个核心 Skill 的定义仓库：Creator、Doctor、Executor、Evolver、Recorder、Spec、Upgrader。
> 本仓库是 Skill 的 **源码定义**（SKILL.md + agents + references + scripts），不是应用项目。
> 部署时安装到目标项目的 `.qoder/skills/` 目录下使用。

**Fork 来源：** [http://gitlab.alibaba-inc.com/qoder-open/qoder-harness-flow.git](http://gitlab.alibaba-inc.com/qoder-open/qoder-harness-flow.git)

**Fork 改造概览：** [FORK-DIFF-REPORT.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/FORK-DIFF-REPORT.md) ｜ **上游同步：** [SYNC-FROM-UPSTREAM.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/SYNC-FROM-UPSTREAM.md)

> **入库范围**：本仓库**只入库 Skill 源码**（`harness-*/`、`tests/`、根目录文档）。`harness/`、`scripts/`、`docs/`、`AGENTS.md`、`Makefile` 均为 Agent 生成的实例化产物，**不入库**，由 `Skill("harness-creator")` 在目标项目重新生成。详见 [SYNC-FROM-UPSTREAM.md §入库范围策略](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/SYNC-FROM-UPSTREAM.md)。

---

## 目录

1. [整体架构](#整体架构)
2. [Harness Creator](#harness-creator)
3. [Harness Doctor](#harness-doctor)
4. [Harness Executor](#harness-executor)
5. [Harness Evolver](#harness-evolver)
6. [Harness Recorder](#harness-recorder)
7. [Harness Spec](#harness-spec)
8. [Harness Upgrader](#harness-upgrader)
9. [数据流与协作](#数据流与协作)
10. [快速开始](#快速开始)
11. [最佳实践](#最佳实践)

---

## 整体架构

### 什么是 Harness？

Harness（工具链）是 AI Agent 的操作系统。Codebase 是唯一的事实来源——如果 Agent 看不到它，它就不存在。

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Agent (LLM) = CPU                                │
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐     │
│   │              Repository = Single Source of Truth               │     │
│   │                                                                │     │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │     │
│   │  │ Creator  │ │  Doctor  │ │ Executor │ │ Evolver  │         │     │
│   │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │     │
│   │      创建         诊断        执行         演进               │     │
│   │                                                                │     │
│   │  ┌──────────┐ ┌──────────┐ ┌──────────┐                                  │     │
│   │  │ Recorder │ │   Spec   │ │ Upgrader │                                  │     │
│   │  └──────────┘ └──────────┘ └──────────┘                                  │     │
│   │    记录归档      需求规格       版本升级                                   │     │
│   └────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

### 七个 Skill 的职责

| Skill | 职责 | 类比 |
|--------|------|------|
| **Creator** | 从零构建 harness 基础设施 | 装修新房 |
| **Doctor** | 诊断并修复现有 harness 问题 | 体检 + 治疗 |
| **Executor** | 执行具体的开发任务，记录经验 | 完成任务清单 |
| **Evolver** | 从执行历史中学习，创建/修补 Skill | 复盘 + 进化 |
| **Recorder** | 记录任务结果，触发进化 | 任务日志归档 |
| **Spec** | 生成任务规格说明 | 需求分析与拆分 |
| **Upgrader** | 升级已安装项目到新版 Skill | 系统升级 |

### 生命周期

```
Spec 生成规格说明 → Executor 执行任务 → Recorder 记录结果
                                                  ↓
                     Doctor 诊断修复 ← Evolver 分析经验并进化
                                        ↑              ↓
                                   成功/失败 episode 记录
                                   独立 JSON 文件 (pretty-printed)
```

### 核心数据存储

```
harness/
├── config/
│   └── environment.json        # 运行环境配置
├── memory/
│   ├── episodes/               # 情景记忆 (独立 JSON 文件, 每次任务完成/失败写入)
├── tasks/                      # 任务状态管理
│   ├── <task-id>/state/        # task.json, context.json, result.json
│   └── current -> <task-id>    # 当前任务符号链接
├── trace/
│   ├── failures/               # 失败记录 (JSON, 每次 fail 写入)
│   ├── improvements.jsonl      # 改进记录 (evolver 写入)
│   ├── critic-report.json      # Critic 分析报告
│   └── skill-backups/          # Skill 补丁前备份
└── drafts/
    └── skills/                 # Nudge 生成的 Skill 草稿 (待人工 review)
```

### task.json vs tasks.md

这两个文件名相似但职责完全不同，不要混淆：

| 文件 | 格式 | 路径 | 作用 |
|------|------|------|------|
| **task.json** | JSON | `harness/tasks/<id>/state/task.json` | 状态机核心，记录任务元数据和执行状态 |
| **tasks.md** | Markdown | `docs/exec-specs/<slug>/tasks.md` | 执行计划，记录 Task 1/2/3 的具体步骤 |

关联：task.json 的 `plan_path` 指向 tasks.md，`spec_path` 指向 spec 目录。

### 门禁控制

Harness 通过 `task_state.py` 在**文件系统层面**强制执行门禁（exit 1 阻塞），而非仅靠 LLM 自律：

| 门禁 | 检查时机 | 检查内容 | 阻塞方式 |
|------|----------|----------|----------|
| 完成门控 | `complete` | `verification-report.json` 存在且含 HTTP 证据 | exit 1 |
| 计划门控 | `init`/`checkpoint`/`complete` | plan_path 指向的 tasks.md 含四段式结构 | exit 1 |
| 任务完成校验 | `complete` | 每个 Task 都有 checkpoint 文件 | exit 1 |
| 经验质量门控 | `complete`/`fail` | 至少 1 条 lesson | exit 1（strict 模式） |
| 漂移检测 | `checkpoint` | 实际变更 vs 计划范围 | 警告（不阻塞） |

逃生口：`--skip-gate`、`--skip-lessons-check`、`--cdd-mode`（均标注 not recommended）。

---

## Harness Creator

### 功能

从零开始为一个代码仓库创建完整的 harness 基础设施。

### 生成的文件结构

```
AGENTS.md                       # AI Agent 导航地图 (80-120行)
docs/
  ARCHITECTURE.md               # 架构文档
  DEVELOPMENT.md                # 开发指南
  PRODUCT_SENSE.md              # 产品背景
  TESTING.md                    # 测试策略
  OPERATIONS.md                 # 运维指南
  design-docs/
    index.md                    # 组件文档索引
    {component}.md              # 各组件设计文档
scripts/
  lint-deps.py                  # 层依赖检查
  lint-quality.py               # 代码质量检查
  validate.py                   # 验证管道
harness/
  config/environment.json       # 运行环境配置
  scripts/                      # 环境脚本 (setup/start/teardown)
  memory/                       # 记忆系统 (空初始化)
  tasks/                        # 任务状态 (空初始化)
  trace/                        # 执行追踪 (空初始化)
Makefile                        # 构建自动化
```

### 执行流程

```
Phase 1: Quick Detection (项目状态检测)
    ↓
Phase 2: Parallel Analysis (3个子代理并行分析)
    ↓
Phase 3: Delta Synthesis (计算需创建/更新的文件)
    ↓
Phase 4: Parallel Creation (3个填充代理并行生成)
    ↓
Phase 5: Verification + Handoff (验证 + 交付)
```

#### Phase 1: 快速检测

| 状态 | 标准 | 动作 |
|------|------|------|
| **Empty** | < 5 文件 | 引导用户选择项目类型 |
| **Code Only** | 无 harness | 完整创建 |
| **Partial Harness** | 部分组件存在 | 缺口分析 + 填充 |
| **Full Harness** | 全部存在 | 审计 + 改进建议 |

#### Phase 2: 并行分析

| Agent | 焦点 | 输出 |
|-------|------|------|
| **Architecture Analyzer** | 层结构、导入关系 | `harness/.analysis/architecture.json` |
| **Harness State Audit** | 现有 harness 审计 | `harness/.analysis/audit.json` |
| **Environment Analyzer** | 外部依赖、环境变量 | `harness/.analysis/environment.json` |

#### Phase 4: 并行创建

| Agent | 生成文件 |
|-------|----------|
| **fill-documentation** | AGENTS.md, docs/*.md (ARCHITECTURE/DEVELOPMENT/TESTING/OPERATIONS/PRODUCT_SENSE), docs/design-docs/*.md |
| **fill-linters** | scripts/lint-deps.py, scripts/lint-quality.py |
| **fill-harness-config** | harness/config/environment.json, harness/scripts/*.sh, Makefile |

---

## Harness Doctor

### 功能

深度扫描代码仓库，确保 harness 文件与实际代码一致。自包含——不修改 executor 等其他 Skill。

### 执行流程

```
DOCTOR
═══════════════════════════════════
 1. SCAN      深度代码分析 (3个并行子代理)
 2. AUDIT     双重审计（表面 + 内容深度）
 3. FIX       按优先级自动修复 (P0-P5)
 4. HEAL      经验漂移检测 + 归档
 5. REPORT    输出报告
═══════════════════════════════════
```

#### Step 1: SCAN

并行启动 3 个分析代理：

| Agent | 读取内容 | 输出 |
|-------|----------|------|
| **Architecture Analyzer** | 所有源文件的导入关系 | `doctor-architecture.json` |
| **Component Analyzer** | 接口定义、控制器、服务类 | `doctor-components.json` |
| **Environment Analyzer** | 构建文件、Docker 配置 | `doctor-environment.json` |

#### Step 2: AUDIT

双重检查层：

| 维度 | Tier 1 (表面) | Tier 2 (内容深度) |
|------|---------------|-------------------|
| **Structure** | 文件存在性 | — |
| **Fixed Files** | Makefile 目标、validate.py | — |
| **Documentation** | 行数、格式、链接有效 | 设计文档覆盖所有组件 |
| **Scripts** | 权限、无硬编码路径 | LAYER_MAP 覆盖所有包 |
| **Config** | JSON 有效 | 服务匹配实际依赖 |
| **Skill Scripts** | py_compile 语法检查 | 运行时参数测试 |
| **Consistency** | — | 层数据在文件间一致 |

#### Step 3: FIX

修复优先级：

| 级别 | 范围 | 示例 |
|------|------|------|
| P0 | Structure | 文件必须存在 |
| P1 | Fixed Files | 恢复 Makefile、validate.py 规范版本 |
| P2 | Scripts | 从实际包扫描更新 LAYER_MAP |
| P3 | Documentation | 与实际组件同步 |
| P4 | Config | 匹配实际外部依赖 |
| P5 | Consistency | 跨文件同步 |

#### Step 4: HEAL

检测经验漂移——episode 记录的文件在之后被修改，说明经验可能已过时。漂移的 episode 归档到 `harness/memory/archived/`。

---

## Harness Executor

### 功能

自主执行开发任务，记录成功和失败经验，为 Evolver 提供进化数据。

### 执行流程

```
COORDINATOR
═══════════════════════════════════════════════
 1. SETUP      bootstrap → 检查中断 → 查询记忆 → 加载上下文
 2. PLAN       分类 → 分析需求 → 交互确认 → 初始化 → 写计划 → 用户批准
 3. EXECUTE    FOR each Task: spawn executor → coordinator 验证
 4. VALIDATE   项目级验证 (build, lint, test) → plan 回归验证
 4.5 REVIEW    [Complex/security: 跨模型审查]
 5. VERIFY     spawn verifier 子代理 → 功能验证 (MANDATORY)
 6. RECORD     task_state.py complete → episodic memory → 触发 evolver
 6-F FAIL      task_state.py fail → 记录失败 episode + trace/failures/
 7. PRESENT    结果总结
═══════════════════════════════════════════════

> 用户纠正感知：在任意 Step 中，若用户回复含纠正信号（"不对"、"改一下"、"应该是"等），
> 立即调用 `task_state.py interaction --event user_correction` 记录。
> 此数据驱动 friction 计数（corrections/takeovers/retries），最终影响 evolver 的 evolution_score 计算。
```

### 四层验证

| Layer | 时机 | 内容 |
|-------|------|------|
| Layer 1 | Step 3 循环内 | 每个 Task 的特定验证 + verify_action.py 预验证 |
| Layer 2 | Step 4 (所有 Task 后) | 项目级验证 (build/lint/test) |
| Layer 3 | Step 4 (所有 Task 后) | 计划回归验证（验证方式 section 的命令） |
| Layer 4 | Step 5 | 功能验证 (spawn verifier 子代理) |

### Step 2: Plan (强制)

**任务分类决策表：**

| Criterion | Trivial 条件 |
|-----------|-------------|
| Files to modify | 仅 1 个文件 |
| New files | 无新文件 |
| Cross-layer changes | 无跨层 |
| Single diff | 单次变更 |
| Security/auth/DB | 不涉及 |

| Complexity | Criteria | Plan Depth |
|------------|----------|-----------|
| **Trivial** | ALL 5 = YES | 轻量计划 + 批准 |
| **Standard** | Any = NO | 完整四段式计划 + 批准 |
| **Complex** | 5+ 文件 / 架构变更 | 完整 + 工作树 + 交叉审查 |

**四段式 Plan 格式（强制）：**

```markdown
## 背景
[任务背景和目标]

## Task N: [任务名称]
- **Before**: [变更前状态]
- **After**: [变更后状态]
- 验证点: [验证项]

## 验证方式
[具体验证命令]

## 涉及文件汇总
| 操作 | 文件 |
|------|------|
| 修改 | path/to/file.java |
```

### Step 6: Record & Complete

<HARD-GATE> 自动执行，无需用户指令。

**成功路径（6.1-6.3）：**

```bash
# 6.1 记录完成 (写入 episodes/<task_id>.json)
python3 "$SKILL_DIR/scripts/task_state.py" complete \
  --task-id "$TASK_ID" \
  --summary "Completed: <summary>" \
  --files-changed file1 file2 \
  --lessons '["lesson1", "lesson2"]'

# 6.2 归档 Plan
mv "docs/exec-plans/active/<plan>.md" "docs/exec-plans/completed/"

# 6.3 触发 Evolver (满足条件时)
# TASK_COUNT ≥ 3 或 FAILURE_COUNT ≥ 5 → 自动触发
```

**失败路径（6-F）：**

当任务重试 2 次后仍失败，或用户放弃：

```bash
python3 "$SKILL_DIR/scripts/task_state.py" fail \
  --task-id "$TASK_ID" \
  --summary "Failed: <what was attempted>" \
  --reason "<root cause>" \
  --lessons '["lesson from failure"]'
```

> `fail` 同时写入 `episodes/`（outcome="failure"）和 `trace/failures/`。
> 失败经验对 evolver 的自进化同样重要。

---

## Harness Evolver

### 功能

从执行历史中学习和改进 harness 基础设施。包含两条进化路径：
- **Nudge**：从成功经验中创建新 Skill
- **Evolve**：从失败经验中修补已有 Skill

### 执行流程

```
EVOLVER
═══════════════════════════════════════════════════════
 1. CONTEXT     加载项目 → 评估数据可用性 → 确定范围
 2. ANALYZE     Critic: 扫描失败 + episodes + skill gaps
 2.5 NUDGE      LLM 语义聚类 → 识别模式 → 创建 Skill 草稿
 3. REFINE      Refiner: P0 自动修复 → P1 用户确认 → P2/P3 队列
 3.5 EVOLVE     Skill Patcher: 基于 Critic 发现补丁已有 Skill
 4. MEMORY      记忆整合 → 修剪陈旧条目 → 更新统计
 4.5 DOC SYNC   任务 files_changed → 影响分类 → 增量文档更新
 5. VALIDATE    验证变更不破坏现有系统 → 失败自动回滚
 6. REPORT      改进总结 + Skill 进化日志 + 更新水位线
═══════════════════════════════════════════════════════
```

> 每一步都可能"无事发生"直接跳过，evolver 是机会主义的。

### 触发条件

| 入口 | 触发方 | 范围 | 行为 |
|------|--------|------|------|
| **Auto** | executor Step 6.3 (新增 TASK≥3 或 FAILURE≥5，自上次进化以来) | 增量 (水位线之后) | 静默运行 |
| **Manual** | 用户直接调用 | 完整历史 | 交互式 (AskUserQuestion) |

> 通过 `harness/trace/evolver-watermark.json` 记录上次进化时间点，确保不重复处理已进化过的 episode。Evolver 成功完成后更新水位线，崩溃则不更新（下次重试）。

### Step 2: Analyze (Critic)

```bash
python3 "$SKILL_DIR/scripts/harness_critic.py" --json [--since "$LAST_RUN"] \
  --output harness/trace/critic-report.json
```

Auto 模式按水位线 `$LAST_RUN` 做增量扫描；首次运行（无水位线）不加 `--since`，处理全量历史。

Critic 只读扫描：`trace/failures/` + `memory/episodes/` + 已有 SKILL.md 文件。
输出按优先级分类的建议（P0-P3）+ `fix_type`（patch_config / patch_skill）。

### Step 2.3: Evolution Score Analysis

Evolver 在读取 episode 时实时计算三维进化得分（不依赖预计算字段）：

```
evolution_score = task_signal × interaction_signal × knowledge_signal
```

| 维度 | 公式 | 范围 |
|------|------|------|
| `task_signal` | `{complex: 1.0, standard: 0.5, trivial: 0.2}[complexity]` + 跨模块加成(>2: +0.2) + 跨层加成(>3: +0.1), cap 1.0 | 0.2–1.0 |
| `interaction_signal` | 取最高信号：takeovers>0→0.6, corrections>0→0.4, retries>0→0.3, 全零→0.1 | 0.1–0.6 |
| `knowledge_signal` | `min(1.0, lesson_count × 0.2)` | 0.0–1.0 |

两层进化管线：`evolution_score >= 0.1` → 候选 → 2+ 相似候选 → 模式聚类 → 可执行进化动作。

### Step 2.5: Nudge — 创建新 Skill（LLM 语义聚类）

这是 evolver 最核心的自进化能力。**不依赖任何规则匹配**，完全由 Agent（LLM）自身的语义理解来识别模式。

**Step A — 加载数据**
```bash
python3 "$SKILL_DIR/scripts/skill_nudge.py" evaluate \
  --project-root "$PROJECT_ROOT" --json
```
输出所有 episode 的 task、outcome、lessons，以及已有 skill 列表。

**Step B — Agent 语义聚类（LLM 自己做）**

Agent 分析 episodes，识别三类信号：
1. **重复模式**：2+ 个语义相似的成功任务（如"修复伪批量"+"创建批量方法"→"批量操作优化"）
2. **复杂任务**：单任务有 5+ lessons 或 500+ 字符的 lessons
3. **用户纠正**：lessons 提到修复错误、workaround

**Step C — 导出上下文 + 创建 Skill**
```bash
python3 "$SKILL_DIR/scripts/skill_nudge.py" context \
  --project-root "$PROJECT_ROOT" \
  --name "<skill-name>" --pattern "<description>" \
  --episodes '[0,1,2,3]' --json
```

Agent 根据 `references/skill-creation-guide.md` 内建规范创建合格的 SKILL.md：
1. 归纳模式：从 sample_tasks 提炼通用任务模式
2. 提炼规则：将每条 lesson 转为可执行的规则（不是照搬原文）
3. 编排步骤：按执行顺序组织为 Step 1/2/3...
4. 补充陷阱：从 failure_reasons 提炼常见错误
5. 定义验证：怎么判断 Skill 执行成功
6. 写入 `harness/drafts/skills/<name>/SKILL.md`

**草稿不会自动激活**，需人工 review 后移到 `.qoder/skills/` 才生效。

### Step 3: Refine — 修复基础设施

| Priority | Action | User Confirmation? |
|----------|--------|-------------------|
| **P0** (关键盲点、缺失规则) | 直接应用修复 | No — 安全缺口必须关闭 |
| **P1** (覆盖缺口、不清晰错误) | 提议修复，用户确认 | Yes |
| **P2** (优化建议) | 记录到 improvements.jsonl | No |
| **P3** (样式问题) | 记录到 improvements.jsonl | No |

### Step 3.5: Evolve — 修补已有 Skill

从 Critic 报告筛出 `fix_type == "patch_skill"` 的建议：

```bash
# Dry-run 预览
python3 "$SKILL_DIR/scripts/skill_patcher.py" patch \
  --skill-dir "$TARGET_SKILL_DIR" \
  --old "<原文>" --new "<改进>" --dry-run --json

# 应用补丁 (自动备份到 harness/trace/skill-backups/)
python3 "$SKILL_DIR/scripts/skill_patcher.py" patch \
  --skill-dir "$TARGET_SKILL_DIR" \
  --old "<原文>" --new "<改进>" --file "SKILL.md" --json

# 验证 (失败自动回滚)
python3 "$SKILL_DIR/scripts/skill_patcher.py" validate \
  --skill-dir "$TARGET_SKILL_DIR" --json
```

### Step 4: Memory — 记忆维护

```bash
# 获取锁（防止和 doctor 冲突）
# 统计记忆状态
python3 "$SKILL_DIR/scripts/memory_query.py" stats --json

# 备份 + 清理 90 天前的旧 episode
tar -czf harness/trace/memory-backup-$(date +%Y-%m-%d).tar.gz harness/memory/episodes/
find harness/memory/episodes -name "*.json" -mtime +90 -delete
find harness/memory/episodes -name "*.jsonl" -mtime +90 -delete  # legacy cleanup

# 检查 knowledge 重复和过时条目
```

### Step 4.5: Doc Sync — 任务驱动的文档增量同步

基于本批任务的 `files_changed` 增量检查项目文档是否需要更新：

| 变更类型 | 检测方式 | 更新的文档 |
|----------|----------|-----------|
| 新增源文件（新包/模块） | 文件路径不在 ARCHITECTURE.md 层级表中 | ARCHITECTURE.md、AGENTS.md |
| 接口/Controller 变更 | 文件名含 Controller/Service/Handler | 对应 design-doc |
| Build 配置变更 | pom.xml/go.mod/Makefile 变更 | DEVELOPMENT.md |
| 新增外部依赖 | 依赖文件新增条目 | environment.json |

与 Doctor 的区别：Doc Sync 只看任务改了什么（轻量、自动），Doctor 全量扫描整个项目（重量、手动）。变更超过 20 个文件时跳过，建议运行 Doctor。

### Step 5-6: Validate + Report

验证所有变更不破坏项目（lint + build），失败自动回滚。
输出汇总报告：Critic 发现数、Nudge 草稿数、修复数、记忆状态、Doc Sync 统计（触发/更新/跳过）、水位线从 `<old>` → `<new>`（共 `<N>` 个 episode）。

---

## Harness Recorder

### 功能

记录执行结果：统计交互次数 → 写入 episode → 归档规格 → 触发进化 → 呈现结果。

> **核心理念**："每次执行都产生数据。缺失数据会打断进化链。" Recorder 确保没有执行被遗漏。

### 执行流程

```
RECORDER
═══════════════════════════════════════════
 1. LOAD     读取 task.json → 判断成功/失败
 2. COUNT    扫描对话 → 统计交互次数
 3. RECORD   task_state.py complete/fail（强制）
 4. ARCHIVE  将规格移到 completed/
 5. TRIGGER  检查进化阈值 → 满足则触发 Evolver
 6. PRESENT  向用户呈现结果摘要
═══════════════════════════════════════════
```

> ⛔ **阻塞点**：第 3 步（Record）不可跳过。`task_state.py complete` 是情景记忆的**唯一**入口。跳过 = 进化链断裂。

---

## Harness Spec

### 功能

生成结构化需求规格：通过多轮交互式分析，产出 spec/tasks/acceptance 三层规格产物，供 Executor 机械执行。

> **核心理念**："AI 是需求工程师，不是问答机器。" 先分析，再推荐完整方案，然后让用户确认或调整。

### 执行流程

```
SPEC
═══════════════════════════════════════════
 1. SETUP     启动 → 检查中断 → 查询记忆 → 加载上下文
 2. CLASSIFY  任务分类（简单/标准/复杂）
 3. ANALYZE   代码分析 → Code Analysis Report
 4. INTERACT  Round 1-N：推荐 → 用户确认 → 写入产物
 5. REVIEW    自检全部 3 个产物
 6. INIT      task_state.py init → 生成 TASK_ID
 7. HANDOFF   请求用户确认 → 调用 Executor
═══════════════════════════════════════════
```

> Spec 是 **spec → executor → recorder** 链路的第一站。它只写规格产物，不写代码，不运行测试。

---

## Harness Upgrader

### 功能

将新版 Harness Skill 升级部署到已安装旧版本的目标项目，自动修正结构漂移。

> **核心理念**：“Skill 源码是无状态的模板，直接覆盖更新；harness 运行时数据是有状态的项目资产，由 Doctor 安全修正。”

### 执行流程

```
UPGRADER
═══════════════════════════════════════════
 1. DETECT     检测目标项目当前 Harness 状态
 2. PREPARE    确认升级来源、预检安全性
 3. DEPLOY     部署新版 Skill 源码到 .qoder/skills/
 4. DOCTOR     触发 Doctor 修正结构漂移
 5. EVOLVER    条件性触发 Evolver 校准水位线
 6. REPORT     输出升级报告
═══════════════════════════════════════════
```

### 安全机制

- **Step 2 预检**：升级前必须 git commit/stash，确保 Doctor 修复可追溯
- **Step 3 隔离**：只部署 `.qoder/skills/` 目录，不触碰 `harness/` 运行时数据
- **Step 3 备份**：旧版 Skill 自动备份到 `harness/trace/skill-backups/pre-upgrade-*/`
- **Step 4 Doctor**：`--missing-only` 仅补全缺失文件，`--restore-fixed` 仅恢复规范基线
- **Step 5 Evolver**：仅在 Doctor 产生修改时触发，避免不必要的重算

---

## 数据流与协作

### Executor → Evolver 数据闭环

```
Executor 成功 → task_state.py complete → episode(outcome=success)  ─┐
Executor 失败 → task_state.py fail    → episode(outcome=failure)  ─┤
                                                                    ↓
                                            Evolver 读取全部 episodes
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ↓                               ↓
                             成功模式聚类                      失败模式分析
                             (Nudge → 新 Skill 草稿)     (Critic+Patcher → 补丁旧 Skill)
```

### Episode 数据格式（完整）

每个 episode 存储为独立的 pretty-printed JSON 文件：`harness/memory/episodes/<task_id>.json`

```json
{
  "task_id": "批量操作优化-20260413-1617",
  "task": "修复伪批量操作问题",
  "outcome": "success",
  "timestamp": "2026-04-13T16:30:23",
  "summary": "Completed: 修复伪批量操作问题",
  "files_changed": ["src/order/OrderService.java", "src/order/OrderRepository.java"],
  "files_created": ["src/order/BatchOrderValidator.java"],
  "validation": {"build": "pass", "lint": "pass", "test": "pass"},
  "friction": {
    "corrections": 1,
    "takeovers": 0,
    "retries": 0
  },
  "structured_lessons": {
    "decisions": [],
    "conventions": [],
    "pitfalls": ["原方案循环insert性能差，应使用批量insert"],
    "patterns": ["批量操作统一用 BatchValidator 校验后再写入"]
  },
  "task_profile": {
    "complexity": "standard",
    "modules_touched": ["src/order"],
    "layers_touched": ["service", "repository"]
  }
}
```

- **evolution_score**（读时计算）: `task_signal × interaction_signal × knowledge_signal`
  - `task_signal`: `{complex: 1.0, standard: 0.5, trivial: 0.2}[complexity]` + 跨模块加成(>2: +0.2) + 跨层加成(>3: +0.1), cap 1.0
  - `interaction_signal`: 取最高信号：takeovers>0→0.6, corrections>0→0.4, retries>0→0.3, 全零→0.1
  - `knowledge_signal`: `min(1.0, lesson_count × 0.2)`
- 失败 episode 额外包含 `failure_reason` 字段
- `files_changed` / `files_created`: 任务修改/新增的文件列表，供 Evolver Doc Sync 增量更新项目文档
- `structured_lessons` 四个桶：`decisions`（设计选择）、`conventions`（项目规范）、`pitfalls`（陷阱）、`patterns`（可复用模式）

### 七个 Skill 的协作关系

| 场景 | 协作链 |
|------|--------|
| 新项目 | Creator → Doctor 验证 → Executor 执行任务 |
| 日常开发 | Spec → Executor → Recorder → 自动触发 Evolver |
| 质量检查 | Doctor 扫描 → 发现问题 → Executor 修复 |
| 自进化 | Evolver 分析 → 创建 Skill 草稿 / 补丁 Skill → 人工 review |
| 需求分析 | Spec 生成规格说明 → Executor 按规格执行 |
| 经验归档 | Recorder 记录 episode → 触发 Evolver 进化 |
| 版本升级 | Upgrader 部署新 Skill → Doctor 修正结构 → Evolver 校准水位线 |

---

## 快速开始

### 1. 创建新项目的 Harness

```
Skill("harness-creator")
```
Creator 自动检测项目状态，分析架构，生成全套 harness 文件。

### 2. 诊断现有 Harness

```
Skill("harness-doctor")
```
Doctor 深度扫描，自动修复 P0-P2 问题，输出诊断报告。

### 3. 执行开发任务

```
Skill("harness-executor")
```
Executor 按七步流程执行：SETUP → PLAN → EXECUTE → VALIDATE → VERIFY → RECORD → PRESENT。

### 4. 手动触发进化

```
Skill("harness-evolver")
```
Evolver 全量分析执行历史，创建 Skill 草稿，修补已有 Skill。积累 3+ 任务后也会自动触发。

### 5. 升级已安装项目

```
Skill("harness-upgrader")
```
Upgrader 检测版本差异 → 部署新版 Skill → 触发 Doctor 修正结构漂移 → 条件性触发 Evolver 校准。

---

## 最佳实践

### Creator

- **遵循标准结构** — 不偏离 scaffold 模板
- **使用真实包名** — LAYER_MAP 基于实际扫描，不猜测
- **保持 AGENTS.md 简洁** — 80-120 行限制

### Doctor

- **定期运行** — 代码变更后跑一次
- **关注 P0 修复** — 结构问题立即修复
- **保持一致性** — 跨文件的层数据必须同步

### Executor

- **不跳过 Plan** — 所有任务强制计划阶段
- **四段式 Plan** — 背景 + Task N + 验证方式 + 涉及文件汇总
- **记录经验** — lessons 是 evolver 进化的燃料
- **失败也要记录** — `task_state.py fail` 记录失败同样重要

### Evolver

- **积累数据** — 更多执行 = 更好的模式识别
- **信任 LLM 语义聚类** — 不依赖规则匹配，Agent 自己判断模式
- **草稿需 review** — Nudge 生成的 Skill 永远不自动激活
- **备份优先** — 记忆修剪和 Skill 补丁前必须备份

### Upgrader

- **先 commit 再升级** — 确保 Doctor 修复可追溯
- **只部署 Skill 源码** — 不触碰 harness/ 运行时数据
- **升级后必跑 Doctor** — 新版 Skill 可能引入新必需文件

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| AGENTS.md 超过 120 行 | 详细说明移到 docs/，AGENTS.md 只保留链接 |
| lint-deps 报告假阳性 | 添加 KNOWN_EXCEPTIONS 注释说明原因 |
| Episode 没有写入 | 检查 task_state.py complete 是否执行（Step 6 HARD-GATE） |
| Evolver 没有识别模式 | episodes 太少（需 2+ 条语义相似任务），或已有 Skill 已覆盖 |
| Skill 补丁失败 | 自动回滚到 harness/trace/skill-backups/，检查 patcher 日志 |
| Memory 漂移 | Doctor HEAL 步骤自动归档过时 episode |
| 升级后结构不一致 | 运行 Upgrader，它会自动触发 Doctor 修复 |

---

## 附录：关键文件路径

```
harness/
  config/environment.json               # 环境配置
  memory/
    episodes/*.json                     # 情景记忆 (独立 JSON 文件, 成功+失败)
  tasks/<task-id>/state/                # 任务状态
  trace/
    failures/*.json                     # 失败详情
    improvements.jsonl                  # 改进记录
    critic-report.json                  # Critic 报告
    skill-backups/                      # Skill 补丁备份
  drafts/skills/<name>/SKILL.md         # Nudge 生成的 Skill 草稿

docs/exec-plans/
  active/*.md                           # 执行中的计划
  completed/*.md                        # 已归档的计划
```
