# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## 项目概述

星星乐园 — 家庭激励管理系统，通过任务打卡和积分奖励激励孩子养成好习惯。

## 常用命令

```bash
# 安装所有子项目依赖（必须首次执行）
cd star-park && npm run install:all

# 启动后端服务（默认端口 3001）
cd star-park && npm run start:server
# 或开发模式（热重载）
cd star-park/server && npm run dev

# 启动管理后台开发服务器（另一个终端，Vite 代理 /api → :3001）
cd star-park && npm run start:pc

# 启动小程序 H5 预览（另一个终端）
cd star-park && npm run start:mini

# 构建、测试、lint
make build          # 构建管理后台生产版本
make test           # 运行测试（当前未配置）
make lint-arch      # 架构 lint（层边界 + 代码质量，由 scripts/lint-deps.py + lint-quality.py 执行）
make lint           # 所有 lint
make verify         # 端到端验证（scripts/verify/*.sh）
make api-doc        # 生成/更新 API 文档
make check-db       # DDL/Entity 一致性检查
make api-test       # API 接口测试
make check-conventions  # 编码规范检查
python3 scripts/validate.py .   # 完整验证流水线
```

## 架构

### 整体结构

Monorepo 三子包，前后端通过 HTTP API 通信（无共享代码）：

| 子包 | 技术栈 | 说明 |
|------|--------|------|
| `star-park/server` | Express + better-sqlite3 | 后端 REST API，端口 3001 |
| `star-park/pc-admin` | Vue 3 + Element Plus + ECharts + Pinia | 家长管理后台 |
| `star-park/miniprogram` | Vue 3 + uni-app + Pinia | 孩子/家长移动端（H5 + 微信小程序） |

### 分层架构（L0–L5）

项目强制执行分层依赖规则，由 `scripts/lint-deps.py` 自动校验：

| 层 | 范围 | 可导入 |
|----|------|--------|
| L0 — 数据层 | `server/src/database.js`, `seed.js` | 仅 npm 包 |
| L1 — 后端路由 | `server/src/routes/*` | L0 + npm 包 |
| L2 — 后端入口 | `server/src/index.js` | L0, L1 + npm 包 |
| L3 — 前端基础设施 | `api/`, `components/`, `router/`, `stores/`, `styles/` | 仅 npm 包 |
| L4 — 前端页面 | `pages/`, `views/` | L3 + npm 包 |
| L5 — 前端入口 | `main.js`, `App.vue` | L3, L4 + npm 包 |

**禁止依赖**：路由模块之间不可互引、前端不可直接导入后端、同一子项目的页面/视图不可互引。

### 数据库

SQLite 嵌入式数据库，WAL 模式，外键约束开启。数据库文件位于 `star-park/server/data/star-park.db`。

核心表：`children`（含 `points_balance` 积分余额）、`tasks`、`checkins`、`rewards`（含 `reward_unit` 区分元/积分）、`transactions`、`points`。

Schema 迁移采用 try/catch ALTER TABLE 模式（见 `database.js`），新增字段时沿用此模式。

### 关键业务流程

- **打卡流程**：POST `/api/checkins` → 插入打卡记录 → 创建 earn 交易 → 更新奖励目标进度
- **双货币系统**：余额（transactions 表，金钱奖励）与积分（points 表，行为激励）独立运作
- **奖励兑换**：POST `/api/rewards/:id/redeem` → 检查 is_achieved 和 redeemed_at → 扣减对应余额/积分

### API 路由

所有 API 以 `/api/` 为前缀：children, tasks, checkins, rewards, stats, dashboard, points。完整接口见 [docs/api.md](docs/api.md)。

pc-admin 开发环境通过 Vite proxy 将 `/api` 请求转发到后端。

## 规则

- 层 N 只能从层 < N 导入
- 所有新文件在第一天必须 lint 干净
- 仅结构化日志（无原始 console.log 调试语句）
- 单个文件 ≤ 500 行
- Node.js 18+, npm 9+, Python 3.10+

## Harness Skills 工作流

| 任务复杂度 | 工作流 | 要求 |
|------------|--------|------|
| **复杂** | `harness-spec` → `harness-executor` → `harness-recorder` | **必需** |
| **标准** | `harness-spec` → `harness-executor` → `harness-recorder` | **推荐** |
| **简单** | 直接对话（CDD） | **可选** |

| Skill | 用途 |
|-------|------|
| harness-creator | 初始化/升级 harness 基础设施 |
| harness-spec | 生成执行规格（spec/tasks/acceptance） |
| harness-executor | 执行带验证的规格 |
| harness-recorder | 记录任务结果和经验教训 |
| harness-evolver | 基于记录的数据进化 skill |
| harness-doctor | 审计和修复 harness 健康 |
| harness-upgrader | 升级已安装项目到新版 Skill |

> 启动 SDD 工作流：使用任务描述 `Skill(skill="harness-spec")`

## 关键目录

| 目录 | 层 | 用途 |
|------|-----|------|
| `star-park/server/src/` | L0-L2 | 后端 API 源代码 |
| `star-park/miniprogram/src/` | L3-L5 | 小程序前端源代码 |
| `star-park/pc-admin/src/` | L3-L5 | 管理后台前端源代码 |
| `docs/` | — | 架构文档、设计文档、API 文档 |
| `scripts/` | — | Linter 和验证工具（Python/Shell） |
| `harness/` | — | Agent 基础设施和任务状态 |

## 参考文档

- [系统架构](docs/ARCHITECTURE.md) — 层层次结构、依赖图、数据流
- [后端设计](docs/design-docs/server.md) · [管理后台设计](docs/design-docs/pc-admin.md) · [小程序设计](docs/design-docs/miniprogram.md)
- [API 接口](docs/api.md) — 完整的 REST API 参考
- [开发设置](docs/DEVELOPMENT.md) — 环境变量、代理配置等
- [测试策略](docs/TESTING.md) · [运维指南](docs/OPERATIONS.md)
