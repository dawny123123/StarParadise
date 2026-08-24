---
kind: build_system
name: Monorepo 构建、测试与生产部署流水线
category: build_system
scope:
    - '**'
source_files:
    - Makefile
    - star-park/server/package.json
    - star-park/server/vitest.config.js
    - star-park/pc-admin/vite.config.js
    - star-park/miniprogram/vite.config.js
    - scripts/run-api-tests.sh
    - deploy/deploy.sh
    - deploy/health-check.sh
    - deploy/star-park-server.service
    - .flow/star-park-nodejs-cicd.yml
---

## 1. 使用的系统/工具
- **Makefile**（根目录）作为 monorepo 的统一入口，编排 PC 管理后台构建、API 文档生成、数据库一致性检查、编码规范检查、端到端验证以及开发环境启停。
- **npm scripts + Vite**：`star-park/pc-admin` 使用 `vite build` 产出静态资源；`star-park/miniprogram` 通过 `uni build -p mp-weixin` / `uni build` 分别构建微信小程序与 H5。
- **Vitest**（`star-park/server/vitest.config.js`）：服务端单元测试，覆盖率阈值 lines ≥ 80%，测试环境 `NODE_ENV=test`，关闭文件并行避免 SQLite 并发冲突。
- **systemd + Bash 部署脚本**：`deploy/deploy.sh` 在 ECS 上执行版本化发布、SQLite 备份、原子切换 `current` 软链、健康检查与失败自动回滚；`deploy/star-park-server.service` 以 `/opt/star-park/current/server` 为工作目录运行 `node src/index.js`。
- **云效 Flow CI**：`.flow/star-park-nodejs-cicd.yml` 定义 Node.js 流水线（分支名 `feat/nodejs-cicd-pipeline`），将制品包下发到目标主机由 `deploy.sh` 安装。

## 2. 关键文件
- `Makefile`：顶层统一命令 (`build`, `api-test`, `check-db`, `check-conventions`, `verify`, `setup-env/start-server/teardown-env`)。
- `star-park/server/package.json`：后端依赖（Express + better-sqlite3）、`test`/`test:coverage` 脚本。
- `star-park/server/vitest.config.js`：Vitest 配置（v8 覆盖率、thresholds.lines=80）。
- `star-park/pc-admin/vite.config.js`：Vite 开发代理 `/api → localhost:3001`。
- `star-park/miniprogram/vite.config.js`：uni-app Vite 插件 + `/api` 代理。
- `scripts/run-api-tests.sh`：启动服务后 curl 验证 `/health`、`/children`、`/tasks`、`/dashboard`。
- `deploy/deploy.sh`：ECS 主机部署主脚本（端口守卫、SQLite 备份、better-sqlite3 预编译回退、环境变量注入、systemd unit 安装、原子 `current` 切换、健康检查、旧版本清理）。
- `deploy/health-check.sh`：轮询 `http://127.0.0.1:${PORT}/api/health` 直到返回 `status: ok`。
- `deploy/star-park-server.service`：systemd Unit，`WorkingDirectory=/opt/star-park/current/server`，`EnvironmentFile=/opt/star-park/shared/star-park.env`。
- `.flow/star-park-nodejs-cicd.yml`：云效 Flow 流水线定义。

## 3. 架构与约定
- **Monorepo 分层构建**：PC 管理后台与服务端各自独立 `package.json`，通过根 `Makefile` 统一触发；小程序通过 uni-app CLI 单独构建。
- **制品包结构约定**：`deploy.sh` 要求制品包内必须存在 `server/package.json` 与 `deploy/star-park-server.service`，否则直接失败；解包后按 `RELEASES_DIR/<BUILD_NUMBER>` 落盘。
- **版本化发布 + 原子切换**：每次部署创建独立 release 目录，通过 `ln -sfn` 更新 `current` 软链，配合 systemd 重启实现零停机切换。
- **数据持久化隔离**：`server/data` 通过软链指向共享目录 `/opt/star-park/shared/data`，版本切换不丢失数据；部署前用 `sqlite3 .backup` 或 `cp` 备份至 `/opt/star-park/backups`，保留最近若干份。
- **原生模块回退策略**：若 `npm ci --omit=dev` 因缺少 g++ 失败，则改用 `--ignore-scripts` 安装并下载 `better-sqlite3` 对应 ABI 的预编译二进制（镜像 `npmmirror`），确保在无编译器的 ECS 上也能部署。
- **健康检查闭环**：部署完成后调用 `deploy/health-check.sh` 轮询 `/api/health`，失败则触发 `rollback()` 恢复上一版本；首次部署无历史版本时直接停止服务。
- **端口守卫**：部署前检查 3002 端口是否被无关进程占用，防止误覆盖线上其他应用。

## 4. 约定与约束
- **构建入口**：所有跨子项目操作应通过根 `make <target>` 触发，而非在各子目录手动执行 npm。（来源：`Makefile` 的 `.PHONY` 声明与 `build` 目标）
- **服务端测试**：使用 `vitest run`（`npm test`），覆盖率阈值 lines≥80%；测试禁用 `fileParallelism` 以避免 SQLite 并发写入冲突。（来源：`star-park/server/vitest.config.js`）
- **API 契约**：前端开发代理统一将 `/api` 转发到 `localhost:3001`；生产部署默认监听 `APP_PORT=3002`（注释明确说明 3001 已被其他线上应用占用，不得改回）。（来源：`deploy/deploy.sh` 注释与 `star-park/pc-admin/vite.config.js`）
- **环境变量**：`star-park.env` 由部署脚本首次生成后保留人工修改，包含 `NODE_ENV=production`、`PORT`、`STATIC_DIR=current/pc-admin`。（来源：`deploy/deploy.sh` 第 140–151 行）
- **制品包校验**：部署脚本强制要求制品包中存在 `server/package.json` 与 `deploy/star-park-server.service`，缺失即中止。（来源：`deploy/deploy.sh` 第 94–99 行）
- **安全加固**：systemd Unit 启用 `NoNewPrivileges=true`、`PrivateTmp=true`、`ProtectSystem=full`，仅允许读写 `/opt/star-park` 与日志目录。（来源：`deploy/star-park-server.service`）
- **版本保留策略**：部署成功后仅保留最近 `KEEP_RELEASES=5` 个版本，其余删除。（来源：`deploy/deploy.sh` 第 169–170 行）
- **CI 集成**：流水线配置文件位于 `.flow/star-park-nodejs-cicd.yml`，由云效 Flow 驱动并在目标主机执行 `deploy/deploy.sh`。（来源：`deploy/deploy.sh` 首行注释）