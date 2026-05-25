---
adapter:
  language: go
  display_name: "Go"
  version: "1.0"

  detection:
    files: [go.mod, go.sum]
    confidence: 0.95

  commands:
    build: "go build ./..."
    test: "go test ./..."
    lint: "golangci-lint run"
    lint_arch: "make lint-arch"
    format: "gofmt -w ."
    start: null   # 从 cmd/ 结构或 main.go 推断
    dev: null      # 常使用 "air" 但不假设

  package_manager:
    detection: []  # Go modules 是内置的
    default: "go"
    install_command: "go mod download"

  route_detection:
    server_indicators:
      - pattern: 'http\.ListenAndServe|http\.Server\{|\.Listen\('
        description: "标准库 HTTP 服务器"
        frameworks: ["net/http"]
      - pattern: 'gin\.Default|gin\.New'
        description: "Gin web 框架"
        frameworks: ["gin"]
      - pattern: 'chi\.NewRouter|chi\.NewMux'
        description: "Chi 路由器"
        frameworks: ["chi"]
      - pattern: 'echo\.New\(\)'
        description: "Echo web 框架"
        frameworks: ["echo"]
      - pattern: 'mux\.NewRouter'
        description: "Gorilla Mux 路由器"
        frameworks: ["gorilla/mux"]
      - pattern: 'fiber\.New\(\)'
        description: "Fiber web 框架"
        frameworks: ["fiber"]

    cli_indicators:
      - pattern: 'github\.com/spf13/cobra'
        description: "Cobra CLI 框架"
        frameworks: ["cobra"]
      - pattern: 'github\.com/urfave/cli'
        description: "urfave/cli 框架"
        frameworks: ["urfave/cli"]
      - pattern: 'flag\.Parse\(\)|flag\.String\('
        description: "标准库 flags"
        frameworks: ["flag"]

    frontend_indicators: []  # Go 通常不用于前端

    patterns:
      # Chi 路由器
      - type: route
        regex: 'r\.(Get|Post|Put|Delete|Patch|Head|Options)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["chi"]
      # Gin
      - type: route
        regex: '\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["gin"]
      # Echo
      - type: route
        regex: 'e\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [method, path]
        frameworks: ["echo"]
      # Gorilla Mux
      - type: route
        regex: '\.HandleFunc\s*\(\s*["\x27]([^"\x27]+)["\x27].*\)\.(Methods)\s*\(\s*["\x27]([^"\x27]+)["\x27]\)'
        groups: [path, _, method]
        frameworks: ["gorilla/mux"]
      # net/http
      - type: route
        regex: 'http\.HandleFunc\s*\(\s*["\x27]([^"\x27]+)["\x27]'
        groups: [path]
        frameworks: ["net/http"]
      # Cobra CLI
      - type: command
        regex: '&cobra\.Command\s*\{\s*Use:\s*["\x27]([^"\x27\s]+)'
        groups: [command_name]
        frameworks: ["cobra"]

  import_analysis:
    list_packages: "go list -json ./..."
    import_pattern: '"([^"]+)"'
    source_extensions: [".go"]
    module_root_file: "go.mod"

  layer_conventions:
    patterns:
      - layer: 0
        paths: ["internal/types", "types", "domain", "model", "entity"]
        description: "纯类型，零内部导入"
      - layer: 1
        paths: ["internal/utils", "utils", "pkg/utils", "lib"]
        description: "工具类，仅依赖类型"
      - layer: 2
        paths: ["internal/core", "core", "internal/service", "service"]
        description: "业务逻辑，依赖类型 + 工具"
      - layer: 3
        paths: ["internal/handler", "handler", "api", "internal/api"]
        description: "HTTP/gRPC 处理器，依赖核心层"
      - layer: 4
        paths: ["cmd"]
        description: "入口点，依赖所有层"

  dependency_detection:
    manifest_file: "go.mod"
    databases:
      - pattern: "github.com/jackc/pgx|github.com/lib/pq"
        type: "postgres"
        default_port: 5432
      - pattern: "github.com/go-sql-driver/mysql"
        type: "mysql"
        default_port: 3306
      - pattern: "go.mongodb.org/mongo-driver"
        type: "mongodb"
        default_port: 27017
      - pattern: "github.com/go-redis/redis|github.com/redis/go-redis"
        type: "redis"
        default_port: 6379
      - pattern: "github.com/mattn/go-sqlite3|modernc.org/sqlite"
        type: "sqlite"
        default_port: 0
    services:
      - pattern: "github.com/segmentio/kafka-go|github.com/IBM/sarama"
        type: "kafka"
        default_port: 9092
      - pattern: "github.com/rabbitmq/amqp091-go|github.com/streadway/amqp"
        type: "rabbitmq"
        default_port: 5672
      - pattern: "github.com/nats-io/nats.go"
        type: "nats"
        default_port: 4222
      - pattern: "github.com/elastic/go-elasticsearch"
        type: "elasticsearch"
        default_port: 9200
    env_var_patterns:
      - pattern: 'os\.Getenv\("([^"]+)"\)'
      - pattern: 'os\.LookupEnv\("([^"]+)"\)'
      - pattern: 'viper\.\w+\("([^"]+)"\)'

  linter:
    template_section: "go-linter"
    script_extension: ".go"
    run_command: "go run scripts/lint-deps.go"

  naming:
    file_pattern: "^[a-z][a-z0-9_]*\\.go$"
    test_pattern: "^[a-z][a-z0-9_]*_test\\.go$"
    directory_style: "snake_case"

  ci:
    github_actions:
      image: "golang:1.22"
      setup_steps:
        - "uses: actions/setup-go@v5\n  with:\n    go-version: '1.22'"
      cache_paths: ["~/go/pkg/mod", "~/.cache/go-build"]
---

# Go 适配器

## 服务器启动命令推断

检测服务器启动命令的优先级顺序：

1. `verify.json` → `server.start`
2. 存在 `cmd/server/main.go` → `go run cmd/server/main.go`
3. 存在 `cmd/api/main.go` → `go run cmd/api/main.go`
4. 根目录 `main.go` 包含 `http` 导入 → `go run main.go`
5. 失败并给出可操作的错误

## CLI 二进制文件推断

1. 存在 `cmd/cli/main.go` → `go build -o bin/cli cmd/cli/main.go`
2. 存在 `cmd/<name>/main.go` → `go build -o bin/<name> cmd/<name>/main.go`
3. 根目录 `main.go` 包含 `cobra`/`flag` 导入 → `go build -o bin/app .`

## 测试模式

- 单元测试：与源码并存的 `*_test.go` 文件
- 集成测试：`//go:build integration` 构建标签 → `go test -tags=integration ./...`
- 表驱动测试是惯用法

## 常见框架

| 框架 | 检测模式 | 路由风格 |
|-----------|------------------|-------------|
| chi | `github.com/go-chi/chi` | `r.Get("/path", handler)` |
| gin | `github.com/gin-gonic/gin` | `r.GET("/path", handler)` |
| echo | `github.com/labstack/echo` | `e.GET("/path", handler)` |
| fiber | `github.com/gofiber/fiber` | `app.Get("/path", handler)` |
| gorilla/mux | `github.com/gorilla/mux` | `r.HandleFunc("/path", handler).Methods("GET")` |
| net/http | stdlib | `http.HandleFunc("/path", handler)` |

## 结构化日志

Go 项目应使用结构化日志记录器。检测的常见模式：
- `go.uber.org/zap` → `zap.String()`, `zap.Int()`
- `log/slog` (stdlib) → `slog.Info()`, `slog.With()`
- `github.com/rs/zerolog` → `log.Info().Str().Msg()`
- `github.com/sirupsen/logrus` → `logrus.WithFields()`

需标记的非结构化模式：`log.Printf`, `log.Println`, `log.Fatalf`, `fmt.Printf`（非 CLI 代码中）
