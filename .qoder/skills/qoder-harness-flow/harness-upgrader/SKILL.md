---
name: harness-upgrader
description: "将新版 Harness Skill 部署到已安装旧版本的目标项目，自动检测版本差异、部署新 Skill 源码、触发 Doctor 修正结构漂移、填充新创建模板的实际内容、校准进化水位线。一键升级——安全无覆盖。"
---

# Harness Upgrader

将新版 Harness Skill 升级部署到已安装旧版本的目标项目，并自动修正因版本差异导致的结构漂移。

> **核心哲学**："Skill 源码是无状态的模板，直接覆盖更新；harness 运行时数据是有状态的项目资产，由 Doctor 基于代码库真实状态安全修正。"

> **安全原则**：升级绝不覆盖项目定制内容。Doctor 的 `--missing-only` 和 `--restore-fixed` 双模式确保只补全缺失、只恢复规范基线。

## 脚本执行

本 Skill 在 `scripts/` 子目录中捆绑了辅助脚本。在运行任何脚本之前，从本 SKILL.md 文件的路径确定本 Skill 的安装目录，并设置：

```bash
SKILL_DIR="<directory containing this SKILL.md>"
```

然后以如下方式调用脚本：`bash "$SKILL_DIR/scripts/xxx.sh"`。以下所有 bash 示例均假设 `SKILL_DIR` 已按此方式设置。

---

## 适用场景

| 场景 | 触发条件 |
|------|----------|
| 手动升级 | 用户调用 `Skill("harness-upgrader")` |
| 版本检查 | 用户想了解当前项目安装的 Skill 版本 |

> **不适用**：全新项目安装（应使用 `harness-creator`），项目结构诊断修复（应直接使用 `harness-doctor`）。

---

## 变量

| 变量 | 含义 | 来源 |
|------|------|------|
| `$PROJECT_ROOT` | 目标项目根目录 | 当前工作目录 |
| `$SKILL_DIR` | 本 Skill（harness-upgrader）的安装目录 | SKILL.md 路径 |
| `$CREATOR_SKILL_DIR` | harness-creator Skill 目录 | `.qoder/skills/harness-creator` |
| `$SOURCE_SKILLS_DIR` | 新版 Skill 源码所在目录 | 用户指定或本仓库 |

---

## 执行流程

```
UPGRADER
═══════════════════════════════════════════════════════
 1. DETECT     检测目标项目当前 Harness 状态
 2. PREPARE    确认升级来源、预检安全性
 3. DEPLOY     部署新版 Skill 源码到 .qoder/skills/
 4. DOCTOR     触发 Doctor 修正结构漂移
 4.5 FILL      填充新创建模板的实际项目内容
 5. EVOLVER    条件性触发 Evolver 校准水位线
 6. REPORT     输出升级报告
═══════════════════════════════════════════════════════
```

---

## Step 1: DETECT — 检测当前 Harness 状态

**目标**：了解目标项目的 Harness 安装状态，判断是否可以升级。

### 1.1 检测项目根目录

验证当前目录是有效的项目根（存在 `.git/` 或其他项目标识）。

### 1.2 检测已安装 Skill

```bash
SKILL_BASE="$PROJECT_ROOT/.qoder/skills"
if [ -d "$SKILL_BASE" ]; then
  echo "已安装 Skill："
  ls -1 "$SKILL_BASE"/*/SKILL.md 2>/dev/null | while read f; do
    skill_dir=$(dirname "$f")
    skill_name=$(basename "$skill_dir")
    echo "  - $skill_name"
  done
else
  echo "未检测到已安装 Skill，建议使用 harness-creator 进行初始安装"
fi
```

### 1.3 读取当前版本

从 `harness/config/environment.json` 读取 `skills.version`（如存在）：

```bash
if [ -f "$PROJECT_ROOT/harness/config/environment.json" ]; then
  CURRENT_VERSION=$(python3 -c "
import json, sys
try:
    data = json.load(open('$PROJECT_ROOT/harness/config/environment.json'))
    print(data.get('skills', {}).get('version', 'unknown'))
except: print('unknown')
")
  echo "当前 Harness Skill 版本: $CURRENT_VERSION"
else
  echo "未找到 environment.json，可能为早期版本"
  CURRENT_VERSION="unknown"
fi
```

### 1.4 读取新版 Skill 版本

从源目录的 `harness-creator/references/scaffold-template.md` 或 `environment.json` 模板中提取新版版本号。

### 1.5 决策：继续或退出

| 状态 | 操作 |
|------|------|
| 已安装旧版 Skill → 检测到版本差异 | 继续到 Step 2 |
| 已安装同版 Skill → 无版本差异 | 提示用户"已是最新版"，询问是否强制重新部署 |
| 未安装任何 Skill | 建议使用 `harness-creator`，退出 |
| 项目无 `harness/` 目录 | 建议使用 `harness-creator`，退出 |

---

## Step 2: PREPARE — 确认升级来源与安全性

**目标**：确认新版 Skill 源码的位置，确保升级安全。

### 2.1 定位新版 Skill 源码

查找包含必需 Skill 目录的源路径：

```bash
# 优先级 1：用户指定的源路径
SOURCE_SKILLS_DIR="${SOURCE_SKILLS_DIR:-}"

# 优先级 2：本仓库（harness-upgrader 所在的 qoder-harness-flow 仓库根）
if [ -z "$SOURCE_SKILLS_DIR" ]; then
  REPO_ROOT=$(cd "$SKILL_DIR/.." && pwd)
  if [ -f "$REPO_ROOT/harness-creator/SKILL.md" ]; then
    SOURCE_SKILLS_DIR="$REPO_ROOT"
  fi
fi

# 验证源路径包含必需 Skill
REQUIRED_SKILLS="harness-creator harness-doctor harness-executor harness-evolver harness-recorder harness-spec harness-upgrader"
MISSING_SKILLS=""
for s in $REQUIRED_SKILLS; do
  [ -f "$SOURCE_SKILLS_DIR/$s/SKILL.md" ] || MISSING_SKILLS="$MISSING_SKILLS $s"
done
if [ -n "$MISSING_SKILLS" ]; then
  echo "错误：源目录缺少 Skill:$MISSING_SKILLS"
  exit 1
fi
```

### 2.2 预检安全性

> ⛔ **阻塞**：升级前目标项目必须处于干净状态，确保 Doctor 修复可追溯。

```bash
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]; then
  echo "错误：检测到未提交的更改。升级前请先执行 'git commit' 或 'git stash'。"
  exit 1
fi
```

### 2.3 用户确认

使用 AskUserQuestion 确认升级计划：

```
升级计划：
- 源版本：{NEW_VERSION}
- 目标版本：{CURRENT_VERSION}
- 目标项目：{PROJECT_ROOT}
- 部署范围：7 个 Skill（creator/doctor/executor/evolver/recorder/spec/upgrader）
- 修正范围：Doctor 自动修复 P0-P5 结构漂移

确认升级？
```

选项：确认升级 / 先查看差异 / 取消

---

## Step 3: DEPLOY — 部署新版 Skill 源码

**目标**：将新版 Skill 源码部署到目标项目的 `.qoder/skills/` 目录。

> **安全说明**：Skill 源码（SKILL.md + agents + references + scripts）是无状态的模板，直接覆盖不影响项目运行时数据。项目运行时数据在 `harness/` 目录下，不会被触碰。

### 3.1 备份旧版 Skill（可选）

```bash
BACKUP_DIR="$PROJECT_ROOT/harness/trace/skill-backups/pre-upgrade-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
if [ -d "$SKILL_BASE" ]; then
  cp -r "$SKILL_BASE" "$BACKUP_DIR/skills"
  echo "✓ 旧版 Skill 已备份到 $BACKUP_DIR"
fi
```

### 3.2 执行部署

使用 `deploy.sh` 脚本进行确定性部署：

```bash
bash "$SKILL_DIR/scripts/deploy.sh" \
  --source "$SOURCE_SKILLS_DIR" \
  --target "$PROJECT_ROOT/.qoder/skills"
```

脚本行为：
1. 创建 `.qoder/skills/` 目录（如不存在）
2. 对每个 Skill 目录执行 `rsync` 或 `cp -r` 覆盖
3. 验证每个部署的 Skill 包含 `SKILL.md`
4. 设置脚本可执行权限（`chmod +x scripts/*.sh scripts/*.py`）

### 3.3 更新版本号

更新 `harness/config/environment.json` 中的 `skills.version`：

```bash
python3 -c "
import json
path = '$PROJECT_ROOT/harness/config/environment.json'
data = json.load(open(path))
if 'skills' not in data:
    data['skills'] = {}
data['skills']['version'] = '$NEW_VERSION'
data['skills']['enabled'] = [
    'harness-creator', 'harness-spec', 'harness-executor',
    'harness-recorder', 'harness-evolver', 'harness-doctor',
    'harness-upgrader'
]
json.dump(data, open(path, 'w'), indent=2, ensure_ascii=False)
print('✓ 版本号已更新为 $NEW_VERSION')
"
```

### 3.4 验证部署

```bash
# 检查所有 Skill 的 SKILL.md 存在且可读
DEPLOY_OK=true
for skill in $REQUIRED_SKILLS; do
  if [ ! -f "$SKILL_BASE/$skill/SKILL.md" ]; then
    echo "✗ 部署失败: $skill/SKILL.md 缺失"
    DEPLOY_OK=false
  else
    echo "✓ $skill/SKILL.md"
  fi
done

if [ "$DEPLOY_OK" = false ]; then
  echo "错误：部署验证失败，请检查源目录"
  exit 1
fi
```

---

## Step 4: DOCTOR — 触发 Doctor 修正结构漂移

**目标**：运行 harness-doctor 让新版 Skill 的结构期望与项目实际代码库对齐。

> **关键**：Doctor 是结构修正的权威。它扫描实际代码库，然后按优先级修复 harness 基础设施。不假设项目初始状态，基于代码库真实状态做决策。

### 4.1 触发 Doctor

```
Skill(skill="harness-doctor")
```

Doctor 将自动执行以下修复：

| 优先级 | 范围 | 说明 |
|--------|------|------|
| P0 | 结构 | `create-scaffold.sh --missing-only` 仅创建缺失文件 |
| P1 | 固定文件 | `create-scaffold.sh --restore-fixed` 恢复规范版本 |
| P2 | 脚本 | 修正 LAYER_MAP 漂移、修复 Skill 脚本运行时缺陷 |
| P3 | 文档 | 同步 ARCHITECTURE.md、DEVELOPMENT.md 与实际代码 |
| P4 | 配置 | 修正 environment.json 与实际依赖的匹配 |
| P5 | 一致性 | 跨文件同步层数据 |
| HEAL | 经验 | 归档过期 episode |

### 4.2 记录 Doctor 修复结果

读取 Doctor 报告：

```bash
if [ -f "$PROJECT_ROOT/harness/.analysis/doctor-report.md" ]; then
  echo "Doctor 报告已生成: harness/.analysis/doctor-report.md"
  DOCTOR_FIXES=$(grep -c "^|" "$PROJECT_ROOT/harness/.analysis/doctor-report.md" || echo "0")
  echo "Doctor 修复项数: $DOCTOR_FIXES"
fi
```

---

## Step 4.5: FILL — 填充新创建模板的实际项目内容

**目标**：Doctor 的 `--missing-only` 模式只创建骨架文件（含 `{param}` 占位符），不填充实际内容。本步骤检测并填充 Doctor 新创建的模板文件，使其包含项目具体信息。

> **为什么需要这步**：`create-scaffold.sh --missing-only` 只写入通用骨架。填充占位符是 harness-creator Phase 4（`fill-documentation` 子代理）的职责，但升级场景不会运行 Creator 的完整流程。Upgrader 必须自己补全。

### 4.5.1 检测未填充模板

扫描 Doctor 可能新创建的文档，检查是否含有未填充的占位符：

```bash
UNFILLED_FILES=""
for doc_file in docs/TESTING.md docs/OPERATIONS.md; do
  if [ -f "$PROJECT_ROOT/$doc_file" ]; then
    if grep -qE '\{[a-z_]+\}' "$PROJECT_ROOT/$doc_file" 2>/dev/null; then
      UNFILLED_FILES="$UNFILLED_FILES $doc_file"
      echo "  ⚠ $doc_file 含未填充占位符"
    fi
  fi
done

if [ -z "$UNFILLED_FILES" ]; then
  echo "✓ 所有文档已填充，跳过 FILL 步骤"
fi
```

### 4.5.2 填充模板内容

对每个含未填充占位符的文件，基于项目实际信息填充：

**数据来源**（按优先级）：
1. `harness/config/environment.json` — 运行时配置、服务列表、环境变量
2. `docs/ARCHITECTURE.md` — 技术栈、层级架构
3. `docs/DEVELOPMENT.md` — 构建/测试/lint 命令
4. `AGENTS.md` — 项目名称、架构概要
5. 代码库扫描 — 如上述文件缺失则直接扫描代码

**填充策略**：

| 文件 | 填充内容 | 数据来源 |
|------|----------|----------|
| `docs/TESTING.md` | 测试框架、覆盖率目标、测试命令、数据库初始化 | ARCHITECTURE.md（技术栈）、DEVELOPMENT.md（测试命令）、environment.json（服务） |
| `docs/OPERATIONS.md` | 部署命令、环境列表、健康检查、日志配置 | DEVELOPMENT.md（构建命令）、environment.json（启动命令、环境变量、健康端点） |

> **原则**：只填充 Doctor 新创建的骨架文件。如果文件在升级前已存在（即使含占位符），不覆盖——可能是项目刻意保留的定制内容。

### 4.5.3 验证填充结果

```bash
for doc_file in $UNFILLED_FILES; do
  if grep -qE '\{[a-z_]+\}' "$PROJECT_ROOT/$doc_file" 2>/dev/null; then
    echo "  ⚠ $doc_file 仍有未填充占位符"
  else
    echo "  ✓ $doc_file 已完整填充"
  fi
done
```

---

## Step 5: EVOLVER — 条件性触发 Evolver 校准

**目标**：如果 Doctor 修改了项目文件（包括 Step 4.5 的模板填充），触发 Evolver 重新校准进化水位线。

> **原理**：Doctor 修复可能使旧版 Evolver 产生的进化信号失效（如 LAYER_MAP 变更导致旧 episode 中的文件路径不再准确）。Evolver 将重新扫描 episode 以适应新状态。

### 5.1 判断是否需要触发

| 条件 | 操作 |
|------|------|
| Doctor 修改了 ≥ 1 个项目文件 | 触发 Evolver |
| Doctor 未修改任何项目文件 | 跳过 |

```bash
# 检查 Doctor 是否产生了修改（比较 git status）
if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain 2>/dev/null)" ]; then
  MODIFIED_COUNT=$(git -C "$PROJECT_ROOT" status --porcelain | wc -l | tr -d ' ')
  echo "Doctor 修改了 $MODIFIED_COUNT 个文件，触发 Evolver 校准"
  TRIGGER_EVOLVER=true
else
  echo "Doctor 未产生修改，跳过 Evolver"
  TRIGGER_EVOLVER=false
fi
```

### 5.2 触发 Evolver

```bash
if [ "$TRIGGER_EVOLVER" = true ]; then
  Skill(skill="harness-evolver", args="--mode auto --trigger-reason upgrade")
fi
```

---

## Step 6: REPORT — 输出升级报告

### 6.1 生成报告

保存到 `harness/.analysis/upgrade-report.md`：

```markdown
# Harness Skill 升级报告

**日期**：YYYY-MM-DD HH:MM
**项目**：{project name}

## 版本变更

| 指标 | 值 |
|------|-----|
| 旧版本 | {CURRENT_VERSION} |
| 新版本 | {NEW_VERSION} |
| 部署 Skill 数 | 7 |

## 部署详情

| Skill | 状态 |
|-------|------|
| harness-creator | ✓ 已部署 |
| harness-doctor | ✓ 已部署 |
| harness-executor | ✓ 已部署 |
| harness-evolver | ✓ 已部署 |
| harness-recorder | ✓ 已部署 |
| harness-spec | ✓ 已部署 |
| harness-upgrader | ✓ 已部署 |

## Doctor 修复摘要

（来自 harness/.analysis/doctor-report.md）

## Evolver 校准

| 指标 | 值 |
|------|-----|
| 是否触发 | {是/否} |
| 触发原因 | {upgrade/跳过} |

## 备份位置

{BACKUP_DIR}

## 回滚步骤

如需回滚到旧版本：
1. 恢复旧版 Skill：`cp -r {BACKUP_DIR}/skills/* .qoder/skills/`
2. 恢复 environment.json 版本号
3. 运行 `Skill("harness-doctor")` 重新校准
```

### 6.2 终端输出

```
升级完成：
  版本：  {OLD} → {NEW}
  部署：  7 个 Skill
  修复：  Doctor {N} 个问题（P0:{n} P1:{n} P2:{n} P3:{n} P4:{n} P5:{n}）
  校准：  Evolver {已触发/跳过}
  备份：  {BACKUP_DIR}
  报告：  harness/.analysis/upgrade-report.md
```

---

## 验证标准

升级成功的判定条件：

- [ ] 7 个 Skill 的 SKILL.md 均存在于 `.qoder/skills/`
- [ ] `harness/config/environment.json` 的 `skills.version` 已更新
- [ ] Doctor 报告已生成（`harness/.analysis/doctor-report.md`）
- [ ] 所有 Doctor 新创建的模板文件已填充实际内容（无 `{param}` 占位符残留）
- [ ] 所有 Doctor 修复均已完成（无阻塞项）
- [ ] 升级报告已生成（`harness/.analysis/upgrade-report.md`）

---

## 常见陷阱

| 陷阱 | 预防 |
|------|------|
| 未提交就升级 → Doctor 修复无法追溯 | Step 2.2 预检阻塞 |
| 直接覆盖 harness/ 运行时数据 → 丢失项目定制内容 | 本 Skill 只部署 `.qoder/skills/`，不触碰 `harness/` |
| 跳过 Doctor 直接使用 → 旧结构与新版 Skill 不兼容 | Step 4 是强制步骤 |
| Doctor 新创建的模板未填充 → 占位符留在文档中 | Step 4.5 自动检测并填充 |
| 升级后不触发 Evolver → 进化水位线过时 | Step 5 自动检测并触发 |
| 源目录缺少某个 Skill → 部署不完整 | Step 2.1 验证必需 Skill 完整性 |
| 从错误的源目录部署 → 版本混乱 | Step 2.1 严格验证源目录结构 |

---

## 参考文件

| 文件 | 何时读取 | 内容 |
|------|----------|------|
| `scripts/deploy.sh` | Step 3: 部署 | 确定性 Skill 源码部署脚本 |
| `harness-creator/SKILL.md` | Step 4: Doctor 前置 | Creator 的 scaffold 模板和 `--missing-only`/`--restore-fixed` 机制 |
| `harness-doctor/SKILL.md` | Step 4: 修复 | Doctor 的完整修复流程和优先级体系 |
| `harness-evolver/SKILL.md` | Step 5: 校准 | Evolver 的进化流程和水位线机制 |
