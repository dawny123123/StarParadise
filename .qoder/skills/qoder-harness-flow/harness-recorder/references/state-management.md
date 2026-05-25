# 状态管理

如何跟踪任务状态、检查点和情景记忆。

## 为什么状态管理很重要

三个具体原因：
1. 如果上下文在工具调用 60+ 时降级，重新读取状态文件可以恢复你的位置
2. 如果任务被中断，你（或其他代理）可以从上一个检查点恢复
3. 决策日志防止与早期的架构选择相矛盾

所有任务使用相同的状态管理流程。没有捷径。

## 任务目录结构

每个任务在 `harness/tasks/` 下都有自己的隔离目录：

```
harness/
└── tasks/
    ├── current -> plugin-architecture-20260324-1600/  （指向活动任务的符号链接）
    ├── plugin-architecture-20260324-1600/
    │   ├── state/
    │   │   ├── task.json        # 任务元数据和状态
    │   │   ├── context.json     # 当前执行上下文
    │   │   ├── decisions.json   # 决策日志（可选）
    │   │   └── result.json      # 最终结果（完成时写入）
    │   └── checkpoints/
    │       ├── phase-1.json
    │       └── phase-2.json
    └── event-refactor-20260323-0900/   （之前的任务）
        └── ...
```

## 使用 task_state.py

`scripts/task_state.py` CLI 处理所有状态管理。优先使用它而不是手动 bash 命令。

### 任务生命周期

```bash
# Step 2: 初始化
python3 scripts/task_state.py init "plugin-architecture" \
  --tasks 4 \
  --description "Redesign plugin loading system" \
  --plan-path "docs/exec-specs/plugin-architecture/tasks.md"

# Step 3: 每个任务后检查点（单任务计划可选）
python3 scripts/task_state.py checkpoint \
  --task-num 2 \
  --summary "Types defined, interfaces implemented" \
  --decisions '["Put EventBus in L0 for cross-layer access"]' \
  --files-changed internal/event/event.go internal/message/queue.go

# Step 6: 完成（需要 verification-report.json）
python3 scripts/task_state.py complete \
  --summary "Plugin architecture implemented with lazy loading" \
  --files-changed internal/plugin/loader.go internal/plugin/registry.go \
  --files-created internal/plugin/types.go \
  --validation '{"build": "pass", "lint": "pass", "test": "pass"}' \
  --lessons '["Plugin interfaces must be in L0 to avoid circular deps"]'
```

> ⚠ `complete` 命令强制执行验证门控 —— 如果缺少 `harness/trace/verification-report.json` 或缺少 HTTP 证据，它将拒绝。

### 查询命令

```bash
# 显示任务详情
python3 scripts/task_state.py show --task-id <TASK_ID>
python3 scripts/task_state.py show --json  # 当前任务，JSON 输出

# 列出所有任务
python3 scripts/task_state.py list
python3 scripts/task_state.py list --json
```

## 文件模式

### task.json

```json
{
  "task_id": "plugin-architecture-20260324-1600",
  "task": "Redesign plugin loading system",
  "started_at": "2026-03-24T16:00:00+08:00",
  "plan_path": "docs/exec-specs/plugin-architecture/tasks.md",
  "spec_path": "docs/exec-specs/plugin-architecture",
  "task_num": 1,
  "total_tasks": 4,
  "status": "in_progress",
  "complexity": "standard"
}
```

状态值：`in_progress`、`completed`、`failed`、`blocked`。

### 跨 Skill 握手协议

task.json 是三个 skill（spec → executor → recorder）之间的唯一状态交接协议：

| 字段 | 写入方 | 读取方 | 说明 |
|------|--------|--------|------|
| `task_id` | harness-spec (init) | executor, recorder | 全局唯一任务标识 |
| `plan_path` | harness-spec (init) | executor | 指向 tasks.md（向后兼容） |
| `spec_path` | harness-spec (init --spec-path) | executor, recorder | 指向 spec 目录（`docs/exec-specs/<slug>/`） |
| `total_tasks` | harness-spec (init) | executor | Task 数量 |
| `status` | executor (checkpoint/complete) | recorder | 执行状态 |
| `task_checkpoints` | executor (checkpoint) | recorder | 已完成的 task 列表 |

> **spec_path vs plan_path**: `spec_path` 指向 spec 目录（包含 requirement.md / decomposition.md / tasks.md / acceptance.md），`plan_path` 指向 tasks.md 文件（向后兼容旧 executor）。新 executor 应优先使用 `spec_path`。

### context.json

```json
{
  "completed": [
    "Task 1: types defined in internal/event/event.go",
    "Task 2: PriorityQueue upgraded to heap-based"
  ],
  "current": "Task 3: Implementing EventBridge adapter",
  "remaining": ["Task 4: Migrate TUI", "Task 5: Validation"],
  "key_decisions": [
    "EventBus placed in L0 (internal/event/) — no internal imports",
    "EventSink.OnTurnComplete changed to primitive types to avoid L1 dependency"
  ],
  "files_modified": ["internal/event/event.go", "internal/message/queue.go"],
  "files_created": ["internal/event/bridge.go"],
  "validation_command": "go build ./... && make lint-arch && go test -race ./...",
  "deviations": [
    "Modified internal/config/settings.go (not in original plan scope)"
  ],
  "task_checkpoints": {
    "1": {"summary": "Types defined in internal/event/event.go", "timestamp": "2026-03-24T16:30:00+08:00"},
    "2": {"summary": "PriorityQueue upgraded to heap-based", "timestamp": "2026-03-24T17:15:00+08:00"}
  }
}
```

增强版 `task_state.py` 新增字段：

- **`deviations`**: 在检查点期间记录的范围漂移警告数组。每个条目描述了一个被修改或创建但未列在计划的 `## 涉及文件汇总` 部分中的文件。在调用 `checkpoint` 时由 `detect_scope_drift()` 自动填充。
- **`task_checkpoints`**: 将任务编号（字符串）映射到带时间戳的检查点摘要的对象。在调用 `checkpoint` 时自动更新。在任务完成期间由 `validate_task_completion()` 使用，以验证所有任务都已检查点。

### decisions.json（可选，用于重要的架构选择）

```json
[
  {
    "decision": "Put EventBus in L0 instead of L1",
    "reasoning": "All layers need to publish/subscribe; L0 has no internal deps",
    "alternatives": ["Put in provider (L1) — rejected: TUI couldn't use it"]
  }
]
```

### result.json（完成时写入）

```json
{
  "status": "success",
  "files_changed": ["path/to/file"],
  "files_created": ["path/to/new-file"],
  "validation": {"build": "pass", "lint": "pass", "test": "pass"},
  "tool_calls_used": 42,
  "blockers": [],
  "summary": "Implemented plugin loading with lazy initialization"
}
```

## 情景记忆

情景记录为 `harness/memory/episodes/<task_id>.json` 中的独立 JSON 文件：

```json
{
  "task_id": "msg-queue-refactor-20260323-0900",
  "task": "Refactor message queue and event system",
  "outcome": "success",
  "timestamp": "2026-03-23T10:30:00.123456",
  "files_changed": ["src/event/bus.ts", "src/queue/handler.ts"],
  "files_created": ["src/event/sink.ts"],
  "complexity": "standard",
  "modules_touched": ["src/event", "src/queue"],
  "layers_touched": ["service", "interface"],
  "friction": {
    "corrections": 1,
    "takeovers": 0,
    "retries": 0
  },
  "lessons": {
    "decisions": ["EventSink interface must use primitive types for L0 compatibility"],
    "conventions": [],
    "pitfalls": [],
    "patterns": ["TUI can subscribe to EventBus via async handler to avoid blocking"]
  }
}
```

### 情景字段参考

| 字段 | 类型 | 说明 |
|---|---|---|
| `task_id` | string | 唯一任务标识符 |
| `task` | string | 任务描述 |
| `outcome` | string | "success"、"failure" 或 "abandoned" |
| `timestamp` | string | 完成时的 ISO 时间戳 |
| `failure_reason` | string? | 仅在 outcome="failure" 时存在 |
| `files_changed` | string[] | 任务期间修改的文件 |
| `files_created` | string[] | 任务期间创建的文件 |
| `complexity` | string | "trivial"、"standard" 或 "complex" |
| `modules_touched` | string[] | 受影响的项目模块 |
| `layers_touched` | string[] | 受影响的架构层 |
| `friction` | object | `{corrections, takeovers, retries}` — 交互摩擦计数 |
| `lessons` | object | `{decisions, conventions, pitfalls, patterns}` — 四桶分类 |

## 恢复被中断的任务

```bash
# 检查活动任务
python3 scripts/task_state.py list

# 显示完整状态
python3 scripts/task_state.py show --task-id <TASK_ID> --json
```

协调器读取状态并将上下文传递给一个新的子代理，该子代理从之前中断的地方继续。
