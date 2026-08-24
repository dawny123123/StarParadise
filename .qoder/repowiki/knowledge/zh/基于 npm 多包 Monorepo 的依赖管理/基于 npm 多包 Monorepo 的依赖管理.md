---
kind: dependency_management
name: 基于 npm 多包 Monorepo 的依赖管理
category: dependency_management
scope:
    - '**'
source_files:
    - star-park/package.json
    - star-park/server/package.json
    - star-park/server/package-lock.json
    - star-park/pc-admin/package.json
    - star-park/pc-admin/package-lock.json
    - star-park/miniprogram/package.json
    - star-park/miniprogram/package-lock.json
    - Makefile
---

## 1. 使用的系统与工具

本项目采用 **npm + package-lock.json** 作为统一的依赖管理方案，通过 **Monorepo 多包结构**（`star-park/` 下独立子包）组织后端、PC 管理端与小程序三个产物。顶层 `Makefile` 提供统一入口，各子包各自维护独立的 `package.json` 与 `package-lock.json`，不存在跨包的共享依赖或 workspace 聚合。

- 包管理器：`npm`（lockfileVersion 3），未使用 pnpm/yarn。
- 版本约束：全部依赖使用 `^` 语义化版本范围（如 `express ^4.21.0`、`vue ^3.4.0`），无精确锁定到次级版本。
- 私有仓库/代理：仓库中未发现 `.npmrc`、`registry` 配置或 `NODE_AUTH_TOKEN` 等私仓相关设置，所有包均从官方 `https://registry.npmjs.org` 拉取。
- 无 vendoring：未见 `vendor/` 或 `third_party/` 目录，依赖通过 `node_modules` 安装。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `star-park/package.json` | Monorepo 根包，仅定义 `install:all` / `start:*` 脚本，按顺序进入子包执行 `npm install` |
| `star-park/server/package.json` | Express 后端运行时依赖（`express`、`better-sqlite3`、`cors`、`dayjs`）及测试依赖（`vitest`、`supertest`） |
| `star-park/pc-admin/package.json` | Vue3 + Element Plus 管理端依赖（`vue`、`pinia`、`element-plus`、`echarts`、`axios`） |
| `star-park/miniprogram/package.json` | uni-app 小程序依赖（`@dcloudio/uni-*` 系列、`vue`、`pinia`） |
| 各子包 `package-lock.json` | 锁定完整依赖树与 sha512 integrity，提交至版本库 |
| `Makefile` | 顶层构建入口，`build` 调用 `star-park/pc-admin` 的 `vite build`；`lint` 触发 `scripts/lint-deps.*` 与 `scripts/lint-quality.*` |

## 3. 架构与约定

- **每个子包独立声明依赖**：server、pc-admin、miniprogram 各自拥有完整的 `dependencies` / `devDependencies`，不共享 `package.json`，也不使用 npm workspaces。
- **根包仅做编排**：`star-park/package.json` 的 `install:all` 以串行 `cd && npm install` 方式依次安装 server → pc-admin → miniprogram，保证三端同时可安装。
- **锁文件随代码提交**：三个子包均提交 `package-lock.json`，用于在 CI/生产环境复现完全一致的依赖树。
- **构建与测试脚本内聚于子包**：`server` 用 `vitest`，`pc-admin` 用 `vite dev/build`，`miniprogram` 用 `uni` CLI，顶层 `Makefile` 只暴露 `build`（仅构建 PC 端）和 `api-test`/`check-db` 等条件目标。
- **无跨包共享依赖**：`vue`、`pinia`、`dayjs` 等在多个子包中以各自版本范围重复声明，由各自 lock 文件分别锁定。

## 4. 约定与约束

- **依赖版本策略**：所有依赖均以 `^` 语义范围声明，允许 npm 自动升级兼容小版本；升级时需同步更新对应 `package-lock.json`。
- **安装入口**：推荐通过 `make` 或 `cd star-park && npm run install:all` 一次性安装三端依赖，避免遗漏任一子包。
- **CI/部署一致性**：由于 `package-lock.json` 已入库，CI 只需执行 `npm ci`（或 `npm install`）即可还原与开发一致的环境；当前仓库未包含 GitHub Actions workflow 中的 `npm ci` 步骤，但锁文件的存在表明应以此方式保证可重现性。
- **无私有源/镜像**：未发现任何 registry 重定向配置，所有第三方包均来自 npm 官方源。
- **质量门禁**：`Makefile lint` 会遍历 `scripts/lint-deps.*` 与 `scripts/lint-quality.*` 执行架构/质量检查，但当前仓库未提供这些脚本的具体实现，因此依赖层面的强制校验尚未落地。
- **生产部署**：服务端通过 `deploy/star-park-server.service` + `deploy/deploy.sh` 发布，依赖安装发生在服务器侧（由部署脚本触发），依赖来源仍为 npm 官方源。