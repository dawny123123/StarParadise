# Evolver Integration: Recorder → Evolver 数据契约

本文档定义了 harness-recorder（原 harness-executor Step 6-7）和 harness-evolver 之间的通信协议。两个 Skill 通过目标项目的 `harness/` 目录进行间接通信 — 不存在直接的脚本调用。

> **架构变更说明**: 原来由 executor Step 6 负责的 episode 写入和 evolver 触发，现在由独立的 harness-recorder skill 负责。数据格式和路径完全不变，只是触发源从 executor 变为 recorder。

## 通信架构

```
harness-recorder                          harness-evolver
═══════════════                          ═══════════════

Step 3: 写入 episodes ──→  harness/memory/episodes/*.jsonl  ──→ Step 2: Critic 读取
Step 5: Skill 调用     ──→  Skill(skill="harness-evolver")  ──→ 入口点

harness-executor (unchanged)              harness-evolver
════════════════                          ═══════════════

Step 3: 写入失败记录 ──→  harness/trace/failures/*.jsonl  ──→ Step 2: Critic 读取
Step 3.5: 写入 review ──→  harness/trace/review-patterns.jsonl ──→ Step 2: Critic 读取
```

## Recorder 写入的数据

### 1. 失败记录

**路径**: `harness/trace/failures/YYYY-MM-DD.jsonl`
**写入时机**: Step 4 (Validate) 和 Step 5 (Verify) 失败时
**格式**: JSONL，每行一个事件

```json
{
  "timestamp": "2026-03-24T10:30:00Z",
  "task_id": "add-auth-20260324-1030",
  "failure_type": "build_error|lint_violation|test_failure|verification_failure",
  "details": {
    "file": "internal/handler/auth.go",
    "line": 15,
    "rule": "layer-violation",
    "message": "error message",
    "attempted_fix": "what was tried",
    "fix_succeeded": false
  }
}
```

### 2. Episodic Memory

**路径**: `harness/memory/episodes/YYYY-MM-DD.jsonl`
**写入时机**: Step 3 (`task_state.py complete --lessons`), 由 harness-recorder 调用
**格式**: JSONL

```json
{
  "task_name": "Add user authentication",
  "task_id": "add-auth-20260324-1030",
  "status": "success",
  "started_at": "2026-03-24T14:00:00Z",
  "task": "Add user authentication",
  "outcome": "success",
  "timestamp": "2026-03-24T14:00:00Z",
  "lessons": ["lesson1", "lesson2"],
  "execution_source": "normal",
  "external_changes": [],
  "files_changed": ["src/auth.py", "src/middleware.py"],
  "files_created": ["src/auth_test.py"],
  "interaction_profile": {
    "interruption_count": 1,
    "correction_count": 0,
    "takeover_count": 0,
    "plan_revision_count": 0,
    "retry_count": 0,
    "friction_score": 0.15
  },
  "evolution_signals": {
    "high_friction": false,
    "has_takeover": false,
    "has_correction": false,
    "has_correction_lesson": false,
    "evolution_priority": null,
    "evolution_reasons": []
  },
  "structured_lessons": {
    "decisions": ["Use JWT for stateless auth instead of session-based"],
    "corrections": [],
    "knowledge": ["[CONVENTION] All middleware must call next() or return response"],
    "pitfalls": ["Token expiry must be checked before DB lookup to avoid unnecessary queries"]
  },
  "task_profile": {
    "complexity": "standard",
    "task_count": 2,
    "modules_touched": ["src/auth", "src/middleware"],
    "layers_touched": ["controller", "middleware"],
    "scope_breadth": 0.1
  }
}
```

字段说明：
- `task_name` / `task`: 任务描述（同值，后向兼容）
- `outcome`: 执行结果 (`success`, `failure`, `abandoned`) — **primary field**，Evolver 应读取此字段
- `status`: 同 `outcome`，**legacy field**，仅为后向兼容保留，新代码应使用 `outcome`
- `execution_source`: 执行来源 (`normal`, `resumed`, `orphan_sweep`)
- `external_changes`: 用户在 executor 之外的改动文件列表
- `interaction_profile`: 任务交互画像，含 `friction_score` (0~1)
- `evolution_signals`: executor 预计算的进化信号（确定性，Evolver 直接读标志位）
  - `evolution_priority`: `"P1"` / `"P2"` / `null`，Evolver 不需要自己比阈值
  - `evolution_reasons`: 人类可读的原因列表（如 `["user_takeover x1", "high_friction (score=0.55)"]`）

### 3. Review Patterns

**路径**: `harness/trace/review-patterns.jsonl`
**写入时机**: Step 4.5 (Cross-Model Review) 发现 recurring patterns 时
**格式**: JSONL

```json
{
  "type": "review_pattern",
  "patterns": ["pattern1", "pattern2"],
  "task_id": "add-auth-20260324-1030",
  "timestamp": "2026-03-24T12:00:00Z"
}
```

## 触发条件

Recorder Step 5 在以下条件下触发 evolver：

| 条件 | 阈值 | 计数范围 |
|------|------|---------|
| 新增完成任务数 | ≥ 3 | 自上次进化以来（读水位线） |
| 新增失败记录数 | ≥ 5 | 自上次进化以来（读水位线） |

触发调用：

```
Skill(skill="harness-evolver", args="--mode auto --project-root <project-root> --task-id <task-id> --trigger-reason <batch|failures>")
```

### 水位线机制

**路径**: `harness/trace/evolver-watermark.json`

```json
{
  "last_run": "2026-04-15T10:30:00.123456",
  "last_task_id": "batch-export-api-20260415-1030",
  "episodes_processed": 5,
  "run_mode": "auto"
}
```

- **Executor 读**（Step 6.3）：计算水位线之后的新增任务/失败数，达到阈值才触发
- **Evolver 读**（Step 1.2.1）：auto 模式只处理水位线之后的 episode
- **Evolver 写**（Step 7.1）：成功完成后，用已处理 episode 的最大 `timestamp` 更新水位线
- **崩溃安全**：水位线在 Step 7 才写入，Evolver 中途崩溃不会更新 → 下次重试同批数据
- **格式约定**：`last_run` 必须使用与 episode `timestamp` 相同的格式（`datetime.now().isoformat()`，无 `Z` 后缀、无时区），避免 aware/naive datetime 比较出错

## Evolver 读取的数据

Evolver 只从 `harness/` 目录读取数据，所有路径都由 harness-creator 的 `create-scaffold.sh` 预先创建：

| 数据 | 路径 | Evolver 使用步骤 |
|------|------|-----------------|
| 失败记录 | `harness/trace/failures/*.jsonl` | Step 2: Critic 分析 |
| Episodic memory | `harness/memory/episodes/*.json` (+ legacy `*.jsonl`) | Step 2: Critic 分析, Step 4.5: Doc Sync |
| Review patterns | `harness/trace/review-patterns.jsonl` | Step 2: Critic 分析 |

## Doc Sync 数据需求

Evolver Step 5.5（Task-Scoped Doc Sync）依赖 episode 中的以下字段做增量文档同步：

| 字段 | 来源 | 用途 |
|------|------|------|
| `files_changed` | Executor `task_state.py complete --files-changed` | 判断哪些项目文件被修改，分类影响范围 |
| `files_created` | Executor `task_state.py complete --files-created` | 检测新增的源文件/模块，判断是否需要补充 ARCHITECTURE.md |

Doc Sync 与 Doctor 的区别：

| 维度 | Doc Sync (Evolver Step 5.5) | Doctor Step 3.4 |
|------|---------------------------|-----------------|
| 触发方式 | 自动（每次 evolver 运行） | 手动 |
| 扫描范围 | 仅本批任务的 files_changed | 全项目 |
| 更新策略 | 精准补丁（只改受影响的段落） | 全量对齐 |
| 跳过条件 | >20 文件变更时跳过 | 无 |
| 适合场景 | 日常任务后的增量维护 | 大规模重构后的全量修复 |

## Evolver 产出的数据

Evolver 产出的改进也写回 `harness/` 目录，下次 executor 运行时自动受益：

| 产出 | 路径 | Executor 受益方式 |
|------|------|-----------------|
| 改进的 lint 规则 | `scripts/lint-*.{go,py,sh}` | Step 4: 更精确的 lint 检查 |
| 改进的文档 | `docs/*.md` | Step 1.4: 更准确的上下文 |
| 清理后的 memory | `harness/memory/` | Step 1.3: 更高效的内存查询 |


## 安全保证

1. **Task completion first**: Recorder 的 `task_state.py complete` 在 evolver 触发之前执行。即使 evolver 失败，任务已完成。
2. **No cross-dependency**: Recorder 不依赖 evolver 的任何脚本；evolver 不依赖 recorder 的任何脚本。Executor 只写失败记录和 review patterns，不直接触发 evolver。
3. **Data immutability**: Executor 写入的数据在 evolver 分析期间不会被修改（evolver 只在 Step 5 Memory 整理时才删除旧数据）。
4. **Graceful degradation**: 如果 evolver 不可用或未安装，executor 正常工作，只是不触发进化分析。
