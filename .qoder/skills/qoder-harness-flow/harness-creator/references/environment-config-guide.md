# 环境配置指南

在 harness 创建期间收集完整环境信息并生成 `harness/config/environment.json` 的指南。

## 概览

`environment.json` 是 harness-creator 和 harness-executor 之间的契约。它描述了执行器启动应用程序、设置依赖项和运行验证所需的一切——但它不定义要验证什么。验证配置（`verify.json`）由 harness-executor 在任务运行时动态生成。

> **核心原则**：harness-creator 回答"这个项目需要什么才能运行？"——harness-executor 回答"变更后我们应该检查什么？"

---

## environment.json 模式

> **真相来源**：此模式必须与 `agents/creator-config.md` 中的示例匹配。如果它们有分歧，`creator-config.md` 胜出（它是填充代理直接读取的）。

```json
{
  "runtime": {
    "language": "go",
    "version": "1.22",
    "build_command": "go build ./...",
    "dev_command": "go run ./cmd/server",
    "test_command": "go test ./..."
  },
  "databases": [
    {
      "type": "postgresql",
      "env_vars": {"DATABASE_URL": "postgres://..."},
      "docker": {"image": "postgres:16", "port": 5432},
      "test_alternative": "SQLite in-memory"
    }
  ],
  "services": [
    {"type": "redis", "env_vars": {"REDIS_URL": "redis://localhost:6379"}}
  ],
  "secrets": [
    {"name": "JWT_SECRET", "description": "JWT signing key", "test_value": "test-secret-do-not-use-in-prod"}
  ],
  "test_environment": {
    "env_vars": {
      "ENV": "test",
      "LOG_LEVEL": "error",
      "PORT": "8081"
    }
  },
  "functional_scenarios": [
    {
      "name": "health_check",
      "description": "验证服务器启动并且健康端点正确响应",
      "prerequisites": ["postgresql"],
      "steps": [
        "使用 runtime.dev_command 启动服务器",
        "等待服务器就绪 (GET /healthz 返回 200)",
        "验证健康响应包含 status: up"
      ],
      "expected_outcome": "服务器健康且所有依赖已连接"
    }
  ],
  "scripts": {
    "setup": "harness/scripts/setup-env.sh",
    "start": "harness/scripts/start-server.sh",
    "teardown": "harness/scripts/teardown-env.sh"
  }
}
```

### 字段参考

| 字段 | 必需 | 说明 |
|-------|----------|-------------|
| `runtime.language` | 是 | go, typescript, python, java, rust |
| `runtime.version` | 是 | 语言版本 |
| `runtime.build_command` | 是 | 如何构建项目 |
| `runtime.dev_command` | 是 | 如何在开发模式下启动 |
| `runtime.test_command` | 是 | 如何运行测试 |
| `databases[]` | 如果检测到 DB | 每个包含 type, env_vars, docker, test_alternative |
| `services[]` | 如果检测到服务 | 每个包含 type, env_vars |
| `secrets[]` | 如果检测到敏感变量 | 每个包含 name, description, 可选 test_value |
| `test_environment.env_vars` | 是 | 测试模式的环境变量 |
| `functional_scenarios[]` | 是 | 至少 health_check；如果检测到路由则更多 |
| `scripts` | 是 | setup/start/teardown 脚本的路径 |

---

## 检测策略（4 步流水线）

### 步骤 1：检测项目类型和语言

```bash
# 语言检测（高置信度）
test -f go.mod && echo "go"
test -f package.json && echo "typescript/javascript"
test -f pyproject.toml && echo "python"
test -f requirements.txt && echo "python"
test -f Cargo.toml && echo "rust"
test -f pom.xml && echo "java-maven"
test -f build.gradle && echo "java-gradle"

# 项目类型检测（中等置信度）
# 服务器指标
grep -rq "http.ListenAndServe\|gin.Default\|chi.NewRouter\|echo.New" --include="*.go" . && echo "web-api"
grep -q '"express"\|"fastify"\|"koa"\|"hono"\|"nest"' package.json 2>/dev/null && echo "web-api"
grep -rq "FastAPI\|Flask\|Django" --include="*.py" . && echo "web-api"

# CLI 指标
test -d cmd/cli && echo "cli"
grep -rq "cobra\|urfave/cli" --include="*.go" . && echo "cli"
grep -q '"commander"\|"yargs"\|"oclif"' package.json 2>/dev/null && echo "cli"

# 前端指标
grep -q '"react"\|"vue"\|"svelte"\|"next"\|"nuxt"' package.json 2>/dev/null && echo "frontend"

# 库指标（无入口点，仅导出）
grep -q '"main"\|"bin"' package.json 2>/dev/null || echo "library"
```

### 步骤 2：检测启动命令

**优先级顺序** — 使用第一个成功的检测：

| 优先级 | 来源 | 命令 |
|----------|--------|---------|
| 1 | 现有的 `harness/config/environment.json` | `jq .startup.command environment.json` |
| 2 | Dockerfile CMD/ENTRYPOINT | `grep -E "^(CMD|ENTRYPOINT)" Dockerfile` |
| 3 | docker-compose.yml command | `grep "command:" docker-compose.yml` |
| 4 | Makefile 目标 | `grep -E "^(run|start|serve|dev):" Makefile` |
| 5 | package.json scripts | `jq '.scripts.start // .scripts.dev' package.json` |
| 6 | Go cmd/ 目录 | `ls cmd/*/main.go` → `go run ./cmd/<name>` |
| 7 | Python 主模块 | `test -f main.py && echo "python main.py"` |
| 8 | **AskUserQuestion** | 如果所有自动检测都失败则必需 |

```bash
# Go: 检测启动命令
if test -d cmd/; then
    SERVER_CMD=""
    # 查找类似服务器的目录
    for dir in cmd/*/; do
        name=$(basename "$dir")
        if echo "$name" | grep -qiE "server|api|web|app|service"; then
            SERVER_CMD="go run ./$dir"
            break
        fi
    done
    # 如果没有类似服务器的目录，检查是否只有一个 cmd/
    if [ -z "$SERVER_CMD" ]; then
        cmd_count=$(ls -d cmd/*/ 2>/dev/null | wc -l)
        if [ "$cmd_count" -eq 1 ]; then
            SERVER_CMD="go run ./$(ls -d cmd/*/ )"
        fi
    fi
fi

# Node.js: 检查 package.json
if test -f package.json; then
    DEV_CMD=$(jq -r '.scripts.dev // empty' package.json 2>/dev/null)
    START_CMD=$(jq -r '.scripts.start // empty' package.json 2>/dev/null)
    # 检测包管理器
    test -f pnpm-lock.yaml && PKG_MGR="pnpm"
    test -f yarn.lock && PKG_MGR="yarn"
    test -f bun.lockb && PKG_MGR="bun"
    PKG_MGR="${PKG_MGR:-npm}"
fi

# Python: 检查框架
if grep -q "FastAPI\|Flask" requirements.txt pyproject.toml 2>/dev/null; then
    # 查找 uvicorn/gunicorn 模式
    grep -rn "uvicorn\|gunicorn" --include="*.py" . | head -1
fi
```

### 步骤 3：检测服务依赖

**扫描这些来源以查找服务依赖：**

```bash
# Docker Compose（最高置信度）
if test -f docker-compose.yml; then
    # 提取服务名称和镜像
    grep -E "^\s+\w+:" docker-compose.yml | grep -v "version\|services"
    grep "image:" docker-compose.yml
fi

# 代码导入（中等置信度）
# PostgreSQL
grep -rq "pgx\|pq\|database/sql.*postgres\|psycopg\|pg.*Pool\|sequelize.*postgres\|TypeORM.*postgres" . 2>/dev/null && echo "postgres detected"

# MySQL
grep -rq "mysql\|mariadb" --include="*.go" --include="*.py" --include="*.ts" . 2>/dev/null && echo "mysql detected"

# Redis
grep -rq "go-redis\|redigo\|redis\|ioredis\|bull" --include="*.go" --include="*.py" --include="*.ts" . 2>/dev/null && echo "redis detected"

# MongoDB
grep -rq "mongo\|bson\|mongoose" --include="*.go" --include="*.py" --include="*.ts" . 2>/dev/null && echo "mongodb detected"

# Kafka/RabbitMQ
grep -rq "kafka\|sarama\|confluent" . 2>/dev/null && echo "kafka detected"
grep -rq "rabbitmq\|amqp" . 2>/dev/null && echo "rabbitmq detected"
```

### 步骤 4：检测环境变量

```bash
# 扫描 .env.example 或 .env.sample
if test -f .env.example; then
    cat .env.example
elif test -f .env.sample; then
    cat .env.sample
fi

# 扫描代码中的环境变量引用
# Go
grep -rn "os.Getenv\|os.LookupEnv\|viper.Get" --include="*.go" . 2>/dev/null | head -30

# Node.js
grep -rn "process.env\." --include="*.ts" --include="*.js" . 2>/dev/null | head -30

# Python
grep -rn "os.environ\|os.getenv\|settings\." --include="*.py" . 2>/dev/null | head -30

# 检测敏感变量
grep -rEi "(PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|AUTH)" --include="*.go" --include="*.ts" --include="*.py" . 2>/dev/null | grep -i "getenv\|environ\|process\.env\|viper" | head -20
```

---

## 交互式收集流程（混合模式）

### 决策矩阵：何时询问 vs 何时自动填充 vs 何时写 TODO

| 信息 | 可检测？ | 关键？ | 操作 |
|-------------|-------------|-----------|--------|
| 启动命令 | 通常可以 | **是** | 自动检测 → 如果失败，**立即 AskUserQuestion** |
| 健康端点 | 有时 | **是** | 自动检测 → 如果失败，**AskUserQuestion** |
| 端口 | 通常 | 否 | 自动检测 → 默认 8080 |
| 数据库类型 | 通常 | **是**（如果代码使用 DB） | 自动检测 → 如果失败，**AskUserQuestion** |
| DB 连接 URL | 否 | **是** | 标记 `requires_user_input`，使用 `${DATABASE_URL}` |
| Redis/缓存 | 有时 | 否 | 自动检测 → 如果不清楚则写 TODO |
| API 密钥 | 否 | 取决于 | 标记 `requires_user_input`，使用 `${VAR_NAME}` |
| 日志级别 | 是（默认） | 否 | 自动填充 "info" |
| 功能标志 | 有时 | 否 | 写 TODO 占位符 |

### AskUserQuestion 模板

**模板 1：启动命令（关键，如果未检测到则必须询问）**

```json
{
  "question": "无法自动检测如何启动此项目。应用程序在开发模式下如何启动？",
  "header": "启动",
  "options": [
    {
      "label": "自定义命令",
      "description": "我将提供特定命令（例如，'go run ./cmd/server', 'npm run dev'）"
    },
    {
      "label": "Docker Compose",
      "description": "项目使用 docker-compose up 启动所有内容"
    },
    {
      "label": "Makefile 目标",
      "description": "有 Makefile，包含 run/start/dev 目标"
    },
    {
      "label": "不适用",
      "description": "这是一个库/包——不需要启动命令"
    }
  ]
}
```

**模板 2：数据库依赖（如果在代码中检测到 DB 使用则关键）**

```json
{
  "question": "在代码中检测到数据库使用 ({detected_db_type})。请确认数据库设置：",
  "header": "数据库",
  "options": [
    {
      "label": "Docker 容器",
      "description": "使用 Docker 在本地运行 {db_type}（推荐用于开发）"
    },
    {
      "label": "本地安装",
      "description": "数据库直接安装在此机器上"
    },
    {
      "label": "远程/云端",
      "description": "数据库托管在远程（暂存/开发环境）"
    },
    {
      "label": "SQLite/嵌入式",
      "description": "使用嵌入式数据库进行开发/测试"
    }
  ]
}
```

**模板 3：敏感配置（如果检测到则始终询问）**

```json
{
  "question": "在代码中检测到敏感环境变量：{var_list}。这些对于应用程序运行是必需的。它们应该如何配置？",
  "header": "密钥",
  "options": [
    {
      "label": "环境变量（推荐）",
      "description": "通过 ${VAR_NAME} 引用——你在 shell 配置文件中设置它们"
    },
    {
      "label": "有安全的测试值可用",
      "description": "其中一些有可以使用的安全测试/开发值"
    },
    {
      "label": "配置文件引用",
      "description": "引用本地配置文件如 ~/.config/app/secrets.json"
    },
    {
      "label": "暂时跳过",
      "description": "标记为 TODO——在运行验证之前稍后填写"
    }
  ]
}
```

---

## 启动脚本生成

### setup-env.sh

```bash
#!/usr/bin/env bash
# 环境设置脚本 — 启动所需服务
# 由 harness-creator 生成，由 harness-executor 消费
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== 为 {project_name} 设置环境 ==="

# 通过 Docker 启动服务（如果 docker-compose 存在）
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    echo "通过 docker-compose 启动服务..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d
fi

# 或启动单独的服务
# {基于检测到的服务自动生成}

# 等待服务就绪
echo "等待服务..."
# {自动生成的健康检查}

# 运行迁移（如果适用）
# {自动生成的迁移命令}

echo "=== 环境就绪 ==="
```

### start-server.sh

```bash
#!/usr/bin/env bash
# 应用程序启动脚本
# 由 harness-creator 生成，由 harness-executor 消费
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

# 设置默认环境变量
export PORT="${PORT:-8080}"
export ENV="${ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"

# 启动应用程序
echo "在端口 $PORT 上启动 {project_name}..."
{startup_command}
```

### teardown-env.sh

```bash
#!/usr/bin/env bash
# 环境拆卸脚本
# 由 harness-creator 生成，由 harness-executor 消费
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== 拆卸环境 ==="

# 停止 Docker 服务
if [ -f "$PROJECT_ROOT/docker-compose.yml" ]; then
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down -v
fi

# 清理任何临时文件
rm -rf "$PROJECT_ROOT/harness/trace/verify-report.json" 2>/dev/null
rm -rf "$PROJECT_ROOT/harness/trace/verification-report.json" 2>/dev/null

echo "=== 环境已清理 ==="
```

---

## 就绪检查类型

| 类型 | 何时使用 | 配置 |
|------|-------------|--------|
| `http` | 带健康端点的 Web API | `{ "endpoint": "/health", "port": 8080, "expected_status": 200 }` |
| `tcp` | 监听端口但无 HTTP 的服务 | `{ "host": "localhost", "port": 5432 }` |
| `log_pattern` | 记录"就绪"消息的服务 | `{ "pattern": "Server listening on", "timeout_seconds": 30 }` |
| `process` | 仅检查进程是否运行 | `{ "command": "pgrep -f 'my-app'" }` |
| `none` | 库或不需要启动 | (省略就绪部分) |

---

## 敏感配置安全

> **核心规则：绝不在 environment.json 或脚本中硬编码敏感值。**

### 安全模式

| 模式 | 语法 | 示例 |
|---------|--------|---------|
| 环境变量 | `${VAR_NAME}` | `"password": "${DB_PASSWORD}"` |
| 带默认值 | `${VAR_NAME:-default}` | `"port": "${PORT:-8080}"` |
| 配置文件引用 | `$file:path:key` | `"key": "$file:~/.config/app/secrets.json:api.key"` |

### 检测和标记

当在代码中检测到敏感变量时，在 `_meta.requires_user_input` 中标记它们：

```json
{
  "_meta": {
    "requires_user_input": ["DATABASE_URL", "JWT_SECRET", "API_KEY"],
    "todos": [
      "在运行验证之前设置 DATABASE_URL 环境变量",
      "配置 JWT_SECRET 用于认证测试"
    ]
  }
}
```

### 不应该放入 environment.json 的内容

- 实际密码、API 密钥、令牌
- 包含嵌入凭证的连接字符串
- 可能有效的测试凭证
- 不应放入版本控制的内部 URL

---

## 自主模式（AskUserQuestion 不可用）

当 AskUserQuestion 不可用时：

1. **自动检测一切可能的内容** — 使用上述所有检测策略
2. **应用保守默认值** — 使用最常见的值
3. **将未知标记为 TODO** — 绝不对关键配置进行猜测
4. **记录假设** — 解释检测到了什么以及假设了什么

```json
{
  "_meta": {
    "generated_by": "harness-creator",
    "mode": "autonomous",
    "assumptions": [
      "从 cmd/server/main.go 推断启动命令",
      "假设端口 8080（Go Web 服务器最常见）",
      "从 internal/storage/ 中的 pgx 导入检测到 PostgreSQL"
    ],
    "requires_user_input": ["DATABASE_URL"],
    "todos": [
      "验证启动命令是否正确",
      "确认 PostgreSQL 连接详情",
      "设置 DATABASE_URL 环境变量"
    ]
  }
}
```
