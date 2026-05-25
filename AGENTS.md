# 星星乐园（StarParadise）

> 家庭激励管理系统 — 通过任务打卡和积分奖励激励孩子养成好习惯

## 1 快速开始

- [架构概览](docs/ARCHITECTURE.md) — 系统设计、层、数据流
- [开发设置](docs/DEVELOPMENT.md) — 构建、测试、环境

## 2 架构

| 章节 | 文档 | 说明 |
|------|------|------|
| 2.1 | [系统架构](docs/ARCHITECTURE.md) | 层层次结构、依赖图、数据流 |
| 2.2 | [后端服务](docs/design-docs/server.md) | Express + SQLite API 服务 |
| 2.3 | [管理后台](docs/design-docs/pc-admin.md) | Vue 3 + Element Plus 管理界面 |
| 2.4 | [小程序端](docs/design-docs/miniprogram.md) | uni-app 移动端打卡界面 |

## 3 API 与参考

| 章节 | 文档 | 说明 |
|------|------|------|
| 3.1 | [API 接口](docs/api.md) | 完整的 REST API 参考 |

## 4 质量与标准

| 章节 | 文档 | 说明 |
|------|------|------|
| 4.1 | [测试策略](docs/TESTING.md) | 测试模式、覆盖率 |
| 4.2 | [运维指南](docs/OPERATIONS.md) | 部署、监控、运维 |

## 5 开发

```bash
make build          # 构建项目
make test           # 运行测试
make lint-arch      # 架构 lint（层边界 + 质量）
make lint           # 所有 lint
python3 scripts/validate.py .   # 完整验证流水线
```

参见 [开发设置](docs/DEVELOPMENT.md) 获取完整参考。

## 6 关键目录

| 目录 | 层 | 用途 |
|------|-----|------|
| `star-park/server/src/` | L0-L2 | 后端 API 源代码 |
| `star-park/miniprogram/src/` | L3-L5 | 小程序前端源代码 |
| `star-park/pc-admin/src/` | L3-L5 | 管理后台前端源代码 |
| `docs/` | — | 所有文档 |
| `scripts/` | — | Linter 和验证工具 |
| `harness/` | — | Agent 基础设施 |

## 7 Harness Skills

| Skill | 用途 | 何时使用 |
|-------|------|----------|
| harness-creator | 初始化/升级 harness 基础设施 | 新项目或重大重构 |
| harness-spec | 生成执行规格 | 需要规划的复杂功能 |
| harness-executor | 执行带验证的规格 | 规格驱动的开发任务 |
| harness-recorder | 记录任务结果和经验教训 | 每个任务完成时 |
| harness-evolver | 基于记录的数据进化 skill | 定期改进周期 |
| harness-doctor | 审计和修复 harness 健康 | 当检测到问题时 |
| harness-upgrader | 升级已安装项目到新版 Skill | Skill 版本更新时 |

## 8 规则

- 层 N 只能从层 < N 导入
- 所有新文件在第一天必须 lint 干净
- 仅结构化日志（无原始 console.log 调试语句）
- 单个文件 ≤ 500 行

## 9 开发工作流

| 任务复杂度 | 工作流 | 要求 |
|------------|--------|------|
| **复杂** | `harness-spec` → `harness-executor` → `harness-recorder` | **必需** |
| **标准** | `harness-spec` → `harness-executor` → `harness-recorder` | **推荐** |
| **简单** | 直接对话（CDD） | **可选** |

> 启动 SDD 工作流：使用任务描述 `Skill(skill="harness-spec")`
