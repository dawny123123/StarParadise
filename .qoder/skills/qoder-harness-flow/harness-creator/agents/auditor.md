# Harness 状态审计代理

你正在审计代码库的现有 harness 基础设施以识别缺口和问题。

## 你的任务

生成全面的审计报告，显示存在什么、缺失什么以及什么已损坏。

## 审计维度

### 1. 文档（权重：30%）

| 检查 | 方式 | 通过标准 |
|------|------|----------|
| AGENTS.md 存在 | `test -f AGENTS.md` | 文件存在 |
| AGENTS.md 大小 | `wc -l AGENTS.md` | 80-120 行 |
| AGENTS.md 有编号部分 | 计数 `##` 标题 | ≥ 5 个部分 |
| ARCHITECTURE.md 存在 | `test -f docs/ARCHITECTURE.md` | 文件存在 |
| ARCHITECTURE.md 有 Mermaid 图表 | `grep 'mermaid' docs/ARCHITECTURE.md` | 至少 1 个 |
| 层声明准确 | 交叉引用 imports | 无虚假声明 |
| DEVELOPMENT.md 命令有效 | 抽查 2-3 个命令 | 命令成功 |
| 设计文档存在（不只是 index） | `find docs/design-docs -name "*.md" ! -name "index.md"` | ≥ 2 个文件 |
| 所有文档链接有效 | 检查 `[text](path)` 引用 | 无断链 |

### 2. Linter（权重：25%）

| 检查 | 方式 | 通过标准 |
|------|------|----------|
| lint-deps 脚本存在 | `test -f scripts/lint-deps*` | 文件存在 |
| lint-quality 脚本存在 | `test -f scripts/lint-quality*` | 文件存在 |
| 层映射覆盖所有包 | 将映射与 `go list ./...` 比较 | 100% 覆盖 |
| 能检测真实违规 | 创建测试用例 | 检测到违规 |
| 错误消息对 Agent 可操作 | 读取 5 条错误消息 | WHAT + WHY + HOW |
| `make lint-arch` 通过 | 运行它 | 退出码 0 |

### 3. 环境与配置（权重：20%）

| 检查 | 方式 | 通过标准 |
|------|------|----------|
| environment.json 存在 | `test -f harness/config/environment.json` | 文件存在（如果项目有外部依赖） |
| 设置脚本存在 | `test -f harness/scripts/setup-env.sh` | 文件存在 |
| 脚本可执行 | `test -x harness/scripts/*.sh` | 可执行 |
| 无硬编码密钥 | `grep -r "password\|secret\|key=" harness/config/` | 使用 ${VAR} 引用 |

### 4. 集成（权重：15%）

| 检查 | 方式 | 通过标准 |
|------|------|----------|
| Makefile 有 lint-arch target | `grep 'lint-arch' Makefile` | Target 存在 |
| 构建通过 | `make build` 或等效命令 | 退出码 0 |
| CI 配置存在 | `test -f .github/workflows/ci.yml` | 文件存在 |

### 5. 质量自动化（权重：10%）

| 检查 | 方式 | 通过标准 |
|------|------|----------|
| 可观测性结构 | `test -d harness/trace` | 目录存在 |
| 记忆结构 | `test -d harness/memory` | 目录存在 |
| 任务 checkpoint 支持 | `test -d harness/tasks` | 目录存在 |

## 评分

对每个维度，评分 0-10。然后计算总分（0-100）：

  overall_score = round(sum(dimension_score * weight for each dimension))

每维度评分（0-10）：
- 10：所有检查通过，高质量
- 7-9：大多数检查通过，小缺口
- 4-6：部分检查通过，显著缺口
- 1-3：少数检查通过，大缺口
- 0：维度完全缺失

总分解释（0-100）：
- 0-20：最低限度——需要从头构建完整 harness
- 21-70：有基础但有缺口——需要针对性补全
- 71+：健康——仅需微调

## 输出格式

将结果保存到 `harness/.analysis/audit.json`：

```json
{
  "overall_score": 66,
  "dimensions": {
    "documentation": {"score": 7, "weight": 30, "checks_passed": 7, "checks_total": 9},
    "linters": {"score": 5, "weight": 25, "checks_passed": 3, "checks_total": 6},
    "environment": {"score": 8, "weight": 20, "checks_passed": 4, "checks_total": 4},
    "integration": {"score": 9, "weight": 15, "checks_passed": 3, "checks_total": 3},
    "quality_automation": {"score": 3, "weight": 10, "checks_passed": 1, "checks_total": 3}
  },
  "gaps": [
    {"priority": "P0", "dimension": "documentation", "issue": "ARCHITECTURE.md claims 3 layers but code has 4", "fix": "Regenerate from actual imports"},
    {"priority": "P1", "dimension": "linters", "issue": "lint-deps missing 5 packages", "fix": "Add internal/cache, internal/auth to layer map"}
  ],
  "strengths": [
    "Build passes cleanly",
    "CI properly configured",
    "Error handling is consistent"
  ]
}
```

同时向 `harness/.analysis/audit-summary.md` 写入人类可读的审计报告。
