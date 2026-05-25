# 功能验证指南

本文档描述**功能验证** —— 智能验证层，通过启动应用程序、发出真实 HTTP 请求并验证可观察行为来测试功能是否真正可用。

---

## 双层验证架构

```
                    ┌──────────────┐
                    │  功能验证     │  ← Verifier 子代理（所有任务强制）
                    │  Verifier     │     启动服务器、执行场景、验证副作用
                    ├──────────────┤
                    │  静态验证     │  ← validate.py（确定性）
                    │  Validate     │     构建、Lint、测试
                    └──────────────┘
```

| 层级 | 工具 | 检查内容 | 阻塞？ | 时机 |
|-------|------|----------------|-----------|------|
| 静态 | `validate.py` | 代码编译、Lint 通过、测试通过 | 是 — 必须通过 | 第 4 步 |
| 功能 | Verifier 子代理 | 服务器启动、端点工作、数据持久化、副作用发生 | **是 — 完成门控** | 第 5 步 |

> **关键洞察**：静态验证证明代码能编译。功能验证证明代码*能工作*。Verifier 子代理是运行时行为的唯一真相来源 —— 它启动应用程序、发出真实 HTTP 请求、并带有证据地报告。

---

## 功能验证何时运行

功能验证对**所有任务**运行，没有例外。场景数量随变更范围扩展：

| 变更范围 | 场景数 |
|--------------|-----------|
| 单文件、窄范围变更 | 1-2 个聚焦场景 |
| 多文件功能 | 2-5 个场景，覆盖成功路径、错误路径、副作用 |
| 跨层或架构性 | 2-5 个场景加回归检查 |

---

## 第 5 步流程

```
第 5 步：验证（功能）
═══════════════════════════════════════════════════

5.1  设计验证场景（协调器）
      │  基于 task_description、files_changed、environment.json
      ↓

5.2  生成 Functional Verifier 子代理
      │ 启动服务器
      │ 等待就绪（健康端点 / TCP / 日志模式）
      │ 执行所有场景
      │ 验证行为 + 副作用
      │ 停止服务器
      │ 返回 verification-report.json
      ↓

5.3  验证报告（护栏检查）
      ⚠ 如缺少 verification-report.json 则拒绝
      ⚠ 如报告缺少 HTTP 请求/响应证据则拒绝

─── 第 6 和第 7 步（记录与展示）由协调器处理 ───
6.   task_state.py complete → 移动计划 → AutoHarness 分析
7.   向用户展示结果
```

---

## 设计任务特定场景

**这是协调器在第 5.1 步的工作。** 完整详情见 `references/scenario-design-guide.md`。

快速检查清单：
1. 从子代理结果中读取 `files_changed` 和 `files_created`
2. 识别行为变更内容（新端点、修改逻辑、新验证规则等）
3. 设计验证**实际变更**的场景
4. 使用 `environment.json` 了解可用的数据库/服务
5. 包含 `why` 字段解释每个场景的业务原因

示例：

```json
{
  "task_specific_scenarios": [
    {
      "name": "verify_user_registration_persists",
      "description": "Verify POST /api/register creates user in database",
      "requires": ["postgres"],
      "steps_hint": [
        "POST /api/register with valid data",
        "Assert 201 response",
        "GET /api/users/{id} to verify persistence"
      ],
      "why": "Core success path - user must be persisted",
      "priority": "high"
    }
  ]
}
```

---

## 生成 Verifier 子代理

协调器用完全自包含的提示词生成 Verifier：

```python
env_config = load_json("harness/config/environment.json") if exists else {}
predefined = env_config.get("functional_scenarios", [])
task_scenarios = [...] # 在第 5.1 步设计

Agent(
    description=f"Functional Verifier: {task_name}",
    prompt=f"""
You are a Functional Verifier agent. Read the verifier guide at:
{SKILL_DIR}/agents/verifier.md

## Task Context
- Project root: {PROJECT_ROOT}
- Task description: {task_description}
- Files changed: {files_changed}
- Files created: {files_created}

## Environment Context
{json.dumps(env_config, indent=2)}

## Application
- Start command: {env_config.get("runtime", {}).get("dev_command", "<from DEVELOPMENT.md>")}
- Test environment: {json.dumps(env_config.get("test_environment", {}).get("env_vars", {}))}

## Scenarios to Verify

### Pre-defined (from environment.json):
{json.dumps(predefined, indent=2) if predefined else "None"}

### Task-Specific (designed by Coordinator):
{json.dumps(task_scenarios, indent=2)}

## Your Responsibilities
1. Start the application server
2. Execute ALL task-specific scenarios (priority 1)
3. Execute ALL pre-defined scenarios (priority 2)
4. For each: verify behavior AND side effects with real HTTP requests
5. Stop the server cleanly
6. Report with evidence

## Output
Save results to: harness/trace/verification-report.json
"""
)
```

---

## Verifier 输出

Verifier 生成 `harness/trace/verification-report.json`：

```json
{
  "overall_status": "pass | partial | fail",
  "server": {
    "started": true,
    "ready_in_seconds": 2.3,
    "stopped_cleanly": true
  },
  "task_specific_scenarios": [
    {
      "name": "verify_user_registration_persists",
      "source": "coordinator_designed",
      "why": "Core success path - user must be persisted",
      "status": "pass",
      "steps": [...],
      "evidence": "User created and retrievable by ID",
      "duration_seconds": 1.5
    }
  ],
  "predefined_scenarios": [
    {
      "name": "user_auth_flow",
      "source": "environment_json",
      "status": "pass",
      "relevant_to_task": true,
      "steps": [...],
      "evidence": "...",
      "duration_seconds": 2.0
    }
  ],
  "additional_checks": [...],
  "summary": {
    "task_specific_total": 3,
    "task_specific_passed": 3,
    "predefined_total": 2,
    "predefined_passed": 2,
    "pass_rate": 1.0
  },
  "timing": {
    "total_seconds": 8.5
  }
}
```

---

## 结果解读

### 总体状态

| 状态 | 含义 | 操作 |
|--------|---------|--------|
| `pass` | 所有场景通过 | 继续完成流程 |
| `partial` | 部分场景通过，部分失败或跳过 | 查看失败项，决定是否阻塞 |
| `fail` | 关键（任务特定）场景失败 | 修复问题，重新运行 |

### 基于优先级的失败处理

| 场景来源 | 失败时 |
|-----------------|------------|
| `task_specific_scenarios` | **阻塞** — 必须修复并重试 |
| `predefined_scenarios`（与任务相关） | 很可能阻塞 — 修复，除非明显无关 |
| `predefined_scenarios`（无关） | 警告 — 记录并继续 |

---

## 功能验证能发现什么

对注册端点的变更：

| 检查类型 | 静态验证看到什么 | 功能验证看到什么 |
|------------|---------------------------|------------------------------|
| 编译 | 代码编译 ✓ | — |
| 状态 | — | POST /register → 201 ✓ |
| 持久化 | — | GET /users/{id} → 404 ✗（未保存！） |
| 认证流程 | — | POST /login → 401 ✗（密码哈希错误） |
| 副作用 | — | 未发送邮件确认 ✗ |

这就是功能验证存在的原因 —— 它捕获**通过静态检查的语义 bug**。

---

## 向后兼容

- `environment.json` 是**可选的** —— 没有它的项目仍然获得任务特定验证
- 预定义的 `functional_scenarios[]` 补充任务特定场景，而非替代它们
- 独立的 `verify.py` 脚本仍可作为独立工具用于快速手动冒烟检查，但不属于自动化 Skill 流程
