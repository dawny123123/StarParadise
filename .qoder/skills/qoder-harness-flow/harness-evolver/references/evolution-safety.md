# Evolution Safety: 分级标准与安全策略

> "Evolution never breaks a working system." — 进化改动必须可验证、可回滚、可追溯。

本文档定义了 harness-evolver 在分析和改进 harness 时的安全约束，包括修复分级标准、验证流程、回滚机制和内存清理策略。

## P0-P3 修复分级标准

Critic 产出的每条建议（recommendation）都必须归入以下四个优先级之一。Refiner 根据优先级决定处理策略。

### P0: Critical — 安全盲区必须立即关闭

| 属性 | 值 |
|------|-----|
| **定义** | 缺失的约束导致 agent 可以执行违规操作而不被拦截 |
| **典型案例** | lint-deps 层级映射缺失新包 → 跨层依赖不被检测；verify_action.py 缺少对某文件类型的校验 |
| **处理** | Refiner 直接修复，不需要用户确认 |
| **置信度要求** | confidence ≥ 0.8 |
| **验证** | 修复后立即运行 `make lint-arch` + `make build` |
| **风险** | 低 — P0 修复是补全已知规则，不引入新规则 |

### P1: Important — 需要用户确认的改进

| 属性 | 值 |
|------|-----|
| **定义** | 规则存在但不够完善，导致 agent 频繁出错或错误信息不可操作 |
| **典型案例** | lint 错误信息缺少 HOW 部分 → agent 不知道怎么修复；测试覆盖率盲区 → 某模块的错误反复出现 |
| **处理** | Refiner 先 dry-run 展示变更 → AskUserQuestion 确认 → 执行 |
| **置信度要求** | confidence ≥ 0.6 |
| **验证** | 用户确认后执行，运行 `make lint-arch` + `make build` |
| **风险** | 中 — 可能改变错误信息的表述或增加新的 lint 规则 |

### P2: Nice-to-have — 排队等待的优化

| 属性 | 值 |
|------|-----|
| **定义** | 可以改进但不紧急的优化建议 |
| **典型案例** | 某个流程可以合并两步为一步；文档可以补充更多示例 |
| **处理** | 记录到 `harness/trace/improvements.jsonl`，不立即执行 |
| **置信度要求** | 无要求 |
| **验证** | 手动执行时再验证 |
| **风险** | 低 — 仅记录不执行 |

### P3: Low — 表面改进

| 属性 | 值 |
|------|-----|
| **定义** | 格式、风格、命名等非功能性建议 |
| **典型案例** | 变量命名不统一；注释风格不一致 |
| **处理** | 记录到 `harness/trace/improvements.jsonl`，标记为 low |
| **验证** | 可选 |
| **风险** | 无 |

### 分级决策表

```
Critic 产出 recommendation
    ↓
confidence ≥ 0.8 AND 属于 "规则缺失/盲区" → P0
confidence ≥ 0.6 AND 属于 "规则不完善/频繁出错" → P1
confidence < 0.6 OR 属于 "优化建议" → P2
属于 "格式/风格/命名" → P3
```

## 验证流程

每次进化改动后（Step 3 Refine 或 Step 4 Compile），都必须通过以下验证流程：

### 标准验证序列

```bash
# 1. 架构 lint — 确保层级约束未被破坏
make lint-arch
# 失败 → 立即回滚，不继续

# 2. 代码构建 — 确保改动不引入编译错误
make build
# 失败 → 立即回滚，不继续

# 3. 可选：运行测试 — 如果改动涉及测试相关文件
make test 2>/dev/null || echo "Tests skipped or not configured"
```

### 验证结果处理

| 步骤 | 通过 | 失败 |
|------|------|------|
| `make lint-arch` | 继续下一步 | 立即回滚所有变更 |
| `make build` | 继续下一步 | 立即回滚所有变更 |
| `make test` | 完成验证 | 记录失败但不回滚（可能是既有问题） |

### 验证范围

进化改动**只验证 harness 基础设施**，不验证业务代码。具体来说：

- **验证对象**: `scripts/lint-*.{go,py,sh}`、`docs/`、`AGENTS.md`、`harness/` 下的配置
- **不验证**: 业务代码文件（由 harness-executor 负责）

## 回滚机制

当验证失败时，使用 git 回滚被改动的文件。

### 自动回滚

```bash
# 获取被进化改动修改的文件列表（排除 harness/trace/ 下的记录文件）
CHANGED_FILES=$(git diff --name-only 2>/dev/null | grep -v "^harness/trace/" | head -20)

if [ -n "$CHANGED_FILES" ]; then
  # 回滚被改动的文件
  git checkout -- $CHANGED_FILES 2>/dev/null
  echo "Rolled back: $CHANGED_FILES"

  # 记录回滚事件
  mkdir -p harness/trace/failures
  echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","task_id":"evolution","failure_type":"evolution_rollback","details":{"files":"'"$CHANGED_FILES"'","reason":"validation_failed"}}' \
    >> harness/trace/failures/$(date +%Y-%m-%d).jsonl
fi
```

### 回滚范围

| 类型 | 是否回滚 | 原因 |
|------|---------|------|
| 被修改的项目文件（lint 脚本、文档等） | **是** | 恢复到修改前状态 |
| `harness/trace/` 下的记录（improvements.jsonl 等） | **否** | 记录数据本身无害，保留用于后续分析 |

### 手动回滚

如果自动回滚机制不足（例如涉及新文件创建），可以：

```bash
# 查看所有进化改动
git diff --stat

# 回滚特定文件
git checkout -- <file-path>

# 回滚所有改动（包括新文件）
git checkout -- .
```

## 内存清理安全策略

Step 5（Memory Consolidation）涉及删除旧数据，必须遵循以下安全策略：

### 备份优先

任何删除操作前，必须先创建备份：

```bash
# 备份目标目录
BACKUP_FILE="harness/trace/memory-backup-$(date +%Y-%m-%d).tar.gz"
tar -czf "$BACKUP_FILE" harness/memory/ 2>/dev/null
echo "Backup created: $BACKUP_FILE"
```

### 日期阈值

| 数据类型 | 保留期限 | 说明 |
|---------|---------|------|
| Episodic memory（事件记录） | 90 天 | 超过 90 天的事件记录可以清理 |
| Procedural memory（流程记录） | **永不自动删除** | 流程知识是永久资产，只能手动删除 |
| Knowledge memory（知识记录） | **永不自动删除** | 项目知识是永久资产 |
| Failure records（失败记录） | 180 天 | 保留更久以支持长期模式分析 |
| Improvement records | **永不自动删除** | 改进历史是审计记录 |

### 清理执行流程

```
1. 计算待清理数据量
2. 创建完整备份
3. 验证备份完整性（tar -tzf 检查）
4. 执行删除
5. 记录清理事件到 improvements.jsonl
```

### 清理约束

- **单次清理上限**: 每次最多删除 100 个文件，超过则分批执行
- **备份保留**: 备份文件保留 30 天，之后可手动清理
- **手动确认（full scope）**: 在 full scope 模式下，清理前通过 AskUserQuestion 确认
- **自动执行（incremental scope）**: 在 incremental 模式下，仅清理超过阈值的 episodic memory，不涉及其他类型
