---
kind: build_system
name: Monorepo 构建与验证流水线（Makefile + scripts + harness）
category: build_system
scope:
    - '**'
source_files:
    - Makefile
    - scripts/validate.py
    - scripts/lint-deps.py
    - scripts/lint-quality.py
    - scripts/run-api-tests.sh
    - scripts/check-db-consistency.sh
    - scripts/generate-api-doc.sh
    - harness/scripts/setup-env.sh
    - harness/scripts/start-server.sh
    - harness/scripts/teardown-env.sh
    - star-park/package.json
    - star-park/server/package.json
    - star-park/pc-admin/package.json
    - star-park/miniprogram/package.json
    - star-park/server/vitest.config.js
---

## 1. 系统概览

本项目采用 **Monorepo** 结构，通过根级 `Makefile` 统一编排三个子项目的构建、测试与验证：
- `star-park/server` — Express + SQLite 后端（Vitest 单元测试）
- `star-park/pc-admin` — Vue 3 + Vite 家长端管理后台
- `star-park/miniprogram` — uni-app + Vue 3 孩子端小程序（H5 / 微信小程序）

顶层入口是 `Makefile`，所有常用命令（build、lint、verify、setup-env、start-server、teardown-env、api-doc、check-db、api-test、check-conventions）均在此集中声明。脚本层由 Python 与 Shell 混合实现，并通过 `scripts/validate.py` 串联为单一 CI 入口。

## 2. 关键文件与职责

| 文件 | 职责 |
|---|---|
| `Makefile` | 顶层任务编排；`build` 仅构建 pc-admin；`lint-arch` 动态发现并执行 `scripts/lint-deps.*` 与 `scripts/lint-quality.*`；`verify` 遍历 `scripts/verify/*.sh` |
| `scripts/validate.py` | 统一验证管线：顺序执行 Build → Lint Architecture → Test → Verify（可选跳过），任一失败立即中止 |
| `scripts/lint-deps.py` | 依赖层级检查器，定义 6 层架构约束（L0 数据层 → L1 路由 → L2 入口 → L3 API/组件 → L4 视图 → L5 前端入口），禁止跨层与前后端直接导入 |
| `scripts/lint-quality.py` | 代码质量检查：限制单文件 ≤500 行、禁止原始 `console.log`（含已知例外白名单）、扫描 `.js/.vue/.ts` |
| `scripts/run-api-tests.sh` | 基于 curl 的 HTTP 冒烟测试（健康检查、children、tasks、dashboard），默认 `BASE_URL=http://localhost:3001/api` |
| `scripts/check-db-consistency.sh` | DDL/Entity 一致性校验（通过 Makefile 条件调用） |
| `scripts/generate-api-doc.sh` | 生成 `docs/api.md`（通过 Makefile 条件调用） |
| `harness/scripts/setup-env.sh` | 安装三端依赖（按需检测 `node_modules`） |
| `harness/scripts/start-server.sh` | 启动后端（`PORT=3001`、`NODE_ENV=development`），轮询 `/api/health` 最多 30 秒 |
| `harness/scripts/teardown-env.sh` | 清理进程（`pkill -f "node src/index.js"`） |
| `star-park/package.json` | 工作区聚合脚本：`install:all`、`start:server`、`start:pc`、`start:mini` |
| `star-park/server/package.json` | 后端脚本：`start`、`dev`（`node --watch`）、`test`、`test:coverage` |
| `star-park/miniprogram/package.json` | uni-app 脚本：`dev:h5`、`build:h5`、`dev:mp-weixin`、`build:mp-weixin` |
| `star-park/pc-admin/package.json` | Vite 脚本：`dev`、`build`、`preview` |
| `star-park/server/vitest.config.js` | Vitest 配置：全局模式、`node` 环境、`setupFiles: ./tests/setup.js`、覆盖率阈值 lines ≥80% |

## 3. 架构与约定

### 3.1 分层架构强制校验
`lint-deps.py` 显式定义了 6 个层级（见 LAYERS 常量），并维护 `FORBIDDEN_IMPORTS` 禁止前端模块直接导入后端代码（必须走 HTTP API）。该检查在 `make lint-arch` 中自动发现并执行，任何违反都会导致构建失败。

### 3.2 构建产物与入口
- 后端：`node src/index.js`（开发模式用 `node --watch`），端口由 `PORT` 环境变量控制，默认 3001。
- PC 管理后台：`vite build`，输出至 `dist/`。
- 小程序：`uni build`（H5）或 `uni build -p mp-weixin`（微信小程序），输出至各自平台目录。
- 根 `make build` 当前只构建 pc-admin；其余子项目通过 `star-park/package.json` 中的脚本单独触发。

### 3.3 测试体系
- 后端单元测试：`vitest run`（`star-park/server/tests/*.test.js`），使用 `supertest` 进行 HTTP 集成测试，覆盖率阈值 80%。
- API 冒烟测试：`scripts/run-api-tests.sh` 通过 curl 调用运行中的服务，要求服务先通过 `harness/scripts/start-server.sh` 启动。
- 端到端验证：`make verify` 依次执行 `scripts/verify/*.sh`（由 `validate.py` 在完整流水线末尾触发）。

### 3.4 环境与生命周期
- 数据库：SQLite 嵌入式，无需外部服务，首次启动时由 `src/database.js` 自动创建 `data/star-park.db`。
- 环境准备：`make setup-env` → `make start-server` → 运行测试 → `make teardown-env`。
- 健康检查：启动脚本轮询 `http://localhost:${PORT}/api/health`，API 测试也以此作为服务就绪信号。

### 3.5 质量门禁
- `make lint` = `make lint-arch`，会遍历 `scripts/lint-deps.*` 与 `scripts/lint-quality.*`（支持 .py/.sh/.go 扩展名）。
- 质量规则包括：文件大小上限 500 行、禁止原始 console.log（含白名单例外）、禁止跨层导入。
- `validate.py` 提供“一键全量验证”，按顺序执行 build → lint-arch → test → verify，任一失败即中止。

## 4. 约定与约束

- **Monorepo 根命令优先**：所有跨子项目操作应通过 `make <target>` 或 `python3 scripts/validate.py .` 调用，避免在各子项目内重复编写流程。
- **前后端解耦**：前端不得直接 import 后端模块（`lint-deps.py` 的 `FORBIDDEN_IMPORTS` 强制），必须通过 HTTP API 通信。
- **服务启动约定**：后端默认监听 `PORT=3001`，健康端点 `/api/health` 必须返回 `{ ok: true }` 才能被 harness 识别为就绪。
- **测试隔离**：Vitest 使用 `NODE_ENV=test` 并在 `tests/setup.js` 中初始化测试环境，每个测试文件独立运行（`fileParallelism: false`）。
- **可插拔脚本**：`Makefile` 对 `api-doc`、`check-db`、`api-test`、`check-conventions` 等目标使用 `if [ -f ... ]` 条件判断，使非 Web 项目也能安全执行。
- **版本策略**：各子项目独立维护 `package.json` 中的 `version`（当前均为 `1.0.0`），仓库未定义统一的版本号同步机制。
- **无 Docker/CI 配置**：仓库未发现 `Dockerfile`、`.github/workflows`、`.gitlab-ci.yml` 等 CI 配置文件；构建与验证完全依赖本地 `Makefile` + `scripts/validate.py`。
