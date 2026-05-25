# 文档模板

创建文档架构的模板。遵循 DeepWiki 原则：每个声明都有源代码依据，图表从分析自动生成，导航使用一致的编号层次结构。

## 目录

- [编号章节约定](#编号章节约定)
- [来源引用约定](#来源引用约定)
- [AGENTS.md 模板](#agentsmd-模板)
- [ARCHITECTURE.md 模板](#architecturemd-模板)
- [DEVELOPMENT.md 模板](#developmentmd-模板)
- [QUALITY.md 模板](#qualitymd-模板)
- [设计文档模板](#设计文档模板)
- [API 参考模板](#api-参考模板)
- [参考文档模板](#参考文档模板)
- [测试文档模板](#测试文档模板)
- [运维文档模板](#运维文档模板)

---

## 编号章节约定

所有文档使用分层编号章节系统。这使得文档之间的交叉引用稳定，并使人类和代理的导航可预测。

**规则：**
1. 顶级章节使用单个数字：`## 1`, `## 2`, `## 3`
2. 子章节使用小数：`### 1.1`, `### 1.2`, `### 2.1`
3. 交叉引用使用章节编号："参见 [2.3 数据流](#23-数据流)"
4. 每个项目的文档按文档类型共享相同的编号方案

这很重要，因为导航文档的代理需要稳定的锚点。如果你重新编号，链接会断裂。如果你根本不编号，交叉引用会变得模糊。编号章节还让代理能快速定位特定信息——"跳到 3.2 节"是明确的。

---

## 来源引用约定

文档中的每个技术声明都应该引用其源代码位置。这使文档可信且可验证。当文档说"认证模块使用 JWT 令牌"时，它应该指向该行为发生的精确文件和行范围。

**格式：**
```
> 来源：[`internal/auth/jwt.go:25-48`](../internal/auth/jwt.go), [`internal/types/token.go:10-15`](../internal/types/token.go)
```

**当填充时实际路径未知，使用反引号跨度（永远不要空链接）：**
```
> 来源：`internal/auth/jwt.go:25-48`, `internal/types/token.go:10-15`
```

**规则：**
1. 在每个主要声明、表格或图表后放置来源引用
2. 使用 `file:line` 或 `file:line-range` 格式
3. 在单个 `> 来源：` 行上分组相关来源
4. 对于生成的图表，引用用于生成图表的文件
5. 当源文件更改时，重新生成引用（这是保持文档诚实的做法）
6. **永远不要使用空链接** — `[]()` 是严格禁止的。空链接看起来功能正常但实际上无处可去，这比没有链接更糟糕。改用纯反引号代码跨度：`` `file.go:10-15` `` 或正确解析的路径：`[file.go](../path/to/file.go)`
7. 当你无法确定实际文件路径时，使用不带括号的反引号表示法：`` `scripts/lint-deps.go` `` — 绝不要在 markdown 链接中让 `()` 为空

**为什么这很重要**：当代理读到"Layer 0 包不能导入 core/"时，它需要知道*在哪里*强制执行该规则（在 `scripts/lint-deps.go:42`），以便它可以验证声明并了解违反规则时会发生什么。

---

## AGENTS.md 模板

```markdown
# [项目名称] 代理指南

此文件为使用此仓库的 AI 代理提供导航。

## 1 快速开始

- [架构概览](docs/ARCHITECTURE.md) — 系统设计、层、数据流
- [开发设置](docs/DEVELOPMENT.md) — 构建、测试、环境

## 2 架构

| 章节 | 文档 | 说明 |
|------|------|------|
| 2.1 | [系统架构](docs/ARCHITECTURE.md) | 层层次结构、依赖图、数据流 |
| 2.2 | [组件 A](docs/design/component-a.md) | 用途、接口、关键类型 |
| 2.3 | [组件 B](docs/design/component-b.md) | 用途、接口、关键类型 |
| 2.4 | [组件 C](docs/design/component-c.md) | 用途、接口、关键类型 |

## 3 API 与参考

| 章节 | 文档 | 说明 |
|------|------|------|
| 3.1 | [API 目录](docs/references/api.md) | 完整的 API 参考 |
| 3.2 | [错误代码](docs/references/error-codes.md) | 错误代码分类 |
| 3.3 | [配置](docs/references/config.md) | 配置模式 |

## 4 质量与标准

| 章节 | 文档 | 说明 |
|------|------|------|
| 4.1 | [代码质量](docs/QUALITY.md) | 黄金原则、linter 规则 |
| 4.2 | [安全策略](docs/SECURITY.md) | 安全注意事项 |
| 4.3 | [测试标准](docs/TESTING.md) | 测试模式、覆盖率 |
| 4.4 | [质量评分](docs/QUALITY_SCORE.md) | 各领域质量等级 |

## 5 开发

\`\`\`bash
make build      # 构建项目
make test       # 运行测试
make lint-arch  # 运行架构 linter
\`\`\`

参见 [开发设置](docs/DEVELOPMENT.md) 获取完整参考。

## 6 关键目录

| 目录 | 层 | 用途 |
|-----------|-------|---------|
| \`cmd/\` | L5 | CLI 入口点 |
| \`internal/core/\` | L3 | 业务逻辑 |
| \`internal/types/\` | L0 | 类型定义 |
| \`docs/\` | — | 所有文档 |
| \`scripts/\` | — | Linter 和工具 |
| \`harness/\` | — | 评估和质量 |

---

**注意**：此文件是导航地图（约 100 行）。详细信息位于链接的文档中。
```

---

## ARCHITECTURE.md 模板

这是最重要的技术文档。它应该读起来像 DeepWiki 架构页面：基于源代码，带有 Mermaid 图表，以及特定的文件+行引用。

```markdown
# 架构

> 上次重新生成：YYYY-MM-DD
> 来源分析：`go.mod`, `cmd/`, `internal/`

## 1 概览

[一段：这个项目做什么，谁使用它，以及核心架构模式。
例如："这是一个处理 X 的 CLI 工具。它遵循分层架构，并
强制执行严格的依赖方向。"]

## 2 系统架构

### 2.1 包依赖图

\`\`\`mermaid
graph TD
    subgraph "Layer 3 — 入口点"
        CMD[cmd/]
    end
    subgraph "Layer 2 — 业务逻辑"
        CORE[internal/core/]
    end
    subgraph "Layer 1 — 工具"
        UTIL[internal/utils/]
    end
    subgraph "Layer 0 — 类型"
        TYPES[internal/types/]
    end

    CMD --> CORE
    CORE --> UTIL
    UTIL --> TYPES
    CORE --> TYPES

    style TYPES fill:#e8f5e9
    style UTIL fill:#e3f2fd
    style CORE fill:#fff3e0
    style CMD fill:#f3e5f5
\`\`\`

> 来源：`go.mod`, `cmd/root.go:1-15`, `internal/core/core.go:1-10`

### 2.2 层层次结构

<!-- ⚠️ 不能导入列规则：
  1. 绝不能在 Cannot Import 列中写"—"（破折号/长破折号）。每个层都有限制。
  2. 即使最高层也有禁止的导入：同级包、循环依赖等。
  3. 格式：列出禁止的层号（例如，"L2, L3"）或特定包（例如，"cmd/*"）。
  4. 默认规则"Layer N 从 < N 导入"是必要的但**不足够**的——你还必须
     列出非相邻跳过（例如，L4 不能跳过 L3 直接导入 L1）。
  5. 此表必须与 scripts/lint-deps.py 中的 LAYERS 字典以及 AGENTS.md 中的层
     表相同。跨文件一致性是强制性的。
-->

| 层 | 包 | 可以导入 | 不能导入 |
|-------|----------|------------|---------------|
| L0 | \`internal/types/\` | 仅标准库 | 任何内部包 |
| L1 | \`internal/utils/\` | L0 | L2, L3 |
| L2 | \`internal/core/\` | L0, L1 | L3 |
| L3 | \`cmd/\` | L0, L1, L2 | 同级 cmd 包 |

> 由以下强制执行：\`scripts/lint-deps.go\`

### 2.3 禁止的依赖

这些不是风格建议——它们由 linter 机械地强制执行：

- \`internal/types/\` 不得导入任何内部包
- \`internal/core/\` 不得导入 \`cmd/\`
- 同一层的同级包不得相互导入

> 由以下强制执行：\`scripts/lint-deps.go:30-45\`

## 3 核心组件

### 3.1 [组件 A 名称]

**用途**：[一句话说明它做什么]
**位置**：\`internal/core/component_a.go\`
**行数**：~XXX

\`\`\`mermaid
classDiagram
    class ComponentA {
        <<interface>>
        +Method1(ctx context.Context) error
        +Method2(input Input) (Output, error)
    }
    note for ComponentA "Defined in internal/core/component_a.go:18"
\`\`\`

**关键类型：**

| 类型 | 文件 | 行 | 用途 |
|------|------|------|---------|
| \`ComponentA\` | \`internal/core/component_a.go\` | 18 | 主接口 |
| \`componentAImpl\` | \`internal/core/component_a.go\` | 35 | 默认实现 |
| \`ComponentAConfig\` | \`internal/types/config.go\` | 22 | 配置选项 |

> 来源：\`internal/core/component_a.go:18-65\`, \`internal/types/config.go:22-30\`

### 3.2 [组件 B 名称]

[与 3.1 相同的结构]

## 4 数据流

### 4.1 主请求流

\`\`\`mermaid
sequenceDiagram
    participant User
    participant CLI as CLI (cmd/root.go)
    participant Core as Core (internal/core/)
    participant Store as Storage (internal/storage/)

    User->>CLI: command args
    CLI->>Core: Process(args)
    Core->>Store: Read/Write data
    Store-->>Core: Result
    Core-->>CLI: Output
    CLI-->>User: Display
\`\`\`

> 来源：\`cmd/root.go:42-58\`, \`internal/core/processor.go:15-33\`

### 4.2 错误处理流

\`\`\`
用户输入 → 验证 → 处理 → 输出
                ↓           ↓
            ValidationErr  ProcessErr
                ↓           ↓
            错误响应（带类型化错误代码）
\`\`\`

> 参见 [3.2 错误代码](references/error-codes.md) 获取完整的错误分类。

## 5 关键文件

| 文件 | 行数 | 用途 | 关键导出 |
|------|-------|---------|-------------|
| \`main.go\` | ~15 | 入口点 | \`main()\` |
| \`cmd/root.go\` | ~80 | CLI 结构 | \`Execute()\` |
| \`internal/types/types.go\` | ~100 | 类型定义 | \`Config\`, \`Result\`, \`Error\` |
| \`internal/core/core.go\` | ~200 | 业务逻辑 | \`Process()\`, \`Validate()\` |

## 6 关键设计决策

| # | 决策 | 理由 | 考虑的替代方案 |
|---|----------|-----------|------------------------|
| 1 | [决策 A] | [为什么选择这个] | [还考虑了什么] |
| 2 | [决策 B] | [为什么选择这个] | [还考虑了什么] |
| 3 | [决策 C] | [为什么选择这个] | [还考虑了什么] |

## 7 模块与依赖

\`\`\`
module [module-path]
go X.XX
\`\`\`

**外部依赖：**

| 依赖 | 版本 | 用途 |
|------------|---------|---------|
| \`dep-a\` | v1.2.3 | [用途] |
| \`dep-b\` | v4.5.6 | [用途] |

> 来源：\`go.mod\`, \`go.sum\`

## 参见

- [2.2 组件 A 设计](design/component-a.md)
- [2.3 组件 B 设计](design/component-b.md)
- [3.1 API 目录](references/api.md)
```

---

## DEVELOPMENT.md 模板

```markdown
# 开发设置

## 1 前置条件

- Language runtime X.XX+
- Build tool Y
- Dependencies Z

## 2 快速开始

\`\`\`bash
# 克隆并设置
git clone <repo>
cd <project>

# 安装依赖
make deps

# 构建
make build

# 测试
make test
\`\`\`

## 3 构建命令

| 命令 | 说明 | 持续时间 |
|---------|-------------|----------|
| \`make build\` | 为当前平台构建 | ~5s |
| \`make test\` | 运行所有测试 | ~30s |
| \`make lint\` | 运行所有 linter | ~10s |
| \`make lint-arch\` | 运行架构 linter | ~5s |
| \`make clean\` | 清理构建产物 | ~1s |

## 4 测试命令

| 命令 | 说明 | 范围 |
|---------|-------------|-------|
| \`make test\` | 所有测试 | 完整 |
| \`go test -v ./path/...\` | 特定包 | 包 |
| \`go test -run TestX ./\` | 特定测试 | 单个 |

## 5 项目结构

\`\`\`
.
├── cmd/           — CLI 命令 (Layer 3)
├── internal/
│   ├── core/      — 业务逻辑 (Layer 2)
│   ├── types/     — 类型定义 (Layer 0)
│   └── utils/     — 工具 (Layer 1)
├── docs/          — 文档
├── scripts/       — Linter 和工具
├── harness/       — 评估和质量
└── tests/         — 测试夹具
\`\`\`

## 6 配置

| 配置文件 | 位置 | 用途 |
|-------------|----------|---------|
| 用户配置 | \`~/.project/config.json\` | 每用户设置 |
| 项目配置 | \`.project/config.json\` | 项目范围设置 |

## 7 环境变量

| 变量 | 默认值 | 必需 | 说明 |
|----------|---------|----------|-------------|
| \`API_KEY\` | — | 是 | API 认证 |
| \`DEBUG\` | \`false\` | 否 | 启用调试模式 |
| \`LOG_LEVEL\` | \`info\` | 否 | 日志详细程度 |
```

---

## QUALITY.md 模板

```markdown
# 质量标准

由 \`scripts/lint-quality.go\` 强制执行的黄金原则。

## 1 结构化日志

> 由以下强制执行：\`scripts/lint-quality.go:28-45\`

\`\`\`go
// ✓ 好 — 结构化、可解析、可查询
logger.Info("operation completed", zap.String("key", value))

// ✗ 差 — 非结构化、难以解析
log.Printf("operation completed: %v", value)
\`\`\`

## 2 错误处理

### 2.1 使用类型化错误
\`\`\`go
// ✓ 好 — 类型化、机器可读
return NewError(ErrCodeNotFound, "resource not found")

// ✗ 差 — 字符串类型
return fmt.Errorf("not found")
\`\`\`

### 2.2 用上下文包装
\`\`\`go
// ✓ 好 — 保留错误链
return fmt.Errorf("reading config: %w", err)

// ✗ 差 — 丢失上下文
return err
\`\`\`

## 3 文件大小限制

> 由以下强制执行：\`scripts/lint-quality.go:50-62\`

- 每个文件最多 **1000 行**
- 将大文件拆分为聚焦的模块
- 当文件接近 800 行时，计划拆分

## 4 命名约定

| 类别 | 约定 | 示例 |
|----------|-----------|---------|
| 类型 | PascalCase | \`UserConfig\` |
| 导出函数 | PascalCase | \`NewConfig()\` |
| 未导出函数 | camelCase | \`parseInput()\` |
| 常量 | PascalCase | \`MaxRetries\` |
| 包 | lowercase | \`config\`, \`auth\` |

## 5 强制执行

\`\`\`bash
make lint-arch    # 运行所有架构 linter
\`\`\`

参见 \`scripts/lint-quality.go\` 获取完整的强制执行规则集。
```

---

## 设计文档模板

设计文档比架构概览更深入。每个文档涵盖单个组件，包含足够的细节供代理理解组件的角色、正确修改它，并验证修改是否健全。

```markdown
# [组件名称]

> 上次更新：YYYY-MM-DD
> 主要来源：\`path/to/main/file.go\`

## 1 概览

[此组件做什么以及为什么存在。最多一段。]

## 2 架构

### 2.1 组件图

\`\`\`mermaid
graph TD
    A[公共 API] --> B[内部逻辑]
    B --> C[存储]
    B --> D[外部服务]
\`\`\`

> 来源：\`internal/core/component.go\`

### 2.2 关键接口

\`\`\`go
// Defined in internal/core/component.go:18
type Component interface {
    Method1() Result
    Method2(input Input) (Output, error)
}
\`\`\`

> 来源：\`internal/core/component.go:18-24\`

### 2.3 关键类型

| 类型 | 文件 | 行 | 字段 | 用途 |
|------|------|------|--------|---------|
| \`componentImpl\` | \`component.go\` | 35 | \`field1\`, \`field2\` | 默认实现 |
| \`ComponentConfig\` | \`types.go\` | 22 | \`timeout\`, \`retries\` | 配置 |

> 来源：\`internal/core/component.go:35-50\`, \`internal/types/types.go:22-28\`

## 3 执行流程

\`\`\`mermaid
sequenceDiagram
    participant Caller
    participant Comp as Component
    participant Dep as Dependency

    Caller->>Comp: Method1()
    Comp->>Dep: FetchData()
    Dep-->>Comp: Data
    Comp-->>Caller: Result
\`\`\`

> 来源：\`internal/core/component.go:55-72\`

## 4 配置

| 选项 | 类型 | 默认值 | 验证 | 说明 |
|--------|------|---------|------------|-------------|
| \`timeout\` | \`time.Duration\` | \`30s\` | > 0 | 请求超时 |
| \`retries\` | \`int\` | \`3\` | 0-10 | 最大重试次数 |

> 来源：\`internal/types/config.go:15-25\`

## 5 错误处理

| 错误 | 代码 | 何时 | 恢复 |
|-------|------|------|----------|
| \`ErrNotFound\` | 1001 | 资源不存在 | 返回 404 |
| \`ErrTimeout\` | 1002 | 请求超时 | 带退避重试 |

## 6 使用示例

\`\`\`go
// 基本用法
comp := NewComponent(config)
result, err := comp.Method1()
if err != nil {
    // 处理类型化错误
}
\`\`\`

## 7 测试

| 测试文件 | 覆盖率 | 测试内容 |
|-----------|----------|---------------|
| \`component_test.go\` | 85% | 核心逻辑、边界情况 |
| \`component_integration_test.go\` | 70% | 与依赖项的端到端测试 |

## 参见

- [架构概览](../ARCHITECTURE.md#31-组件名称) — 第 3.1 节
- [相关组件](related.md) — 它如何与此组件交互
```

---

## API 参考模板

对于具有公共 API 表面的项目（HTTP、gRPC、库、CLI）。

```markdown
# API 参考

> 从源代码分析自动生成，YYYY-MM-DD

## 1 摘要

| 端点 / 函数 | 方法 | 用途 |
|---------------------|--------|---------|
| \`/api/v1/users\` | GET | 列出用户 |
| \`/api/v1/users/:id\` | GET | 通过 ID 获取用户 |
| \`/api/v1/users\` | POST | 创建用户 |
| \`NewClient(cfg)\` | — | 创建 API 客户端 |

## 2 端点

### 2.1 列出用户

\`\`\`
GET /api/v1/users?page=1&limit=20
\`\`\`

**参数：**

| 名称 | 类型 | 必需 | 默认值 | 说明 |
|------|------|----------|---------|-------------|
| \`page\` | int | 否 | 1 | 页码 |
| \`limit\` | int | 否 | 20 | 每页项目数 |

**响应：**

\`\`\`json
{
  "users": [{"id": "abc", "name": "Alice"}],
  "total": 42,
  "page": 1
}
\`\`\`

> 处理程序：\`api/handlers/user.go:25-48\`
> 类型：\`internal/types/user.go:10-18\`

### 2.2 获取用户

[相同结构]

## 3 错误响应

| 状态 | 代码 | 消息 | 何时 |
|--------|------|---------|------|
| 400 | \`INVALID_INPUT\` | "Invalid request body" | 格式错误的 JSON |
| 404 | \`NOT_FOUND\` | "Resource not found" | ID 不存在 |
| 500 | \`INTERNAL\` | "Internal server error" | 意外失败 |

> 错误类型定义于：\`internal/types/errors.go:12-35\`
```

---

## 参考文档模板

```markdown
# [参考名称]

> 上次更新：YYYY-MM-DD
> 提取自：\`path/to/source\`

## 1 概览

[主题] 的完整参考。

## 2 摘要表

| 项目 | 常量 | 类别 | 文件 | 行 | 说明 |
|------|----------|----------|------|------|-------------|
| A | \`ConstA\` | Cat1 | \`types.go\` | 15 | 做 X |
| B | \`ConstB\` | Cat2 | \`types.go\` | 22 | 做 Y |

## 3 详情

### 3.1 项目 A

[详细说明]

\`\`\`go
// From types.go:15
const ConstA = "value"
\`\`\`

> 来源：\`internal/types/types.go:15\`

### 3.2 项目 B

[详细说明]

> 来源：\`internal/types/types.go:22\`

## 参见

- [相关参考](related.md)
```

---

## 测试文档模板

项目测试策略文档模板。所有标题、描述和说明必须使用中文，代码命令和工具名保持英文。

```markdown
# 测试策略

> 最后更新：YYYY-MM-DD
> 覆盖率目标：80%（单元测试）/ 70%（集成测试）

## 1 测试分级

| 级别 | 范围 | 工具 | 目标覆盖率 |
|------|------|------|-----------|
| 单元测试 | 单个函数/类 | {test_framework} | 80% |
| 集成测试 | 组件交互 | Test containers / mocks | 70% |
| 端到端测试 | 完整用户场景 | `scripts/verify/` | 关键路径 |

## 2 单元测试

### 2.1 命名规范

- 每个源文件对应一个测试文件：`foo.go` → `foo_test.go`
- 参数化场景使用表驱动测试
- Mock 外部依赖，单元测试中禁止调用真实服务

### 2.2 运行单元测试

```bash
make test        # 运行全部测试
make test-unit   # 仅运行单元测试
```

## 3 集成测试

### 3.1 前置条件

集成测试依赖外部服务，先启动测试环境：

```bash
make setup-env   # 启动测试数据库、缓存等
```

### 3.2 运行集成测试

```bash
make test-integration
```

### 3.3 清理

```bash
make teardown-env
```

## 4 端到端验证

端到端测试位于 `scripts/verify/`，从用户视角验证应用行为。

| 场景 | 脚本 | 验证内容 |
|------|------|----------|
| 健康检查 | `verify/health-check.sh` | 应用启动与健康端点 |
| {场景 A} | `verify/{scenario-a}.sh` | {简要描述} |
| {场景 B} | `verify/{scenario-b}.sh` | {简要描述} |

运行全部验证场景：

```bash
make verify
```

## 5 测试数据

### 5.1 固定数据

- 位置：`tests/fixtures/`
- 格式：JSON / YAML / SQL dump
- 每个固定数据文件有对应的加载函数

### 5.2 工厂模式

编程式生成测试数据：

```
// 示例工厂
NewUser(opts) -> 使用合理默认值创建用户，可按测试覆盖
```

## 6 覆盖率报告

```bash
make test-coverage    # 生成 HTML 覆盖率报告
```

覆盖率排除项：
- 生成代码（`*_gen.go`、protobuf）
- 入口文件（`cmd/*/main.go`）
- 测试辅助（`*test*.go`）

## 7 不稳定测试策略

| 操作 | 触发条件 |
|------|----------|
| 隔离 | 连续失败 3+ 次且无代码变更 |
| 排查 | 24h 内分配负责人 |
| 删除 | 3 次修复尝试后仍不稳定 |

> 隔离的测试放在 `tests/quarantine/`，并在文件头注明原因。
```

---

## 运维文档模板

项目运维文档模板。所有标题、描述和说明必须使用中文，代码命令和工具名保持英文。

```markdown
# 运维指南

> 部署流程、环境配置、监控日志与运维手册

## 1 部署

### 1.1 本地开发

```bash
{local_dev_command}
```

### 1.2 Docker 部署

```bash
{docker_build_command}
{docker_run_command}
```

### 1.3 CI/CD 流水线

{cicd_pipeline_steps}

## 2 环境配置

### 2.1 环境列表

| 环境 | 用途 | 配置 |
|------|------|------|
| {env_name} | {purpose} | {config_file} |

### 2.2 关键配置

```{config_format}
{key_config_example}
```

## 3 监控与日志

### 3.1 日志配置
- **框架**: {log_framework}
- **级别**: INFO（生产环境）、DEBUG（开发环境）

### 3.2 健康检查

```bash
{health_check_command}
```

### 3.3 查看日志

```bash
{log_view_command}
```

## 4 运维手册

### 4.1 服务管理

```bash
{start_service_command}
{stop_service_command}
```

### 4.2 数据库维护

```bash
{db_backup_command}
{db_restore_command}
```

### 4.3 性能调优

```bash
{performance_tuning_command}
```

## 5 安全与权限

{security_notes}
```
