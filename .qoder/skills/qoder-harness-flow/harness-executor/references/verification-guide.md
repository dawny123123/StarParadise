# verify.py 独立工具指南

> **注意**：本指南将 `verify.py` 记录为用于快速冒烟测试的**独立命令行工具**。harness-executor Skill 流程使用**Verifier 子代理**（见 `functional-verification-guide.md`）作为主要验证机制。`verify.py` 仍可以手动运行以进行快速健全性检查。

`verify.py` 运行确定性冒烟检查：启动服务器、检查健康端点、运行 CLI 命令并验证前端渲染。在生成完整的 Verifier 子代理之前，用于快速本地测试。

## 何时使用 verify.py

| 用例 | 工具 |
|----------|------|
| 快速本地健全性检查 | `verify.py`（此工具） |
| Skill 集成验证 | Verifier 子代理（见 functional-verification-guide.md） |
| 任务完成门控 | Verifier 子代理（生成 verification-report.json） |

## 架构

```
harness/config/verify.json          ← 配置（由 creator 生成，用户自定义）
         ↓
verify.py --generate-config         ← 自动检测应用类型，创建默认配置
verify.py .                         ← 运行完整验证流水线
verify.py . --type server           ← 仅运行服务器验证
         ↓
┌─────────────────────────────────────┐
│    先决条件（飞行前检查）            │
│                                     │
│ • 数据库连通性                      │
│ • 必需的环境变量                    │
│ • 外部服务可达性                    │
│ • 自定义命令成功                    │
└──────────────┬──────────────────────┘
               │ 全部通过？
               ↓
┌─────────────────────────────────────┐
│         验证流水线                   │
├──────────┬──────────┬───────────────┤
│  服务器   │   CLI    │   前端         │
│          │          │               │
│ 启动 →   │ 构建 →   │ 开发服务器 →   │
│ 就绪 →   │ 运行 →   │ 就绪 →        │
│ 测试 →   │ 检查 →   │ CDP 测试 →    │
│ 停止     │          │ 停止          │
└──────────┴──────────┴───────────────┘
         ↓
    冒烟测试
         ↓
    清理
         ↓
  验证报告（JSON）
```

## 先决条件（环境飞行前检查）

**新增**：运行任何验证前，`verify.py` 检查环境是否就绪。这防止了因缺少数据库连接、密钥或服务而浪费时间的验证尝试。

### 先决条件检查什么

| 检查类型 | 验证内容 | 示例 |
|---|---|---|
| `databases` | 数据库连通性（MySQL、PostgreSQL、Redis 等） | 能否连接到 `$DB_HOST:$DB_PORT` |
| `env_vars` | 必需环境变量存在且有有效值 | `JWT_SECRET` 已设置且非空 |
| `services` | 外部服务可达 | Auth 服务 `http://localhost:9000/health` 返回 200 |
| `commands` | 自定义命令成功 | `docker info` 退出码 0 |
| `paths` | 必需文件/目录存在 | `docker-compose.yml` 存在 |

### 先决条件失败行为

如有**必需**的先决条件失败：
- 验证被**跳过**（不视为失败）
- 清晰的错误消息解释缺少什么
- 退出码为 2（设置失败）

如有**非必需**的先决条件失败：
- 记录警告
- 验证继续

### 示例：带 MySQL 的 Spring Boot

```json
{
  "prerequisites": {
    "databases": [
      {
        "name": "MySQL Database",
        "type": "mysql",
        "host_env": "DB_HOST",
        "port_env": "DB_PORT",
        "required": true
      }
    ],
    "env_vars": [
      {"name": "DB_HOST", "required": true, "not_empty": true},
      {"name": "DB_PORT", "required": true},
      {"name": "DB_USERNAME", "required": true},
      {"name": "DB_PASSWORD", "required": true},
      {"name": "JWT_SECRET", "required": true}
    ]
  }
}
```

### 跳过先决条件

对于没有完整基础设施的 CI 环境：

```json
{
  "prerequisites": {
    "skip": true
  }
}
```

或通过命令行：

```bash
verify.py . --skip-prerequisites
```

## 配置

### 配置位置

`harness/config/verify.json` —— 由 harness-creator 创建或由 verify.py 在首次运行时自动生成。

### 配置如何创建

1. **harness-creator** 分析项目并在创建或全新模式期间生成 `verify.json`
2. 如果没有配置，**verify.py** 自动检测应用类型并生成默认配置
3. 用户可以手动编辑配置以添加端点、CLI 命令或页面测试

### 自动检测启发式

verify.py 通过评分指标确定应用类型：

**服务器指标：**
- `cmd/server/` 目录存在 (+3)
- Go 源代码中有 `http.ListenAndServe` (+2)
- package.json 中有 Express/Fastify/Koa/Hono (+3)
- Python 源代码中有 FastAPI/Flask (+3)

**CLI 指标：**
- `cmd/cli/` 目录存在 (+3)
- Cobra/urfave/cli 导入 (+2)
- package.json 中有 Commander/yargs (+2)

**前端指标：**
- package.json 中有 React/Vue/Svelte/Next/Vite (+3)
- dev 脚本中有 Vite/Next (+2)

如果多种类型得分高，应用为"hybrid"，所有相关验证类型都运行。

## 服务器验证

### 工作原理

1. **启动** —— 将服务器作为后台进程启动
2. **就绪** —— 轮询直到服务器就绪（HTTP 健康检查、TCP 端口或日志模式）
3. **端点测试** —— 发送 HTTP 请求并检查响应
4. **停止** —— 优雅关闭服务器（SIGTERM → 等待 → 如需要则 SIGKILL）

### 就绪策略

| 策略 | 何时使用 | 配置 |
|---|---|---|
| `http` | 服务器有健康端点 | `endpoint`、`expected_status` |
| `tcp` | 无健康端点，但已知端口 | `host`、`port` |
| `log_pattern` | 服务器日志输出 "ready" 消息 | `pattern`（正则） |
| `command` | 自定义就绪检查 | `command`（退出码 0 = 就绪） |

### 端点测试

每个端点测试指定：
- **方法 + 路径** —— 调用什么
- **请求头 + 请求体** —— 发送什么
- **预期响应** —— 状态码、响应体内容、JSON 路径断言

JSON 路径断言使用简化语法：
```json
{"path": "$.data.id", "operator": "exists"}
{"path": "$.data.name", "operator": "equals", "value": "test"}
{"path": "$.items", "operator": "type", "value": "array"}
```

### 示例：验证 Go API 服务器

```json
{
  "server": {
    "start": {
      "command": "go run cmd/server/main.go",
      "env": {"PORT": "8081", "ENV": "test", "DB_URL": "sqlite3://:memory:"},
      "background": true
    },
    "readiness": {
      "type": "http",
      "endpoint": "http://localhost:8081/health",
      "timeout_seconds": 30
    },
    "endpoints": [
      {"name": "health", "method": "GET", "path": "/health", "expected": {"status": 200}},
      {
        "name": "list users",
        "method": "GET",
        "path": "/api/v1/users",
        "expected": {"status": 200, "json_path": [{"path": "$.data", "operator": "type", "value": "array"}]}
      }
    ],
    "stop": {"signal": "SIGTERM", "graceful_timeout_seconds": 5}
  }
}
```

## CLI 验证

### 工作原理

1. **构建** —— 可选地先构建 CLI 二进制文件
2. **命令测试** —— 运行 CLI 命令并检查退出码、stdout、stderr 和文件输出

### 测试什么

聚焦测试核心功能的命令：
- `--version` 和 `--help` —— 基本健全性
- 典型输入的核心命令
- 错误情况（错误输入 → 非零退出码）
- 文件输出命令（验证文件是否以预期内容创建）

### 示例：验证 CLI 工具

```json
{
  "cli": {
    "binary": {
      "build_command": "go build -o bin/mycli cmd/cli/main.go",
      "path": "bin/mycli"
    },
    "commands": [
      {"name": "version", "args": ["--version"], "expected": {"exit_code": 0, "stdout_matches": "v\\d+\\.\\d+"}},
      {"name": "help", "args": ["--help"], "expected": {"exit_code": 0, "stdout_contains": ["Usage", "Commands"]}},
      {
        "name": "process file",
        "args": ["process", "--input", "testdata/sample.json", "--output", "/tmp/result.json"],
        "expected": {
          "exit_code": 0,
          "file_created": ["/tmp/result.json"],
          "file_content": [{"path": "/tmp/result.json", "contains": ["processed"]}]
        }
      },
      {"name": "bad input", "args": ["process", "--input", "nonexistent.json"], "expected": {"exit_code": 1}}
    ]
  }
}
```

## 前端验证（CDP）

### 工作原理

1. **开发服务器** —— 将前端开发服务器作为后台进程启动
2. **就绪** —— 轮询直到开发服务器响应
3. **页面测试** —— 使用 headless Chrome 加载页面、运行操作并检查断言
4. **截图** —— 可选地捕获截图（用于调试失败）

### Chrome DevTools 协议

verify.py 在简化模式下使用 headless Chrome。对于完整的 CDP 交互（点击按钮、填写表单），它使用 `--headless` 和 `--screenshot` 标志启动 Chrome。

对于更复杂的测试（多步用户流程、SPA 导航），考虑：
- 将 Playwright/Puppeteer 添加为项目依赖
- 在 `verify.json` 中配置测试命令以运行这些测试

### 页面断言

| 断言类型 | 检查内容 |
|---|---|
| `element_exists` | 匹配选择器的 DOM 元素存在 |
| `element_text` | 元素的文本内容匹配 |
| `element_visible` | 元素可见（未隐藏） |
| `no_console_errors` | 无 console.error() 调用 |
| `no_network_errors` | 无失败的网络请求 |
| `title` | 页面标题匹配 |
| `url` | 当前 URL 匹配 |
| `evaluate` | 自定义 JS 表达式返回 true |

### 示例：验证 React 应用

```json
{
  "frontend": {
    "dev_server": {
      "command": "npm run dev",
      "env": {"PORT": "3001"},
      "background": true
    },
    "readiness": {"type": "http", "url": "http://localhost:3001", "timeout_seconds": 60},
    "browser": {"headless": true},
    "pages": [
      {
        "name": "homepage",
        "url": "/",
        "wait_for": {"type": "selector", "selector": "#root"},
        "assertions": [
          {"type": "element_exists", "selector": "#root"},
          {"type": "no_console_errors"},
          {"type": "title", "expected": "My App"}
        ]
      },
      {
        "name": "dashboard after login",
        "url": "/login",
        "actions": [
          {"type": "type", "selector": "#email", "value": "admin@test.com"},
          {"type": "type", "selector": "#password", "value": "test123"},
          {"type": "click", "selector": "button[type=submit]"},
          {"type": "wait", "timeout_ms": 3000}
        ],
        "assertions": [
          {"type": "url", "expected": "/dashboard"},
          {"type": "element_visible", "selector": ".stats-panel"}
        ],
        "screenshot": {"path": "harness/screenshots/dashboard.png"}
      }
    ]
  }
}
```

## 独立用法

> **提醒**：此工具**不**属于 harness-executor Skill 流程。Skill 使用 Verifier 子代理进行功能验证。使用 `verify.py` 进行快速手动健全性检查。

### 命令

```bash
# 完整运行时验证（自动检测或使用 verify.json）
python3 $SKILL_DIR/scripts/verify.py .

# JSON 输出用于编程解析
python3 $SKILL_DIR/scripts/verify.py . --json

# 仅特定类型
python3 $SKILL_DIR/scripts/verify.py . --type server

# 详细调试输出
python3 $SKILL_DIR/scripts/verify.py . -v

# 生成配置但不运行
python3 $SKILL_DIR/scripts/verify.py . --generate-config

# 保存报告
python3 $SKILL_DIR/scripts/verify.py . --json --output harness/trace/verify-report.json
```

### 退出码

| 代码 | 含义 |
|---|---|
| 0 | 所有验证通过 |
| 1 | 一个或多个必需验证失败 |
| 2 | 配置错误或设置失败 |

## 最佳实践

### 编写良好的端点测试

- 测试你的变更实际影响的端点
- 同时包含成功路径（200）和错误路径（400/404）测试
- 对结构化响应使用 JSON 路径断言
- 保持超时合理（大多数 10 秒，重计算更长）

### 编写良好的 CLI 测试

- 始终测试 `--version` 和 `--help` 作为基线
- 使用类似真实世界的输入，不仅仅是简单情况
- 同时检查 stdout 内容和退出码
- 清理测试命令创建的任何文件

### 编写良好的页面测试

- 以"页面加载无控制台错误"作为基线
- 测试关键用户流程，不是每个可能的交互
- 使用稳定选择器（ID、data 属性）而非脆弱选择器（nth-child、类名）
- 失败时截图有助于调试

### 何时跳过运行时验证

- **库项目** —— 没有可验证的服务器、CLI 或前端。静态测试足够。
- **纯重构** —— 如果变更纯粹是内部的（无行为变更），运行时验证可能不需要。但如果项目配置了 verify.json，仍然运行它 —— 它成本低且能捕获回归。
- **文档变更** —— 没有代码需要验证。

## 故障排除

### 服务器无法启动
- 检查端口是否已被占用：`lsof -i :8080`
- 检查环境变量：是否需要 DB 凭证？
- 在详细模式下查看服务器 stdout（`-v`）

### 找不到 Chrome
- 安装 Chrome 或 Chromium
- 在 verify.json 中将 `browser.executable` 设为正确路径
- 在 CI 上，使用 `--no-sandbox` 标志

### 等待就绪超时
- 增加 `timeout_seconds`
- 手动运行命令验证服务器是否实际启动
- 检查健康端点路径是否正确

### CLI 构建失败
- 手动运行构建命令查看完整错误
- 检查构建依赖是否已安装
