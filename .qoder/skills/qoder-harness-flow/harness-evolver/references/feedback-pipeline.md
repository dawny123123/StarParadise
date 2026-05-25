# 反馈流水线：Critic → Refiner

> "竞争优势不再是 prompt。而是你的 Harness 捕捉到的轨迹。" — AutoHarness 洞察：Harness 应该从每次失败中学习并自动改进自身。

本文档描述了将验证失败转化为 harness 改进的结构化反馈流水线。该流水线受 [AutoHarness 论文](https://arxiv.org/abs/2603.03329) 启发，该论文证明了通过环境反馈进行自动化 harness 精炼，可以使较小的模型 + harness 优于没有 harness 的较大模型。

## 核心循环

```
Agent 执行任务
    ↓
验证捕捉失败（verify_action.py / validate.py）
    ↓
失败记录到 harness/trace/failures/
    ↓
Critic 分析模式（harness_critic.py）
    ↓
Critic 产出改进建议
    ↓
Refiner 更新 harness（手动或自动）
    ↓
下一个 agent 受益于改进后的 harness
```

这是一个"学习过的拒绝采样器" — 可接受内容的定义基于观察到的失败而进化。

## 第 1 阶段：捕获

每次验证失败都应捕获为结构化格式。这在任务执行期间自动发生。

### 失败事件模式

```json
{
    "timestamp": "2026-03-24T10:30:00Z",
    "failure_type": "lint|build|test|verify|runtime",
    "error_message": "完整错误文本",
    "file_path": "internal/types/user.go",
    "line_number": 15,
    "rule_id": "layer-violation",
    "attempted_fix": "Agent 尝试的修复",
    "outcome": "fixed|still_failed|escalated",
    "context": {
        "task_id": "implement-auth",
        "phase": 2,
        "agent_session": "session-abc123"
    }
}
```

### 保存位置

| 来源 | 保存位置 | 格式 |
|--------|---------------|--------|
| 预验证拒绝 | `harness/trace/failures/YYYY-MM-DD.jsonl` | 每行一个事件 |
| 后验证失败 | `harness/trace/failures/YYYY-MM-DD.jsonl` | 每行一个事件 |
| 情景记忆事件 | `harness/memory/episodes/YYYY-MM-DD.jsonl` | 带事件的完整情景 |
| 验证报告 | `harness/trace/validation/YYYY-MM-DD-HHMMSS.json` | 完整 validate.py 报告 |

### 捕获触发器

子代理应在以下时刻记录失败：

1. **verify_action.py 返回 INVALID** — 记录提议的操作和拒绝原因
2. **validate.py 步骤失败** — 记录步骤、错误和任何尝试的修复
3. **达到 3 次重试限制** — 记录完整失败链，然后上报
4. **任务完成并带有经验** — `task_state.py complete --lessons` 写入情景记忆

## 第 2 阶段：Critic 分析

Critic 脚本（`scripts/harness_critic.py`）分析累积的失败以发现模式。在重要任务批次后或定期运行。

### 何时运行 Critic

| 触发器 | 命令 | 理由 |
|---------|---------|-----------|
| 完成一批任务后 | `python3 scripts/harness_critic.py --since 24h` | 上下文尚热时的即时反馈 |
| Harness 审计前 | `python3 scripts/harness_critic.py --json -o critic-report.json` | 数据驱动的审计 |
| 每周维护 | `python3 scripts/harness_critic.py --since 7d` | 捕捉缓慢积累的模式 |
| 失败激增后 | `python3 scripts/harness_critic.py --min-occurrences 3` | 识别根本原因 |

### Critic 输出：模式类型

| 模式类型 | 含义 | 典型修复 |
|-------------|---------------|-------------|
| `layer_violation` | Agent 持续将代码放在错误的层级 | 更新 ARCHITECTURE.md，改进 lint-deps 规则 |
| `naming_issue` | 重复的命名约定失败 | 添加示例到 DEVELOPMENT.md |
| `opaque_error` | 错误信息不解释如何修复 | 将 linter 消息重写为 WHAT+WHY+HOW |
| `missing_rule` | 构建失败本应由 lint 更早捕捉 | 添加新 lint 规则 |
| `failure_hotspot` | 同一文件反复失败 | 审查设计，添加组件特定文档 |

### 阅读 Critic 报告

```json
{
    "patterns_found": [
        {
            "pattern_id": "layer-violation-1",
            "pattern_type": "layer_violation",
            "occurrence_count": 7,
            "root_cause_hypothesis": "包 'internal/cache' 不在层级映射中",
            "suggested_fix": "将 'internal/cache' 添加到 lint-deps.go 的层级映射 L1",
            "fix_type": "update_layer_map",
            "priority": "P1",
            "confidence": 0.85
        }
    ],
    "recommendations": [
        {
            "priority": "P1",
            "action": "将 'internal/cache' 添加到 lint-deps.go 的层级映射 L1",
            "type": "update_layer_map",
            "impact": "影响 3 个文件，7 次出现"
        }
    ]
}
```

## 第 3 阶段：Refiner 操作

Refiner 使用 Critic 的建议更新 harness 组件。这可以由 harness-creator（重大变更）或手动（快速修复）完成。

### 修复类型 → 操作映射

| 修复类型 | 谁实现 | 如何 |
|----------|---------------|-----|
| `update_layer_map` | harness-creator 或手动 | 编辑 `scripts/lint-deps.go` 的层级映射变量 |
| `improve_error_message` | harness-creator 或手动 | 在 lint 脚本中重写错误格式以包含修复选项 |
| `add_rule` | harness-creator | 向现有 linter 添加新验证规则 |
| `update_docs` | harness-creator 或手动 | 更新 ARCHITECTURE.md、DEVELOPMENT.md 或设计文档 |

### Refiner 决策流程

```
读取 Critic 报告
    ↓
对每个建议：
    ├── P0（Critical）：立即修复，无需审批
    ├── P1（High）：立即修复，通知用户变更
    ├── P2（Medium）：排队等待下一个 harness-creator 改进周期
    └── P3（Low）：添加到 tech-debt-tracker.md
```

### 跟踪改进

应用修复后，更新反馈循环跟踪器：

```json
// harness/trace/improvements.jsonl（追加）
{
    "timestamp": "2026-03-24T14:00:00Z",
    "triggered_by": "critic-report-20260324",
    "pattern_id": "layer-violation-1",
    "action_taken": "将 internal/cache 添加到 lint-deps.go 的 L1",
    "files_modified": ["scripts/lint-deps.go", "docs/ARCHITECTURE.md"],
    "expected_impact": "防止 7+ 次未来的 cache 包层级违规",
    "verification": "make lint-arch 变更后通过"
}
```

## 第 4 阶段：验证循环

Refiner 应用变更后，验证改进是否确实有效：

1. **回归检查**：`make lint-arch && go test ./...`
2. **重放测试**：如果可能，重放原始失败场景以确认它们现在要么通过，要么产生更清晰的错误
3. **分数检查**：运行 `python3 scripts/detect_harness.py .` 验证 harness 分数没有下降

## 自动化流水线

### 集成点

| 集成 | 如何 | 频率 |
|-------------|-----|-----------|
| 任务完成钩子 | `task_state.py complete --lessons` 自动保存到情景记忆 | 每次任务 |
| 验证失败捕获 | 子代理在任何验证失败时记录到 `harness/trace/failures/` | 每次失败 |
| Critic 分析 | 协调器在任务批次之间运行 `harness_critic.py` | 每批次或每日 |
| Harness 改进 | 协调器决定：快速修复 vs. 排队等待 harness-creator | 基于优先级 |

### 目录结构

```
harness/
├── trace/
│   ├── failures/           # 原始失败事件（JSONL）
│   │   └── 2026-03-24.jsonl
│   ├── validation/         # 完整验证报告
│   │   └── 2026-03-24-103000.json
│   ├── improvements.jsonl  # 已应用的改进日志
│   └── critic-report.json  # 最新 Critic 分析
└── memory/
    └── episodes/           # 情景记忆（包含失败）
        └── 2026-03-24.jsonl
```

## Harness 改进的 Thompson 采样

AutoHarness 论文使用 Thompson 采样在精炼 harness 规则时平衡探索与利用。虽然我们不实现完整的树搜索算法，但关键洞察适用：

**探索**：为同一模式尝试不同的修复策略（例如，对于层级违规：将代码移到更高层级 vs. 注入依赖 vs. 定义接口）

**利用**：当修复策略多次生效时，对类似模式优先使用它

在情景记忆经验中跟踪这一点 — 当修复策略生效时，将其记录为经验，以便 Critic 可以为类似模式参考过去的经验。

当 Critic 识别出新的层级违规时，agent 可以查阅情景记忆经验，选择在特定上下文中效果最好的策略。
