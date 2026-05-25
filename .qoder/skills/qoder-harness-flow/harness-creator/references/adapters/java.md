---
adapter:
  language: java
  display_name: "Java / Kotlin"
  version: "1.0"

  detection:
    files: [pom.xml, build.gradle, build.gradle.kts, settings.gradle, settings.gradle.kts]
    content_patterns:
      - file: "pom.xml"
        pattern: "<groupId>"
      - file: "build.gradle.kts"
        pattern: "plugins|dependencies"
    confidence: 0.90

  commands:
    build: null   # 从构建工具检测
    test: null    # 从构建工具检测
    lint: null    # 常使用 spotbugs, checkstyle, 或 ktlint
    lint_arch: null
    format: null
    start: null
    dev: null

  package_manager:
    detection:
      - lockfile: "pom.xml"
        manager: "maven"
      - lockfile: "build.gradle"
        manager: "gradle"
      - lockfile: "build.gradle.kts"
        manager: "gradle"
    default: "maven"
    install_command: null  # 构建时解析依赖

  route_detection:
    server_indicators:
      - pattern: '@RestController|@Controller|@RequestMapping'
        description: "Spring MVC/Boot 控制器"
        frameworks: ["spring"]
      - pattern: 'import io\.micronaut'
        description: "Micronaut 框架"
        frameworks: ["micronaut"]
      - pattern: 'import io\.quarkus'
        description: "Quarkus 框架"
        frameworks: ["quarkus"]
      - pattern: 'import io\.vertx'
        description: "Vert.x 框架"
        frameworks: ["vertx"]
      - pattern: 'import io\.ktor'
        description: "Ktor 框架（Kotlin）"
        frameworks: ["ktor"]
      - pattern: 'import io\.javalin'
        description: "Javalin web 框架"
        frameworks: ["javalin"]

    cli_indicators:
      - pattern: 'import picocli|@CommandLine'
        description: "picocli CLI 框架"
        frameworks: ["picocli"]
      - pattern: 'public static void main\(String'
        description: "Java main 方法（潜在 CLI）"
        frameworks: ["stdlib"]

    frontend_indicators: []

    patterns:
      # Spring MVC 注解
      - type: route
        regex: '@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*(?:value\s*=\s*)?["\x27]([^"\x27]*)["\x27]'
        groups: [method, path]
        frameworks: ["spring"]
      # Spring RequestMapping
      - type: route
        regex: '@RequestMapping\s*\(.*(?:value|path)\s*=\s*["\x27]([^"\x27]+)["\x27].*method\s*=\s*RequestMethod\.(\w+)'
        groups: [path, method]
        frameworks: ["spring"]
      # Ktor（Kotlin）
      - type: route
        regex: '(get|post|put|delete|patch)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["ktor"]
      # Javalin
      - type: route
        regex: 'app\.(get|post|put|delete|patch)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["javalin"]

  import_analysis:
    list_packages: null
    import_pattern: "^import\\s+([\\w.]+)"
    source_extensions: [".java", ".kt"]
    module_root_file: "pom.xml"

  layer_conventions:
    patterns:
      - layer: 0
        paths: ["src/main/java/**/model", "src/main/java/**/entity", "src/main/java/**/dto"]
        description: "领域模型、实体、DTO"
      - layer: 1
        paths: ["src/main/java/**/util", "src/main/java/**/common", "src/main/java/**/config"]
        description: "工具和配置"
      - layer: 2
        paths: ["src/main/java/**/service", "src/main/java/**/repository", "src/main/java/**/dao"]
        description: "服务和数据访问层"
      - layer: 3
        paths: ["src/main/java/**/controller", "src/main/java/**/api", "src/main/java/**/resource"]
        description: "REST 控制器、API 端点"
      - layer: 4
        paths: ["src/main/java/**/Application.java", "src/main/java/**/Main.java"]
        description: "应用入口点"

  dependency_detection:
    manifest_file: "pom.xml"
    databases:
      - pattern: "postgresql|postgres"
        type: "postgres"
        default_port: 5432
      - pattern: "mysql-connector"
        type: "mysql"
        default_port: 3306
      - pattern: "mongodb-driver|mongo-java-driver"
        type: "mongodb"
        default_port: 27017
      - pattern: "jedis|lettuce-core|spring-data-redis"
        type: "redis"
        default_port: 6379
      - pattern: "h2|sqlite-jdbc"
        type: "sqlite"
        default_port: 0
    services:
      - pattern: "kafka-clients|spring-kafka"
        type: "kafka"
        default_port: 9092
      - pattern: "amqp-client|spring-amqp|spring-rabbit"
        type: "rabbitmq"
        default_port: 5672
      - pattern: "elasticsearch-rest-client|spring-data-elasticsearch"
        type: "elasticsearch"
        default_port: 9200
    env_var_patterns:
      - pattern: 'System\.getenv\(\s*["\x27]([^"\x27]+)["\x27]\)'
      - pattern: '\\$\\\{([A-Z_][A-Z0-9_]*)\}'

  linter:
    template_section: "java-linter"
    script_extension: ".java"
    run_command: null  # 通常集成到构建工具中（spotbugs, checkstyle）

  naming:
    file_pattern: "^[A-Z][a-zA-Z0-9]*\\.java$"
    test_pattern: "^[A-Z][a-zA-Z0-9]*Test\\.java$"
    directory_style: "lowercase"

  web_app_detection:
    api_doc_annotations:
      - pattern: '@Action'
        description: "自定义统一入口 Action 注解"
        doc_type: "custom-action"
      - pattern: '@ApiOperation|@Api'
        description: "Swagger 2 注解"
        doc_type: "swagger2"
      - pattern: '@Tag|@Operation|@Schema'
        description: "Springdoc/OpenAPI 3 注解"
        doc_type: "openapi3"
    ddl_sync_indicators:
      - pattern: 'mybatis|mybatis-plus'
        description: "MyBatis ORM"
        orm_type: "mybatis"
        has_mapper_xml: true
      - pattern: 'spring-boot-starter-data-jpa'
        description: "JPA/Hibernate ORM"
        orm_type: "jpa"
        has_mapper_xml: false
      - pattern: 'flywaycore|flyway-maven-plugin'
        description: "Flyway 数据库迁移"
        migration_tool: "flyway"
      - pattern: 'liquibase-core'
        description: "Liquibase 数据库迁移"
        migration_tool: "liquibase"
    code_convention_tools:
      format:
        - tool: "spotless-maven-plugin"
          command: "mvn spotless:apply"
          check_command: "mvn spotless:check"
        - tool: "spotless-plugin-gradle"
          command: "./gradlew spotlessApply"
          check_command: "./gradlew spotlessCheck"
      static_analysis:
        - tool: "pmd"
          command: "mvn pmd:check"
          report: "target/pmd.xml"
        - tool: "p3c-pmd"
          command: "mvn p3c-pmd:pmd"
          description: "阿里巴巴 Java 开发规约"
        - tool: "spotbugs"
          command: "mvn spotbugs:check"
      coverage:
        - tool: "jacoco"
          command: "mvn jacoco:report"
          report: "target/site/jacoco/index.html"
    mutation_test:
      tool: "pitest"
      maven_plugin: "pitest-maven"
      junit5_plugin: "pitest-junit5-plugin"
      command: "mvn org.pitest:pitest-maven:mutationCoverage"
      report: "target/pit-reports/index.html"

  ci:
    github_actions:
      image: null  # 使用 setup-java action
      setup_steps:
        - "uses: actions/setup-java@v4\n  with:\n    distribution: 'temurin'\n    java-version: '21'"
      cache_paths: ["~/.m2/repository", "~/.gradle/caches"]
---

# Java / Kotlin 适配器

## 构建工具检测

| 文件 | 构建工具 | 构建命令 | 测试命令 |
|------|-----------|---------------|--------------|
| `pom.xml` | Maven | `mvn package -DskipTests` | `mvn test` |
| `build.gradle` | Gradle (Groovy) | `./gradlew build -x test` | `./gradlew test` |
| `build.gradle.kts` | Gradle (Kotlin DSL) | `./gradlew build -x test` | `./gradlew test` |

如果存在 `mvnw` 或 `gradlew` wrapper，优先使用 wrapper 而非系统安装的工具。

## 服务器启动命令推断

1. `verify.json` → `server.start`
2. Spring Boot → `./gradlew bootRun` 或 `mvn spring-boot:run`
3. 存在 Fat JAR → `java -jar target/*.jar` 或 `java -jar build/libs/*.jar`
4. 类上有 `@SpringBootApplication` 注解 → 从 pom.xml/build.gradle 推断

## 框架特定说明

### Spring Boot
- 注解路由：`@GetMapping("/path")`, `@PostMapping("/path")`
- 控制器前缀：类上的 `@RequestMapping("/api/v1")`
- 自动配置：`application.properties` 或 `application.yml`
- 默认端口：8080（可通过 `server.port` 配置）
- Actuator 健康检查：`/actuator/health`

### Micronaut
- 类似 Spring 的注解风格：`@Get("/path")`, `@Post("/path")`
- 编译时 DI（无反射）
- 默认端口：8080

### Ktor（Kotlin）
- 基于 DSL 的路由：`routing { get("/path") { ... } }`
- 通过 `application.conf`（HOCON）或 `application.yaml` 配置

## 测试模式

- JUnit 5 是标准：`@Test`, `@ParameterizedTest`
- Kotlin：相同的 JUnit 5 + kotest 作为替代
- 集成测试常使用 `@SpringBootTest` + Testcontainers
- 测试目录：`src/test/java/` 或 `src/test/kotlin/`

## Web 应用增强检测

当检测到 Web 应用（`@RestController` / `@Controller` / `@Action` 注解存在）时，Creator 自动激活以下增强：

### API 文档生成

| 注解类型 | 检测方式 | 生成策略 |
|---------|---------|----------|
| `@Action` | grep 源码 | 扫描所有 `@Action` 注解，提取 action 名称、参数、返回值，生成 `docs/api.md` |
| Swagger 2 | grep 源码 `@Api` / `@ApiOperation` | 使用 `swagger-maven-plugin` 生成 OpenAPI spec，再转为 Markdown |
| OpenAPI 3 | grep 源码 `@Tag` / `@Operation` | 使用 `springdoc-openapi` 生成 spec，再转为 Markdown |

**生成命令**：
```bash
# 自定义 Action 注解
bash scripts/generate-api-doc.sh

# Swagger 2
mvn swagger:generate && python3 scripts/openapi-to-markdown.py target/swagger.json

# OpenAPI 3 (Springdoc)
mvn spring-boot:run -Dspringdoc.api-docs.enabled=true && curl -s http://localhost:8080/v3/api-docs | python3 scripts/openapi-to-markdown.py -
```

### DDL/Entity 同步

| ORM 类型 | 同步检查点 |
|---------|----------|
| MyBatis | DDL 迁移脚本(mysql/ + h2/) + Entity.java + Mapper.xml(resultMap) |
| JPA | DDL 迁移脚本(mysql/ + h2/) + Entity.java(@Column) |

**四端同步规则**：
```
1. src/main/resources/db/migration/mysql/V1.x.x__description.sql
2. src/main/resources/db/migration/h2/V1.x.x__description.sql
3. src/main/java/.../entity/XxxEntity.java
4. src/main/resources/mapper/xxx/XxxMapper.xml (resultMap)  [MyBatis 专用]
```

**检查命令**：
```bash
bash scripts/check-db-consistency.sh
```

### 编码规范检查

```bash
# 代码格式
mvn spotless:check

# 静态分析（PMD + 阿里巴巴规约）
mvn pmd:check
mvn p3c-pmd:pmd

# 覆盖率
mvn jacoco:report

# 综合检查
bash scripts/code-review-check.sh
```

### 变异测试

```bash
# 变异测试突击检查（临时 PIT 配置，检查后自动清理）
bash scripts/mutation-spot-check.sh com.example.service.impl.*

# 快速模式（限制变异数量）
bash scripts/mutation-spot-check.sh --quick com.example.service.impl.XxxServiceImpl

# 诊断模式（批量检查核心 Service）
bash scripts/diagnose-mutation-tests.sh
```

### API 接口测试

```bash
# 启动应用并运行 API 测试
bash scripts/run-api-tests.sh

# 测试外部已启动的应用
bash scripts/run-api-tests.sh --external

# 指定应用地址
bash scripts/run-api-tests.sh --url http://localhost:8080
```
