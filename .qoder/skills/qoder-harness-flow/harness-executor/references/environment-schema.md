# 环境配置模式参考

本文档描述 `harness/config/environment.json` 文件 —— 由 **harness-creator** 生成、**harness-executor** 消费的环境契约。

> **用途**：`environment.json` 描述项目所需的完整运行时生态系统。它使执行器能够启动服务、启动应用程序，并为 **Verifier 子代理** 提供功能验证所需的上下文。

---

## 与其他配置文件的关系

```
harness/config/
├── validate.json       # 静态验证（构建、Lint、测试）→ validate.py
├── environment.json    # 运行时环境契约 → 由执行器和 Verifier 子代理消费
└── verify.json         # 可选：独立冒烟检查 → verify.py（不属于 Skill 流程）
```

| 文件 | 创建者 | 用途 |
|------|--------|------|
| `validate.json` | harness-creator | 静态检查（构建、Lint、测试命令） |
| `environment.json` | harness-creator | 运行时环境：启动、服务、环境变量 |
| `verify.json` | 可选 | 独立冒烟检查配置，供 `verify.py` 工具使用（Skill 流程不要求） |

**关键区别**：`environment.json` 回答"这个项目需要什么才能运行？" —— Verifier 子代理使用此上下文来启动应用程序、设置测试环境并执行验证场景。

---

## 模式概览

### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|-------|------|----------|-------------|
| `version` | string | 是 | 模式版本（"2.0"） |
| `project` | object | 是 | 项目名称、类型、语言、描述 |
| `project_name` | string | 是 | 项目标识符（已弃用，请使用 `project.name`） |
| `generated_at` | ISO datetime | 是 | 生成时间 |
| `generated_by` | string | 是 | 始终为 "harness-creator" |
| `runtime` | object | 是 | 语言、构建/开发命令 |
| `startup` | object | 是* | 应用程序启动：命令、参数、就绪检查（* 库项目除外） |
| `services` | array | 否 | 服务依赖（数据库、缓存、队列） |
| `databases` | array | 否 | 数据库依赖（旧版，优先使用 services[]） |
| `env_vars` | object | 否 | 必需和可选的环境变量 |
| `secrets` | array | 否 | 必需的密钥/凭证（旧版，优先使用 env_vars.required） |
| `endpoints` | object | 否 | 已知端点（健康检查、base_url） |
| `ports` | array | 否 | 应用程序使用的端口 |
| `files` | object | 否 | 必需/生成的文件 |
| `functional_scenarios` | array | 否 | 功能验证场景 |
| `test_environment` | object | 否 | 测试模式环境变量 |
| `scripts` | object | 否 | 生命周期脚本路径 |
| `_meta` | object | 否 | 生成元数据、待办事项、用户输入需求 |

### `project` 对象（v2.0）

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 项目标识符 |
| `type` | string | "web-api", "cli", "frontend", "library", "hybrid" |
| `language` | string | 主语言 |
| `description` | string | 简要项目描述 |

### `startup` 对象（v2.0 — 新增）

> **这是执行器最重要的部分。** 它告诉执行器如何启动应用程序并检测其是否就绪以进行验证。

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `command` | string | 启动应用程序的命令（例如："go run ./cmd/server"） |
| `args` | string[] | 可选参数 |
| `working_dir` | string | 工作目录（默认 "."） |
| `env` | object | 启动所需的环境变量 |
| `readiness` | object | 如何知道应用程序已准备好接收请求 |
| `readiness.type` | string | "http", "tcp", "log_pattern", "process", "none" |
| `readiness.config` | object | 类型特定的配置 |

**就绪类型：**

| 类型 | 配置字段 | 适用场景 |
|------|--------------|----------|
| `http` | `endpoint`, `port`, `expected_status`, `timeout_seconds`, `poll_interval_ms` | 带健康检查端点的 Web API |
| `tcp` | `host`, `port`, `timeout_seconds` | 监听端口但无 HTTP 的服务 |
| `log_pattern` | `pattern`, `timeout_seconds` | 会输出 "ready" 日志的服务 |
| `process` | `command` | 仅检查进程是否运行 |
| `none` | — | 库或 CLI（无需启动） |

### `runtime` 对象

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `language` | string | "go", "typescript", "python", "java" |
| `version` | string | 所需的最低版本 |
| `package_manager` | string | "npm", "pnpm", "yarn", "pip", "poetry", "maven", "gradle" |
| `build_command` | string | 如何构建项目 |
| `test_command` | string | 如何运行测试 |
| `lint_command` | string | 如何运行 Lint |
| `dev_command` | string | 如何以开发模式启动（旧版，优先使用 startup.command） |

### `env_vars` 对象（v2.0 — 增强）

结构化的环境变量定义，包含元数据。

```json
{
  "env_vars": {
    "required": {
      "DATABASE_URL": {
        "purpose": "PostgreSQL connection string",
        "sensitive": true,
        "example": "postgres://user:pass@localhost:5432/dbname"
      }
    },
    "optional": {
      "PORT": {
        "purpose": "HTTP server port",
        "default": "8080",
        "sensitive": false
      }
    }
  }
}
```

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `required` | object | 必需的环境变量 — 缺失时应用会失败 |
| `required.<name>.purpose` | string | 此变量的用途 |
| `required.<name>.sensitive` | boolean | 是否为敏感信息？ |
| `required.<name>.example` | string | 示例值（非敏感信息） |
| `required.<name>.test_value_ok` | boolean | 是否可以使用测试值？ |
| `required.<name>.test_value` | string | 安全的测试值（仅在 test_value_ok 时） |
| `optional` | object | 带默认值的可选环境变量 |
| `optional.<name>.default` | string | 未设置时的默认值 |

### `databases[]` 数组

每个条目描述一个数据库依赖：

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 唯一标识符（例如："primary_db"） |
| `type` | string | "postgres", "mysql", "mongodb", "redis", "sqlite" |
| `purpose` | string | 此数据库的用途 |
| `required` | boolean | 缺失时应用是否失败 |
| `connection` | object | 连接用的环境变量 |
| `connection.host_env` | string | 主机环境变量 |
| `connection.port_env` | string | 端口环境变量 |
| `connection.default_port` | number | 环境变量未设置时的默认端口 |
| `connection.user_env` | string | 用户名环境变量 |
| `connection.password_env` | string | 密码环境变量 |
| `connection.database_env` | string | 数据库名环境变量 |
| `connection.url_env` | string | 完整连接 URL 环境变量 |
| `setup.docker_image` | string | 使用的 Docker 镜像 |
| `setup.docker_compose_service` | string | docker-compose.yml 中的服务名 |
| `setup.migration_command` | string | 如何运行迁移 |
| `setup.seed_command` | string | 如何填充测试数据 |
| `test_alternatives` | object | 测试用的替代配置 |

### `services[]` 数组

每个条目描述一个外部服务依赖：

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 唯一标识符 |
| `type` | string | "redis", "http", "grpc", "kafka", "rabbitmq", "s3" |
| `purpose` | string | 此服务的用途 |
| `required` | boolean | 缺失时应用是否失败 |
| `connection.url_env` | string | 连接 URL 的环境变量 |
| `connection.default_url` | string | 默认 URL |
| `connection.health_endpoint` | string | 健康检查路径（HTTP 服务） |
| `setup.docker_image` | string | Docker 镜像 |
| `setup.docker_compose_service` | string | docker-compose 服务名 |
| `fallback` | string | 服务不可用时如何处理 |
| `test_alternatives.mock` | string | 如何使用模拟替代 |

### `secrets[]` 数组

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 环境变量名 |
| `purpose` | string | 此密钥的用途 |
| `required` | boolean | 缺失时应用是否失败 |
| `test_value_ok` | boolean | 使用测试值是否安全？ |
| `test_value` | string | 安全的测试值（仅在 `test_value_ok: true` 时） |
| `skip_when_missing` | string | 密钥缺失时的行为 |

### `functional_scenarios[]` 数组

这些描述**要功能验证什么** —— Verifier 子代理使用它们。

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `name` | string | 场景标识符（例如："user_auth_flow"） |
| `description` | string | 自然语言描述 |
| `requires` | string[] | 所需的 databases/services/secrets 名称 |
| `category` | string | "auth", "core", "infra", "integration" |
| `steps_hint` | string[] | 自然语言步骤提示（非精确规格） |
| `priority` | string | "high", "medium", "low" |

**重要**：`steps_hint` 故意使用自然语言，而非精确的 HTTP 规格。Verifier 子代理会读取代码来填充精确的细节（请求体、请求头等）。这使场景在重构时保持稳定。

### `test_environment` 对象

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `env_vars` | object | 安全的测试环境变量键值对 |
| `setup_commands` | string[] | 测试前运行的命令 |
| `teardown_commands` | string[] | 测试后运行的命令 |

### `scripts` 对象

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `setup_env` | string | 环境设置脚本路径 |
| `start_server` | string | 服务器启动脚本路径 |
| `teardown_env` | string | 环境清理脚本路径 |
| `seed_data` | string | 数据填充脚本路径 |

---

## 执行器如何消费 environment.json

### 1. Verifier 子代理（功能验证 — 主要）

执行器对 `environment.json` 的主要用途是向 **Verifier 子代理** 提供上下文：

```
environment.json（startup、readiness、services、env_vars）
    + 任务上下文（变更的文件、新端点）
    + 协调器设计的场景
    ───────────────────────────────────────────
    → Verifier 子代理启动服务器、执行场景、报告结果
```

Verifier 子代理接收：
- **启动配置**：如何启动应用（来自 environment.json 的 startup 部分）
- **就绪检查**：如何检测应用已就绪（来自 startup.readiness）
- **功能场景**：来自 `functional_scenarios[]` 的预定义场景
- **环境上下文**：可用的数据库、服务、环境变量

子代理随后：
1. 使用 `startup.command` 启动应用程序
2. 使用 `startup.readiness` 配置等待就绪
3. 使用 `env_vars.optional` 中的安全默认值设置测试环境
4. 执行协调器设计的任务特定场景
5. 执行 `functional_scenarios[]` 中的预定义场景
6. 使用真实的 HTTP 请求和副作用检查验证功能正确性

### 2. preflight.py（前置条件检查）

在任何验证运行之前，`preflight.py` 加载 `environment.json` 并检查：

- **services**：Docker 容器是否运行、TCP 连通性
- **env_vars.required**：必需的环境变量是否已设置（非空）
- **endpoints**：必需的端口是否可用
- **files**：必需的文件是否存在

### 3. 协调器（环境设置/清理）

协调器使用 `scripts` 路径来管理环境生命周期：

```
设置: harness/scripts/setup-env.sh  → 启动 DB、Redis 等
启动: harness/scripts/start-server.sh → 启动应用程序
测试:  Verifier 子代理使用真实 HTTP 请求运行场景
停止:  harness/scripts/teardown-env.sh → 停止所有服务
```

---

## 向后兼容

- `environment.json` 是**可选的** —— 没有它的现有项目继续正常工作
- 缺失时，执行器回退到：
  1. `detect_adapter.py` 获取语言/构建命令
  2. 启发式启动检测（Makefile、Dockerfile、package.json）
- **功能验证对所有任务始终强制进行**，无论 `environment.json` 是否存在。协调器设计的任务特定场景即使没有 environment.json 也能工作 —— Verifier 子代理可以使用内存/模拟数据。

## 从 v1.0 迁移

使用 v1.0 `environment.json`（使用 `runtime.dev_command` 而非 `startup.command`）的项目会自动处理：

| v1.0 字段 | v2.0 等效 | 自动迁移 |
|------------|-----------------|----------------|
| `runtime.dev_command` | `startup.command` | 是 — 执行器会检查两者 |
| `databases[]` | `services[]` 且 `type: "database"` | 是 — 向后兼容 |
| `secrets[]` | `env_vars.required` 且 `sensitive: true` | 是 — 执行器会读取两者 |
| `test_environment.env_vars` | `env_vars.optional` | 是 — 执行器会合并 |

使用 harness-creator 预生成的 `verify.json` 的项目仍可将它与独立的 `verify.py` 工具一起用于快速冒烟检查。
