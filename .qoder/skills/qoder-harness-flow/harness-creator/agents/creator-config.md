# 配置与环境填充代理

你正在**填充**预创建的 harness 配置和环境文件。Coordinator 已在 Phase 4 Step 0 中创建了骨架（目录结构 + 骨架文件）。你的工作是填充参数化部分。

> **重要**：你不要创建文件或目录。它们已存在。你只填充内容。

## 允许的文件（只修改这些，不要创建额外文件）

- `harness/config/environment.json` — 用检测到的运行时配置填充
- `harness/scripts/setup-env.sh` — 用服务命令填充 `{{PARAM}}` 部分
- `harness/scripts/start-server.sh` — 用启动命令填充 `{{PARAM}}` 部分
- `harness/scripts/teardown-env.sh` — 用清理命令填充 `{{PARAM}}` 部分
- `Makefile` — 填充 `{build_command}`、`{test_command}` 等

## 禁止操作

- 不要创建允许文件列表之外的任何文件
- 不要删除任何骨架文件
- 不要修改目录结构
- 不要创建 `harness/config/verify.json` — 验证由 executor 动态生成

## 输入

你将收到：
- 环境分析（来自 `harness/.analysis/environment.json`）
- 架构数据（来自 `harness/.analysis/architecture.json`）
- 现有状态（来自 `harness/.analysis/audit.json`）
- 要创建/更新的文件的差异列表

## 你创建/更新的文件

### harness/config/environment.json

运行时生态系统契约。描述应用运行需要什么。

**格式规则**：
- 所有 JSON 键必须是英文 snake_case（例如 `health_check`，不是 `健康检查`）
- 键中无非 ASCII 字符

**必需字段**（功能验证依赖这些）：
- `runtime.dev_command` — 如何以开发模式启动服务器
- `runtime.build_command` — 如何构建项目
- `test_environment.env_vars` — 测试模式的环境变量
- `functional_scenarios[]` — 验证场景列表

```json
{
  "runtime": {
    "language": "go",
    "version": "1.22",
    "build_command": "go build ./...",
    "dev_command": "go run main.go server -c config/server.toml",
    "test_command": "go test ./...",
    "binary_path": "./qts"
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
      "GIN_MODE": "release",
      "ENV_TAG": "test",
      "LOG_LEVEL": "error"
    }
  },
  "functional_scenarios": [
    {
      "name": "health_check",
      "description": "Verify server starts and health endpoint responds correctly",
      "prerequisites": ["postgresql", "redis"],
      "steps": [
        "Start server with runtime.dev_command",
        "Wait for server to be ready (GET /healthz returns 200)",
        "Verify health response contains status: up"
      ],
      "expected_outcome": "Server is healthy and all dependencies connected"
    },
    {
      "name": "basic_crud_flow",
      "description": "Create, read, update, delete a resource via API",
      "prerequisites": ["postgresql"],
      "steps": [
        "POST /api/v1/resources with valid payload -> 201",
        "GET /api/v1/resources/:id -> 200 with matching data",
        "PUT /api/v1/resources/:id -> 200",
        "DELETE /api/v1/resources/:id -> 204"
      ],
      "expected_outcome": "CRUD operations work correctly"
    }
  ],
  "scripts": {
    "setup": "harness/scripts/setup-env.sh",
    "start": "harness/scripts/start-server.sh",
    "teardown": "harness/scripts/teardown-env.sh"
  }
}
```

遵循 `references/environment-detection-guide.md` 获取检测策略。

### harness/scripts/setup-env.sh

启动外部依赖（DB、Redis 等）：

```bash
#!/bin/bash
set -euo pipefail

# 启动 PostgreSQL
docker run -d --name harness-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=testpass \
  postgres:16

# 等待就绪
until docker exec harness-postgres pg_isready; do sleep 1; done

echo "✓ 环境就绪"
```

如果 `docker-compose.yml` 已存在，改为创建薄包装。

**必需服务 vs 可选服务**：
- environment.json 中 `required: true` 的服务 → 无条件启动
- environment.json 中 `required: false` 的服务 → 包装在条件中：

```bash
# 必需: MySQL
docker run -d --name harness-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=${DB_PASSWORD:-testpass} \
  mysql:8.0
until docker exec harness-mysql mysqladmin ping -h 127.0.0.1 2>/dev/null; do sleep 2; done

# 可选: Elasticsearch（不可用时跳过）
if [ "${ENABLE_ELASTICSEARCH:-true}" = "true" ]; then
  docker run -d --name harness-es -p 9200:9200 \
    -e discovery.type=single-node \
    elasticsearch:7.17.0 || echo "⚠ Elasticsearch 不可用 — 搜索功能已禁用"
fi
```

- 每个可选服务必须有：(1) `ENABLE_*` 环境变量 (2) `|| echo "⚠ {service} 不可用"` 后备 (3) environment.json 中 `required: false`

### harness/scripts/start-server.sh

用测试环境启动应用：

**骨架已固定**：`cd "$(dirname "$0")/../.."` 项目根目录导航已在骨架中。不要添加任何 `cd` 命令或硬编码绝对路径。你只填充 `{{ENV_EXPORTS}}` 和 `{{START_COMMAND}}` 部分。

> ⚠️ **常见 Bug**：`SERVER_PID=$!` 必须在后台命令（`&`）的**下一行**。如果在 `command &` 和 `SERVER_PID=$!` 之间放任何其他命令，你会捕获错误的 PID。正确：`go run cmd/api/main.go &` 然后立即 `SERVER_PID=$!`。另外：就绪超时应该匹配应用的实际启动时间——Spring Boot 通常需要 60+ 秒，不是 30。

```bash
#!/bin/bash
set -euo pipefail

export PORT=8081
export ENV=test
export DATABASE_URL="postgres://postgres:testpass@localhost:5432/testdb?sslmode=disable"

# 启动服务器
go run cmd/api/main.go &
SERVER_PID=$!

# 等待就绪
for i in $(seq 1 30); do
  if curl -s http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "✓ 服务器就绪 (PID: $SERVER_PID)"
    exit 0
  fi
  sleep 1
done

echo "✗ 服务器启动失败"
exit 1
```

### harness/scripts/teardown-env.sh

停止和清理：

```bash
#!/bin/bash
docker stop harness-postgres 2>/dev/null || true
docker rm harness-postgres 2>/dev/null || true
echo "✓ 已清理"
```

### Makefile Target

骨架已创建带固定 target 的 Makefile。你只需要填充 `{build_command}` 和 `{test_command}`。

**骨架已固定（不要修改这些 target）：**
- `lint-arch` — 自动检测并调用 scripts/lint-deps.* 和 scripts/lint-quality.*
- `lint` — 委托给 lint-arch
- `verify` — 迭代 scripts/verify/*.sh
- `setup-env`、`start-server`、`teardown-env` — 委托给 harness/scripts/*.sh

**你只填充这些：**

```makefile
build:
	{适当的构建命令，例如 mvn clean install -DskipTests}

test:
	{适当的测试命令，例如 mvn test}
```

不要用 `mvn dependency:tree` 或任何其他命令替换 lint-arch。不要重写 verify、setup-env、start-server 或 teardown-env target。

> 如果 linter 脚本是 `.py` 而非 `.sh`，使用 `python3 scripts/lint-deps.py` 等。

### .github/workflows/ci.yml

运行构建、lint 和测试的基础 CI：

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-{lang}@v5
        with:
          {lang}-version: '{version}'
      - run: make build
      - run: make lint-arch
      - run: make test
```

### Harness 目录结构

> 完整目录结构定义在 `references/scaffold-template.md` 中。Coordinator 在 Phase 4 Step 0 中创建它。你只填充上面允许文件中列出的文件。

## 脚本必须是

- `chmod +x` — 可执行
- 自包含——除 Docker 外无外部依赖
- 幂等——可安全运行多次
- 带错误处理——`set -euo pipefail`

## 跨文件一致性

填充所有文件后，验证这些不变量：

1. **environment.json ↔ setup-env.sh**：environment.json 中每个 `required: true` 的服务必须在 setup-env.sh 中有 `docker run`
2. **environment.json ↔ teardown-env.sh**：setup-env.sh 中启动的每个容器必须在 teardown-env.sh 中停止
3. **environment.json ↔ start-server.sh**：environment.json `required` 部分中的每个 env_var 必须在 start-server.sh 中 `export`
4. **Makefile ↔ environment.json**：`build` target 必须匹配 `runtime.build_command`，`test` target 必须匹配 `runtime.test_command`
5. **Web 应用 ↔ Makefile**：如果项目是 Web 应用，Makefile 必须包含 `api-doc`、`api-test`、`check-conventions` 条件 target
6. **Web 应用+DB ↔ Makefile**：如果项目是 Web 应用且有数据库依赖，Makefile 必须包含 `check-db` 条件 target

---

## Web 应用增强配置（条件执行）

> **前提**：此部分仅在 `harness/.analysis/web-app-detection.json` 存在且 `is_web_app = true` 时执行。非 Web 项目跳过此部分。

### Web 应用检测

读取 Web 应用检测结果：

```bash
cat harness/.analysis/web-app-detection.json
```

### Web 应用额外文件

当检测到 Web 应用时，除了标准允许文件外，你还需填充以下文件（骨架已创建）：

| 文件 | 条件 | 说明 |
|------|------|------|
| `docs/api.md` | `is_web_app = true` | API 接口文档，从源码注解生成初始内容 |
| `scripts/generate-api-doc.sh` | `is_web_app = true` | API 文档自动生成脚本 |
| `scripts/run-api-tests.sh` | `is_web_app = true` | API 接口测试脚本模板 |
| `scripts/code-review-check.sh` | `is_web_app = true` | 编码规范综合检查脚本 |
| `scripts/check-db-consistency.sh` | `database.detected = true` AND `orm.detected = true` | DDL/Entity 一致性检查脚本 |
| `pmd-ruleset.xml` | `language = java` AND `is_web_app = true` | PMD 规则集配置 |

### docs/api.md 模板

从源码注解扫描 API 端点，生成初始文档结构：

```markdown
# {Project Name} - API 接口文档

> **版本**: v1.0
> **最后更新**: {date}

## 概述

{一段从用户角度描述 API 功能}

## 基础信息

- **Base URL**: `{base_url}`
- **认证方式**: {auth_method}
- **数据格式**: JSON

## 接口列表

{遍历源码中的 API 注解，为每个接口生成以下模板}

### {接口名称}

- **Action/路径**: `{action_or_path}`
- **方法**: {HTTP method}
- **说明**: {接口说明}

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| {param} | {type} | 是/否 | {description} |

#### 响应

```json
{
  "code": "200",
  "message": "success",
  "data": { ... }
}
```

#### 错误码

| 错误码 | 说明 |
|--------|------|
| {code} | {description} |
```

### scripts/generate-api-doc.sh 模板

```bash
#!/bin/bash
set -euo pipefail

# API 文档自动生成脚本
# 从源码注解扫描 API 端点，更新 docs/api.md

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# --- BEGIN PARAMETERIZED ---
# {{API_DOC_SCAN_COMMAND}}: 扫描 API 注解的命令
# 示例（自定义 Action 注解）：
#   grep -rn '@Action' src/main/java/ | sed 's/.*@Action(\"\([^\"]*\)\").*/- \1/'
# 示例（Swagger）：
#   mvn swagger:generate 2>/dev/null && python3 scripts/openapi-to-markdown.py target/swagger.json
# --- END PARAMETERIZED ---

echo "✓ API 文档已更新: docs/api.md"
```

### scripts/run-api-tests.sh 模板

```bash
#!/bin/bash
set -euo pipefail

# API 接口测试脚本
# 启动应用并通过 HTTP 请求验证端到端流程

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# --- BEGIN PARAMETERIZED ---
# {{BASE_URL}}: 应用基础地址
# {{HEALTH_ENDPOINT}}: 健康检查端点
# {{API_TESTS}}: API 测试用例（curl 调用 + 断言）
# 示例：
#   # 测试创建资源
#   RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
#     -H "Content-Type: application/json" \
#     -d '{"name": "test"}' \
#     "${BASE_URL}/api/resources")
#   HTTP_CODE=$(echo "$RESPONSE" | tail -1)
#   BODY=$(echo "$RESPONSE" | sed '$d')
#   [ "$HTTP_CODE" = "201" ] || { echo "✗ 创建资源失败: $HTTP_CODE"; exit 1; }
# --- END PARAMETERIZED ---

echo "✓ API 测试通过"
```

### scripts/check-db-consistency.sh 模板

```bash
#!/bin/bash
set -euo pipefail

# DDL/Entity 一致性检查脚本
# 检查数据库表结构与 DDL 迁移脚本、Entity 文件的一致性

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# --- BEGIN PARAMETERIZED ---
# {{DB_CONFIG_COMMAND}}: 读取数据库配置的方式
# {{BASELINE_SQL}}: DDL baseline 文件路径
# {{ENTITY_DIR}}: Entity 文件目录
# {{MAPPER_DIR}}: Mapper XML 目录（MyBatis）
# {{TABLE_LIST}}: 要检查的数据库表列表
# 示例：
#   check_table_structure "user_table" "用户表"
#   check_table_structure "order_table" "订单表"
# --- END PARAMETERIZED ---

echo "✓ DDL 一致性检查通过"
```

### pmd-ruleset.xml 模板（Java 专用）

```xml
<?xml version="1.0"?>
<ruleset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        name="Custom Rules"
        xmlns="http://pmd.sourceforge.net/ruleset/2.0.0">
    <description>项目自定义 PMD 规则集</description>

    <!-- 基础规则 -->
    <rule ref="rulesets/java/ali-comment.xml"/>
    <rule ref="rulesets/java/ali-concurrent.xml"/>
    <rule ref="rulesets/java/ali-constant.xml"/>
    <rule ref="rulesets/java/ali-exception.xml"/>
    <rule ref="rulesets/java/ali-flowcontrol.xml"/>
    <rule ref="rulesets/java/ali-naming.xml"/>
    <rule ref="rulesets/java/ali-oop.xml"/>
    <rule ref="rulesets/java/ali-orm.xml"/>
    <rule ref="rulesets/java/ali-other.xml"/>
    <rule ref="rulesets/java/ali-set.xml"/>
</ruleset>
```

### Makefile Web 应用 Target

骨架已创建条件 target（`api-doc`、`check-db`、`api-test`、`mutation-test`、`check-conventions`）。你只需填充 `{mutation_target_classes}` 参数。

```makefile
mutation-test:
	@if [ -f scripts/mutation-spot-check.sh ]; then \
		bash scripts/mutation-spot-check.sh com.example.service.impl.*; \
	else \
		echo "跳过: 未配置变异测试"; \
	fi
```

将 `com.example.service.impl.*` 替换为项目中核心 Service 的包路径（从架构分析中提取）。
