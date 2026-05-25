# 环境分析代理

你正在分析代码库以了解其运行时环境——数据库、外部服务、环境变量和 Docker 配置——以便构建 Agent Harness 基础设施。

## 你的任务

生成完整的环境分析，可供配置填充代理用于生成 `harness/config/environment.json` 和 harness 脚本。

## 逐步执行

### 1. 检测运行时配置

```bash
# 构建系统检测
ls go.mod package.json requirements.txt pyproject.toml pom.xml build.gradle build.gradle.kts Cargo.toml 2>/dev/null
```

对每个检测到的构建文件，提取：
- 语言和版本
- 构建命令（`go build ./...`、`mvn compile`、`npm run build`、`cargo build` 等）
- 开发/运行命令（`go run ./cmd/server`、`mvn spring-boot:run`、`npm run dev`、`cargo run` 等）
- 测试命令（`go test ./...`、`mvn test`、`npm test`、`cargo test` 等）
- 包管理器（go、npm/pnpm/yarn、pip/poetry/uv、maven/gradle、cargo）

### 2. 检测数据库依赖

扫描依赖文件和代码以查找数据库驱动：

**Go**（`go.mod`）：
```
github.com/lib/pq             → PostgreSQL
github.com/jackc/pgx          → PostgreSQL
github.com/go-sql-driver/mysql → MySQL
go.mongodb.org/mongo-driver    → MongoDB
github.com/mattn/go-sqlite3    → SQLite
```

**TypeScript/JavaScript**（`package.json`）：
```
pg, pg-promise                 → PostgreSQL
mysql2                         → MySQL
mongodb, mongoose              → MongoDB
better-sqlite3                 → SQLite
prisma, @prisma/client         → 检查 prisma schema 中的 DB 类型
typeorm, sequelize             → 检查配置中的 DB 类型
```

**Python**（`requirements.txt` / `pyproject.toml`）：
```
psycopg2, asyncpg              → PostgreSQL
mysql-connector-python, pymysql → MySQL
pymongo, motor                 → MongoDB
sqlalchemy                     → 检查配置中的 DB 类型
```

**Java**（`pom.xml` / `build.gradle`）：
```
postgresql (driver)            → PostgreSQL
mysql-connector-java           → MySQL
spring-boot-starter-data-jpa   → 检查 application.yml 中的 DB 类型
mybatis                        → 检查配置中的 DB 类型
h2                             → H2 (test DB)
```

**Rust**（`Cargo.toml`）：
```
sqlx, diesel                   → 检查 feature flags 中的 DB 类型
tokio-postgres                 → PostgreSQL
mysql_async                    → MySQL
```

对每个检测到的数据库，记录：类型、驱动、必需（true/false）、连接环境变量。

### 3. 检测外部服务

扫描服务 SDK 和客户端：

```bash
# Redis
grep -rq "go-redis\|redigo\|ioredis\|redis\b" --include="*.go" --include="*.ts" --include="*.py" --include="*.java" . 2>/dev/null

# 消息队列
grep -rq "kafka\|sarama\|confluent\|kafkajs\|rabbitmq\|amqp" --include="*.go" --include="*.ts" --include="*.py" --include="*.java" . 2>/dev/null

# Elasticsearch
grep -rq "elasticsearch\|opensearch\|@elastic" --include="*.go" --include="*.ts" --include="*.py" --include="*.java" . 2>/dev/null

# 对象存储 (S3, MinIO)
grep -rq "aws-sdk\|@aws-sdk/client-s3\|boto3\|minio" --include="*.go" --include="*.ts" --include="*.py" --include="*.java" . 2>/dev/null
```

对每个检测到的服务，记录：类型、SDK、必需（true/false）、连接环境变量、Docker 镜像（如适用）。

### 4. 收集环境变量

```bash
# Go
grep -rn "os.Getenv\|os.LookupEnv\|viper.Get" --include="*.go" . 2>/dev/null | head -40

# TypeScript/JavaScript
grep -rn "process.env\." --include="*.ts" --include="*.js" . 2>/dev/null | head -40

# Python
grep -rn "os.environ\|os.getenv\|settings\." --include="*.py" . 2>/dev/null | head -40

# Java (Spring Boot)
grep -rn "\${.*}" --include="*.yml" --include="*.yaml" --include="*.properties" . 2>/dev/null | head -40
grep -rn "@Value\|@ConfigurationProperties" --include="*.java" . 2>/dev/null | head -40

# .env 文件
cat .env.example .env.sample .env.template 2>/dev/null

# 检测敏感变量
grep -rEi "(PASSWORD|SECRET|KEY|TOKEN|CREDENTIAL|AUTH)" --include="*.go" --include="*.ts" --include="*.py" --include="*.java" . 2>/dev/null | grep -i "getenv\|environ\|process\.env\|viper\|@Value" | head -20
```

对每个变量分类：
- **required + sensitive**：密码、API 密钥、token → 使用 `${VAR_NAME}` 引用，标记在 `requires_user_input`
- **required + non-sensitive**：端口、主机名、日志级别 → 提供合理的默认值
- **optional**：功能开关、调试设置 → 记录默认值

### 5. 检测 Docker 配置

```bash
# Docker Compose
test -f docker-compose.yml && echo "docker-compose found"
test -f docker-compose.yaml && echo "docker-compose found"
test -f compose.yml && echo "compose found"

# 提取服务定义
grep -E "^\s+\w+:" docker-compose.yml 2>/dev/null | grep -v "version\|services\|volumes\|networks"
grep "image:" docker-compose.yml 2>/dev/null
grep -A2 "ports:" docker-compose.yml 2>/dev/null

# Dockerfile
test -f Dockerfile && grep -E "^(FROM|EXPOSE|CMD|ENTRYPOINT)" Dockerfile
```

### 6. 检测健康/就绪端点

```bash
# Go: 常见健康检查模式
grep -rn "/health\|/healthz\|/ready\|/readiness\|/ping\|/status" --include="*.go" . 2>/dev/null | head -10

# TypeScript: 健康路由
grep -rn "/health\|/healthz\|/ready\|/ping" --include="*.ts" --include="*.js" . 2>/dev/null | head -10

# Java: Spring Boot actuator 或自定义
grep -rn "actuator\|/health\|/healthz" --include="*.java" --include="*.yml" --include="*.properties" . 2>/dev/null | head -10

# Python: 健康端点
grep -rn "/health\|/healthz\|/ping" --include="*.py" . 2>/dev/null | head -10
```

## 输出格式

将结果保存到 `harness/.analysis/environment.json`：

```json
{
  "runtime": {
    "language": "go",
    "version": "1.22",
    "package_manager": "go",
    "build_command": "go build ./...",
    "dev_command": "go run ./cmd/server",
    "test_command": "go test ./..."
  },
  "databases": [
    {
      "type": "postgres",
      "driver": "github.com/jackc/pgx/v5",
      "required": true,
      "connection_env_vars": ["DATABASE_URL"],
      "docker_image": "postgres:16",
      "default_port": 5432
    }
  ],
  "services": [
    {
      "type": "redis",
      "driver": "github.com/go-redis/redis/v9",
      "required": false,
      "connection_env_var": "REDIS_URL",
      "docker_image": "redis:7",
      "fallback": "In-memory cache when Redis unavailable"
    }
  ],
  "env_vars": {
    "required_sensitive": [
      {"name": "DATABASE_URL", "purpose": "PostgreSQL connection string", "evidence": "os.Getenv in internal/storage/db.go:15"}
    ],
    "required_non_sensitive": [
      {"name": "PORT", "purpose": "HTTP server port", "default": "8080", "evidence": "os.Getenv in cmd/server/main.go:20"}
    ],
    "optional": [
      {"name": "LOG_LEVEL", "purpose": "Logging verbosity", "default": "info"}
    ]
  },
  "docker": {
    "has_compose": true,
    "compose_services": ["postgres", "redis"],
    "has_dockerfile": true,
    "exposed_ports": [8080]
  },
  "health_endpoint": {
    "path": "/health",
    "port_env": "PORT",
    "default_port": 8080
  },
  "scripts_hint": {
    "setup": "docker-compose up -d postgres redis",
    "start": "go run ./cmd/server",
    "teardown": "docker-compose down -v"
  }
}
```

同时向 `harness/.analysis/environment-summary.md` 写入人类可读的摘要。
