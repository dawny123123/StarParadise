# 运行时验证模式（可选）

> **注意**：`verify.json` 是一个**可选**配置文件，由独立 `verify.py` 工具使用。harness-executor Skill 流程中的主要验证机制是**Verifier 子代理**，它不依赖 `verify.json`。此模式为希望独立使用 `verify.py` 进行快速冒烟检查的开发者记录。

`harness/config/verify.json` 的配置模式。

## 概览

运行时验证验证应用程序在代码变更后**实际工作**，而不仅仅是编译和通过静态测试。这补充了静态验证流水线（`validate.py`）。

## 模式定义

```json
{
  "version": "1.0",
  "app_type": "server" | "cli" | "frontend" | "library" | "hybrid",
  "auto_detected": true,
  "prerequisites": { ... },
  "verification": {
    "server": { ... },
    "cli": { ... },
    "frontend": { ... }
  },
  "smoke_tests": [ ... ],
  "cleanup": { ... }
}
```

## 完整类型模式

```typescript
interface VerifyConfig {
  // 前向兼容的模式版本
  version: "1.0";

  // 主要应用类型（自动检测或手动）
  app_type: "server" | "cli" | "frontend" | "library" | "hybrid";

  // 此配置是否自动生成
  auto_detected: boolean;

  // 环境先决条件 —— 运行验证前检查
  prerequisites?: Prerequisites;

  // 类型特定的验证设置
  verification: {
    server?: ServerVerification;
    cli?: CLIVerification;
    frontend?: FrontendVerification;
  };

  // 验证设置后运行的快速健全性检查
  smoke_tests: SmokeTest[];

  // 清理配置
  cleanup: CleanupConfig;
}
```

---

## 先决条件（环境飞行前检查）

在运行时验证开始前**必须**通过的环境检查。如有任何先决条件失败，验证将被跳过，并附带清晰的错误消息解释缺少什么。

```typescript
interface Prerequisites {
  // 数据库连通性检查
  databases?: DatabaseCheck[];

  // 必需的环境变量
  env_vars?: EnvVarCheck[];

  // 必须可达的外部服务
  services?: ServiceCheck[];

  // 必须成功的自定义命令
  commands?: CommandCheck[];

  // 必须存在的文件或目录
  paths?: PathCheck[];

  // 跳过所有先决条件（用于无完整环境的 CI）
  skip?: boolean;
}

interface DatabaseCheck {
  name: string;                    // 例如："MySQL"、"PostgreSQL"、"Redis"
  type: "mysql" | "postgres" | "redis" | "mongodb" | "sqlite" | "custom";
  // 连接信息 —— 通过环境变量或显式指定
  connection_string_env?: string;  // 例如："DB_URL" —— 从环境变量读取
  host_env?: string;               // 例如："DB_HOST"
  port_env?: string;               // 例如："DB_PORT"
  host?: string;                   // 直接值："localhost"
  port?: number;                   // 直接值：3306
  // 对于自定义类型，测试连通性的命令
  check_command?: string;          // 例如："mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -e 'SELECT 1'"
  required: boolean;               // 如为 false，失败仅为警告
  timeout_seconds?: number;        // 默认：5
}

interface EnvVarCheck {
  name: string;                    // 环境变量名
  description?: string;            // 人类可读的用途
  required: boolean;
  pattern?: string;                // 值必须匹配的正则
  not_empty?: boolean;             // 如为 true，变量必须有非空值
}

interface ServiceCheck {
  name: string;                    // 例如："Auth Service"、"Redis Cache"
  type: "http" | "tcp" | "grpc";
  url?: string;                    // http 用："http://localhost:9000/health"
  host?: string;                   // tcp/grpc 用
  port?: number;
  expected_status?: number;        // http 用，默认 200
  required: boolean;
  timeout_seconds?: number;        // 默认：5
}

interface CommandCheck {
  name: string;                    // 例如："Docker running"
  command: string;                 // 例如："docker info > /dev/null 2>&1"
  expected_exit_code?: number;     // 默认：0
  required: boolean;
  timeout_seconds?: number;        // 默认：10
}

interface PathCheck {
  path: string;                    // 相对项目根或绝对路径
  type: "file" | "directory";
  required: boolean;
  description?: string;
}
```

### 先决条件示例

#### 示例 1：带 MySQL 的 Java Spring Boot

```json
{
  "prerequisites": {
    "databases": [
      {
        "name": "MySQL Database",
        "type": "mysql",
        "host_env": "DB_HOST",
        "port_env": "DB_PORT",
        "required": true,
        "timeout_seconds": 5
      }
    ],
    "env_vars": [
      {"name": "DB_HOST", "required": true, "not_empty": true},
      {"name": "DB_PORT", "required": true, "pattern": "^\\d+$"},
      {"name": "DB_USERNAME", "required": true},
      {"name": "DB_PASSWORD", "required": true},
      {"name": "JWT_SECRET", "required": true, "description": "JWT signing key"}
    ]
  }
}
```

#### 示例 2：带 Redis 和外部 API 的 Node.js

```json
{
  "prerequisites": {
    "services": [
      {
        "name": "Redis Cache",
        "type": "tcp",
        "host": "localhost",
        "port": 6379,
        "required": true
      },
      {
        "name": "Auth Service",
        "type": "http",
        "url": "http://localhost:9000/health",
        "expected_status": 200,
        "required": false
      }
    ],
    "env_vars": [
      {"name": "NODE_ENV", "required": false},
      {"name": "API_KEY", "required": true, "description": "External API key"}
    ]
  }
}
```

#### 示例 3：依赖 Docker 的服务

```json
{
  "prerequisites": {
    "commands": [
      {
        "name": "Docker daemon running",
        "command": "docker info > /dev/null 2>&1",
        "required": true
      },
      {
        "name": "Docker Compose available",
        "command": "docker compose version > /dev/null 2>&1",
        "required": true
      }
    ],
    "paths": [
      {
        "path": "docker-compose.yml",
        "type": "file",
        "required": true,
        "description": "Docker Compose configuration"
      }
    ]
  }
}
```

#### 示例 4：在 CI 中跳过先决条件

```json
{
  "prerequisites": {
    "skip": true
  }
}
```

---

## 服务器验证

用于后端服务（HTTP API、gRPC、WebSocket 服务器）。

```typescript
interface ServerVerification {
  // 如何启动服务器
  start: {
    command: string;           // 例如："go run cmd/server/main.go"
    working_dir?: string;      // 相对项目根
    env?: Record<string, string>;
    args?: string[];
    background: true;          // 服务器始终为 true
  };

  // 如何知道服务器就绪
  readiness: {
    type: "http" | "tcp" | "log_pattern" | "command";

    // type: "http" 用
    endpoint?: string;         // 例如："http://localhost:8080/health"
    expected_status?: number;  // 默认：200

    // type: "tcp" 用
    host?: string;             // 默认："localhost"
    port?: number;

    // type: "log_pattern" 用
    pattern?: string;          // 匹配 stdout/stderr 的正则

    // type: "command" 用
    command?: string;          // 就绪时成功的命令

    timeout_seconds: number;   // 最大等待时间，默认：30
    poll_interval_ms: number;  // 检查频率，默认：500
  };

  // 要测试的 API 端点
  endpoints: EndpointTest[];

  // 如何停止服务器
  stop: {
    signal: "SIGTERM" | "SIGINT" | "SIGKILL";
    graceful_timeout_seconds: number;  // 默认：5
  };
}

interface EndpointTest {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  headers?: Record<string, string>;
  body?: any;
  expected: {
    status: number | number[];  // 例如：200 或 [200, 201]
    body_contains?: string[];
    body_not_contains?: string[];
    json_path?: JsonPathAssertion[];
  };
  timeout_seconds?: number;
}

interface JsonPathAssertion {
  path: string;        // 例如："$.data.id"
  operator: "exists" | "equals" | "contains" | "type";
  value?: any;
}
```

### 服务器示例

```json
{
  "server": {
    "start": {
      "command": "go run cmd/server/main.go",
      "env": { "PORT": "8081", "ENV": "test" },
      "background": true
    },
    "readiness": {
      "type": "http",
      "endpoint": "http://localhost:8081/health",
      "expected_status": 200,
      "timeout_seconds": 30
    },
    "endpoints": [
      {
        "name": "health check",
        "method": "GET",
        "path": "/health",
        "expected": { "status": 200 }
      },
      {
        "name": "create user",
        "method": "POST",
        "path": "/api/users",
        "headers": { "Content-Type": "application/json" },
        "body": { "name": "test", "email": "test@example.com" },
        "expected": {
          "status": [200, 201],
          "json_path": [
            { "path": "$.id", "operator": "exists" },
            { "path": "$.name", "operator": "equals", "value": "test" }
          ]
        }
      }
    ],
    "stop": {
      "signal": "SIGTERM",
      "graceful_timeout_seconds": 5
    }
  }
}
```

---

## CLI 验证

用于命令行工具和脚本。

```typescript
interface CLIVerification {
  // CLI 可执行文件
  binary: {
    build_command?: string;    // 例如："go build -o bin/cli cmd/cli/main.go"
    path: string;              // 例如："bin/cli" 或 "node dist/cli.js"
  };

  // 要测试的命令
  commands: CLICommandTest[];
}

interface CLICommandTest {
  name: string;
  args: string[];              // 例如：["--version"]
  stdin?: string;              // 管道输入到命令
  env?: Record<string, string>;
  expected: {
    exit_code: number | number[];  // 成功通常为 0
    stdout_contains?: string[];
    stdout_not_contains?: string[];
    stdout_matches?: string;       // 正则模式
    stderr_contains?: string[];
    file_created?: string[];       // 之后应存在的路径
    file_content?: FileContentAssertion[];
  };
  timeout_seconds?: number;
}

interface FileContentAssertion {
  path: string;
  contains?: string[];
  matches?: string;  // 正则
}
```

### CLI 示例

```json
{
  "cli": {
    "binary": {
      "build_command": "go build -o bin/mycli cmd/cli/main.go",
      "path": "bin/mycli"
    },
    "commands": [
      {
        "name": "version flag",
        "args": ["--version"],
        "expected": {
          "exit_code": 0,
          "stdout_matches": "v\\d+\\.\\d+\\.\\d+"
        }
      },
      {
        "name": "help flag",
        "args": ["--help"],
        "expected": {
          "exit_code": 0,
          "stdout_contains": ["Usage:", "Commands:"]
        }
      },
      {
        "name": "generate config",
        "args": ["init", "--output", "/tmp/test-config.json"],
        "expected": {
          "exit_code": 0,
          "file_created": ["/tmp/test-config.json"],
          "file_content": [
            { "path": "/tmp/test-config.json", "contains": ["version"] }
          ]
        }
      }
    ]
  }
}
```

---

## 前端验证

用于使用 Chrome DevTools 协议（CDP）的 Web 应用程序。

```typescript
interface FrontendVerification {
  // 如何启动开发服务器
  dev_server: {
    command: string;           // 例如："npm run dev"
    working_dir?: string;
    env?: Record<string, string>;
    background: true;
  };

  // 如何知道开发服务器就绪
  readiness: {
    type: "http" | "log_pattern";
    url?: string;              // 例如："http://localhost:3000"
    pattern?: string;
    timeout_seconds: number;
  };

  // Chrome/Chromium 配置
  browser: {
    executable?: string;       // Chrome 路径，省略则自动检测
    headless: boolean;         // 默认：true
    args?: string[];           // 额外的 Chrome 参数
  };

  // 使用 CDP 的页面测试
  pages: PageTest[];

  // 如何停止开发服务器
  stop: {
    signal: "SIGTERM" | "SIGINT";
    graceful_timeout_seconds: number;
  };
}

interface PageTest {
  name: string;
  url: string;                 // 完整 URL 或路径（追加到开发服务器 URL）
  wait_for?: WaitCondition;
  actions?: PageAction[];
  assertions: PageAssertion[];
  screenshot?: {
    path: string;              // 截图保存位置
    on_failure_only?: boolean;
  };
}

interface WaitCondition {
  type: "selector" | "navigation" | "network_idle" | "timeout";
  selector?: string;
  timeout_ms?: number;
}

interface PageAction {
  type: "click" | "type" | "select" | "wait" | "scroll" | "evaluate";
  selector?: string;
  value?: string;
  script?: string;             // type: "evaluate" 用
  timeout_ms?: number;
}

interface PageAssertion {
  type: "element_exists" | "element_text" | "element_visible" |
        "no_console_errors" | "no_network_errors" | "title" | "url" | "evaluate";
  selector?: string;
  expected?: string | string[];
  script?: string;             // type: "evaluate" 用，返回 boolean
}
```

### 前端示例

```json
{
  "frontend": {
    "dev_server": {
      "command": "npm run dev",
      "env": { "PORT": "3001" },
      "background": true
    },
    "readiness": {
      "type": "http",
      "url": "http://localhost:3001",
      "timeout_seconds": 60
    },
    "browser": {
      "headless": true,
      "args": ["--no-sandbox", "--disable-gpu"]
    },
    "pages": [
      {
        "name": "homepage loads",
        "url": "/",
        "wait_for": { "type": "selector", "selector": "#app" },
        "assertions": [
          { "type": "element_exists", "selector": "#app" },
          { "type": "no_console_errors" },
          { "type": "title", "expected": "My App" }
        ]
      },
      {
        "name": "login flow",
        "url": "/login",
        "wait_for": { "type": "selector", "selector": "form" },
        "actions": [
          { "type": "type", "selector": "#email", "value": "test@example.com" },
          { "type": "type", "selector": "#password", "value": "password123" },
          { "type": "click", "selector": "button[type=submit]" },
          { "type": "wait", "timeout_ms": 2000 }
        ],
        "assertions": [
          { "type": "url", "expected": "/dashboard" },
          { "type": "element_visible", "selector": ".welcome-message" }
        ],
        "screenshot": {
          "path": "harness/screenshots/login-success.png",
          "on_failure_only": false
        }
      }
    ]
  }
}
```

---

## 冒烟测试

主要验证后运行的快速健全性检查。用于横切关注点。

```typescript
interface SmokeTest {
  name: string;
  type: "command" | "http" | "file_exists";

  // type: "command" 用
  command?: string;
  expected_exit_code?: number;

  // type: "http" 用
  url?: string;
  expected_status?: number;

  // type: "file_exists" 用
  paths?: string[];

  required: boolean;  // 如为 false，失败仅为警告
}
```

### 冒烟测试示例

```json
{
  "smoke_tests": [
    {
      "name": "database migrations applied",
      "type": "command",
      "command": "go run cmd/migrate/main.go status",
      "expected_exit_code": 0,
      "required": true
    },
    {
      "name": "static assets built",
      "type": "file_exists",
      "paths": ["dist/index.html", "dist/main.js"],
      "required": true
    }
  ]
}
```

---

## 清理配置

```typescript
interface CleanupConfig {
  // 验证后删除的文件/目录
  remove_paths?: string[];

  // 清理命令
  commands?: string[];

  // 环境清理
  reset_env?: string[];  // 要取消设置的环境变量
}
```

---

## 自动检测规则

`verify.py` 使用这些启发式自动检测应用类型：

| 指标 | 检测到的类型 |
|-----------|--------------|
| `cmd/server/` 或 `**/server.go` 或带 `http.ListenAndServe` 的 `main.go` | server |
| `cmd/cli/` 或 `**/cli.go` 或 `cobra`/`urfave/cli` 导入 | cli |
| 带 `react`/`vue`/`next`/`vite` 的 `package.json` | frontend |
| 无入口点的 `setup.py`/`pyproject.toml` | library |
| 多种以上 | hybrid |

对于 hybrid 应用，verify.json 应包含多个部分。

---

## 独立用法

`verify.py` 可作为独立工具独立运行（它**不**属于 Skill 执行流程 —— Verifier 子代理处理那个）：

```bash
# 完整运行时验证
python3 $SKILL_DIR/scripts/verify.py . --json

# 仅特定类型
python3 $SKILL_DIR/scripts/verify.py . --type server

# 跳过清理（用于调试）
python3 $SKILL_DIR/scripts/verify.py . --no-cleanup

# 详细输出
python3 $SKILL_DIR/scripts/verify.py . -v
```

退出码：
- 0：所有验证通过
- 1：一个或多个必需验证失败

---

## 功能验证报告模式

Verifier 子代理生成 `harness/trace/verification-report.json`，模式如下。这与 `verify.json` 分开 —— 它是**输出**，不是配置文件。

```typescript
interface VerificationReport {
  overall_status: "pass" | "partial" | "fail" | "skip";
  skip_reason?: string;               // 仅在 overall_status == "skip" 时

  server: {
    started: boolean;
    ready_in_seconds: number;
    stopped_cleanly: boolean;
  };

  task_specific_scenarios: ScenarioResult[];   // 协调器设计的场景
  predefined_scenarios: ScenarioResult[];      // environment.json 的预定义场景
  additional_checks: ScenarioResult[];         // Verifier 生成的额外检查

  claims: Claim[];
  summary: VerificationSummary;
  timing: VerificationTiming;
}

interface ScenarioResult {
  name: string;                    // 来自 environment.json functional_scenarios[].name
  status: "pass" | "fail" | "skipped";
  skip_reason?: string;            // 仅在 skipped 时
  steps: VerificationStep[];
  evidence: string;                // 观察到的内容摘要
  duration_seconds: number;
}

interface VerificationStep {
  description: string;             // 此步骤测试什么
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    body?: any;
  };
  assertion: string;               // 预期什么
  passed: boolean;
}

interface Claim {
  claim: string;                   // 正在声称什么
  type: "factual" | "process" | "quality";
  verified: boolean;
  evidence: string;
}

interface VerificationSummary {
  task_specific_total: number;
  task_specific_passed: number;
  predefined_total: number;
  predefined_passed: number;
  additional_checks_total: number;
  additional_checks_passed: number;
  pass_rate: number;               // 0.0 到 1.0
}

interface VerificationTiming {
  total_seconds: number;
  server_startup_seconds?: number;
  verification_seconds?: number;
  cleanup_seconds?: number;
}
```

### 与其他模式的关系

| 文件 | 生产者 | 消费者 | 用途 |
|------|----------|----------|--------|
| `verify.json` | harness-creator 或自动检测 | verify.py（独立工具） | 独立冒烟检查的可选配置 |
| `environment.json` | harness-creator | preflight.py、verifier 子代理 | 环境描述 |
| `verification-report.json` | verifier 子代理 | 协调器、task_state.py | 功能验证结果（完成门控） |
