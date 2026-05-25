# 语言适配器模式

每个语言适配器都必须遵循此模式。适配器是整个 harness 系统中所有语言特定行为的单一事实来源。

## 设计原则

1. **发现，而非假设**：适配器定义检测规则，而非核心系统
2. **一个适配器，一种语言**：每个适配器为单一语言生态系统自包含
3. **优雅降级**：每个字段都是可选的 — 缺失字段回退到通用行为
4. **可扩展性**：添加新语言 = 添加一个适配器文件，零核心改动

## 模式定义

```yaml
adapter:
  # ─── 元数据 ───────────────────────────────────────────────
  language: string               # 唯一标识符: go, typescript, python, java, rust, 等
  display_name: string           # 人类可读名称: "Go", "TypeScript", "Python", 等
  version: string                # 适配器模式版本（当前 "1.0"）

  # ─── 检测 ──────────────────────────────────────────────
  # 如何在项目中识别此语言。
  # 检测按顺序运行；首个最高置信度匹配胜出。
  detection:
    # 文件存在即表示此语言（任意匹配 = 候选）
    files: [string]
    # 可选：要求文件内容模式以获得更高置信度
    content_patterns:
      - file: string             # Glob 模式（例如 "*.toml", "package.json"）
        pattern: string          # 在文件内匹配的正则表达式
    # detection.files 匹配时的整体置信度（0.0 - 1.0）
    confidence: float

  # ─── 命令 ───────────────────────────────────────────────
  # 标准开发命令。null = 对此语言不适用。
  # 这些是默认值；DEVELOPMENT.md 或 harness/config/validate.json 中的项目级覆盖始终优先。
  commands:
    build: string | null         # 编译/转译: "go build ./...", "npm run build"
    test: string | null          # 运行测试: "go test ./...", "npm test"
    lint: string | null          # 通用 lint: "golangci-lint run", "npm run lint"
    lint_arch: string | null     # 架构 lint: "make lint-arch", "npm run lint:arch"
    format: string | null        # 代码格式化: "gofmt -w .", "prettier --write ."
    start: string | null         # 启动应用: "go run main.go", "npm start"
    dev: string | null           # 开发模式: "air", "npm run dev"

  # ─── 包管理器 ────────────────────────────────────────
  # 如何检测和使用包管理器。
  package_manager:
    # 检测优先级：首个匹配胜出
    detection:
      - lockfile: string         # 例如 "pnpm-lock.yaml"
        manager: string          # 例如 "pnpm"
      - lockfile: string
        manager: string
    default: string              # 无锁文件时回退: "npm", "pip", 等
    install_command: string      # 模板: "{manager} install"

  # ─── 路由检测 ────────────────────────────────────────
  # 如何查找 HTTP 路由、CLI 命令和其他入口点。
  # 供 verify.py 和 generate_task_verification.py 使用。
  route_detection:
    # 指示此项目是服务器的标记（扫描文件内容）
    server_indicators:
      - pattern: string          # 在源文件中查找的正则表达式
        description: string      # 人类可读的说明
        frameworks: [string]     # 关联框架: ["chi", "gin"]

    # 指示此项目是 CLI 工具的标记
    cli_indicators:
      - pattern: string
        description: string
        frameworks: [string]

    # 指示此项目是前端应用的标记
    frontend_indicators:
      - pattern: string
        description: string
        frameworks: [string]

    # 路由/命令提取模式
    patterns:
      - type: route              # "route" 表示 HTTP, "command" 表示 CLI
        regex: string            # 带命名组的提取正则
        groups: [string]         # 命名组: [method, path] 或 [command_name]
        frameworks: [string]     # 此模式匹配的框架

  # ─── 导入分析 ────────────────────────────────────────
  # 如何分析导入以进行依赖 lint。
  import_analysis:
    # 列出所有包/模块的命令
    list_packages: string | null # "go list ./...", 无此功能的语言为 null
    # 从源文件中提取导入的正则表达式
    import_pattern: string       # 例如 Go 用 '"([^"]+)"', TS 用 'from [\'"]([^\'"]+)'
    # 扫描的文件扩展名
    source_extensions: [string]  # [".go"], [".ts", ".tsx", ".js", ".jsx"]
    # 模块根检测
    module_root_file: string     # "go.mod", "package.json", "pyproject.toml"

  # ─── 层级约定 ──────────────────────────────────────
  # 架构 lint 的默认层级层次结构。
  # 这些是起始默认值；分析器代理基于实际导入图分析进行调整。
  layer_conventions:
    patterns:
      - layer: int               # 0 = 基础层, 越高 = 越特定于应用
        paths: [string]          # 目录模式: ["internal/types", "types", "domain"]
        description: string      # "纯类型，零内部导入"

  # ─── 依赖检测 ───────────────────────────────────
  # 如何从项目依赖清单检测外部依赖（数据库、服务等）。
  dependency_detection:
    manifest_file: string        # "go.mod", "package.json", "requirements.txt"
    # 检测特定依赖类型的模式
    databases:
      - pattern: string          # 依赖名称上的正则表达式
        type: string             # "postgres", "mysql", "mongodb", "redis", "sqlite"
        default_port: int
    services:
      - pattern: string
        type: string             # "kafka", "rabbitmq", "elasticsearch", 等
        default_port: int
    # 源代码中的环境变量检测
    env_var_patterns:
      - pattern: string          # 例如 Go 用 'os\.Getenv\("([^"]+)"\)'

  # ─── Linter 模板 ───────────────────────────────────────
  # 此语言的 linter 实现引用。
  linter:
    # 指向 linter-templates.md 中的章节
    template_section: string     # "go-linter", "typescript-linter", 等
    # linter 脚本的文件扩展名
    script_extension: string     # ".go", ".ts", ".py"
    # 如何运行 linter
    run_command: string          # "go run scripts/lint-deps.go", "npx ts-node scripts/lint-deps.ts"

  # ─── 命名约定 ─────────────────────────────────────
  # verify_action.py 的文件和目录命名规则。
  naming:
    file_pattern: string         # 正则: "^[a-z][a-z0-9_]*\\.go$"
    test_pattern: string         # 正则: "^[a-z][a-z0-9_]*_test\\.go$"
    directory_style: string      # "snake_case", "kebab-case", "camelCase"

  # ─── CI 模板 ────────────────────────────────────────────
  # 此语言的 CI 配置模板。
  ci:
    # GitHub Actions 模板（主选）
    github_actions:
      image: string              # "golang:1.22", "node:20", "python:3.12"
      setup_steps: [string]      # 额外设置步骤
      cache_paths: [string]      # 缓存路径: ["~/go/pkg/mod"], ["node_modules"]
    # 其他 CI 系统可在此添加
```

## 解析优先级

当 harness 系统需要语言特定行为时，遵循以下解析链：

1. **项目级覆盖** — `harness/config/validate.json`, `DEVELOPMENT.md` 命令
2. **适配器默认值** — 匹配适配器的 `commands` 章节
3. **通用回退** — `generic.md` 适配器（从 Makefile/README 发现）

## 添加新语言

要添加对新语言的支持（例如 Kotlin）：

1. 创建 `references/adapters/kotlin.md` 遵循此模式
2. 填写检测规则、命令、路由模式
3. 可选：在 `linter-templates.md` 中添加 linter 模板章节
4. 无需修改核心脚本 — `detect_adapter.py` 自动发现适配器

## 适配器文件格式

每个适配器文件使用 YAML front matter 后接散文文档：

```markdown
---
adapter:
  language: kotlin
  display_name: "Kotlin"
  version: "1.0"
  detection:
    files: [build.gradle.kts, build.gradle]
    confidence: 0.9
  commands:
    build: "./gradlew build"
    test: "./gradlew test"
    # ...
---

# Kotlin 适配器

## 框架特定说明

### Ktor（服务器）
- 路由通过 `routing { get("/path") { ... } }` 定义
- ...

### Spring Boot
- 路由通过 `@GetMapping`, `@PostMapping` 注解
- ...
```
