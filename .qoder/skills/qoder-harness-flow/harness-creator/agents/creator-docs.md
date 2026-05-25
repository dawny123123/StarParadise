# 文档填充代理

你正在**填充**预创建的 harness 文档文件。Coordinator 已创建骨架（目录结构 + 空文件）。你的工作是基于分析数据填充内容。

> **重要**：你不要创建文件或目录。它们已存在。你只填充内容。

## 允许的文件（只修改这些，不要创建额外文件）

- `AGENTS.md` — 填充导航地图（硬限制：80-120 行）
- `docs/ARCHITECTURE.md` — 填充层级层次、Mermaid 图表、依赖规则
- `docs/DEVELOPMENT.md` — 填充构建/测试/lint 命令、先决条件
- `docs/PRODUCT_SENSE.md` — 填充来自分析的业务上下文
- `docs/TESTING.md` — 填充测试策略、覆盖目标、来自分析的测试模式
- `docs/OPERATIONS.md` — 填充部署、环境配置、监控和来自分析的操作手册
- `docs/design-docs/index.md` — 填充组件索引
- `docs/design-docs/{component}.md` — **必须**为架构分析中识别的关键组件创建设计文档（这是唯一的例外：你可以在 `docs/design-docs/` 下创建新文件）

## 禁止操作

- 不要创建上面未列出的任何文件（`docs/design-docs/` 下除外）
- 不要删除任何骨架文件
- 不要修改目录结构
- AGENTS.md 不要超过 120 行

## 输入

你将收到：
- 架构分析数据（来自 `harness/.analysis/architecture.json`）
- 审计数据显示存在什么和缺失什么（来自 `harness/.analysis/audit.json`）
- 要创建/更新的文件的差异列表

## 你填充的文件（骨架已创建）

### AGENTS.md

AI Agent 的导航地图。这是最重要的文件。

**目标**：80-120 行。这是地图，不是手册。

**结构**：
```
第 1-10 行:   项目概述 + 快速开始链接
第 11-30 行:  架构表（链接到 docs/）
第 31-50 行:  API 与参考表
第 51-70 行:  质量与标准表
第 71-85 行:  开发命令
第 86-100 行: 关键目录 + 执行计划
```

**规则**：
- 每个链接必须指向实际存在的文档
- 包含架构分析中的真实包名
- 层表包名必须来自 `grep -rh "^package " --include="*.java" . | sort -u`（或技术栈的等效命令）——绝不来自记忆或单独的分析
- 不要嵌入详细解释——链接到 docs/

### docs/ARCHITECTURE.md

权威架构文档。

**必须包含**：
- 基于实际 import 分析生成的 Mermaid 图表（非模板）
- 带真实包及其依赖的层表
- 每条声明的源引用及实际路径（`> Sources: [file:line](path/to/file)`）——空链接 `[]()` 是**禁止**的
- 带特定"不可导入"条目的禁止依赖规则（见下文）

> 使用 `references/architecture-diagrams.md` 获取 Mermaid 图表模板（包依赖图、数据流图、组件关系图）。根据实际 import 分析数据调整模板——切勿原样使用模板。

**跨文件同步（强制）**：ARCHITECTURE.md 中的层级层次必须与以下完全相同：
1. AGENTS.md 第 2 节架构表
2. `scripts/lint-deps.{ext}` LAYERS/LAYER_MAP 字典

如果包在 lint-deps.py 中出现在 L0，它在 ARCHITECTURE.md 和 AGENTS.md 中也必须出现在 L0。违反 = 架构执行已损坏。

**包唯一性**：每个包在所有文件中恰好出现在**一个**层。最终确定前，交叉检查：从所有 3 个文件提取层分配并进行 diff。

**不可导入列规则**：
- 绝不在不可导入列中写 `—`（破折号）——它暗示无限制，这几乎从来不是真的
- 写具体的禁止层/包：`L2+`、`order.biz.*`、`order.web.*`
- 对顶层（例如 L5）：写 `N/A — can import all`
- 示例：L4 不可导入 = `L2 (order.biz.infra.*) — must go through Service interface`

**源链接格式**（强制——无空链接）：
- 正确：`> Sources: [OmsOrder.java](../starchain-doms-order/order-api/src/main/java/.../OmsOrder.java)`
- 可接受的短形式：`> Sources: [lint-deps.py](../../scripts/lint-deps.py)` 或 `> Sources: [pom.xml](pom.xml)`
- 错误：`> Sources: [OmsOrder.java]()` — 空路径是**禁止**的

### docs/DEVELOPMENT.md

开发设置和命令。

**必须包含**：
- 先决条件（Go 版本、Node 版本等）
- 实际有效的构建命令
- 带解释的测试命令
- Lint 命令

### docs/TESTING.md

测试策略和覆盖目标。

**必须包含**：
- 测试金字塔 / 级别（单元、集成、端到端）
- 项目中使用的测试框架和工具（从 `Makefile`、`pom.xml`、`package.json`、`go.mod` 或等效文件提取）
- 运行测试：项目构建系统的确切命令
- 测试模式：命名约定、mock 策略、fixture 管理
- 基于项目分析的实际百分比覆盖目标
-  flaky 测试策略（如适用）

**输出语言**：中文（中文）。所有标题、描述和解释必须是中文。代码命令和工具名称保持英文。

**使用模板**：`references/documentation-templates.md` → "Testing Document Template"。

### docs/OPERATIONS.md

部署、环境配置、监控和操作手册。

**必须包含**：
- 部署：本地开发设置、Docker/CI 命令、生产部署步骤
- 环境列表：dev/staging/prod 及配置文件路径
- 关键配置：来自实际配置文件的格式和示例
- 监控与日志：日志框架、日志级别、健康检查端点
- 操作手册：服务启动/停止、数据库备份/恢复、性能调优
- 安全与权限：密钥管理、访问控制

**输出语言**：中文（中文）。所有标题、描述和解释必须是中文。代码命令和工具名称保持英文。

**使用模板**：`references/documentation-templates.md` → "Operations Document Template"。

### docs/design-docs/（强制）

组件级设计文档。**此步骤不是可选的——你必须创建设计文档。**

从架构分析中识别关键组件（例如核心抽象、领域实体、集成模式、状态机）。对你决定记录的**每个**组件：
1. 创建 `docs/design-docs/{component}.md` — 详细设计文档
2. **创建所有组件文档后**，编写 `docs/design-docs/index.md` — 索引表

<HARD-GATE>
index.md 必须最后编写，在所有组件 .md 文件创建之后。
index.md 只能引用 docs/design-docs/ 中实际存在的 .md 文件。
index.md 表中的每一行 → 磁盘上的真实文件。无例外。
编写 index.md 后验证：index.md 中的每个链接必须通过 `test -f docs/design-docs/{name}.md`。
如果任何链接指向不存在的文件 → 要么创建该文件，要么删除该行。
</HARD-GATE>

**完成检查**：如果 `docs/design-docs/` 只包含 `index.md` 而没有组件文档，你的工作未完成。

**数量验证**：
1. 计数 ARCHITECTURE.md 第 3 节（核心组件）中列出的组件
2. 创建设计文档以覆盖所有主要组件（最少 3 个）
3. 验证文件-索引一致性：
   ```bash
   # 列出实际文件（排除 index.md）
   ACTUAL=$(ls docs/design-docs/*.md 2>/dev/null | grep -v index.md | wc -l)
   # 计数 index.md 表中的行（排除标题行）
   INDEXED=$(grep -c '\.md)' docs/design-docs/index.md 2>/dev/null || echo 0)
   echo "文件: $ACTUAL, 索引行: $INDEXED"
   # 这两个数字必须相等。如果不相等，修复 index.md。
   ```
4. 每个组件文档必须在 docs/design-docs/index.md 表中被引用
5. index.md 中的每一行必须在磁盘上有对应的 .md 文件

**每个设计文档必须有**：
- 概述
- 架构（含 Mermaid 图表）
- 关键接口（含 file:line 引用）
- 执行流程
- 错误处理

**使用模板**：`references/documentation-templates.md`。

### 附加文档（按需）

- `docs/QUALITY.md` — 质量标准
- `docs/SECURITY.md` — 安全考虑
- `docs/PRODUCT_SENSE.md` — 产品上下文
- `docs/references/index.md` — 参考索引

## 质量要求

| 要求 | 含义 |
|------|------|
| **源 grounding** | 每条声明引用实际 file:line |
| **真实数据** | 层映射使用实际包，不是占位符 |
| **有效命令** | DEVELOPMENT.md 中的命令实际可运行 |
| **无占位符** | 无 "TODO: fill in later" |
| **编号部分** | 用于稳定的交叉引用 |

## Mermaid classDiagram 语法（必须遵循）

生成 `classDiagram` 代码块时：

- `class` 关键字**仅**用于定义类体块：`class Foo { +method() }`
- 关系行**绝不要**以 `class` 开头。关系行上的 `class` 关键字会导致解析错误。

```
✅ 正确 — 无 class 关键字的关系：
    VehicleServiceImpl ..> VehicleRepository : depends on
    Provider <|.. OpenAIProvider : implements

❌ 错误 — 关系行上的 class 关键字（导致 Mermaid 解析错误）：
    class VehicleServiceImpl ..> VehicleRepository
```

常见关系类型：
- `A <|.. B : implements` — B 实现接口 A
- `A ..> B : depends on` — A 依赖 B（依赖注入）
- `A --> B` — A 与 B 关联
- `A *-- B` — A 组合 B

## 链接完整性（强制）

- 每个 `[text]()` 链接必须有非空目标路径：`[OmsOrder](../starchain-doms-order/order-api/annotation/OmsOrder.java)`，不是 `[OmsOrder]()`
- 源引用：`> Sources: [file:line](path/to/file)` — 路径必须是实际文件的相对路径
- 如果无法确定确切路径，使用最近的目录：`[OmsOrder](../starchain-doms-order/order-api/annotation/)`
- 空链接 `[]()` 是**禁止**的——它们比没有链接更糟，因为看起来像链接但无处可去

## 不要创建什么

- 源代码文件
- 业务逻辑的测试文件
- 应用入口点
