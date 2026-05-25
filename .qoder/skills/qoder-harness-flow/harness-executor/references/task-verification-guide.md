# 任务感知验证指南（可选增强）

> **注意**：这是一个**可选增强**工具。主要验证机制是**Verifier 子代理**（见 `functional-verification-guide.md`），它基于任务上下文动态设计和执行验证。本文档记录的 `generate_task_verification.py` 脚本是一个补充工具，可以为独立 `verify.py` 工具预填充 `verify.json`。

运行时验证应该测试**实际变更的内容**，而不仅仅是通用健康检查。本指南解释如何使用 `generate_task_verification.py` 脚本生成任务特定的验证测试。

## 问题：通用验证不足

默认 verify.json 仅测试：
- 健康端点（GET /health → 200）
- `--version` 和 `--help` 标志

这遗漏了你实际实现的功能：
- 新 API 端点（POST /api/users）
- 修改的业务逻辑（更新的验证规则）
- 新 CLI 命令（export、migrate、sync）

## 解决方案：任务感知测试生成

`generate_task_verification.py` 可以可选地运行以：

1. **分析变更文件** → 检测新路由、命令、组件
2. **解析任务描述** → 提取预期行为
3. **生成定向测试** → 测试实际构建的内容
4. **更新 verify.json** → 自动添加新的测试用例

## 工作原理

### 输入：任务上下文

生成器需要这些输入：

| 输入 | 来源 | 示例 |
|-------|--------|---------|
| `--description` | 计划文件目标部分 | "Implement user registration API" |
| `--goal` | 计划文件目标部分 | "Users can register via POST /api/users" |
| `--files-changed` | 子代理 JSON 结果 | `internal/handler/user.go internal/service/user.go` |
| `--files-created` | 子代理 JSON 结果 | `internal/handler/register.go` |

### 处理：代码分析

脚本分析变更文件以检测：

**HTTP 路由（Go、TypeScript、Python）：**
```go
// Detected: POST /api/users
r.Post("/api/users", handler.CreateUser)
```

**CLI 命令（Cobra、Click、Typer）：**
```go
// Detected: command "export"
&cobra.Command{Use: "export", ...}
```

### 处理：描述分析

脚本从任务描述中提取预期：

| 模式 | 检测到的行为 |
|---------|-------------------|
| "implement user registration" | POST /users 端点 |
| "add export command" | CLI 命令 "export" |
| "create login flow" | POST /login 端点 |
| "list all products" | GET /products 端点 |

### 输出：验证建议

```json
{
  "suggestions": [
    {
      "type": "endpoint",
      "name": "post_api_users",
      "config": {
        "name": "post_api_users",
        "method": "POST",
        "path": "/api/users",
        "headers": {"Content-Type": "application/json"},
        "body": {},
        "expected": {"status": [200, 201, 400]}
      },
      "confidence": 0.9,
      "reason": "Matches expected POST /users from task description"
    }
  ],
  "updated_config": { ... }
}
```

### 置信度评分

| 分数 | 含义 | 操作 |
|-------|---------|--------|
| 0.9+ | 高置信度：代码 + 描述匹配 | 自动添加到 verify.json |
| 0.6-0.9 | 中等：代码中检测到，无描述匹配 | 自动添加基本断言 |
| < 0.6 | 低：仅来自描述，代码中未找到 | 建议但不自动添加 |

## 用法

### 独立用法（可选）

```bash
# 从已完成阶段提取上下文
TASK_DESCRIPTION="Implement user registration with email validation"
FILES_CHANGED="internal/handler/user.go internal/service/user.go"
FILES_CREATED="internal/handler/register.go"

# 生成任务感知验证配置
python3 "$SKILL_DIR/scripts/generate_task_verification.py" . \
  --description "$TASK_DESCRIPTION" \
  --files-changed $FILES_CHANGED \
  --files-created $FILES_CREATED

# 然后可选择用更新后的配置运行独立冒烟检查
python3 "$SKILL_DIR/scripts/verify.py" . --json
```

### CLI 选项

```bash
# 基本用法
python3 generate_task_verification.py . -d "task description"

# 使用所有上下文
python3 generate_task_verification.py . \
  -d "Implement user CRUD" \
  -g "Users can create, read, update, delete accounts" \
  --files-changed file1.go file2.go \
  --files-created file3.go

# 试运行（显示建议但不更新 verify.json）
python3 generate_task_verification.py . -d "..." --dry-run

# JSON 输出用于编程使用
python3 generate_task_verification.py . -d "..." --json

# 调整置信度阈值（默认 0.6）
python3 generate_task_verification.py . -d "..." --confidence-threshold 0.8
```

## 支持的模式

### HTTP 路由检测

**Go（chi、gin、echo、gorilla、net/http）：**
```go
r.Get("/api/users", ...)           // chi
r.GET("/api/users", ...)           // gin
e.GET("/api/users", ...)           // echo
r.HandleFunc("/api/users", ...).Methods("GET")  // gorilla
http.HandleFunc("/api/users", ...) // net/http
```

**TypeScript/JavaScript（Express、Fastify）：**
```typescript
app.get('/api/users', ...)
router.post('/api/users', ...)
@Get('/api/users')   // NestJS 装饰器
```

**Python（FastAPI、Flask）：**
```python
@app.get("/api/users")
@app.route("/api/users", methods=["GET"])
```

### CLI 命令检测

**Go（Cobra、urfave/cli）：**
```go
&cobra.Command{Use: "export", ...}
&cli.Command{Name: "export", ...}
```

**Python（Click、Typer）：**
```python
@click.command(name="export")
@app.command(name="export")
```

## 任务描述模式

生成器识别任务描述中的这些模式：

### CRUD 操作
| 短语 | 检测到 |
|--------|----------|
| "create user", "add user", "register user" | POST /users |
| "list users", "get all users" | GET /users |
| "get user by id", "fetch user" | GET /users/{id} |
| "update user", "modify user" | PUT /users/{id} |
| "delete user", "remove user" | DELETE /users/{id} |

### 认证
| 短语 | 检测到 |
|--------|----------|
| "login", "authenticate" | POST /login |
| "logout", "sign out" | POST /logout |
| "register", "signup" | POST /register |

### CLI 命令
| 短语 | 检测到 |
|--------|----------|
| "export to csv" | export --format csv |
| "import data" | import |
| "run migration" | migrate |
| "sync data" | sync |

## 示例

### 示例 1：用户注册 API

**任务：** "Implement user registration with email validation"

**变更文件：** `internal/handler/auth.go`
```go
r.Post("/api/v1/register", h.Register)
```

**生成的测试：**
```json
{
  "endpoints": [
    {
      "name": "register_user",
      "method": "POST",
      "path": "/api/v1/register",
      "headers": {"Content-Type": "application/json"},
      "body": {},
      "expected": {"status": [200, 201, 400]}
    }
  ]
}
```

### 示例 2：CLI 导出命令

**任务：** "Add export command to dump data to CSV"

**变更文件：** `cmd/cli/export.go`
```go
&cobra.Command{Use: "export", ...}
```

**生成的测试：**
```json
{
  "commands": [
    {
      "name": "test_export",
      "args": ["export"],
      "expected": {"exit_code": 0}
    },
    {
      "name": "test_export_help",
      "args": ["export", "--help"],
      "expected": {"exit_code": 0, "stdout_contains": ["Usage", "export"]}
    }
  ]
}
```

## 与验证流水线集成

```
┌─────────────────────────────────────────────────────────────┐
│ 可选：使用 generate_task_verification.py                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 使用任务上下文运行 generate_task_verification.py        │
│     └─ 更新 harness/config/verify.json                      │
│                                                             │
│  2. 运行 verify.py 进行独立冒烟检查（可选）                 │
│     └─ 测试：健康检查 + 任务特定端点                        │
│                                                             │
│  注意：主要验证机制是 Verifier                             │
│  子代理，它不依赖 verify.json。                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 元数据跟踪

生成器将 `_task_verification` 元数据添加到 verify.json 用于可追溯性：

```json
{
  "_task_verification": {
    "task_description": "Implement user registration...",
    "files_analyzed": ["internal/handler/auth.go", "internal/service/auth.go"],
    "routes_detected": 3,
    "commands_detected": 0,
    "suggestions_count": 4,
    "auto_added_count": 3
  }
}
```

这有助于跟踪：
- 什么任务生成了这些测试
- 分析了哪些文件
- 多少测试是自动添加的 vs 建议的

## 限制和未来工作

### 当前限制

1. **测试数据生成**：创建占位符 `body: {}` —— 不生成真实的测试数据
2. **认证**：不自动为受保护端点添加认证头
3. **前端**：聚焦后端（路由、CLI）；前端组件检测有限
4. **复杂断言**：生成基本状态检查；复杂 JSON 模式验证尚未支持

### 未来增强

1. **智能测试数据**：分析请求模式以生成有效的测试负载
2. **认证检测**：检测中间件装饰器并添加适当的令牌
3. **契约测试**：提取 OpenAPI 规范并验证
4. **前端分析**：检测 React/Vue 组件并生成页面测试

## 故障排除

### 添加了端点但未检测到路由

- 检查文件扩展名是否受支持（.go、.ts、.js、.py）
- 验证路由模式是否匹配支持的框架
- 检查文件是否在 `--files-changed` 或 `--files-created` 中
- 使用 `--dry-run --json` 查看分析了什么

### 置信度分数低

- 向 `--description` 和 `--goal` 添加更多上下文
- 使用明确短语如 "implement POST /api/users"
- 验证检测到的路由是否匹配你的实际代码

### 测试因 401/403 失败

- 生成器不自动添加认证头
- 手动编辑 verify.json 添加 `Authorization` 头
- 或在先决条件中配置测试用户/令牌

---

## 与功能验证集成

`generate_task_verification.py` 是一个**可选增强**工具，为独立 `verify.py` 工具生成 `verify.json` 配置。

**主要验证机制**是**Verifier 子代理**，它：
- 启动实际应用程序
- 发出真实 HTTP 请求
- 验证副作用和数据持久化
- 生成 `verification-report.json`（完成门控）

### 何时使用哪个

| 场景 | 工具 | 说明 |
|----------|------|-------|
| 快速独立冒烟检查 | `verify.py` | 可选，不属于 Skill 流程 |
| 所有功能验证 | Verifier 子代理 | **主要** —— 完成门控 |

Verifier 子代理处理所有验证需求：端点检查、输入验证、多步流程、CRUD 生命周期、CLI 命令和副作用验证。

> **注意**：Skill 流程**仅**使用 Verifier 子代理。`generate_task_verification.py` + `verify.py` 流水线可作为可选独立工具供希望在 Skill 流程之外进行快速冒烟检查的开发者使用。
