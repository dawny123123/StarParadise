---
name: harness-creator
description: "为代码仓库设计和创建 AI Agent 基础设施：AGENTS.md、文档架构（docs/）、可执行的 Linter（scripts/lint-*）、harness/ 配置、CI 集成。直接创建文件——绝不编写业务/应用代码。"
---

# Harness Creator
设计和创建 Harness 工程基础设施，使 AI Agent 能够在代码仓库中可靠地工作。

> **核心哲学**："没有基础设施的 intelligence 只是 demo。" Agent Harness 是操作系统——LLM 只是 CPU。仓库成为唯一的事实来源——如果 Agent 在上下文中看不到它，它就不存在。

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`bash "$SKILL_DIR/scripts/xxx.sh"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

---

## 统一工作流

无论项目状态如何（空项目、已有代码、已有 harness），本 Skill 遵循单一统一工作流。核心思想：**检测当前状态与目标状态之间的差距，然后填补它**。

```
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 1: 快速检测 + 意图确认                                        │
│  (5 分钟) 存在什么？用户想要什么？                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 2: 并行分析（生成子代理）                                      │
│  - 代码架构代理：imports、层级、模式                                  │
│  - Harness 状态代理：现有文档、linter、配置                            │
│  - 环境代理：依赖项、服务、密钥                                       │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 3: 差异综合                                                   │
│  合并分析结果 → 计算需要创建/更新的内容                                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 4: 并行创建/更新（生成子代理）                                  │
│  - 文档代理：AGENTS.md、docs/*                                       │
│  - Linter 代理：scripts/lint-*                                      │
│  - 配置代理：harness/*、Makefile、CI                                 │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  Phase 5: 验证 + 交接                                                │
│  运行 linter、验证文件、呈现摘要                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: 快速检测 + 意图确认

**目标**：在 5 分钟内了解项目状态和用户意图。

### 1.1 项目状态检测

运行此快速扫描：

```bash
# 统计文件数
file_count=$(find . -type f ! -path './.git/*' ! -path './node_modules/*' ! -path './vendor/*' 2>/dev/null | wc -l)
code_files=$(find . -type f \( -name "*.go" -o -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.rs" -o -name "*.java" \) ! -path './.git/*' ! -path './node_modules/*' ! -path './vendor/*' 2>/dev/null | wc -l)

# 检查 harness 组件
has_agents_md=$(test -f AGENTS.md && echo "yes" || echo "no")
has_architecture=$(test -f docs/ARCHITECTURE.md && echo "yes" || echo "no")
has_linters=$(ls scripts/lint-* 2>/dev/null | wc -l)
has_harness_dir=$(test -d harness && echo "yes" || echo "no")
has_makefile=$(test -f Makefile && echo "yes" || echo "no")

# 检测技术栈
if test -f go.mod; then TECH="Go"
elif test -f package.json; then TECH="TypeScript/Node.js"
elif test -f requirements.txt || test -f pyproject.toml; then TECH="Python"
elif test -f pom.xml || test -f build.gradle || test -f build.gradle.kts; then TECH="Java"
elif test -f Cargo.toml; then TECH="Rust"
else TECH="Unknown"
fi
```

### 1.2 项目状态分类

基于检测结果：

| 状态 | 标准 | 操作 |
|------|------|------|
| **空项目** | file_count < 5 AND code_files = 0 | 先引导用户完成项目选择 |
| **仅有代码** | code_files > 0 AND has_agents_md = "no" | 完整分析 + 完整创建 |
| **部分 Harness** | has_agents_md = "yes" AND (has_linters = 0 OR has_harness_dir = "no") | 差距分析 + 填补差距 |
| **完整 Harness** | 所有组件均存在 | 审计 + 改进建议 |

### 1.3 意图确认

**如果 AskUserQuestion 可用**，确认范围：

```json
{
  "question": "本次 harness 搭建的优先级是什么？",
  "header": "范围",
  "multiSelect": false,
  "options": [
    {
      "label": "完整 harness（推荐）",
      "description": "完整配置：AGENTS.md、文档、linter、评估框架、CI 集成"
    },
    {
      "label": "仅文档",
      "description": "仅 AGENTS.md + docs/，后续再添加 linter/评估"
    },
    {
      "label": "最小可用",
      "description": "仅 AGENTS.md + 基础 lint-deps，后续可扩展"
    }
  ]
}
```

**如果是空项目**，还要询问基础信息：

```json
{
  "question": "本项目使用什么技术栈？",
  "header": "技术栈",
  "multiSelect": false,
  "options": [
    {"label": "Go", "description": "CLI 工具、高性能服务、系统编程"},
    {"label": "TypeScript/Node.js", "description": "Web API、全栈应用、快速原型"},
    {"label": "Python", "description": "数据处理、ML/AI、脚本"},
    {"label": "Java", "description": "企业服务、Spring Boot、Maven/Gradle 项目"},
    {"label": "Rust", "description": "系统编程、高性能 CLI 工具、WebAssembly"}
  ]
}
```

**如果 AskUserQuestion 不可用**，使用检测到的值并记录假设：

```markdown
## 自动检测的上下文

| 字段 | 值 | 置信度 | 证据 |
|------|-----|--------|------|
| 技术栈 | {TECH} | 高 | 发现 {config file} |
| 项目状态 | {state} | 高 | {criteria matched} |
| 范围 | 完整 harness | 默认 | 未指定用户偏好 |

基于以上假设继续。如需调整请告知。
```

---

## Phase 2: 并行分析

**目标**：通过并行分析代理深入理解代码库。

### 2.1 生成分析代理（单条消息中）

| 代理 | 关注点 | 输出 |
|------|--------|------|
| 代码架构 | Import 图、层级层次、接口、循环依赖 | `harness/.analysis/architecture.json` |
| Harness 状态 | AGENTS.md 准确性、文档覆盖率、linter 覆盖率、评分 0-10 | `harness/.analysis/audit.json` |
| 环境 | DB 驱动、服务 SDK、环境变量、docker-compose | `harness/.analysis/environment.json` |

> 读取 `agents/analyzer.md` 获取代码架构代理的提示词。
> 读取 `agents/auditor.md` 获取 Harness 状态代理的提示词。
> 读取 `agents/analyzer-env.md` 获取环境代理的提示词。

### 2.2 等待分析完成

等待全部 3 个分析代理返回。如果任一代理失败：
- 使用简化提示词重新生成该代理（省略失败的分析维度），最多重试 1 次
- 如果仍失败：使用成功代理的部分结果，跳过失败的维度
- 如果全部失败：仅使用 Phase 1 的检测结果继续（降低保真度）

### 2.3 空项目

跳过 Phase 2。使用 `references/greenfield-templates.md`，基于用户选择的技术栈设计标准 3 层架构。

---

## Phase 3: 差异综合

**目标**：合并分析结果并精确计算需要创建/更新的内容。

### 3.1 读取分析结果

```bash
cat harness/.analysis/architecture.json
cat harness/.analysis/audit.json
cat harness/.analysis/environment.json
```

### 3.2 计算差异

创建差异列表：

```markdown
## 差异：需要做什么

### 创建（不存在）
- [ ] AGENTS.md
- [ ] docs/ARCHITECTURE.md
- [ ] scripts/lint-deps.go
- [ ] harness/config/environment.json

### 更新（存在但有缺口）
- [ ] docs/DEVELOPMENT.md — 缺少构建命令
- [ ] scripts/lint-quality.py — 层映射中缺少 3 个包

### 已就绪（无需更改）
- [x] Makefile — 已包含所有必需 target
- [x] .github/workflows/ci.yml — 已正确配置
```

### 3.3 与用户确认

呈现差异列表并询问：全部继续 / 显示详情 / 仅 P0/P1 项。

---

## Phase 4: 并行创建/更新

**目标**：通过并行代理创建或更新所有 harness 文件。

### 4.0 创建骨架（强制——在生成任何代理之前）

> ⛔ **阻塞**：不要跳过此步骤。在验证骨架之前不要进入 4.1。

运行骨架创建脚本以创建所有目录和骨架文件：

```bash
bash "$SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)"
```

**立即验证**骨架是否正确创建：

```bash
# 运行 create-scaffold.sh 后这些文件必须存在
# 如果缺少任何文件，说明脚本未运行——重新运行
for f in scripts/validate.py scripts/verify/README.md docs/design-docs/index.md \
         harness/config/environment.json harness/scripts/setup-env.sh \
         harness/scripts/start-server.sh harness/scripts/teardown-env.sh \
         AGENTS.md docs/PRODUCT_SENSE.md docs/TESTING.md docs/OPERATIONS.md Makefile; do
  test -f "$f" && echo "✓ $f" || echo "❌ 缺少: $f — 骨架脚本未运行！"
done
```

如果任何文件显示 `❌ 缺少`，**停止并重新运行脚本**。不要进入 4.1。

脚本创建（完整规范见 `references/scaffold-template.md`）：
- **20 个目录**：docs/、scripts/、harness/ 及所有子目录
- **2 个固定文件**：`scripts/validate.py`、`scripts/verify/README.md`
- **1 个初始模板**：`docs/design-docs/index.md`（一次性创建，**不**由 `--restore-fixed` 恢复）
- **4 个骨架文件**（带 `{{PARAM}}` 标记）：`harness/scripts/*.sh`、`harness/config/environment.json`
- **5 个参数化模板**（带 `{param}` 标记）：`AGENTS.md`、`docs/PRODUCT_SENSE.md`、`docs/TESTING.md`、`docs/OPERATIONS.md`、`Makefile`

> **骨架是确定性的。** 每个项目都获得完全相同的目录和骨架文件。子代理仅填充参数化部分——它们不会创建或删除文件。
>
> **Makefile 固定 target**：`lint-arch`、`lint`、`verify`、`setup-env`、`start-server`、`teardown-env` 完全由骨架生成，并自动检测 linter 脚本扩展名（.sh/.py/.go）。代理仅填充 `{build_command}` 和 `{test_command}`。
>
> **start-server.sh**：`cd "$(dirname "$0")/../.."` 项目根目录导航在骨架中是固定的。代理绝不能硬编码绝对路径。

### 4.1 生成填充代理（单条消息中）

**在生成之前**，从 Phase 2 分析（`harness/.analysis/architecture.json`）中提取核心组件列表。此列表成为填充文档代理的**硬参数**——它必须为每个组件创建一个设计文档。

```bash
# 从架构分析中提取组件名称
# 如果 architecture.json 有 "components" 数组，则使用它
# 否则，从 ARCHITECTURE.md 第 3 节（核心组件）推导
# 最后手段：按 import fan-in 识别前 3-6 个包
COMPONENTS=$(python3 -c "
import json, sys
data = json.load(open('harness/.analysis/architecture.json'))
comps = data.get('components', [])
if not comps:
    # 备用：从层级层次中提取——每层 L1+ 选 1 个组件
    for layer in data.get('layers', []):
        if layer.get('layer', 0) >= 1:
            comps.append(layer.get('name', ''))
print(' '.join(comps[:6]))
" 2>/dev/null || echo "")
```

如果 `COMPONENTS` 为空（无分析数据或空项目），使用：`COMPONENTS="core domain infra"`

| 代理 | 允许的文件 | 关键规则 |
|------|-----------|----------|
| **fill-documentation** | AGENTS.md（80-120 行）、docs/ARCHITECTURE.md、docs/DEVELOPMENT.md、docs/PRODUCT_SENSE.md、docs/design-docs/*.md | 不新建文件（`docs/design-docs/` 下除外），引用 file:line，无占位符，使用 `references/documentation-templates.md` |
| **fill-linters** | scripts/lint-deps.{ext}、scripts/lint-quality.{ext} | 从 `references/linter-templates.md` 复制，仅修改 LAYER_MAP。必须扫描实际包——无幻觉名称。错误消息：WHAT+WHY+HOW |
| **fill-harness-config** | harness/config/environment.json、harness/scripts/*.sh、Makefile（仅 {build_command}/{test_command}）、.github/workflows/ci.yml | 仅填充 {{PARAM}} 标记。绝不硬编码绝对路径或密钥。不要创建 verify.json。使用 `references/environment-config-guide.md` |

> 读取 `agents/creator-docs.md`、`agents/creator-linters.md`、`agents/creator-config.md` 获取完整代理提示词。

**关键——design-docs 创建参数**：生成填充文档代理时，在其提示词中包含：

```
强制：你必须为以下组件在 docs/design-docs/ 中创建设计文档：
  {COMPONENTS}

这不是可选的。骨架已创建 docs/design-docs/index.md。
你必须创建 {N} 个额外的 .md 文件（每个组件一个）。
创建后验证：ls docs/design-docs/*.md | wc -l 必须 ≥ {N+1}
```

将 `{COMPONENTS}` 替换为提取的组件列表，`{N}` 替换为数量。

### 4.2 等待创建完成

固定文件和 Makefile target 在 Phase 5.0 自动恢复。

如果任何填充代理失败：检查它创建的文件与缺失的文件 → 仅为缺失的文件重新生成（最多重试 1 次） → 如果仍失败：将缺失的文件标记为"需手动操作"并继续。

---

## Phase 5: 验证 + 交接

**目标**：确保一切正常，然后交接或呈现结果。

### 5.0 恢复固定文件（自动——在任何验证之前）

```bash
bash "$SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)" --restore-fixed
```

这不是可选的。在验证之前无条件运行，以保证固定文件（validate.py、verify/README.md）和 Makefile target 正确，无论填充代理做了什么。

> 注意：`docs/design-docs/index.md` **不**由 `--restore-fixed` 恢复，因为它包含在 Phase 4 中填充的项目特定设计文档引用。

### 5.1 运行验证

按顺序检查：
1. 构建通过：`go build ./...` / `npm run build` / `python -m compileall .`
2. Linter 通过：`make lint-arch`
3. AGENTS.md 大小：80-120 行（硬限制）
4. 所有骨架文件和目录存在
5. Shell 脚本可执行
6. 无未填充的 `{{PARAM}}` 标记残留
7. docs/design-docs/ 有 ≥3 个组件文档（不只是 index.md）
8. `scripts/validate.py` 包含规范流程：`grep -q "make build" scripts/validate.py` 必须通过

### 5.1.1 修复：design-docs 不足（如果检查 7 失败则强制）

如果 `docs/design-docs/` 的组件文档少于 3 个（即只有 `index.md` 或 `index.md` + 1-2 个文档）：

1. **统计缺口**：
   ```bash
   CURRENT=$(ls docs/design-docs/*.md 2>/dev/null | grep -v index.md | wc -l)
   NEEDED=$((3 - CURRENT))
   echo "现有 $CURRENT 个组件文档，还需 $NEEDED 个"
   ```

2. **识别缺失组件**：读取 `docs/ARCHITECTURE.md` 第 3 节（核心组件）。列出**没有**对应 `docs/design-docs/{component}.md` 的组件。

3. **重新生成目标代理**（不是完整的填充文档代理——只是一个专注的文档创建者）：
   ```
   你必须为以下缺失组件创建 $NEEDED 个设计文档：
     {MISSING_COMPONENT_LIST}

   对每个组件，使用 references/documentation-templates.md 中的设计文档模板
   创建 docs/design-docs/{component-slug}.md。

   每个文档必须包含：概述、架构（Mermaid）、关键接口（file:line）、
   执行流程、错误处理。

   同时更新 docs/design-docs/index.md 以添加新文档的条目。
   ```

4. **重新验证**：`ls docs/design-docs/*.md | grep -v index.md | wc -l` 必须 ≥ 3。

5. **如果重试 1 次后仍失败**：创建最小存根文档，包含组件名称、概述和 `<!-- TODO: 扩展 -->` 标记。在摘要中标记为"需手动操作"。

### 5.2 清理分析产物

Phase 2 分析文件是 Phase 3-4 的临时输入。验证完成后清理它们：

```bash
# 删除 Phase 2 中间分析文件（保留目录）
rm -f harness/.analysis/architecture.json harness/.analysis/audit.json harness/.analysis/environment.json
rm -f harness/.analysis/architecture-summary.md harness/.analysis/audit-summary.md harness/.analysis/environment-summary.md
echo "✓ 已清理 harness/.analysis/ 中的 Phase 2 分析产物"
```

> `harness/.analysis/` 是**临时空间**，不是永久存储。Creator 写入，Creator 清理。Doctor 稍后会在此写入自己的文件。

### 5.3 呈现摘要

显示：项目名称、技术栈、创建/更新的文件、验证结果（每项检查的通过/失败）、后续步骤。

---

## 核心原则

1. **仓库作为唯一事实来源** — 如果不在仓库中，对代理而言就不存在。
2. **AGENTS.md 是地图，不是手册** — 80-120 行，链接到文档。
3. **机械式执行不变量** — Linter 错误必须是可执行的（WHAT + WHY + HOW）。
4. **为删除而构建** — 每个组件都应该是可替换的。
5. **从简单开始** — 原子工具 > 复杂编排。

---

## 参考文件

| 文件 | 阶段 | 内容 |
|------|------|------|
| `references/scaffold-template.md` | Phase 4.0 | 目录结构、固定文件、骨架 |
| `references/greenfield-templates.md` | 空项目 | Go/TS/Python 脚手架 |
| `references/documentation-templates.md` | Phase 4 文档 | 文档模板 |
| `references/linter-templates.md` | Phase 4 linter | 按语言的 linter 骨架 |
| `references/environment-detection-guide.md` | Phase 2 环境 | 生态系统检测 |
| `references/environment-config-guide.md` | Phase 4 配置 | 启动、服务、环境变量 |
| `references/architecture-diagrams.md` | Phase 4 文档 | Mermaid 图表模板（依赖、数据流、组件） |
| `references/adapters/adapter-schema.md` | Phase 4 | 语言适配器模式定义 |
| `references/adapters/go.md` | Phase 4 | Go 专用适配器 |
| `references/adapters/typescript.md` | Phase 4 | TypeScript 专用适配器 |
| `references/adapters/python.md` | Phase 4 | Python 专用适配器 |
| `references/adapters/java.md` | Phase 4 | Java 专用适配器 |
| `references/adapters/rust.md` | Phase 4 | Rust 专用适配器 |
| `references/adapters/generic.md` | Phase 4 | 通用备用适配器 |

代理提示词：`agents/analyzer.md`、`agents/analyzer-env.md`、`agents/auditor.md`、`agents/creator-docs.md`、`agents/creator-linters.md`、`agents/creator-config.md`。

对于小项目（<20 个文件），改为内联执行各阶段，不生成代理。
