# 脚手架模板 —— 确定性项目结构

harness-creator 初始化的每个项目必须产生这个确切的目录结构。无添加，无遗漏。

## 理念

脚手架是**确定性的**——每个项目得到相同的骨架。只有文件内部的内容根据分析变化。这消除了不一致性的头号来源：代理决定创建什么。

- **固定**：目录树、文件名、脚本入口签名、Makefile 目标名称、validate.py
- **参数化**：技术栈命令、层映射内容、环境变量、验证/场景
- **骨架 + 填充**：Shell 脚本有固定结构，带 `{{PARAM}}` 占位符

---

## 必需目录结构

```
project-root/
├── AGENTS.md                          # 导航地图（80-120 行硬限制）
├── docs/
│   ├── ARCHITECTURE.md                # 层次结构、依赖规则、Mermaid 图表
│   ├── DEVELOPMENT.md                 # 构建/测试/lint 命令、前置条件
│   ├── PRODUCT_SENSE.md               # 业务上下文 —— 产品做什么以及为什么
│   ├── api.md                         # [Web 应用] API 接口文档（条件生成）
│   └── design-docs/
│       └── index.md                   # 组件设计文档索引
├── scripts/
│   ├── lint-deps.{ext}               # 层边界强制执行 linter
│   ├── lint-quality.{ext}            # 代码质量规则 linter
│   ├── validate.py                   # 统一验证流水线（固定 —— 所有项目相同）
│   ├── generate-api-doc.sh           # [Web 应用] API 文档生成脚本（条件生成）
│   ├── check-db-consistency.sh        # [Web 应用+DB] DDL/Entity 一致性检查（条件生成）
│   ├── run-api-tests.sh              # [Web 应用] API 接口测试脚本（条件生成）
│   ├── code-review-check.sh          # [Web 应用] 编码规范检查脚本（条件生成）
│   ├── mutation-spot-check.sh        # [Web 应用] 变异测试突击检查（条件生成）
│   └── verify/                       # 端到端功能验证脚本
│       └── README.md                 # 如何添加验证场景
├── pmd-ruleset.xml                   # [Java+Web] PMD 规则集（条件生成）
├── harness/
│   ├── .analysis/                    # 阶段 2 的临时分析结果
│   ├── config/
│   │   └── environment.json          # 运行时生态系统契约（v2.0 模式）
│   ├── scripts/
│   │   ├── setup-env.sh              # 启动外部依赖
│   │   ├── start-server.sh           # 启动应用程序服务器
│   │   └── teardown-env.sh           # 停止和清理
│   ├── tasks/                        # 任务状态和检查点（执行器使用此目录）
│   ├── trace/                        # 执行跟踪
│   │   └── failures/                 # 结构化失败记录（供 Critic 分析）
│   └── memory/
│       ├── episodes/                 # 情景记忆 —— 特定事件和经验教训
│       └── knowledge/                # 语义记忆 —— 项目特定事实
└── Makefile                          # 标准构建目标
```

> **条件文件说明**：标记为 `[Web 应用]` 或 `[Web 应用+DB]` 的文件仅在 `web-app-detection-guide.md` 检测到 Web 应用时生成。标记为 `[Java+Web]` 的文件仅在 Java Web 应用时生成。非 Web 项目不会创建这些文件。

---

## 版本控制 —— .gitignore 规则

> **设计原则**：harness-creator 生成的产物是**项目资产**，默认应**提交入库**由团队共享。仅极少量运行时中间产物（如临时分析、本地任务符号链接、Skill 补丁备份）需要排除。

### 需要入库（项目资产，默认 commit）

| 路径 | 原因 |
|------|------|
| `AGENTS.md` | AI 代理导航地图，团队共享的项目入口 |
| `docs/` | 架构、开发、设计文档、执行规格——项目知识资产 |
| `scripts/` | Linter、验证脚本——项目质量门禁 |
| `Makefile` | 构建自动化入口 |
| `harness/config/` | 环境、项目配置 |
| `harness/scripts/` | 环境启动/拆除脚本 |
| `harness/memory/` | 情景记忆、项目知识——团队共享的经验作为 Evolver 的燃料 |
| `harness/drafts/skills/` | Nudge 草稿——需人工 review |
| `harness/trace/{failures,improvements,critic-report}` | 失败记录、改进记录——进化证据链 |

### 需要忽略（仅运行时中间产物）

| 模式 | 原因 |
|------|------|
| `harness/.analysis/` | 临时分析输出，每次运行重生成 |
| `harness/tasks/current` | 本地任务符号链接（开发者独享） |
| `harness/trace/skill-backups/` | Skill 补丁前本地备份（体积大、本地独享） |

**行为**：脚本在存在的 `.gitignore` 中追加运行时排除规则（幂等，不重复）；不存在时创建新文件。检测到旧版「全目录排除」块时产生警告，提示手工清理。

> **与本 fork 仓库的区别**：本 fork 仓库是 Skill **源码定义仓**，不包含实例化产物；被服务的目标项目是 Skill 的**调用仓**，需入库产物作为项目资产共享。

---

## 固定文件模板

### AGENTS.md（80-120 行）

导航地图。不是手册。必须保持在 80-120 行内。详细内容放在 `docs/` 中。

```markdown
# {Project Name}

> {一句话项目描述}

## 快速开始
- 构建：`{build_command}`
- 测试：`{test_command}`
- Lint：`make lint-arch`

## 架构
| 层 | 包 | 用途 |
|-------|----------|---------|
| L0 | {types_packages} | 类型定义 —— 无内部导入 |
| L1 | {utils_packages} | 工具 —— 仅依赖 L0 |
| L2 | {core_packages} | 业务逻辑 —— 依赖 L0-L1 |
| L3 | {handler_packages} | 入口点 —— 依赖 L0-L2 |

→ 详情：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 文档
| 文档 | 用途 |
|-----|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 层规则、依赖图 |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | 构建、测试、lint 命令 |
| [PRODUCT_SENSE.md](docs/PRODUCT_SENSE.md) | 业务上下文 |
| [design-docs/](docs/design-docs/) | 组件设计文档 |

## 开发命令
```bash
make build          # 构建项目
make test           # 运行测试
make lint-arch      # 架构 lint（层边界 + 质量）
make lint           # 所有 lint 包括外部工具
python3 scripts/validate.py .   # 完整验证流水线
```

## 关键目录
| 目录 | 用途 |
|-----------|---------|
| {source_dir}/ | 应用程序源代码 |
| scripts/ | Linter 和验证工具 |
| harness/ | 代理基础设施（任务、内存、跟踪） |
| docs/exec-specs/ | 结构化规格（[活跃](docs/exec-specs/) / [已完成](docs/exec-specs/completed/)） |

## Harness Skills

七个 harness skill 的快速参考：

| Skill | 用途 | 何时使用 |
|-------|---------|-------------|
| harness-creator | 初始化/升级 harness 基础设施 | 新项目或重大重构 |
| harness-spec | 生成执行规格 | 需要规划的复杂功能 |
| harness-executor | 执行带验证的规格 | 规格驱动的开发任务 |
| harness-recorder | 记录任务结果和经验教训 | 每个任务完成时 |
| harness-evolver | 基于记录的数据进化 skill | 定期改进周期 |
| harness-doctor | 审计和修复 harness 健康 | 当检测到问题时 |
| harness-upgrader | 升级已安装项目到新版 Skill | Skill 版本更新时 |

→ 参见 [架构](docs/ARCHITECTURE.md) 获取生命周期详情。

## 规则
- 层 N 只能从层 < N 导入
- 所有新文件在第一天必须 lint 干净
- 仅结构化日志（无原始 print/log 调用）
- 单个文件 ≤ 500 行

## 开发工作流

| 任务复杂度 | 工作流 | 要求 |
|----------------|----------|-------------|
| **复杂**（多文件、新功能、架构变更） | `harness-spec` → `harness-executor` → `harness-recorder` | **必需** —— 编码前必须生成规格 |
| **标准**（中等变更、有副作用的 bug 修复） | `harness-spec` → `harness-executor` → `harness-recorder` | **推荐** —— 规格提高清晰度和验证 |
| **简单**（拼写错误、配置调整、单行修复） | 直接对话（CDD） | **可选** —— 快速变更可接受 |

> **如何启动 SDD 工作流**：使用任务描述 `Skill(skill="harness-spec")`
>
> **CDD 模式**：对于简单任务，直接对话可接受。记录器将自动检测并适应。
>
> → 参见 [架构](docs/ARCHITECTURE.md) 获取 SDD vs CDD 生命周期详情。
```

**参数化部分**：`{build_command}`, `{test_command}`, `{types_packages}`, `{source_dir}`, 等。

### docs/PRODUCT_SENSE.md

```markdown
# Product Sense

## What This Product Does
{一段从用户角度描述产品}

## Who Uses It
{目标用户及其目标}

## Core User Journeys
1. {旅程 1}：{简要描述}
2. {旅程 2}：{简要描述}
3. {旅程 3}：{简要描述}

## Business Rules
- {规则 1}
- {规则 2}

## Domain Terminology
| 术语 | 含义 |
|------|------|
| {term} | {definition} |
```

### scripts/validate.py（固定 —— 所有项目相同）

```python
#!/usr/bin/env python3
"""统一验证流水线：构建 → lint-arch → 测试 → 验证。

此脚本按顺序运行所有验证步骤。每个步骤仅当
前一步通过时才运行。这是"此代码是否有效？"的单一入口点。

用法：
    python3 scripts/validate.py .
    python3 scripts/validate.py . --skip-verify   # 跳过端到端验证
"""
import subprocess
import sys
import os

def run_step(name, command, cwd="."):
    """运行验证步骤并返回成功。"""
    print(f"\n{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}\n")
    result = subprocess.run(command, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"\n✗ {name} FAILED (exit code {result.returncode})")
        return False
    print(f"\n✓ {name} PASSED")
    return True

def main():
    project_root = sys.argv[1] if len(sys.argv) > 1 else "."
    skip_verify = "--skip-verify" in sys.argv

    # 从 docs/DEVELOPMENT.md 或 Makefile 读取命令
    steps = [
        ("构建", "make build"),
        ("Lint 架构", "make lint-arch"),
        ("测试", "make test"),
    ]

    if not skip_verify and os.path.isdir(os.path.join(project_root, "scripts/verify")):
        steps.append(("验证（端到端）", "make verify"))

    passed = 0
    failed = 0
    for name, cmd in steps:
        if run_step(name, cmd, cwd=project_root):
            passed += 1
        else:
            failed += 1
            print(f"\n⚠ 停止：{name} 失败。在继续之前修复此问题。")
            sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  所有 {passed} 个验证步骤通过 ✓")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
```

### scripts/verify/README.md（固定）

```markdown
# 端到端验证脚本

此目录包含从用户视角测试应用程序的功能验证脚本（不是单元测试）。

## 如何添加场景

1. 创建脚本：`verify/{scenario-name}.sh` 或 `verify/{scenario-name}.py`
2. 脚本应该：
   - 启动应用程序（或假设它正在运行）
   - 执行用户可见的操作
   - 验证结果
   - 成功退出 0，失败非零
3. 将其添加到 Makefile `verify` 目标

## 示例

```bash
#!/bin/bash
# verify/health-check.sh
curl -sf http://localhost:${PORT:-8080}/health | grep -q '"status":"ok"'
```
```

### Makefile（标准目标 + Web 应用条件目标）

```makefile
.PHONY: build test lint-arch lint verify api-doc check-db api-test mutation-test

build:
	{build_command}

test:
	{test_command}

lint-arch:
	{lint_deps_command}
	{lint_quality_command}

lint: lint-arch
	{external_lint_command}

verify:
	@echo "运行端到端验证..."
	@for f in scripts/verify/*.sh; do \
		echo "→ $$f"; \
		bash "$$f" || exit 1; \
	done
	@echo "✓ 所有验证场景通过"

setup-env:
	./harness/scripts/setup-env.sh

start-server:
	./harness/scripts/start-server.sh

teardown-env:
	./harness/scripts/teardown-env.sh

# ====== Web 应用条件目标 ======
# 以下目标仅在 Web 应用项目中有效
# 非 Web 项目可安全忽略（make 会跳过不存在的脚本）

api-doc: ## 生成/更新 API 接口文档 (docs/api.md)
	@if [ -f scripts/generate-api-doc.sh ]; then \
		bash scripts/generate-api-doc.sh; \
	else \
		echo "跳过: 非 Web 应用项目"; \
	fi

check-db: ## DDL/Entity 一致性检查
	@if [ -f scripts/check-db-consistency.sh ]; then \
		bash scripts/check-db-consistency.sh; \
	else \
		echo "跳过: 无数据库依赖"; \
	fi

api-test: ## 运行 API 接口测试
	@if [ -f scripts/run-api-tests.sh ]; then \
		bash scripts/run-api-tests.sh; \
	else \
		echo "跳过: 非 Web 应用项目"; \
	fi

mutation-test: ## 变异测试突击检查
	@if [ -f scripts/mutation-spot-check.sh ]; then \
		bash scripts/mutation-spot-check.sh {mutation_target_classes}; \
	else \
		echo "跳过: 未配置变异测试"; \
	fi

check-conventions: ## 编码规范检查
	@if [ -f scripts/code-review-check.sh ]; then \
		bash scripts/code-review-check.sh; \
	else \
		echo "跳过: 未配置编码规范检查"; \
	fi
```

**参数化**：`{build_command}`, `{test_command}`, `{lint_deps_command}`, `{lint_quality_command}`, `{external_lint_command}`, `{mutation_target_classes}`

**固定字段**：`api-doc`, `check-db`, `api-test`, `mutation-test`, `check-conventions` 目标的脚本存在性检查模式

> **Web 应用 target 设计原则**：每个条件目标都使用 `if [ -f scripts/xxx.sh ]` 做存在性检查，确保非 Web 项目执行 `make api-doc` 等命令时不会报错，而是输出 "跳过" 信息。

---

## 配置文件骨架

### harness/config/environment.json

运行时生态系统契约。所有字段都是参数化的，除了 `skills.enabled` 和 `skills.version` 是固定的。

```json
{
  "runtime": {
    "language": "{{LANGUAGE}}",
    "version": "{{VERSION}}",
    "package_manager": "{{PACKAGE_MANAGER}}"
  },
  "startup": {
    "build_command": "{{BUILD_COMMAND}}",
    "start_command": "{{START_COMMAND}}",
    "health_endpoint": "{{HEALTH_ENDPOINT}}"
  },
  "services": {
    "{{SERVICE_NAME}}": {
      "type": "{{SERVICE_TYPE}}",
      "image": "{{SERVICE_IMAGE}}",
      "port": {{SERVICE_PORT}},
      "env": {
        "{{ENV_KEY}}": "{{ENV_VALUE}}"
      }
    }
  },
  "env_vars": {
    "{{ENV_NAME}}": {
      "default": "{{DEFAULT_VALUE}}",
      "required": {{REQUIRED}},
      "description": "{{DESCRIPTION}}"
    }
  },
  "skills": {
    "enabled": [
      "harness-creator",
      "harness-spec",
      "harness-executor",
      "harness-recorder",
      "harness-evolver",
      "harness-doctor",
      "harness-upgrader"
    ],
    "version": "2.1"
  },
  "functional_scenarios": {
    "{{SCENARIO_NAME}}": {
      "description": "{{SCENARIO_DESCRIPTION}}",
      "verify_script": "scripts/verify/{{SCENARIO_SCRIPT}}",
      "prerequisites": ["{{PREREQ}}"]
    }
  }
}
```

**固定字段**：`skills.enabled`（所有七个 skills），`skills.version`（"2.1"）
**参数化**：`{{LANGUAGE}}`, `{{VERSION}}`, `{{SERVICE_NAME}}`, `{{SCENARIO_NAME}}`, 等。

---

## Shell 脚本骨架

Shell 脚本有**固定骨架** —— 只有 `{{PARAM}}` 部分由配置代理填充。

### harness/scripts/setup-env.sh

```bash
#!/bin/bash
set -euo pipefail
echo "=== 设置环境 ==="

# --- BEGIN PARAMETERIZED ---
# {{SERVICES}}：每个服务一个 docker run 块
# 示例：
#   docker run -d --name harness-postgres -p 5432:5432 -e POSTGRES_PASSWORD=testpass postgres:16
# {{WAIT_CHECKS}}：每个服务一个就绪检查
# 示例：
#   until docker exec harness-postgres pg_isready 2>/dev/null; do sleep 1; done
# --- END PARAMETERIZED ---

echo "✓ 环境就绪"
```

### harness/scripts/start-server.sh

```bash
#!/bin/bash
set -euo pipefail

# --- BEGIN PARAMETERIZED ---
# {{ENV_EXPORTS}}：测试模式的环境变量
# 示例：
#   export PORT=8081
#   export DATABASE_URL="postgres://postgres:testpass@localhost:5432/testdb?sslmode=disable"
#   export ENV=test
# {{START_COMMAND}}：如何在后台启动服务器
# 示例：
#   go run cmd/api/main.go &
# --- END PARAMETERIZED ---

SERVER_PID=$!

# 等待服务器就绪（固定逻辑）
for i in $(seq 1 30); do
  # --- {{HEALTH_CHECK_URL}}：例如 http://localhost:$PORT/health ---
  if curl -s "${HEALTH_CHECK_URL:-http://localhost:8080/health}" > /dev/null 2>&1; then
    echo "✓ 服务器就绪 (PID: $SERVER_PID)"
    exit 0
  fi
  sleep 1
done

echo "✗ 服务器在 30 秒内未能启动"
exit 1
```

### harness/scripts/teardown-env.sh

```bash
#!/bin/bash
set -euo pipefail

# --- BEGIN PARAMETERIZED ---
# {{STOP_COMMANDS}}：停止 setup-env.sh 启动的每个服务
# 示例：
#   docker stop harness-postgres 2>/dev/null || true
#   docker rm harness-postgres 2>/dev/null || true
# --- END PARAMETERIZED ---

# 终止任何剩余的服务器进程（固定逻辑）
pkill -f "start-server" 2>/dev/null || true

echo "✓ 已清理"
```

---

## 创建协议

在阶段 4 步骤 0 期间，协调器必须：

1. 使用 `mkdir -p` 创建所有目录
2. 逐字复制所有固定文件（validate.py, verify/README.md）
3. 创建所有带 `{{PARAM}}` 标记的骨架文件
4. **然后** 生成子代理来填充参数化部分

子代理接收一个**允许的文件**列表和**禁止的操作**。它们不能创建额外的文件或修改目录结构。

## 验证检查清单（阶段 5）

### 正向检查 —— 所有必需文件存在：
```bash
required_files=(
  "AGENTS.md"
  "docs/ARCHITECTURE.md"
  "docs/DEVELOPMENT.md"
  "docs/PRODUCT_SENSE.md"
  "docs/design-docs/index.md"
  "scripts/validate.py"
  "scripts/verify/README.md"
  "harness/config/environment.json"
  "harness/scripts/setup-env.sh"
  "harness/scripts/start-server.sh"
  "harness/scripts/teardown-env.sh"
  "Makefile"
)

for f in "${required_files[@]}"; do
  test -f "$f" || echo "缺失: $f"
done
```

### AGENTS.md 大小检查：
```bash
lines=$(wc -l < AGENTS.md)
if [ "$lines" -gt 120 ]; then echo "错误: AGENTS.md 太长 ($lines 行, 最大 120)"; fi
if [ "$lines" -lt 80 ]; then echo "警告: AGENTS.md 太短 ($lines 行, 最小 80)"; fi
```

### Lint 脚本可执行：
```bash
test -x scripts/lint-deps.* || echo "错误: lint-deps 不可执行"
test -x scripts/lint-quality.* || echo "错误: lint-quality 不可执行"
```

### 无未填充的模板标记：
```bash
grep -r '{{' scripts/ harness/scripts/ 2>/dev/null && echo "错误: 发现未填充的 {{PARAM}} 标记"
```

### Web 应用条件文件检查（仅在检测到 Web 应用时）：
```bash
# 读取 Web 应用检测结果
if [ -f harness/.analysis/web-app-detection.json ]; then
  IS_WEB_APP=$(python3 -c "import json; print(json.load(open('harness/.analysis/web-app-detection.json')).get('is_web_app', False))")
  if [ "$IS_WEB_APP" = "True" ]; then
    echo "检测到 Web 应用，验证条件文件..."
    test -f docs/api.md || echo "缺失 Web 应用文件: docs/api.md"
    test -f scripts/generate-api-doc.sh || echo "缺失 Web 应用文件: scripts/generate-api-doc.sh"
    test -f scripts/run-api-tests.sh || echo "缺失 Web 应用文件: scripts/run-api-tests.sh"
    test -f scripts/code-review-check.sh || echo "缺失 Web 应用文件: scripts/code-review-check.sh"

    # 数据库相关文件
    HAS_DB=$(python3 -c "import json; print(json.load(open('harness/.analysis/web-app-detection.json')).get('database',{}).get('detected',False))")
    HAS_ORM=$(python3 -c "import json; print(json.load(open('harness/.analysis/web-app-detection.json')).get('orm',{}).get('detected',False))")
    if [ "$HAS_DB" = "True" ] && [ "$HAS_ORM" = "True" ]; then
      test -f scripts/check-db-consistency.sh || echo "缺失 Web 应用+DB 文件: scripts/check-db-consistency.sh"
    fi

    # Java 特有文件
    TECH=$(python3 -c "import json; print(json.load(open('harness/.analysis/web-app-detection.json')).get('language',''))")
    if [ "$TECH" = "java" ]; then
      test -f pmd-ruleset.xml || echo "缺失 Java+Web 文件: pmd-ruleset.xml"
    fi

    # Makefile Web 应用 target
    grep -q 'api-doc:' Makefile || echo "缺失 Makefile target: api-doc"
    grep -q 'check-db:' Makefile || echo "缺失 Makefile target: check-db"
    grep -q 'api-test:' Makefile || echo "缺失 Makefile target: api-test"
    grep -q 'mutation-test:' Makefile || echo "缺失 Makefile target: mutation-test"
    grep -q 'check-conventions:' Makefile || echo "缺失 Makefile target: check-conventions"
  fi
fi
```
