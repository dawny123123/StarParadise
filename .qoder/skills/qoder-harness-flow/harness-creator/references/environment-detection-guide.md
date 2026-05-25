# 环境检测指南

本文档定义了 **environment.json** —— harness-creator 与 harness-executor 之间的环境契约 —— 并解释了如何为项目检测、收集和生成环境信息。

> **关键洞察**：环境不仅仅是配置——它是完整的运行时生态系统，包括数据库、服务、密钥以及启动所有内容的**可执行脚本**。

---

## 1. environment.json 概览

### 1.1 用途

| 文件 | 用途 | 消费者 |
|------|---------|----------|
| `verify.json` | "如何检查" —— 机械性检查（健康、状态码） | `verify.py` 脚本 |
| `environment.json` | "环境是什么" —— 完整的生态系统描述 | `preflight.py`, `verifier 子代理`, 设置脚本 |

### 1.2 位置

```
harness/
├── config/
│   ├── verify.json           # 运行时冒烟检查配置
│   └── environment.json      # 环境生态系统契约 ← 新增
└── scripts/
    ├── setup-env.sh          # 启动依赖（DB, Redis 等）
    ├── start-server.sh       # 启动应用程序
    ├── teardown-env.sh       # 停止和清理
    └── seed-data.sh          # 种子测试数据
```

### 1.3 何时生成

| 模式 | 触发条件 |
|------|---------|
| **Greenfield** | 始终生成（脚手架包含 environment.json） |
| **Create** | 始终生成（从代码分析检测） |
| **Improve** | 如果缺失则生成；如果存在则审计和更新 |

---

## 2. environment.json 模式

> **真相来源**：参见 `agents/creator-config.md` 获取规范模式。参见 `references/environment-config-guide.md` 获取字段参考。下面的模式是一个完整的参考示例。

```json
{
  "runtime": {
    "language": "go",
    "version": "1.22+",
    "build_command": "go build -o bin/server ./cmd/server",
    "dev_command": "go run ./cmd/server",
    "test_command": "go test ./..."
  },
  "databases": [
    {
      "type": "postgresql",
      "env_vars": {"DATABASE_URL": "postgres://postgres:postgres@localhost:5432/app?sslmode=disable"},
      "docker": {"image": "postgres:16", "port": 5432},
      "test_alternative": "SQLite in-memory (DB_DRIVER=sqlite3 DB_URL=:memory:)"
    }
  ],
  "services": [
    {
      "type": "redis",
      "env_vars": {"REDIS_URL": "redis://localhost:6379"}
    }
  ],
  "secrets": [
    {
      "name": "JWT_SECRET",
      "description": "JWT token signing",
      "test_value": "test-secret-do-not-use-in-production"
    }
  ],
  "test_environment": {
    "env_vars": {
      "ENV": "test",
      "PORT": "8081",
      "LOG_LEVEL": "error",
      "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/testdb?sslmode=disable",
      "JWT_SECRET": "test-secret-do-not-use-in-production"
    }
  },
  "functional_scenarios": [
    {
      "name": "user_auth_flow",
      "description": "注册, 登录, 访问受保护资源",
      "prerequisites": ["postgresql"],
      "steps": [
        "POST /api/v1/register -> 201",
        "POST /api/v1/login -> 200 with token",
        "GET /api/v1/users/{id} with token -> 200"
      ],
      "expected_outcome": "完整认证流程端到端工作"
    },
    {
      "name": "health_check",
      "description": "基本健康和就绪状态",
      "prerequisites": [],
      "steps": ["GET /health -> 200"],
      "expected_outcome": "服务器健康"
    }
  ],
  "scripts": {
    "setup": "harness/scripts/setup-env.sh",
    "start": "harness/scripts/start-server.sh",
    "teardown": "harness/scripts/teardown-env.sh"
  }
}
```

---

## 3. 环境脚本生成

除了 JSON 配置之外，harness-creator 必须生成**实际启动环境的可执行脚本**。

### 3.1 脚本模板

#### `harness/scripts/setup-env.sh`

使用 Docker 或本地服务设置所有依赖（数据库、外部服务）。

```bash
#!/bin/bash
# setup-env.sh - 启动本地开发所需的所有依赖
# 由 harness-creator 从 environment.json 生成
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

echo "==> 为 ${PROJECT_NAME} 设置环境..."

# --- 数据库: ${DB_NAME} ---
{{#if databases}}
{{#each databases}}
{{#if (eq type "postgres")}}
if ! docker ps -q -f name={{name}} | grep -q .; then
  echo "启动 PostgreSQL ({{name}})..."
  docker run -d \
    --name {{name}} \
    -p {{connection.default_port}}:5432 \
    -e POSTGRES_USER=${{{connection.user_env}}:-postgres} \
    -e POSTGRES_PASSWORD=${{{connection.password_env}}:-postgres} \
    -e POSTGRES_DB=${{{connection.database_env}}:-{{../project_name}}} \
    {{setup.docker_image}}
  echo "等待 PostgreSQL 就绪..."
  sleep 3
  until docker exec {{name}} pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
  done
  echo "PostgreSQL 就绪。"
fi
{{/if}}
{{#if (eq type "mysql")}}
if ! docker ps -q -f name={{name}} | grep -q .; then
  echo "启动 MySQL ({{name}})..."
  docker run -d \
    --name {{name}} \
    -p {{connection.default_port}}:3306 \
    -e MYSQL_ROOT_PASSWORD=${{{connection.password_env}}:-root} \
    -e MYSQL_DATABASE=${{{connection.database_env}}:-{{../project_name}}} \
    {{setup.docker_image}}
  echo "等待 MySQL 就绪..."
  sleep 5
  until docker exec {{name}} mysqladmin ping -h localhost --silent; do
    sleep 1
  done
  echo "MySQL 就绪。"
fi
{{/if}}
{{/each}}
{{/if}}

# --- 服务 ---
{{#if services}}
{{#each services}}
{{#if (eq type "redis")}}
if ! docker ps -q -f name={{name}} | grep -q .; then
  echo "启动 Redis ({{name}})..."
  docker run -d --name {{name}} -p 6379:6379 {{setup.docker_image}}
  echo "Redis 已启动。"
fi
{{/if}}
{{/each}}
{{/if}}

# --- 运行迁移 ---
{{#if databases}}
{{#each databases}}
{{#if setup.migration_command}}
echo "为 {{name}} 运行迁移..."
{{setup.migration_command}}
{{/if}}
{{/each}}
{{/if}}

echo "==> 环境设置完成！"
```

#### `harness/scripts/start-server.sh`

使用正确的环境变量启动应用程序。

```bash
#!/bin/bash
# start-server.sh - 启动应用程序服务器
# 由 harness-creator 从 environment.json 生成
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

# 加载 .env（如果存在）
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# 从 environment.json 设置默认值
{{#each test_environment.env_vars}}
export {{@key}}=${{{@key}}:-{{this}}}
{{/each}}

# 如果需要则构建
{{#if runtime.build_command}}
echo "构建中..."
{{runtime.build_command}}
{{/if}}

# 启动服务器
echo "在端口 ${PORT:-8080} 上启动服务器..."
{{runtime.dev_command}}
```

#### `harness/scripts/teardown-env.sh`

停止并清理所有依赖。

```bash
#!/bin/bash
# teardown-env.sh - 停止和清理环境
# 由 harness-creator 从 environment.json 生成
set -e

echo "==> 拆卸环境..."

{{#if databases}}
{{#each databases}}
docker stop {{name}} 2>/dev/null || true
docker rm {{name}} 2>/dev/null || true
{{/each}}
{{/if}}

{{#if services}}
{{#each services}}
{{#if setup.docker_image}}
docker stop {{name}} 2>/dev/null || true
docker rm {{name}} 2>/dev/null || true
{{/if}}
{{/each}}
{{/if}}

echo "==> 拆卸完成。"
```

#### `harness/scripts/seed-data.sh`

用测试数据填充数据库。

```bash
#!/bin/bash
# seed-data.sh - 用测试数据填充数据库
# 由 harness-creator 从 environment.json 生成
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_ROOT"

{{#if databases}}
{{#each databases}}
{{#if setup.seed_command}}
echo "为 {{name}} 填充数据..."
{{setup.seed_command}}
{{/if}}
{{/each}}
{{/if}}

echo "==> 填充完成。"
```

### 3.2 何时生成脚本

| 场景 | 生成脚本？ |
|----------|-------------------|
| Greenfield 模式 | 是，始终（脚手架的一部分） |
| Create 模式，检测到 DB/服务 | 是 |
| Create 模式，无依赖 | 最小（仅 start-server.sh） |
| Improve 模式，脚本缺失 | 是，如果检测到依赖 |
| Improve 模式，脚本存在 | 保留现有，如果过时则建议更新 |

### 3.3 脚本 vs docker-compose.yml

如果项目已有 `docker-compose.yml`：
- **不要生成重复脚本**来复制 docker-compose 功能
- 而是生成调用 `docker-compose up -d` 等的薄包装脚本
- 在 environment.json 中引用 docker-compose 服务名称

```bash
# 当 docker-compose.yml 存在时的 setup-env.sh
#!/bin/bash
set -e
docker-compose up -d postgres redis
echo "等待服务..."
sleep 5
docker-compose exec postgres pg_isready
echo "服务就绪。"
```

---

## 4. 环境检测策略

### 4.1 代码依赖分析

扫描依赖文件以检测项目使用什么：

| 模式 | 检测 | 意味着 |
|---------|-----------|---------|
| `go.mod`: `github.com/lib/pq`, `github.com/jackc/pgx` | PostgreSQL | 数据库, 连接环境变量 |
| `go.mod`: `github.com/go-redis/redis` | Redis | 缓存服务 |
| `package.json`: `pg`, `mysql2`, `mongoose` | DB 驱动 | 数据库依赖 |
| `package.json`: `@aws-sdk/*` | AWS 服务 | 云服务凭证 |
| `requirements.txt`: `psycopg2`, `sqlalchemy` | PostgreSQL | 数据库 |
| `requirements.txt`: `boto3` | AWS | 云凭证 |

**Go 检测模式：**
```go
// 扫描导入语句
"github.com/lib/pq"           // PostgreSQL
"github.com/jackc/pgx"        // PostgreSQL
"github.com/go-sql-driver/mysql"  // MySQL
"go.mongodb.org/mongo-driver"     // MongoDB
"github.com/go-redis/redis"       // Redis
"github.com/nats-io/nats.go"      // NATS
"github.com/segmentio/kafka-go"   // Kafka
```

**TypeScript/JavaScript 模式：**
```javascript
// package.json 依赖
"pg"           // PostgreSQL
"mysql2"       // MySQL
"mongodb"      // MongoDB
"ioredis"      // Redis
"kafkajs"      // Kafka
"@aws-sdk/*"   // AWS 服务
```

**Python 模式：**
```python
# requirements.txt 或 pyproject.toml
psycopg2       # PostgreSQL
mysql-connector-python  # MySQL
pymongo        # MongoDB
redis          # Redis
boto3          # AWS
```

### 4.2 环境变量收集

扫描代码中的所有环境变量引用：

```go
// Go
os.Getenv("DB_HOST")
os.LookupEnv("REDIS_URL")
viper.GetString("jwt.secret")  // 带配置绑定

// TypeScript
process.env.DB_HOST
config.get('database.url')

// Python
os.environ.get("DB_HOST")
os.getenv("REDIS_URL")
```

还要检查：
- `.env.example` / `.env.template` 获取预期变量
- 配置结构定义（Go 结构体标签、TypeScript 接口）
- README 中提到的必需环境变量

### 4.3 功能场景推断

分析路由以推断功能场景：

**路由模式 → 场景：**

| 检测到的路由 | 推断的场景 |
|-----------------|-------------------|
| `POST /register`, `POST /login`, `GET /profile` | `user_auth_flow` |
| `POST /users`, `GET /users/:id`, `PUT /users/:id`, `DELETE /users/:id` | `user_crud` |
| `POST /orders`, `GET /orders`, middleware `auth` | `authenticated_orders_flow` |
| `GET /health`, `GET /ready` | `health_check` (始终包含) |

**中间件分析：**
- 路由上的认证中间件 → 场景需要先认证
- 速率限制中间件 → 包含速率限制边界测试

**数据模型分析：**
- 带密码字段的用户模型 → 认证场景
- 关系（用户有订单） → 关系查询场景

### 4.4 Docker/K8s 清单分析

如果 `docker-compose.yml` 或 Kubernetes 清单存在：

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
```

提取：
- 服务名称 → `databases[].setup.docker_compose_service`
- 镜像 → `databases[].setup.docker_image`
- 端口映射 → `databases[].connection.default_port`
- 环境变量 → `databases[].connection.*_env`

---

## 5. 安全指南

### 5.1 绝不硬编码密钥

```json
// 错误 —— 绝不要这样做
"secrets": [{ "value": "sk-abc123..." }]

// 正确 —— 通过环境变量引用
"secrets": [{ "name": "API_KEY", "purpose": "..." }]
```

### 5.2 测试值

仅允许以下密钥的 `test_value`：
- 自包含（无外部依赖的 JWT 签名密钥）
- 明确标记为仅测试

```json
{
  "name": "JWT_SECRET",
  "test_value_ok": true,
  "test_value": "test-jwt-secret-not-for-production"
}
```

### 5.3 敏感模式

检测并警告：
- API 密钥：`sk-`, `pk-`, `api_`, `token_`
- 带密码的连接字符串
- 私钥（RSA, EC）

检测到后，提示用户在包含到 environment.json 之前确认。

---

## 6. 与 harness-executor 集成

### 6.1 关系

harness-creator 生成 `environment.json` 来描述运行时生态系统。harness-executor 在任务运行时消费它以动态生成 `verify.json` 用于验证。

```
environment.json (harness-creator)       verify.json (harness-executor, runtime)
════════════════════════════════════     ═══════════════════════════════════════
databases[]                              prerequisites.database_checks[]
  └─ auto-derived ─────────────────►       (TCP 连通性)

services[]                               prerequisites.service_checks[]
  └─ auto-derived ─────────────────►       (HTTP 健康, TCP)

secrets[]                                prerequisites.env_checks[]
  └─ auto-derived ─────────────────►       (必需的环境变量)

ports[]                                  prerequisites.port_checks[]
  └─ auto-derived ─────────────────►       (端口可用性)

functional_scenarios[]                   (不在 verify.json 中)
  └─ consumed by ──────────────────►     verifier 子代理
```

> **注意**：harness-creator 不生成 `verify.json`。它仅提供 `environment.json` 作为基础。harness-executor 基于 environment.json + 任务上下文在任务运行时动态生成 `verify.json`。

### 6.2 自动推导规则

当 harness-executor 生成 `verify.json` 时，它自动从 `environment.json` 推导 `prerequisites`：

```python
def derive_prerequisites(env_config):
    prereqs = {"database_checks": [], "service_checks": [], ...}

    for db in env_config.get("databases", []):
        if db["required"]:
            prereqs["database_checks"].append({
                "type": db["type"],
                "host_env": db["connection"].get("host_env", "localhost"),
                "port": db["connection"].get("default_port")
            })

    for svc in env_config.get("services", []):
        if svc["required"]:
            prereqs["service_checks"].append({
                "type": svc["type"],
                "url_env": svc["connection"].get("url_env"),
                "health_endpoint": svc["connection"].get("health_endpoint")
            })

    for secret in env_config.get("secrets", []):
        if secret["required"]:
            prereqs["env_checks"].append({
                "name": secret["name"],
                "required": True
            })

    return prereqs
```

---

## 7. 模式检查清单

### 7.1 Greenfield 模式

- [ ] 生成带检测/默认值的 `environment.json`
- [ ] 生成所有四个脚本（setup-env, start-server, teardown-env, seed-data）
- [ ] 至少包含 `health_check` 功能场景
- [ ] 使用安全默认值设置 `test_environment`

### 7.2 Create 模式

- [ ] 分析代码库的依赖（第 4.1 节）
- [ ] 收集所有环境变量（第 4.2 节）
- [ ] 从路由推断功能场景（第 4.3 节）
- [ ] 检查现有的 docker-compose.yml（第 4.4 节）
- [ ] 生成 `environment.json`
- [ ] 生成脚本（或如果 docker-compose 存在则生成薄包装器）
- [ ] 验证安全性（无硬编码密钥）

### 7.3 Improve 模式

- [ ] 检查 `environment.json` 是否存在
  - 如果缺失：运行 Create 模式检测并生成
  - 如果存在：审计完整性
- [ ] 审计检查清单：
  - [ ] 所有检测到的 DB 驱动都有对应的 `databases[]` 条目
  - [ ] 代码中所有必需的环境变量都在 `secrets[]` 或 `test_environment` 中
  - [ ] `functional_scenarios[]` 覆盖主要用户流程
  - [ ] 脚本存在且可执行
  - [ ] 脚本与 `environment.json` 匹配（非过时）
- [ ] 生成缺失的组件
- [ ] 更新过时的组件

---

## 8. 示例：完整的 Go Web API

给定一个带 PostgreSQL 和 Redis 的 Go Web API：

**从代码检测：**
- `go.mod`: `github.com/jackc/pgx/v5`, `github.com/go-redis/redis/v9`
- 环境变量：`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `PORT`
- 路由：`/api/v1/register`, `/api/v1/login`, `/api/v1/users/:id`, `/health`
- `/api/v1/users/:id` 上的认证中间件

**生成的 environment.json：**
```json
{
  "runtime": {
    "language": "go",
    "version": "1.22+",
    "build_command": "go build -o bin/server ./cmd/server",
    "dev_command": "go run ./cmd/server",
    "test_command": "go test ./..."
  },
  "databases": [{
    "type": "postgresql",
    "env_vars": {"DATABASE_URL": "postgres://postgres:postgres@localhost:5432/myapi?sslmode=disable"},
    "docker": {"image": "postgres:16", "port": 5432},
    "test_alternative": "SQLite in-memory"
  }],
  "services": [{
    "type": "redis",
    "env_vars": {"REDIS_URL": "redis://localhost:6379"}
  }],
  "secrets": [{
    "name": "JWT_SECRET",
    "description": "JWT token signing",
    "test_value": "test-secret-do-not-use-in-production"
  }],
  "test_environment": {
    "env_vars": {
      "ENV": "test",
      "PORT": "8081",
      "DATABASE_URL": "postgres://postgres:postgres@localhost:5432/testdb?sslmode=disable",
      "JWT_SECRET": "test-secret-do-not-use-in-production"
    }
  },
  "functional_scenarios": [
    {
      "name": "user_auth_flow",
      "description": "注册, 登录, 访问受保护资源",
      "prerequisites": ["postgresql"],
      "steps": [
        "POST /api/v1/register -> 201",
        "POST /api/v1/login -> 200 with token",
        "GET /api/v1/users/{id} with token -> 200"
      ],
      "expected_outcome": "完整认证流程端到端工作"
    },
    {
      "name": "health_check",
      "description": "基本健康和就绪状态",
      "prerequisites": [],
      "steps": ["GET /health -> 200"],
      "expected_outcome": "服务器健康"
    }
  ],
  "scripts": {
    "setup": "harness/scripts/setup-env.sh",
    "start": "harness/scripts/start-server.sh",
    "teardown": "harness/scripts/teardown-env.sh"
  }
}
```
