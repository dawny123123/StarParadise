# 架构图模板

用于可视化代码库结构的自动生成的 Mermaid 图表。这些图表源自实际的代码分析——不是手绘的，也不是理想化的。每个图表都应该反映代码**实际所做的**，而非作者希望它所做的。

## 目录

- [如何生成图表](#如何生成图表)
- [包依赖图](#1-包依赖图)
- [数据流图](#2-数据流图)
- [组件关系图](#3-组件关系图)
- [调用层次图](#4-调用层次图)
- [接口实现映射](#5-接口实现映射)
- [模块边界图](#6-模块边界图)
- [关键流程时序图](#7-关键流程时序图)

---

## 如何生成图表

图表通过分析实际代码生成，而非猜测。遵循以下流程：

### Go 项目
```bash
# 列出所有包及其导入
 go list -json ./... | jq '{ImportPath, Imports}'

# 查找接口及其实现
 grep -rn 'type.*interface' --include='*.go' .
 grep -rn 'func.*) .*(' --include='*.go' . | head -50

# 映射包依赖
 go list -m -json all
```

### TypeScript/Node 项目
```bash
# 查找所有导入
 grep -rn "from ['\"]" --include='*.ts' src/

# 查找接口和类
 grep -rn "export interface\|export class\|export type" --include='*.ts' src/

# 检查 package.json 依赖
 cat package.json | jq '.dependencies, .devDependencies'
```

### Python 项目
```bash
# 查找所有导入
 grep -rn "^from \|^import " --include='*.py' src/

# 查找类及其基类
 grep -rn "class .*:" --include='*.py' src/

# 检查依赖声明
 cat pyproject.toml  # 或 requirements.txt
```

收集这些数据后，在下面生成适当的 Mermaid 图表。

---

## 1. 包依赖图

显示哪些包依赖于哪些包。这是理解架构最重要的图表。

### 模板

````markdown
```mermaid
graph TD
    subgraph "Layer 5 — 入口点"
        CMD[cmd/]
    end
    subgraph "Layer 4 — 接口"
        UI[ui/]
        SDK[sdk/]
        API[api/]
    end
    subgraph "Layer 3 — 业务逻辑"
        CORE[core/]
        SVC[services/]
    end
    subgraph "Layer 2 — 基础设施"
        CFG[config/]
        LOG[logging/]
    end
    subgraph "Layer 1 — 工具"
        UTIL[utils/]
    end
    subgraph "Layer 0 — 类型"
        TYPES[types/]
    end

    CMD --> UI
    CMD --> API
    UI --> CORE
    SDK --> CORE
    API --> SVC
    CORE --> CFG
    CORE --> UTIL
    SVC --> CFG
    CFG --> TYPES
    UTIL --> TYPES
    LOG --> TYPES

    style TYPES fill:#e8f5e9
    style UTIL fill:#e3f2fd
    style CFG fill:#e3f2fd
    style LOG fill:#e3f2fd
    style CORE fill:#fff3e0
    style SVC fill:#fff3e0
    style UI fill:#fce4ec
    style SDK fill:#fce4ec
    style API fill:#fce4ec
    style CMD fill:#f3e5f5
```
````

### 生成指南

从真实代码生成此图表时：

1. 运行 `go list -json ./...`（或你的语言的等效命令）
2. 对于每个包，提取其内部导入
3. 按层分配（来自 lint-deps 规则）对包进行分组
4. 为每个内部导入关系绘制边
5. 按层级别着色（绿色=L0, 蓝色=L1-2, 橙色=L3, 粉色=L4, 紫色=L5）

重要：仅包含**内部**依赖，不包括标准库或第三方依赖。

---

## 2. 数据流图

显示数据如何在系统中端到端地流动。

### 模板

````markdown
```mermaid
flowchart LR
    INPUT["用户输入<br/><i>CLI 参数 / HTTP 请求</i>"]
    PARSE["解析与验证<br/><code>cmd/parse.go</code>"]
    LOGIC["业务逻辑<br/><code>core/processor.go</code>"]
    STORE["存储层<br/><code>storage/db.go</code>"]
    OUTPUT["输出<br/><i>stdout / HTTP 响应</i>"]

    INPUT --> PARSE
    PARSE --> LOGIC
    LOGIC --> STORE
    STORE --> LOGIC
    LOGIC --> OUTPUT

    subgraph "配置"
        CFG["config/config.go"]
    end
    CFG -.-> PARSE
    CFG -.-> LOGIC
    CFG -.-> STORE
```
````

### 生成指南

要准确映射数据流：

1. 找到入口点（`main()`、HTTP 处理程序、CLI 命令处理程序）
2. 逐步追踪用户输入的处理过程
3. 记录每个步骤涉及的文件/函数——包含实际文件路径
4. 识别数据在何处被转换、存储或返回
5. 将配置/日志记录显示为虚线（支持基础设施，非主要流程）

---

## 3. 组件关系图

显示主要组件及其交互。最适合具有清晰模块边界的项目。

### 模板

````markdown
```mermaid
graph TB
    subgraph "公共 API 表面"
        REST["REST API<br/><code>api/router.go:25</code>"]
        GRPC["gRPC 服务<br/><code>api/grpc/server.go:18</code>"]
        CLI_CMD["CLI 命令<br/><code>cmd/root.go:42</code>"]
    end

    subgraph "核心领域"
        AUTH["认证服务<br/><code>core/auth/service.go:15</code>"]
        USER["用户服务<br/><code>core/user/service.go:22</code>"]
        BILLING["计费引擎<br/><code>core/billing/engine.go:30</code>"]
    end

    subgraph "基础设施"
        DB["数据库<br/><code>infra/postgres/client.go:10</code>"]
        CACHE["缓存<br/><code>infra/redis/client.go:8</code>"]
        QUEUE["消息队列<br/><code>infra/queue/producer.go:12</code>"]
    end

    REST --> AUTH
    REST --> USER
    GRPC --> BILLING
    CLI_CMD --> USER

    AUTH --> DB
    AUTH --> CACHE
    USER --> DB
    BILLING --> DB
    BILLING --> QUEUE
```
````

### 生成指南

1. 识别主要的服务/组件边界
2. 对于每个组件，找到定义它的主文件和行号
3. 映射组件之间的方法调用（grep 跨包函数调用）
4. 按架构层分组

---

## 4. 调用层次图

显示关键代码路径的函数调用链。

### 模板

````markdown
```mermaid
graph TD
    A["main()<br/><code>main.go:15</code>"]
    B["cmd.Execute()<br/><code>cmd/root.go:42</code>"]
    C["runCommand()<br/><code>cmd/run.go:28</code>"]
    D["service.Process()<br/><code>core/service.go:55</code>"]
    E["validator.Check()<br/><code>core/validate.go:12</code>"]
    F["store.Save()<br/><code>storage/store.go:33</code>"]
    G["reporter.Output()<br/><code>output/report.go:20</code>"]

    A --> B
    B --> C
    C --> D
    D --> E
    D --> F
    D --> G
    E -->|"验证错误"| C
    F -->|"存储错误"| D
```
````

### 生成指南

1. 从你想要记录的流程的入口点开始
2. 使用 LSP `outgoingCalls` 追踪调用链，或 grep 函数调用
3. 为每个函数包含文件和行号
4. 将错误路径显示为带标签的边
5. 最多保留 8-12 个节点——如果更复杂，拆分为子图

---

## 5. 接口实现映射

显示哪些类型实现了哪些接口。对于理解可扩展性至关重要。

### 模板

````markdown
```mermaid
classDiagram
    class Provider {
        <<interface>>
        +Execute(ctx, input) Result, error
        +Name() string
        +SupportsStream() bool
    }

    class OpenAIProvider {
        -client *openai.Client
        -model string
        +Execute(ctx, input) Result, error
        +Name() string
        +SupportsStream() bool
    }

    class AnthropicProvider {
        -client *anthropic.Client
        -model string
        +Execute(ctx, input) Result, error
        +Name() string
        +SupportsStream() bool
    }

    class MockProvider {
        -responses []Result
        +Execute(ctx, input) Result, error
        +Name() string
        +SupportsStream() bool
    }

    Provider <|.. OpenAIProvider : implements
    Provider <|.. AnthropicProvider : implements
    Provider <|.. MockProvider : implements

    OpenAIProvider ..> ExternalAPI : depends on
    AnthropicProvider ..> ExternalAPI : depends on

    note for Provider "Defined in core/types/provider.go:18"
    note for OpenAIProvider "Defined in providers/openai/provider.go:25"
    note for AnthropicProvider "Defined in providers/anthropic/provider.go:22"
    note for MockProvider "Defined in testing/mock_provider.go:10"
```
````

> ⚠️ **Mermaid classDiagram 语法规则 — 必须遵循：**
> - `class` 关键字仅用于定义类块：`class Foo { +method() }`
> - 关系线不得以 `class` 开头。写 `A ..> B` 而非 ~~`class A ..> B`~~
> - 常见关系类型：
>   - `A <|.. B : implements` — B 实现接口 A
>   - `A ..> B : depends on` — A 依赖于 B（依赖注入）
>   - `A --> B` — A 与 B 关联
>   - `A *-- B` — A 组合 B

### 生成指南

1. 查找所有接口：`grep -rn 'type.*interface' --include='*.go'`
2. 通过匹配方法签名查找实现
3. 对于每个实现，列出其结构体字段（私有）和方法（公共）
4. 添加源文件位置作为注释
5. 关注最重要的接口——不要试图给所有内容画图表

---

## 6. 模块边界图

显示公共与内部 API 表面。对于库/SDK 项目很有用。

### 模板

````markdown
```mermaid
graph TB
    subgraph "公共 API (导出)"
        PUB_TYPES["类型<br/><code>pkg/types.go</code><br/><i>Config, Options, Result</i>"]
        PUB_FUNC["函数<br/><code>pkg/client.go</code><br/><i>New(), Run(), Close()</i>"]
        PUB_IFACE["接口<br/><code>pkg/interfaces.go</code><br/><i>Provider, Store</i>"]
    end

    subgraph "内部 (未导出)"
        INT_CORE["核心逻辑<br/><code>internal/core/</code>"]
        INT_PARSE["解析<br/><code>internal/parse/</code>"]
        INT_UTIL["工具<br/><code>internal/util/</code>"]
    end

    PUB_FUNC --> INT_CORE
    PUB_FUNC --> INT_PARSE
    INT_CORE --> INT_UTIL
    INT_PARSE --> INT_UTIL

    style PUB_TYPES fill:#c8e6c9
    style PUB_FUNC fill:#c8e6c9
    style PUB_IFACE fill:#c8e6c9
    style INT_CORE fill:#ffecb3
    style INT_PARSE fill:#ffecb3
    style INT_UTIL fill:#ffecb3
```
````

---

## 7. 关键流程时序图

显示特定用户场景中组件之间按时间顺序的交互。

### 模板

````markdown
```mermaid
sequenceDiagram
    participant User
    participant CLI as CLI (cmd/run.go)
    participant Auth as 认证服务 (core/auth/)
    participant DB as 数据库 (storage/)
    participant API as 外部 API

    User->>CLI: run --project my-app
    CLI->>Auth: Authenticate(token)
    Auth->>DB: GetUser(token)
    DB-->>Auth: User{id, role}
    Auth-->>CLI: AuthResult{ok, user}
    CLI->>API: FetchProject("my-app")
    API-->>CLI: ProjectData{...}
    CLI-->>User: 显示结果
```
````

### 生成指南

1. 挑选 3-5 个最常见/最重要的用户流程
2. 从用户输入到最终输出追踪完整的序列
3. 包含实际的组件名称和文件路径
4. 显示成功和错误路径
5. 每个序列最多保留 10-15 条消息

---

## 图表选择指南

并非每个项目都需要所有七种类型的图表。根据重要内容选择：

| 项目类型 | 推荐图表 |
|---|---|
| CLI 工具 | 包依赖、数据流、调用层次 |
| Web API | 包依赖、组件关系、时序 |
| 库/SDK | 包依赖、接口实现、模块边界 |
| 微服务 | 组件关系、数据流、时序 |
| 单体应用 | 包依赖、组件关系、接口实现 |

## 图表质量检查清单

每个生成的图表都应通过这些检查：

- [ ] **基于代码**：每个节点引用实际的文件/包（非理想化的）
- [ ] **文件引用**：尽可能包含 `code>file:line</code>`
- [ ] **无孤立节点**：每个节点至少有一个连接
- [ ] **分层布局**：高层组件在上，低层在下
- [ ] **颜色编码**：同一项目中的图表颜色一致
- [ ] **合理大小**：每个图表 5-15 个节点；如果更大则拆分
- [ ] **更新日期**：注明图表上次重新生成的时间
