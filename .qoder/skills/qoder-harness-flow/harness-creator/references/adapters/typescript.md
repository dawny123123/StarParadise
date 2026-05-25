---
adapter:
  language: typescript
  display_name: "TypeScript / JavaScript"
  version: "1.0"

  detection:
    files: [package.json, tsconfig.json]
    content_patterns:
      - file: "package.json"
        pattern: '"(typescript|@types/node)"'
    confidence: 0.90

  commands:
    build: "{pkg_manager} run build"
    test: "{pkg_manager} test"
    lint: "{pkg_manager} run lint"
    lint_arch: "{pkg_manager} run lint:arch"
    format: "{pkg_manager} run format"
    start: "{pkg_manager} start"
    dev: "{pkg_manager} run dev"

  package_manager:
    detection:
      - lockfile: "pnpm-lock.yaml"
        manager: "pnpm"
      - lockfile: "yarn.lock"
        manager: "yarn"
      - lockfile: "bun.lockb"
        manager: "bun"
      - lockfile: "package-lock.json"
        manager: "npm"
    default: "npm"
    install_command: "{manager} install"

  route_detection:
    server_indicators:
      - pattern: 'require\(["\x27]express["\x27]\)|from ["\x27]express["\x27]'
        description: "Express.js web 框架"
        frameworks: ["express"]
      - pattern: 'require\(["\x27]fastify["\x27]\)|from ["\x27]fastify["\x27]'
        description: "Fastify web 框架"
        frameworks: ["fastify"]
      - pattern: 'from ["\x27]@nestjs/common["\x27]'
        description: "NestJS 框架"
        frameworks: ["nestjs"]
      - pattern: 'require\(["\x27]koa["\x27]\)|from ["\x27]koa["\x27]'
        description: "Koa web 框架"
        frameworks: ["koa"]
      - pattern: 'require\(["\x27]hono["\x27]\)|from ["\x27]hono["\x27]'
        description: "Hono web 框架"
        frameworks: ["hono"]
      - pattern: 'createServer|http\.Server'
        description: "Node.js HTTP 服务器"
        frameworks: ["http"]

    cli_indicators:
      - pattern: 'require\(["\x27]commander["\x27]\)|from ["\x27]commander["\x27]'
        description: "Commander.js CLI 框架"
        frameworks: ["commander"]
      - pattern: 'require\(["\x27]yargs["\x27]\)|from ["\x27]yargs["\x27]'
        description: "Yargs CLI 框架"
        frameworks: ["yargs"]
      - pattern: 'require\(["\x27]@oclif/core["\x27]\)|from ["\x27]@oclif'
        description: "Oclif CLI 框架"
        frameworks: ["oclif"]
      - pattern: 'require\(["\x27]inquirer["\x27]\)|from ["\x27]inquirer["\x27]'
        description: "Inquirer.js 交互式 CLI"
        frameworks: ["inquirer"]

    frontend_indicators:
      - pattern: 'from ["\x27]react["\x27]|require\(["\x27]react["\x27]\)'
        description: "React"
        frameworks: ["react"]
      - pattern: 'from ["\x27]vue["\x27]|createApp'
        description: "Vue.js"
        frameworks: ["vue"]
      - pattern: 'from ["\x27]svelte["\x27]'
        description: "Svelte"
        frameworks: ["svelte"]
      - pattern: 'from ["\x27]next["\x27]|from ["\x27]next/'
        description: "Next.js"
        frameworks: ["next"]
      - pattern: 'defineNuxtConfig|from ["\x27]nuxt["\x27]'
        description: "Nuxt"
        frameworks: ["nuxt"]

    patterns:
      # Express / Koa 风格
      - type: route
        regex: '(app|router)\.(get|post|put|delete|patch|all)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [_, method, path]
        frameworks: ["express", "koa", "hono"]
      # Fastify
      - type: route
        regex: '(fastify|server|app)\.(get|post|put|delete|patch)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [_, method, path]
        frameworks: ["fastify"]
      # NestJS 装饰器
      - type: route
        regex: '@(Get|Post|Put|Delete|Patch)\s*\(\s*["\x27]([^"\x27]*)["\x27]?\s*\)'
        groups: [method, path]
        frameworks: ["nestjs"]
      # Next.js app router（基于文件）
      - type: route
        regex: 'export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)'
        groups: [method]
        frameworks: ["next"]
      # Commander CLI
      - type: command
        regex: '\.command\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [command_name]
        frameworks: ["commander"]
      # Yargs
      - type: command
        regex: '\.command\s*\(\s*["\x27]([^"\x27\s]+)'
        groups: [command_name]
        frameworks: ["yargs"]

  import_analysis:
    list_packages: null  # TS 没有原生包列表器
    import_pattern: "from ['\"]([^'\"]+)['\"]|require\\(['\"]([^'\"]+)['\"]\\)"
    source_extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
    module_root_file: "package.json"

  layer_conventions:
    patterns:
      - layer: 0
        paths: ["src/types", "src/models", "types", "shared/types"]
        description: "类型定义、接口、模式"
      - layer: 1
        paths: ["src/utils", "src/lib", "src/helpers", "utils", "lib"]
        description: "工具函数，仅依赖类型"
      - layer: 2
        paths: ["src/services", "src/core", "services", "core"]
        description: "业务逻辑层"
      - layer: 3
        paths: ["src/controllers", "src/handlers", "src/routes", "src/api"]
        description: "HTTP/API 处理器"
      - layer: 4
        paths: ["src/app", "src/pages", "src/index.ts", "src/main.ts"]
        description: "应用入口点"

  dependency_detection:
    manifest_file: "package.json"
    databases:
      - pattern: '"(pg|postgres|@prisma/client|typeorm|knex|drizzle-orm|sequelize)"'
        type: "postgres"
        default_port: 5432
      - pattern: '"(mysql2|mysql)"'
        type: "mysql"
        default_port: 3306
      - pattern: '"(mongodb|mongoose|mongosh)"'
        type: "mongodb"
        default_port: 27017
      - pattern: '"(redis|ioredis|@redis/client)"'
        type: "redis"
        default_port: 6379
      - pattern: '"(better-sqlite3|sql.js)"'
        type: "sqlite"
        default_port: 0
    services:
      - pattern: '"(kafkajs|@kafka-js/confluent-schema-registry)"'
        type: "kafka"
        default_port: 9092
      - pattern: '"(amqplib|amqp-connection-manager)"'
        type: "rabbitmq"
        default_port: 5672
      - pattern: '"(@elastic/elasticsearch)"'
        type: "elasticsearch"
        default_port: 9200
    env_var_patterns:
      - pattern: 'process\.env\.([A-Z_][A-Z0-9_]*)'
      - pattern: 'process\.env\[[\x27"]([A-Z_][A-Z0-9_]*)[\x27"]\]'

  linter:
    template_section: "typescript-linter"
    script_extension: ".ts"
    run_command: "npx ts-node scripts/lint-deps.ts"

  naming:
    file_pattern: "^[a-zA-Z][a-zA-Z0-9.-]*\\.(ts|tsx|js|jsx|mjs|cjs)$"
    test_pattern: "^[a-zA-Z][a-zA-Z0-9.-]*\\.(test|spec)\\.(ts|tsx|js|jsx)$"
    directory_style: "kebab-case"

  ci:
    github_actions:
      image: "node:20"
      setup_steps:
        - "uses: actions/setup-node@v4\n  with:\n    node-version: '20'"
      cache_paths: ["node_modules", ".next/cache"]
---

# TypeScript / JavaScript 适配器

## 包管理器检测

TypeScript 项目有多个包管理器。检测优先级：

| 锁文件 | 管理器 | 运行命令 |
|-----------|---------|-------------|
| `pnpm-lock.yaml` | pnpm | `pnpm run <script>` |
| `yarn.lock` | yarn | `yarn <script>` |
| `bun.lockb` | bun | `bun run <script>` |
| `package-lock.json` | npm | `npm run <script>` |

命令中所有 `{pkg_manager}` 占位符在检测时解析。

## 服务器启动命令推断

1. `verify.json` → `server.start`
2. `package.json` → `scripts.start` 存在 → `{pkg_manager} start`
3. `package.json` → `scripts.dev` 存在 → `{pkg_manager} run dev`
4. 存在 `dist/index.js` → `node dist/index.js`
5. 存在 `src/index.ts` → `npx ts-node src/index.ts`

## 端口检测

1. `verify.json` → `server.readiness.port`
2. `package.json` 脚本包含 `PORT=(\d+)` → 使用该端口
3. `.env` 包含 `PORT=(\d+)` → 使用该端口
4. 默认：3000（前端），8080（服务器）

## 框架特定说明

### Next.js / Nuxt
- 基于文件的路由：路由从 `app/` 或 `pages/` 目录结构派生
- API 路由：`app/api/**/route.ts`（Next.js App Router）
- 生产验证使用 `next build && next start`

### NestJS
- 基于装饰器的路由：`@Get()`, `@Post()`, `@Controller('prefix')`
- 模块系统：扫描 `*.module.ts` 查找服务注册
- 默认端口：3000

### Express / Fastify
- 显式路由：`app.get('/path', handler)`
- 中间件链影响验证顺序

## Monorepo 支持

如果 `package.json` 中存在 `workspaces` 或存在 `pnpm-workspace.yaml`：
- 按工作区运行检测
- 每个工作区可能有自己的适配器覆盖
- 构建顺序遵循工作区依赖图
