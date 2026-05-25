# 审计检查清单

harness-doctor 第 2 步（AUDIT）的完整检查清单。每项检查包含命令、通过标准和修复操作。

> **数据来源**：所有 Tier 2 检查都与第 1 步的 `harness/.analysis/doctor-scan.json` 比较。审计期间不要重新扫描。

---

## 第 1 节：结构（Tier 1）

必需的文件和目录。如果缺失 → P0 修复（仅创建缺失文件 — Doctor 绝不能覆盖现有文件）。

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 1.1 | AGENTS.md 存在 | `test -f AGENTS.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.2 | docs/ 目录存在 | `test -d docs` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.3 | docs/ARCHITECTURE.md 存在 | `test -f docs/ARCHITECTURE.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.4 | docs/DEVELOPMENT.md 存在 | `test -f docs/DEVELOPMENT.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.5 | docs/PRODUCT_SENSE.md 存在 | `test -f docs/PRODUCT_SENSE.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.6 | docs/TESTING.md 存在 | `test -f docs/TESTING.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.7 | docs/OPERATIONS.md 存在 | `test -f docs/OPERATIONS.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.8 | docs/design-docs/ 目录存在 | `test -d docs/design-docs` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.9 | docs/design-docs/index.md 存在 | `test -f docs/design-docs/index.md` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.10 | scripts/ 目录存在 | `test -d scripts` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.11 | scripts/lint-deps.* 存在 | `ls scripts/lint-deps.* 2>/dev/null` | 至少 1 个文件 | P0: 创建缺失（跳过已有） |
| 1.12 | scripts/lint-quality.* 存在 | `ls scripts/lint-quality.* 2>/dev/null` | 至少 1 个文件 | P0: 创建缺失（跳过已有） |
| 1.13 | scripts/validate.py 存在 | `test -f scripts/validate.py` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.14 | Makefile 存在 | `test -f Makefile` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.15 | harness/ 目录存在 | `test -d harness` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.16 | harness/scripts/ 目录存在 | `test -d harness/scripts` | exit 0 | P0: 创建缺失（跳过已有） |
| 1.17 | harness/verify/ 目录存在 | `test -d harness/verify` | exit 0 | P0: 创建缺失（跳过已有） |

---

## 第 2 节：固定文件（Tier 1）

具有规范内容且开发者不得修改的文件。

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 2.1 | Makefile 包含所有必需目标 | `grep -c 'lint-arch\|lint\|build\|test\|verify\|setup-env\|start-server\|teardown-env' Makefile` | count >= 8 | P1: restore-fixed |
| 2.2 | validate.py 可执行 | `test -x scripts/validate.py` | exit 0 | P1: `chmod +x` |
| 2.3 | validate.py 有正确的 shebang | `head -1 scripts/validate.py \| grep -q python` | 匹配 | P1: restore-fixed |
| 2.4 | harness/verify/README.md 存在 | `test -f harness/verify/README.md` | exit 0 | P1: restore-fixed |

---

## 第 3 节：文档

### Tier 1 — 表面检查

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 3.1 | AGENTS.md 行数 | `wc -l < AGENTS.md` | 80-120 行 | P3: 3.4.5 大小修复 |
| 3.2 | AGENTS.md 包含架构章节 | `grep -q '## Architecture\|## arch\|layer' AGENTS.md` | 匹配 | P3: 添加章节 |
| 3.3 | ARCHITECTURE.md 包含层级表 | `grep -q '\| L[0-9]' docs/ARCHITECTURE.md` | 匹配 | P3: 添加表格 |
| 3.4 | ARCHITECTURE.md 包含 Mermaid 图 | `grep -q 'mermaid\|graph\|flowchart' docs/ARCHITECTURE.md` | 匹配 | P3: 添加图表 |
| 3.5 | DEVELOPMENT.md 包含构建命令 | `grep -qi 'build\|compile\|make' docs/DEVELOPMENT.md` | 匹配 | P3: 3.4.4 |
| 3.6 | DEVELOPMENT.md 包含测试命令 | `grep -qi 'test\|spec\|check' docs/DEVELOPMENT.md` | 匹配 | P3: 3.4.4 |
| 3.7 | design-docs/index.md 非空 | `test -s docs/design-docs/index.md` | 非空 | P3: 填充 |
| 3.8 | 所有文档链接有效 | `grep -roP '\[.*?\]\(((?!http)[^)]+)\)' docs/ \| ...` | 所有目标存在 | P3: 3.4.6 |
| 3.9 | PRODUCT_SENSE.md 非空 | `test -s docs/PRODUCT_SENSE.md` | 非空 | P3: 从扫描填充 |

### Tier 2 — 内容深度（与扫描数据比较）

| # | 检查 | 数据来源 | 通过标准 | 修复操作 |
|---|-------|-------------|---------------|------------|
| 3.10 | design-docs 覆盖所有核心组件 | `doctor-components.json` → 与 `ls docs/design-docs/` 比较 | 每个组件都有 .md 文件 | P3: 3.4.1 创建缺失 |
| 3.11 | index.md 列出所有设计文档 | `ls docs/design-docs/*.md` → 与 index.md 条目比较 | 每个 .md 文件都有索引条目 | P3: 更新 index.md |
| 3.12 | ARCHITECTURE.md 层级表覆盖所有包 | `doctor-architecture.json` 包 → 与层级表行比较 | 每个包都在层级行中 | P3: 3.4.2 添加行 |
| 3.13 | 层级分配与导入匹配 | `doctor-architecture.json` 每个包的层级 → 与 ARCHITECTURE.md 分配比较 | 层级匹配 | P3: 3.4.2 修正分配 |
| 3.14 | DEVELOPMENT.md 构建命令是当前 | `doctor-environment.json` build_command → 与 DEVELOPMENT.md 比较 | 命令匹配 | P3: 3.4.4 更新 |
| 3.15 | DEVELOPMENT.md 测试命令是当前 | `doctor-environment.json` test_command → 与 DEVELOPMENT.md 比较 | 命令匹配 | P3: 3.4.4 更新 |
| 3.16 | 所有 Makefile 目标已记录 | `doctor-environment.json` makefile_targets → 与 DEVELOPMENT.md 比较 | 所有目标都有提及 | P3: 3.4.4 添加 |
| 3.17 | Mermaid 图覆盖所有层级 | `doctor-architecture.json` 唯一层级 → 与 Mermaid 节点比较 | 所有层级都在图中 | P3: 3.4.2 更新图表 |
| 3.18 | PRODUCT_SENSE.md 覆盖所有组件 | `doctor-components.json` → 与 PRODUCT_SENSE.md 提及比较 | 所有组件都有提及 | P3: 3.4.7 添加 |
| 3.19 | 设计文档中的代码引用有效 | 对每个 design-docs 中的 `file:line` 或路径引用 → `test -f <path>` | 所有路径存在 | P3: 3.4.6 修正引用 |
| 3.20 | AGENTS.md 架构章节覆盖所有包 | `doctor-architecture.json` 包 → 与 AGENTS.md 层级表比较 | 所有包都已列出 | P3: 3.4.3 同步 |
| 3.21 | Mermaid classDiagram：关系行无 `class` 关键字 | `find docs -name '*.md' -exec grep -Pn '^\s*class\s+\w+\s+(\.\.>\|-->\|<\|\.\.|\*--\|o--)' {} +` | 无匹配 | P3: 3.4.8 去除 `class` 前缀 |
| 3.22 | Mermaid classDiagram：关系行使用有效语法 | 对每个 `classDiagram` 块，检查类定义后的所有行使用有效关系语法（`A ..> B`, `A <\|.. B`, `A --> B`, 等） | 全部有效 | P3: 3.4.8 修正语法 |
| 3.23 | Mermaid 块渲染无解析错误 | 对每个 `` ```mermaid `` 块，验证无已知错误模式（DOTTED_LINE 解析错误、未闭合括号、重复节点 ID） | 无已知错误 | P3: 3.4.8 修正 |

---

## 第 4 节：脚本（Tier 1 + Tier 2）

### Tier 1 — 表面

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 4.1 | lint-deps 可执行 | `test -x scripts/lint-deps.*` | exit 0 | P2: `chmod +x` |
| 4.2 | lint-quality 可执行 | `test -x scripts/lint-quality.*` | exit 0 | P2: `chmod +x` |
| 4.3 | 脚本中无硬编码绝对路径 | `grep -rn '^[^#]*/home/\|/Users/' scripts/ harness/scripts/` | 无匹配 | P2: 替换为相对路径 |
| 4.4 | 无未填充模板占位符 | `grep -rn '{{.*}}' scripts/ harness/scripts/ Makefile` | 无匹配 | P4: 从扫描填充 |

### Tier 2 — 内容深度

| # | 检查 | 数据来源 | 通过标准 | 修复操作 |
|---|-------|-------------|---------------|------------|
| 4.5 | LAYER_MAP 覆盖所有包 | `/tmp/doctor-actual-packages.txt` → 与 LAYER_MAP 条目比较 | 每个包都在 LAYER_MAP 中 | P2: 添加缺失 |
| 4.6 | LAYER_MAP 无幻影包 | LAYER_MAP 条目 → 与 `/tmp/doctor-actual-packages.txt` 比较 | 无没有匹配包的 LAYER_MAP 条目 | P2: 移除幻影 |
| 4.7 | LAYER_MAP 层级分配与导入匹配 | `doctor-architecture.json` 每个包的层级 → 与 LAYER_MAP 比较 | 层级匹配 | P2: 修正层级 |
| 4.8 | Harness 脚本与项目匹配 | `doctor-environment.json` 构建/测试命令 → 与 harness/scripts/*.sh 比较 | 命令匹配 | P4: 更新脚本 |

---

## 第 5 节：配置（Tier 1 + Tier 2）

### Tier 1 — 表面

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 5.1 | harness/environment.json 存在 | `test -f harness/environment.json` | exit 0 | P4: 从扫描创建 |
| 5.2 | environment.json 是有效 JSON | `python3 -c "import json; json.load(open('harness/environment.json'))"` | exit 0 | P4: 修正 JSON |
| 5.3 | 无硬编码密钥 | `grep -rn 'password=\|secret=\|token=' harness/ --include='*.json' --include='*.sh'` | 无匹配（排除 ${VAR} 模式） | P4: 替换为 ${VAR} |

### Tier 2 — 内容深度

| # | 检查 | 数据来源 | 通过标准 | 修复操作 |
|---|-------|-------------|---------------|------------|
| 5.4 | environment.json 服务与实际依赖匹配 | `doctor-environment.json` external_deps → 与 environment.json 服务比较 | 所有检测到的依赖都存在 | P4: 添加缺失 |
| 5.5 | environment.json 环境变量与扫描匹配 | `doctor-environment.json` env_vars_referenced → 与 environment.json 比较 | 所有变量都存在 | P4: 添加缺失 |
| 5.6 | Docker 服务与实际依赖匹配 | `doctor-environment.json` docker_services → 与 environment.json 比较 | 一致 | P4: 同步 |

---

## 第 6 节：跨文件一致性（Tier 2）

这些检查验证多个文件中的数据是否一致。

| # | 检查 | 比较的文件 | 通过标准 | 修复操作 |
|---|-------|----------------|---------------|------------|
| 6.1 | 层级分配一致：lint-deps vs ARCHITECTURE.md | `scripts/lint-deps.*` LAYER_MAP vs `docs/ARCHITECTURE.md` 层级表 | 相同包、相同层级 | P5: 从 lint-deps 同步 |
| 6.2 | 层级分配一致：lint-deps vs AGENTS.md | `scripts/lint-deps.*` LAYER_MAP vs `AGENTS.md` 架构章节 | 相同包、相同层级 | P5: 从 lint-deps 同步 |
| 6.3 | 构建命令一致：Makefile vs DEVELOPMENT.md vs harness 脚本 | `Makefile` 目标 vs `docs/DEVELOPMENT.md` 命令 vs `harness/scripts/*.sh` | 所有引用相同命令 | P5: 从 Makefile 同步（基准事实） |

---

## 第 7 节：Skill 脚本健康（Tier 1 + Tier 2）

检查所有已安装 skill 脚本的编译错误和常见运行时缺陷。

> **范围**：遍历 `$PROJECT_ROOT/.qoder/skills/*/scripts/` — 覆盖 executor、evolver、doctor 和任何其他已安装的 skill。

### Tier 1 — 编译与语法

| # | 检查 | 命令 | 通过标准 | 修复操作 |
|---|-------|---------|---------------|------------|
| 7.1 | 所有 .py 脚本可编译 | `python3 -m py_compile <file>` 对每个 skill `scripts/` 中的 .py | 全部 exit 0 | P2: 报告语法错误位置，标记为手动修复 |
| 7.2 | 所有 .sh 脚本有有效语法 | `bash -n <file>` 对每个 skill `scripts/` 中的 .sh | 全部 exit 0 | P2: 报告语法错误，标记为手动修复 |
| 7.3 | 所有 .py 脚本有正确的 shebang | `head -1 <file> \| grep -q python` | 全部匹配 | P2: 前置 `#!/usr/bin/env python3` |

### Tier 2 — 常见运行时缺陷

| # | 检查 | 检测方法 | 通过标准 | 修复操作 |
|---|-------|-----------------|---------------|------------|
| 7.4 | print() 中无错位关键字参数 | `grep -nP 'print\(.*\),\s*[a-z_]+=' <file>` 排除有效的 print 关键字参数（`end=`/`sep=`/`file=`/`flush=`） | 无匹配 | P2: 将关键字参数移到前一个函数调用的括号内 |
| 7.5 | 所有 json.dumps 包含 ensure_ascii=False | 对每个 `json.dumps(` 调用，检查是否包含 `ensure_ascii=False` | 所有调用都包含 | P2: 添加 `ensure_ascii=False` 参数 |
| 7.6 | 无裸 except 子句 | `grep -n 'except:$' <file>` | 无匹配（应使用 `except Exception:`） | P2: 替换为 `except Exception:` |

---

## 评分

运行所有检查后，计算：

```
总检查数:     {所有项之和}
Tier 1 检查:  {第 1 节 + 第 2 节 + 第 3 节 Tier1 + 第 4 节 Tier1 + 第 5 节 Tier1 + 第 7 节 Tier1}
Tier 2 检查:  {第 3 节 Tier2 + 第 4 节 Tier2 + 第 5 节 Tier2 + 第 6 节 + 第 7 节 Tier2}
通过:         {通过计数}
失败:         {失败计数}
警告:         {警告计数}
健康分:       {通过 / 总数 * 100}%
```

健康的 harness 应得分 >= 90%。低于 70% 表示与实际代码有显著漂移。
