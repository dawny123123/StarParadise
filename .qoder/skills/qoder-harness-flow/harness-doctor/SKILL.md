---
name: harness-doctor
description: "深度扫描实际代码库，然后自动修复 harness 基础设施以匹配现实：恢复固定文件、补全缺失文档、修正漂移脚本、强制跨文件一致性、归档过期经验。一键修复——无需交互。"
---

# Harness Doctor

深度扫描实际代码库，然后使所有 harness 文件与现实保持一致。

> **核心哲学**："代码库是真理，harness 必须跟随。" 开发者修改代码 -> Doctor 让 harness 跟上。而非相反。

> **关键原则**：事实来源是**实际代码库**（包、imports、构建配置、依赖项）。Harness 文件（文档、linter、配置）必须反映当前现实，而非历史快照。

## 脚本与模板复用

本 Skill 复用 harness-creator 的骨架脚本和参考模板。运行前，定位 creator Skill 目录：

```bash
CREATOR_SKILL_DIR="<directory containing harness-creator/SKILL.md>"
```

然后调用：
- **Doctor**（修复模式——仅创建缺失文件）：`bash "$CREATOR_SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)" --missing-only`
- **Creator**（绿地——完整骨架，覆盖所有内容）：`bash "$CREATOR_SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)"`

---

## 工作流

五步。全自动。无需用户交互。

```
DOCTOR
===============================================
 1. SCAN      深度代码分析（3 个子代理并行）
 2. AUDIT     双层审计（表面 + 内容深度）
 3. FIX       按优先级自动修复（P0-P5）
 4. HEAL      经验漂移检测 + 归档
 5. REPORT    输出修复内容 / 需关注内容
===============================================
```

---

## Step 1: SCAN — 深度项目分析

不要使用表面级 grep。**阅读实际代码**来构建项目的完整、准确图景。

> 扫描必须实现语义理解——架构、组件、依赖项和关系——而非文件名匹配。

### 1.1 并行深度分析（生成 3 个子代理）

并行生成 3 个分析子代理。每个都读取实际源代码，而非仅文件名。

| 代理 | 关注点 | 读取内容 | 输出 |
|------|--------|----------|------|
| **架构分析器** | 层级层次、import 图、组件边界 | 每个源文件的 imports；构建配置（pom.xml/go.mod/package.json） | `harness/.analysis/doctor-architecture.json` |
| **组件分析器** | 核心组件、关键接口、API 端点、类层次 | 源文件、接口定义、controller/handler 类、service 类 | `harness/.analysis/doctor-components.json` |
| **环境分析器** | 外部依赖、构建/测试命令、环境变量、运行时配置 | 构建文件、docker-compose、应用配置、shell 脚本 | `harness/.analysis/doctor-environment.json` |

#### 架构分析器提示词

> 读取 `agents/architecture-analyzer.md` 获取完整代理提示词。

#### 组件分析器提示词

> 读取 `agents/component-analyzer.md` 获取完整代理提示词。

#### 环境分析器提示词

> 读取 `agents/environment-analyzer.md` 获取完整代理提示词。

### 1.2 补充 Bash 扫描

子代理返回后，运行快速 bash 检查以获取真实数据：

```bash
# 真实包列表（用于 lint-deps LAYER_MAP 比较）
# Java/Maven
grep -rh "^package " --include="*.java" . | sed 's/package //;s/;//' | sort -u > /tmp/doctor-actual-packages.txt
# Go
grep -rh "^package " --include="*.go" . | sort -u > /tmp/doctor-actual-packages.txt
```

### 1.3 Skill 脚本健康扫描

扫描所有已安装 Skill 脚本的编译错误和常见运行时缺陷。这确保 harness 工具链本身是健康的。

```bash
SKILL_BASE="$PROJECT_ROOT/.qoder/skills"
SCRIPT_ISSUES="[]"

# 1. 编译检查：每个 .py 必须通过 py_compile
for skill_dir in "$SKILL_BASE"/*/scripts; do
  [ -d "$skill_dir" ] || continue
  for py_file in "$skill_dir"/*.py; do
    [ -f "$py_file" ] || continue
    python3 -m py_compile "$py_file" 2>&1 || echo "COMPILE_FAIL: $py_file"
  done
  # .sh 语法检查
  for sh_file in "$skill_dir"/*.sh; do
    [ -f "$sh_file" ] || continue
    bash -n "$sh_file" 2>&1 || echo "SYNTAX_FAIL: $sh_file"
  done
done

# 2. 运行时缺陷检测（misplaced kwargs、missing ensure_ascii、bare except）
# 对每个 .py 文件，按 audit-checklist.md 第 7 节 Tier 2 运行模式检查
# - print(...), kwarg=  -> misplaced kwarg（排除 end=/sep=/file=/flush=）
# - json.dumps( without ensure_ascii=False -> missing ensure_ascii
# - except: (bare) -> should be except Exception:
```

将结果保存到 `doctor-scan.json` 的 `skill_script_health` 字段：

```json
{
  "skill_script_health": {
    "total_scripts": 16,
    "compile_failures": [],
    "runtime_defects": [
      {"file": ".qoder/skills/harness-executor/scripts/verify_action.py", "line": 552, "type": "misplaced_kwarg", "detail": "ensure_ascii=False passed to print() instead of json.dumps()"}
    ]
  }
}
```

### 1.4 文档覆盖率分析

将深度扫描结果与当前文档进行比较。

**步骤 A**：盘点现有文档：
```bash
EXISTING_DESIGN_DOCS=$(ls docs/design-docs/*.md 2>/dev/null | grep -v index.md | sed 's|docs/design-docs/||;s|\.md||')
INDEX_ENTRIES=$(grep -oP '\[.*?\]\(.*?\.md\)' docs/design-docs/index.md 2>/dev/null)
ARCH_PACKAGES=$(grep '| L[0-9]' docs/ARCHITECTURE.md 2>/dev/null)
DOC_BUILD_CMD=$(grep -i 'build\|compile\|make' docs/DEVELOPMENT.md 2>/dev/null)
```

**步骤 B**：将扫描结果与文档交叉引用：

对 `doctor-components.json` 中的每个组件：
- 有 `docs/design-docs/{component}.md` 吗？ -> 如果没有，需要创建
- 列在 `docs/design-docs/index.md` 中吗？ -> 如果没有，需要添加
- 在 `PRODUCT_SENSE.md` 中提到吗？ -> 如果没有，需要添加

对 `doctor-architecture.json` 中的每个包：
- 在 `ARCHITECTURE.md` 层表中吗？ -> 如果没有，需要添加
- 层分配与实际 imports 匹配吗？ -> 如果不匹配，需要修正
- 在 `AGENTS.md` 架构部分中吗？ -> 如果没有，需要添加
- 在 `scripts/lint-deps.*` LAYER_MAP 中吗？ -> 如果没有，需要添加

对 `doctor-environment.json` 中的每项：
- 构建命令与 `DEVELOPMENT.md` 匹配吗？ -> 如果不匹配，需要更新
- Makefile target 都已记录吗？ -> 如果没有，需要更新
- 外部依赖在 `environment.json` 中吗？ -> 如果没有，需要添加
- 环境变量在 harness 脚本中吗？ -> 如果没有，需要添加

### 1.4.1 Mermaid 语法验证

扫描文档中所有 Mermaid 代码块以查找已知语法错误。这可以捕获 AI 文档生成引入的 bug。

```bash
# 查找所有 Mermaid classDiagram 代码块并检查已知错误
# 注意：使用 find 而非 glob——docs/**/*.md 需要 globstar 且默认不会递归
find docs -name '*.md' -print0 | while IFS= read -r -d '' md_file; do
  # 错误模式："class X ..> Y" — 关系行绝不能以 "class" 开头
  grep -Pn '^\s*class\s+\w+\s+(\.\.|-->|<!\.\.|\*--|o--)' "$md_file" && echo "MERMAID_ERROR: $md_file — class keyword on relationship line"
done
# 同时检查项目根目录文档
for md_file in AGENTS.md ARCHITECTURE.md; do
  [ -f "$md_file" ] || continue
  grep -Pn '^\s*class\s+\w+\s+(\.\.|-->|<!\.\.|\*--|o--)' "$md_file" && echo "MERMAID_ERROR: $md_file — class keyword on relationship line"
done
```

已知错误模式检测：
1. **`class X ..> Y`** — `class` 关键字在依赖行上（导致 DOTTED_LINE 解析错误）
2. **`class X --> Y`** — 关联箭头的同样问题
3. **`class X <|.. Y`** — 实现箭头的同样问题
4. **`class X *-- Y`** — 组合箭头的同样问题
5. **`class X o-- Y`** — 聚合箭头的同样问题
6. **未闭合类体** — `class X {` 没有匹配的 `}`

将结果保存到 `doctor-scan.json` 的 `mermaid_syntax_issues` 字段：

```json
{
  "mermaid_syntax_issues": [
    {"file": "docs/design-docs/dtms-biz-basic.md", "line": 79, "type": "class_on_relationship", "original": "    class VehicleServiceImpl ..> VehicleRepository", "fix": "    VehicleServiceImpl ..> VehicleRepository"}
  ]
}
```

### 1.5 保存扫描结果

将所有分析合并到 `harness/.analysis/doctor-scan.json`：

```json
{
  "scan_date": "YYYY-MM-DD HH:MM",
  "tech_stack": "Java/Maven",
  "architecture": "<from doctor-architecture.json>",
  "components": "<from doctor-components.json>",
  "environment": "<from doctor-environment.json>",
  "skill_script_health": "<from Step 1.3 scan>",
  "mermaid_syntax_issues": "<from Step 1.4.1 scan>",
  "doc_coverage_gaps": {
    "missing_design_docs": [{"component": "order-web", "purpose": "Web layer controllers", "source_paths": ["src/.../web/"]}],
    "undocumented_packages": [{"name": "com.example.payment", "layer": 2, "role": "Payment processing"}],
    "stale_design_docs": [{"doc": "order-api.md", "issue": "Missing new endpoint POST /orders/batch added in code"}],
    "outdated_commands": {"test_command": {"documented": "mvn test", "actual": "mvn test -pl order"}},
    "missing_arch_packages": [{"name": "com.example.payment", "suggested_layer": 2, "evidence": "imports only L0-L1"}],
    "missing_env_deps": [{"type": "cache", "name": "redis", "evidence": "spring-data-redis in pom.xml"}],
    "index_md_missing_entries": ["order-web.md", "payment-service.md"]
  }
}
```

此扫描结果驱动所有后续的审计和修复操作。

---

## Step 2: AUDIT — 双层检查

将 harness 文件与 Step 1 的实际项目状态进行比较。对每个检查，记录：
- **状态**：PASS / FAIL / WARN
- **修复操作**：如果 FAIL 该做什么（来自 `references/audit-checklist.md`）

### 2.1 运行完整审计

读取 `references/audit-checklist.md` 并执行其中列出的**每个**检查。此外，使用 `references/gc-templates.md` 进行高级检测方法（过期文档检测、断链检查、接口漂移检测）。构建问题列表：

```markdown
## 审计结果

| # | 维度 | 层级 | 检查 | 状态 | 修复操作 |
|---|------|------|------|------|----------|
| 1 | 结构 | T1 | AGENTS.md 存在 | PASS | -- |
| 2 | 脚本 | T2 | lint-deps LAYER_MAP 缺少 5 个新包 | FAIL | 从扫描更新 LAYER_MAP |
| 3 | 文档 | T2 | ARCHITECTURE.md 层表已过期 | FAIL | 从实际包同步 |
| ... | ... | ... | ... | ... | ... |
```

### 2.2 审计维度

| 维度 | Tier 1（表面） | Tier 2（内容深度） |
|------|----------------|---------------------|
| **结构** | 所有必需的文件/目录存在 | -- |
| **固定文件** | Makefile target、validate.py 与规范匹配 | -- |
| **文档** | 行数、格式、关键部分存在、链接有效 | design-docs 覆盖所有组件、层表覆盖所有包、命令最新、代码引用有效、Mermaid 覆盖所有层 |
| **脚本** | 权限、无硬编码路径、无未填充占位符 | LAYER_MAP 覆盖所有包、层分配与 imports 匹配 |
| **配置** | environment.json 有效 JSON、模式正确 | 服务与实际依赖匹配、环境变量与扫描匹配 |
| **一致性** | -- | 层数据在 AGENTS.md / ARCHITECTURE.md / lint-deps 中完全相同 |

---

## Step 3: FIX — 按优先级自动修复

按依赖顺序修复问题。较早的修复为后续的修复提供基础。

### 修复优先级顺序

```
P0: 结构     -- 文件必须先存在才能修复内容
P1: 固定文件 -- 恢复规范基线
P2: 脚本     -- 从实际包扫描更新 lint-deps LAYER_MAP
P3: 文档     -- 与实际组件、包、构建命令同步
P4: 配置     -- 匹配实际外部依赖和环境变量
P5: 一致性   -- 跨文件同步（所有文件与实际状态匹配）
```

### 3.1 P0: 结构 — 骨架补全（强制）

> ⛔ **阻塞**：如果**任何**必需的文件或目录缺失，你必须创建它们。不要跳到 P1。

> ⚠️ **安全规则**：Doctor 只能创建缺失文件。绝不能覆盖现有文件。完整骨架脚本（不带参数的 `create-scaffold.sh`）覆盖所有内容——这仅用于**新项目**（harness-creator 绿地模式）。

**飞行前检查** — 在做出任何更改之前验证项目处于版本控制之下：

```bash
# 确保 Doctor 运行前所有更改已提交或暂存
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "ERROR: 检测到未提交的更改。运行 Doctor 前请先执行 'git commit' 或 'git stash'。"
  exit 1
fi
```

**仅创建缺失文件** — 使用 `--missing-only` 标志：

```bash
bash "$CREATOR_SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)" --missing-only
```

这仅创建不存在的文件，安全跳过现有文件。

运行后，重新检查：`audit-checklist.md` 第 1 节中所有必需文件都必须存在。

### 3.2 P1: 固定文件 — 恢复规范版本（强制）

> ⛔ **阻塞**：无条件恢复所有固定文件。不要跳过此步骤。

```bash
bash "$CREATOR_SKILL_DIR/scripts/create-scaffold.sh" "$(pwd)" --restore-fixed
```

这将 Makefile target、validate.py 和 verify/README.md 覆盖为规范版本。这是安全的——这些文件没有项目特定的内容。

### 3.3 P2: 脚本 — Linter 修正

**LAYER_MAP 漂移** 是最常见的脚本问题。使用 Step 1.2 的包扫描（而非重新扫描）。

1. **将扫描结果与当前 LAYER_MAP 比较**：从 `scripts/lint-deps.*` 提取层分配，与 `/tmp/doctor-actual-packages.txt` 进行 diff

2. **发现的新包**（在扫描中但不在 LAYER_MAP 中）：
   - 使用 `doctor-architecture.json` 中的 import 分析确定层
   - 添加到 LAYER_MAP 的正确层
   - 仅更新 LAYER_MAP 部分，不要重写脚本的其余部分

3. **幽灵包**（在 LAYER_MAP 中但不在扫描中）：
   - 从 LAYER_MAP 中移除（该包已不存在）

4. **可执行权限**：
   ```bash
   chmod +x scripts/lint-deps.* scripts/lint-quality.* 2>/dev/null
   chmod +x harness/scripts/*.sh 2>/dev/null
   ```

### 3.3.1 P2: Skill 脚本 — 运行时缺陷修复

修复 Step 1.3 检测到的问题。来源：`doctor-scan.json` 的 `skill_script_health`。

> **原则**：Skill 脚本是 harness 环境的一部分。损坏的 Skill 脚本 = 损坏的 harness。Doctor 必须修复它们。

1. **编译失败**（`py_compile` / `bash -n`）：
   - 记录确切错误位置（文件、行、消息）
   - 标记为**需人工关注** — 语法错误需要人工判断

2. **关键字参数位置错误**（例如 `print(...), ensure_ascii=False`）：
   - 自动修复：将 kwarg 移入前一个函数调用的右括号
   - 示例：`print(json.dumps(x, indent=2), ensure_ascii=False)` → `print(json.dumps(x, indent=2, ensure_ascii=False))`
   - 修补后用 `python3 -m py_compile` 验证修复

3. **`json.dumps()` 调用中缺少 `ensure_ascii=False`**：
   - 自动修复：添加 `ensure_ascii=False` 作为最后一个参数
   - 这确保 JSON 输出中的中文内容可读

4. **裸 `except:`** 子句：
   - 自动修复：将 `except:` 替换为 `except Exception:`
   - 裸 except 会捕获 SystemExit/KeyboardInterrupt，这几乎从来不是预期的

### 3.4 P3: 文档 — 增量修复 + 新文档创建

修复现有文档并为未记录的代码创建新文档。来源：`doctor-scan.json` 的 `doc_coverage_gaps`。

不要从头重建。不要触碰已正确描述代码的文档。

#### 3.4.1 创建缺失的设计文档（来自扫描缺口）

对 `doc_coverage_gaps.missing_design_docs` 中的每个组件：

1. 读取组件的实际源代码（关键接口、入口点、imports）
2. 生成一个专注的子代理：
   ```
   为组件 {COMPONENT_NAME} 创建 docs/design-docs/{component-slug}.md。
   使用 $CREATOR_SKILL_DIR/references/ 中的 documentation-templates.md 设计文档模板。
   必须包含：概述、架构（来自实际 imports 的 Mermaid 图表）、
   关键接口（引用 REAL 代码的 file:line）、
   执行流程、错误处理。
   编写前先读取 {SOURCE_PATHS} 处的实际源代码。
   ```
3. 更新 `docs/design-docs/index.md` 以添加新条目
4. 验证新文档引用真实文件（无幽灵路径）
5. **创建所有新设计文档后**，验证 index.md 一致性：
   ```bash
   # index.md 中的每一行都必须指向一个存在的 .md 文件
   for f in $(grep -oP '[\w-]+\.md' docs/design-docs/index.md); do
     test -f "docs/design-docs/$f" || echo "BROKEN: index.md 引用 $f 但文件不存在"
   done
   ```
   如果发现任何 BROKEN 条目：从 index.md 中删除该行（不要留下幽灵引用）。

#### 3.4.2 为新增包更新 ARCHITECTURE.md

对 `doc_coverage_gaps.undocumented_packages` 中的每个包：

1. 使用 `doctor-architecture.json` 中的 import 分析确定层
2. 将其添加到 ARCHITECTURE.md 的层表中
3. 更新 Mermaid 图表以包含新包的依赖箭头
4. 基于实际 import 分析添加依赖规则（"不可导入"列）

#### 3.4.3 同步 AGENTS.md 层表

更新 AGENTS.md 架构部分以匹配当前包：
- 添加扫描中发现的新包
- 移除不再存在的包
- 保持在 80-120 行限制内（如果添加导致溢出，链接到 ARCHITECTURE.md）

#### 3.4.4 更新 DEVELOPMENT.md 命令

对 `doc_coverage_gaps.outdated_commands` 中的每项：
- 将记录的命令替换为实际检测到的命令
- 如果 Makefile 中存在但未记录的新构建 target -> 添加它们

#### 3.4.5 修复 AGENTS.md 大小

**太长**（> 120 行）：
- 将详细内容移至适当的 docs/ 文件，替换为链接

**太短**（< 80 行）：
- 使用扫描数据添加缺失的标准部分

#### 3.4.6 修复断链

在所有文档中：
- 目标文件路径不同 -> 修复链接
- 目标文件不存在但是必需骨架文件 -> 创建它
- 目标文件不存在且不是必需的 -> 移除链接

#### 3.4.7 更新 PRODUCT_SENSE.md

如果扫描发现 PRODUCT_SENSE.md 中未提及的新组件/模块：
- 添加描述新业务目的的部分
- 从包名、类名和代码注释推断目的

#### 3.4.8 修复 Mermaid 语法错误

自动修复 Step 1.4.1 检测到的 Mermaid 图表问题。来源：`doctor-scan.json` 的 `mermaid_syntax_issues`。

> **原则**：Mermaid 错误是 AI 生成引入的文档缺陷。Doctor 必须修复它们——损坏的图表比没有图表更糟。

1. **`class` 关键字在关系行上**（最常见）：
   - 自动修复：从关系行剥离 `class` 前缀
   - 示例：`class VehicleServiceImpl ..> VehicleRepository` → `VehicleServiceImpl ..> VehicleRepository`
   - 检测：`classDiagram` 代码块内匹配 `^\s*class\s+\w+\s+(\.\.|-->|<!\.\.|\*--|o--)` 的行

2. **未闭合类体**：
   - 自动修复：在下一个类定义或关系行之前添加缺失的 `}`
   - 如果不确定在哪里闭合则标记为 WARN

3. **修复后**：验证 Mermaid 代码块不再包含任何检测到的模式：
   ```bash
   # 重新检查修复的文件
   for fixed_file in <files_fixed>; do
     grep -Pn '^\s*class\s+\w+\s+(\.\.|-->|<!\.\.|\*--|o--)' "$fixed_file" && echo "STILL_BROKEN: $fixed_file"
   done
   ```

### 3.5 P4: 配置 — 环境修复

将环境配置与 Step 1 中检测到的实际依赖同步。

**environment.json 缺失或无效**：
- 如果缺失：从 `$CREATOR_SKILL_DIR/references/environment-config-guide.md` 模式创建，用扫描中的 `external_deps` 和 `env_vars_referenced` 填充
- 模式事实来源：`$CREATOR_SKILL_DIR/agents/creator-config.md` — 所有字段名和类型必须匹配
- 如果 JSON 无效：修复语法错误
- 如果缺少扫描检测到的服务（例如，扫描发现 mysql 驱动但 environment.json 没有 mysql）：添加它们
- 如果有扫描未检测到的服务：标记为 WARN（可能是可选的）

**Harness 脚本问题**：
- 缺失脚本 -> 从骨架模板创建
- 硬编码绝对路径 -> 替换为 `cd "$(dirname "$0")/../.."` 导航
- 硬编码密钥 -> 替换为 `${VAR}` 引用并标记为需人工关注
- start-server.sh 构建命令与扫描检测到的构建命令不匹配 -> 更新

**未填充模板标记**：
```bash
grep -r '{{' scripts/ harness/scripts/ Makefile 2>/dev/null
```
如果找到：尝试从扫描数据填充。如果无法确定值 -> 标记为需人工关注。

### 3.6 P5: 一致性 — 跨文件同步

**事实来源链**：实际包扫描（Step 1.2）-> lint-deps LAYER_MAP（Step 3.3）-> 文档。

在 Steps 3.3-3.5 之后，验证所有三个文件同步：
1. lint-deps LAYER_MAP <- 已从实际扫描更新
2. `docs/ARCHITECTURE.md` 层表 <- 从 lint-deps 同步
3. `AGENTS.md` 架构部分 <- 从 lint-deps 同步

对每个文件：
- 提取当前层分配
- 与 lint-deps LAYER_MAP 进行 diff
- 仅更新不匹配的条目
- 保留所有其他内容

同时检查：
- DEVELOPMENT.md 中的构建命令与 Makefile 匹配并与实际构建系统匹配
- environment.json 服务与实际依赖扫描匹配
- AGENTS.md 链接指向实际存在的文件

---

## Step 4: HEAL — 经验漂移检测

检测并归档不再反映现实的过期经验记录。

> **原因**：executor 在任务完成时记录经验（教训、files_changed）。如果代码后来被修改（由用户或另一个 executor 运行），这些教训可能是错误的。过期经验会误导未来的 executor 运行。

### 4.0 获取内存锁

```bash
LOCK_FILE="harness/memory/.doctor-lock"
if test -f "$LOCK_FILE" || test -f "harness/memory/.evolver-lock"; then
  echo "WARN: 内存锁存在（另一个 doctor/evolver 正在运行）。跳过 HEAL 步骤。"
  # 跳到 Step 5
fi
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT
```

### 4.1 扫描经验记录

```bash
# 列出所有情景记忆文件
ls harness/memory/episodes/*.jsonl 2>/dev/null
```

对每个 episode 条目，提取：
- `timestamp`：经验记录时间
- `files_changed`：任务修改的文件
- `lessons`：学到的内容

### 4.2 检测漂移

对每个 episode 的 `files_changed`，检查这些文件是否在 episode 记录之后被修改：

```bash
# 对 files_changed 中的每个文件：
EPISODE_DATE="2025-04-01"  # 来自 episode 时间戳
FILE="src/main/java/com/example/OrderService.java"
LAST_MODIFIED=$(git log -1 --format="%ai" -- "$FILE" 2>/dev/null | cut -d' ' -f1)

if [[ "$LAST_MODIFIED" > "$EPISODE_DATE" ]]; then
  echo "DRIFT: $FILE 在 episode 记录之后被修改"
fi
```

如果 episode 的 `files_changed` 中**任何**文件在 episode 时间戳之后被修改，则该 episode **已漂移**。

### 4.3 归档漂移的 Episode

```bash
mkdir -p harness/memory/archived
```

对每个漂移的 episode：
1. 将条目从 `episodes/*.jsonl` 移至 `archived/*.jsonl`
2. 在 `harness/memory/drift-report.json` 中记录漂移原因：

```json
{
  "scan_date": "YYYY-MM-DD HH:MM",
  "archived_count": 3,
  "entries": [
    {
      "original_file": "episodes/2025-04-01.jsonl",
      "episode_date": "2025-04-01",
      "drifted_files": ["src/.../OrderService.java"],
      "file_modified_date": "2025-04-05",
      "lessons_archived": ["Use batch insert for orders"],
      "reason": "OrderService.java was modified 4 days after episode recording"
    }
  ]
}
```

> executor Step 1.3 只读取 `episodes/*.jsonl` — archived/ 中的归档 episode 自然被排除，无需任何 executor 更改。

---

## Step 5: REPORT

### 5.1 生成报告

保存到 `harness/.analysis/doctor-report.md`：

```markdown
# Harness Doctor 报告

**日期**：YYYY-MM-DD HH:MM
**项目**：{project name}

## 摘要

| 指标 | 值 |
|------|-----|
| 总检查数 | {N} |
| 修复前通过 | {N} |
| 自动修复 | {N} |
| 需人工关注 | {N} |
| 修复后通过 | {N} |
| 归档经验条目 | {N} |

## 自动修复的问题

| # | 优先级 | 维度 | 问题 | 应用的修复 |
|---|--------|------|------|------------|
| 1 | P1 | 固定文件 | Makefile lint-arch target 被覆盖 | 通过 --restore-fixed 恢复 |
| 2 | P2 | 脚本 | lint-deps LAYER_MAP 缺少 3 个包 | 从扫描中添加并分析层 |
| 3 | P3 | 文档 | payment-service 缺少设计文档 | 创建 docs/design-docs/payment-service.md |
| ... | ... | ... | ... | ... |

## 经验漂移

| # | Episode 日期 | 漂移文件 | 归档的教训 | 原因 |
|---|-------------|----------|-----------|------|
| 1 | 2025-04-01 | OrderService.java | "Use batch insert" | 文件在 2025-04-05 修改 |
| ... | ... | ... | ... | ... |

## 需人工关注

| # | 维度 | 问题 | 为何需人工 | 建议操作 |
|---|------|------|-----------|----------|
| 1 | 配置 | environment.json 有 {{DB_HOST}} 未填充 | 无法确定 DB 主机 | 在环境中设置 DB_HOST 或手动填充 |
| ... | ... | ... | ... | ... |

## 所有检查（修复后）

| # | 维度 | 层级 | 检查 | 状态 |
|---|------|------|------|------|
| 1 | 结构 | T1 | AGENTS.md 存在 | PASS |
| ... | ... | ... | ... | ... |
```

### 5.2 清理扫描产物

Step 1 原始扫描文件是 Steps 2-4 的临时输入。报告生成后，清理它们（保留报告）：

```bash
# 删除原始扫描中间文件，保留 doctor-report.md
rm -f harness/.analysis/doctor-architecture.json harness/.analysis/doctor-components.json
rm -f harness/.analysis/doctor-environment.json harness/.analysis/doctor-scan.json
echo "✓ 已清理扫描产物（保留 doctor-report.md）"
```

> `doctor-report.md` 是 `.analysis/` 中**唯一的持久输出**。原始扫描 JSON 是临时数据。

### 5.3 终端输出

同时向终端打印简洁摘要：

```
Doctor 完成：
  扫描：  {N} 个包，{N} 个组件，{N} 个外部依赖
  检查：  {N} 项（Tier 1: {N}，Tier 2: {N}）
  修复：  {N} 个问题（P0:{n} P1:{n} P2:{n} P3:{n} P4:{n} P5:{n}）
  归档：  {N} 条过期经验
  人工：  {N} 项（见 harness/.analysis/doctor-report.md）
```

---

## Step 5.5: 触发 Evolver（条件性）

如果 Step 3 修改了项目文件（文档、脚本、linter——排除 `harness/` 内部文件）：

| 条件 | 操作 |
|------|------|
| 修改 ≥3 个项目文件 | `Skill(skill="harness-evolver", args="--mode auto --trigger-reason doctor-fix")` |
| 修改 0 个项目文件 | 跳过 |

> Doctor 修复可能使现有进化信号失效。Evolver 将重新扫描 episode 以适应。

---

## 子代理生成规则

生成子代理时（用于扫描或修复）：

1. **每个关注点一个子代理** — 不要将文档修复与脚本修复合并
2. **明确范围** — 告诉代理确切读取/修改哪些文件以及生成什么
3. **禁止操作** — 代理不得在其范围外创建文件
4. **每个子代理后验证** — 重新运行相关审计检查以确认修复有效
5. **最多重试 1 次** — 如果子代理修复在 1 次重试后失败，标记为需人工关注

---

## 参考文件

| 文件 | 步骤 | 内容 |
|------|------|------|
| `agents/architecture-analyzer.md` | 1.1 | 架构分析子代理提示词（层、imports、循环依赖） |
| `agents/component-analyzer.md` | 1.1 | 组件分析子代理提示词（接口、入口点、耦合） |
| `agents/environment-analyzer.md` | 1.1 | 环境分析子代理提示词（构建、依赖、环境变量、docker） |
| `references/audit-checklist.md` | 2 | 完整审计清单，含检查命令、通过标准、修复操作（第 1-7 节） |
| `references/gc-templates.md` | 2 | 过期文档检测、断链检查、接口漂移检测模板 |
| `$CREATOR_SKILL_DIR/scripts/create-scaffold.sh` | 3.1-3.2 | 骨架创建 + restore-fixed |
| `$CREATOR_SKILL_DIR/references/documentation-templates.md` | 3.4 | 生成缺失文档的文档模板 |
| `$CREATOR_SKILL_DIR/references/linter-templates.md` | 3.3 | 脚本修复的 linter 模板 |
| `$CREATOR_SKILL_DIR/references/environment-config-guide.md` | 3.5 | 环境配置模板 |
