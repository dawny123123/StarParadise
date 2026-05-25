# Web 应用检测指南

> harness-creator 在 Phase 1 检测到 Web 应用时，自动激活增强脚手架和验证能力。

---

## 检测信号

### 1. HTTP 服务指标

以下信号的出现表明项目包含 Web 应用组件：

| 信号 | 检测方式 | 权重 | 框架 |
|------|---------|------|------|
| `@RestController` / `@Controller` | grep Java 源码 | +3 | Spring |
| `@RequestMapping` / `@GetMapping` 等 | grep Java 源码 | +2 | Spring |
| `@Action` 自定义注解 | grep Java 源码 | +3 | Spring (统一入口) |
| `router.get` / `router.post` | grep TS/JS 源码 | +3 | Express/Koa |
| `app.get` / `app.post` | grep TS/JS 源码 | +3 | Express |
| `@app.route` / `@router` | grep Python 源码 | +3 | Flask/FastAPI |
| `func (r *mux.Router)` | grep Go 源码 | +3 | Gorilla Mux |
| `http.HandleFunc` / `http.Handle` | grep Go 源码 | +2 | stdlib |
| `routing { get` / `routing { post` | grep Kotlin 源码 | +3 | Ktor |

**判定规则**：权重之和 >= 3 时，项目为 Web 应用。

### 2. 数据库驱动指标

| 信号 | 检测方式 | 数据库类型 | 测试库替代 |
|------|---------|-----------|-----------|
| `mysql-connector-java` / `mysql-connector` | grep pom.xml/build.gradle | MySQL | H2 |
| `postgresql` / `postgres` | grep pom.xml/build.gradle | PostgreSQL | H2 |
| `mongodb-driver` / `spring-data-mongodb` | grep pom.xml/build.gradle | MongoDB | flapdoodle |
| `jedis` / `lettuce-core` / `spring-data-redis` | grep pom.xml/build.gradle | Redis | embedded-redis |
| `h2` / `sqlite-jdbc` | grep pom.xml/build.gradle | H2/SQLite | (自身) |
| `psycopg2` / `asyncpg` | grep requirements.txt | PostgreSQL | SQLite |
| `pymongo` | grep requirements.txt | MongoDB | mongomock |
| `go-sql-driver/mysql` | grep go.mod | MySQL | sqlite3 |
| `lib/pq` | grep go.mod | PostgreSQL | sqlite3 |

**判定规则**：检测到主数据库驱动 + 测试库替代时，标记项目需要 DDL 同步能力。

### 3. ORM 框架指标

| 信号 | 检测方式 | ORM 类型 |
|------|---------|---------|
| `mybatis` / `mybatis-plus` | grep pom.xml | MyBatis |
| `mapper/*.xml` 目录 | 检查目录存在 | MyBatis |
| `spring-boot-starter-data-jpa` | grep pom.xml | JPA/Hibernate |
| `@Entity` 注解 | grep Java 源码 | JPA/Hibernate |
| `gorm.io/gorm` | grep go.mod | GORM |
| `sqlalchemy` | grep requirements.txt | SQLAlchemy |
| `prisma` / `typeorm` / `sequelize` | grep package.json | Node.js ORM |

**判定规则**：检测到 ORM 框架时，标记项目需要 Entity/DDL 一致性检查。

### 4. API 文档注解指标

| 信号 | 检测方式 | 文档类型 |
|------|---------|---------|
| `@ApiOperation` / `@Api` | grep Java 源码 | Swagger 2 |
| `@Tag` / `@Operation` / `@Schema` | grep Java 源码 | Springdoc/OpenAPI 3 |
| `@Action` | grep Java 源码 | 自定义统一入口 |
| `swagger-jsdoc` / `swagger-ui-express` | grep package.json | Node Swagger |
| `flasgger` / `apispec` | grep requirements.txt | Python Swagger |
| `swag init` / `swag fmt` | grep Go 源码/Makefile | SwagGo |

**判定规则**：检测到 API 文档注解时，标记项目需要 `docs/api.md` 生成能力。

### 5. 变异测试框架指标

| 语言 | 信号 | 检测方式 | 工具 |
|------|------|---------|------|
| Java | `pitest-maven` / `org.pitest` | grep pom.xml | PIT |
| Java | `pitest-gradle-plugin` | grep build.gradle | PIT |
| Python | `mutmut` | grep requirements.txt | mutmut |
| Go | `go-mutesting` | grep go.mod | go-mutesting |
| TypeScript | `stryker-cli` / `@stryker-mutator` | grep package.json | Stryker |

**判定规则**：检测到变异测试工具时，标记项目支持变异测试突击检查。

---

## 检测流程

### Phase 1 集成

在 harness-creator Phase 1.1 项目状态检测后，运行以下检测脚本：

```bash
# Web 应用检测
IS_WEB_APP=false
WEB_SIGNALS=0

# 1. HTTP 服务信号检测
if grep -rqE '@RestController|@Controller|@Action' src/ 2>/dev/null; then
  WEB_SIGNALS=$((WEB_SIGNALS + 3))
fi
if grep -rqE '@RequestMapping|@GetMapping|@PostMapping' src/ 2>/dev/null; then
  WEB_SIGNALS=$((WEB_SIGNALS + 2))
fi
if grep -rqE 'router\.(get|post)|app\.(get|post)' src/ 2>/dev/null; then
  WEB_SIGNALS=$((WEB_SIGNALS + 3))
fi
if grep -rqE '@app\.route|@router\.(get|post)' src/ 2>/dev/null; then
  WEB_SIGNALS=$((WEB_SIGNALS + 3))
fi

if [ "$WEB_SIGNALS" -ge 3 ]; then
  IS_WEB_APP=true
  echo "检测到 Web 应用（信号权重: $WEB_SIGNALS）"
fi

# 2. 数据库依赖检测
HAS_DATABASE=false
HAS_TEST_DB=false
DB_TYPE="unknown"

if grep -q 'mysql-connector' pom.xml 2>/dev/null; then
  HAS_DATABASE=true; DB_TYPE="mysql"
  grep -q 'h2' pom.xml 2>/dev/null && HAS_TEST_DB=true
elif grep -qE 'postgresql|postgres' pom.xml 2>/dev/null; then
  HAS_DATABASE=true; DB_TYPE="postgresql"
  grep -q 'h2' pom.xml 2>/dev/null && HAS_TEST_DB=true
elif grep -qE 'psycopg2|asyncpg' requirements.txt 2>/dev/null; then
  HAS_DATABASE=true; DB_TYPE="postgresql"
elif grep -q 'go-sql-driver/mysql' go.mod 2>/dev/null; then
  HAS_DATABASE=true; DB_TYPE="mysql"
elif grep -q 'lib/pq' go.mod 2>/dev/null; then
  HAS_DATABASE=true; DB_TYPE="postgresql"
fi

if [ "$HAS_DATABASE" = true ]; then
  echo "检测到数据库: $DB_TYPE (测试库: $HAS_TEST_DB)"
fi

# 3. ORM 框架检测
HAS_ORM=false
ORM_TYPE="unknown"

if grep -qE 'mybatis|mybatis-plus' pom.xml 2>/dev/null; then
  HAS_ORM=true; ORM_TYPE="mybatis"
elif grep -q 'spring-boot-starter-data-jpa' pom.xml 2>/dev/null; then
  HAS_ORM=true; ORM_TYPE="jpa"
elif grep -q 'gorm.io/gorm' go.mod 2>/dev/null; then
  HAS_ORM=true; ORM_TYPE="gorm"
elif grep -q 'sqlalchemy' requirements.txt 2>/dev/null; then
  HAS_ORM=true; ORM_TYPE="sqlalchemy"
elif grep -qE 'prisma|typeorm|sequelize' package.json 2>/dev/null; then
  HAS_ORM=true; ORM_TYPE="nodejs-orm"
fi

if [ "$HAS_ORM" = true ]; then
  echo "检测到 ORM: $ORM_TYPE"
fi

# 4. API 文档注解检测
HAS_API_DOC=false
API_DOC_TYPE="unknown"

if grep -rqE '@Action' src/ 2>/dev/null; then
  HAS_API_DOC=true; API_DOC_TYPE="custom-action"
elif grep -rqE '@ApiOperation|@Api' src/ 2>/dev/null; then
  HAS_API_DOC=true; API_DOC_TYPE="swagger2"
elif grep -rqE '@Tag|@Operation|@Schema' src/ 2>/dev/null; then
  HAS_API_DOC=true; API_DOC_TYPE="openapi3"
fi

if [ "$HAS_API_DOC" = true ]; then
  echo "检测到 API 文档注解: $API_DOC_TYPE"
fi

# 5. 变异测试检测
HAS_MUTATION_TEST=false
MUTATION_TOOL="unknown"

if grep -q 'pitest' pom.xml 2>/dev/null; then
  HAS_MUTATION_TEST=true; MUTATION_TOOL="pit"
elif grep -q '@stryker-mutator' package.json 2>/dev/null; then
  HAS_MUTATION_TEST=true; MUTATION_TOOL="stryker"
elif grep -q 'mutmut' requirements.txt 2>/dev/null; then
  HAS_MUTATION_TEST=true; MUTATION_TOOL="mutmut"
fi

# 6. 数据库迁移工具检测
MIGRATION_TOOL="unknown"

if grep -qE 'flywaycore|flyway-maven-plugin' pom.xml 2>/dev/null; then
  MIGRATION_TOOL="flyway"
elif grep -q 'liquibase-core' pom.xml 2>/dev/null; then
  MIGRATION_TOOL="liquibase"
fi

if [ "$MIGRATION_TOOL" != "unknown" ]; then
  echo "检测到数据库迁移工具: $MIGRATION_TOOL"
fi
```

### 检测结果输出

检测完成后，将结果写入 `harness/.analysis/web-app-detection.json`：

```json
{
  "language": "java",
  "is_web_app": true,
  "web_signals": 5,
  "database": {
    "detected": true,
    "type": "mysql",
    "has_test_db": true,
    "test_db_type": "h2"
  },
  "orm": {
    "detected": true,
    "type": "mybatis",
    "has_mapper_xml": true,
    "migration_tool": "flyway"
  },
  "api_doc": {
    "detected": true,
    "type": "custom-action"
  },
  "mutation_test": {
    "detected": false,
    "tool": null
  },
  "scaffold_additions": [
    "docs/api.md",
    "scripts/check-db-consistency.sh",
    "scripts/run-api-tests.sh",
    "scripts/code-review-check.sh"
  ]
}
```

---

## 脚手架激活规则

基于检测结果，决定哪些增强文件需要生成：

| 检测结果 | 生成文件 | 说明 |
|---------|---------|------|
| `is_web_app = true` | `docs/api.md` | API 接口文档模板 |
| `is_web_app = true` | `scripts/run-api-tests.sh` | API 测试脚本模板 |
| `is_web_app = true` | `scripts/code-review-check.sh` | 编码规范检查脚本 |
| `is_web_app = true` | Makefile 增加 `api-doc` / `api-test` target | |
| `database.detected = true` AND `orm.detected = true` | `scripts/check-db-consistency.sh` | DDL 一致性检查脚本 |
| `database.detected = true` AND `orm.detected = true` | Makefile 增加 `check-db` target | |
| `language = java` AND `is_web_app = true` | `pmd-ruleset.xml` | PMD 规则集模板 |
| `is_web_app = true` | `scripts/generate-api-doc.sh` | API 文档生成脚本 |
| `mutation_test.detected = true` 或 `is_web_app = true` | Makefile 增加 `mutation-test` target | 变异测试为可选 |

---

## 与 harness-executor 集成

检测结果的 `scaffold_additions` 字段供 harness-executor 在 Step 3 验证时使用：

- 如果 `scripts/check-db-consistency.sh` 存在 → Layer 2 运行 DDL 一致性检查
- 如果 `scripts/code-review-check.sh` 存在 → Layer 2 运行编码规范检查
- 如果 `scripts/run-api-tests.sh` 存在 → Step 4 优先使用 API 测试
- 如果 Makefile 有 `mutation-test` target → 可选 Layer 2.5 变异测试
