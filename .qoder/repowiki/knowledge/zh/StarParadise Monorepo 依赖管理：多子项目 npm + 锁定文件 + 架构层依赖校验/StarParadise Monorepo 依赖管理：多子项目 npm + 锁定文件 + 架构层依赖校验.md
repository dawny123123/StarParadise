---
kind: dependency_management
name: StarParadise Monorepo 依赖管理：多子项目 npm + 锁定文件 + 架构层依赖校验
slug: dependency_management
category: dependency_management
scope:
    - '**'
---

## 1. 使用的系统/方法

本项目采用 **npm 包管理器** 作为唯一的第三方依赖管理工具，以 **Monorepo（多子项目）** 形式组织三个独立子工程：

- `star-park/miniprogram` — uni-app + Vue 3 小程序/H5 端
- `star-park/pc-admin` — Vite + Vue 3 家长端 PC 管理后台
- `star-park/server` — Express + SQLite 后端服务

每个子项目拥有独立的 `package.json`、`package-lock.json` 与 `node_modules/`，不存在跨子项目的共享依赖或 workspace 聚合。根目录的 `star-park/package.json` 仅通过脚本在子目录间切换执行安装与启动命令（`install:all`、`start:*`），属于“工作区脚本”而非真正的 npm workspace。

版本策略上，所有依赖均使用 **语义化版本范围（`^x.y.z`）**，未使用精确版本号；各子项目之间没有统一的版本对齐约束，因此相同库在不同子工程中可能解析到不同次级版本。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `star-park/package.json` | Monorepo 顶层脚本入口，编排子项目安装与启动 |
| `star-park/miniprogram/package.json` | 小程序端依赖声明（uni-app、Vue 3、Pinia） |
| `star-park/pc-admin/package.json` | PC 管理端依赖声明（Vue 3、Element Plus、ECharts、Axios） |
| `star-park/server/package.json` | 服务端依赖声明（Express、better-sqlite3、dayjs、cors） |
| 各子项目 `package-lock.json` | 锁定已解析的依赖树与来源 registry（npmjs.org） |
| `scripts/lint-deps.py` | 自定义 Python 脚本，校验源码内部模块导入是否遵守分层架构约束 |
| `Makefile` | 顶层构建入口，统一调用 `lint-deps.py`、`scripts/*` 等质量检查脚本 |

## 3. 架构与约定

### 3.1 依赖声明位置
- 每个子项目各自维护一份 `package.json`，依赖按运行时（`dependencies`）与开发时（`devDependencies`）严格分离。
- 根目录不声明任何业务依赖，仅包含跨子工程的脚本命令。

### 3.2 版本范围策略
- 全部使用 `^` 前缀的兼容范围（如 `vue: ^3.4.0`、`express: ^4.21.0`），允许 npm 自动升级至满足范围的更高次版本。
- 无全局的依赖版本对齐文件或脚本，因此同一库在不同子项目中可能解析到不同版本。

### 3.3 锁定文件
- 每个子项目均提交了对应的 `package-lock.json`（lockfileVersion 3），用于固定依赖树，保证构建可重现。
- 未发现 `.npmrc`、`.yarnrc`、私有 registry 配置或 `GOPRIVATE` 等私有源设置，默认使用官方 npm registry。

### 3.4 无 vendoring / 无 monorepo workspace
- 未使用 `pnpm`、`yarn workspaces`、`npm workspaces` 等聚合机制。
- 未使用 `vendor/`、`third_party/` 等代码级 vendoring 方式引入第三方源码。
- 所有第三方依赖均通过 `npm install` 下载到各自子项目的 `node_modules/`。

### 3.5 内部模块依赖约束（非 npm 依赖，但属于依赖管理范畴）
`scripts/lint-deps.py` 定义了一个 6 层的内部模块依赖图（L0 数据层 → L1 路由 → L2 入口 → L3 API/组件 → L4 页面视图 → L5 前端入口），并通过正则扫描 `import` / `require` 语句，强制：**低层只能被高层引用，禁止反向依赖；同时明确禁止前端模块直接 import 后端代码**，必须通过 HTTP API 通信。该脚本由 `make lint-arch` 统一触发。

## 4. 约定与约束

### 观察到的约定
- 每个子工程独立管理自己的依赖，通过根 `Makefile` 和 `star-park/package.json` 中的脚本进行批量操作。
- 依赖版本统一使用 `^` 语义范围，便于获得安全补丁与功能更新。
- 通过 `package-lock.json` 锁定依赖树，确保 CI/本地构建一致。
- 内部源码模块遵循严格的分层依赖模型，由 `lint-deps.py` 静态检查。

### 明确的约束（由脚本/构建强制）
- **前端不得直接 import 后端模块**：`lint-deps.py` 中 `FORBIDDEN_IMPORTS` 显式禁止 L3/L4/L5 前端层对 L0/L1/L2 后端的任何直接导入，违反将导致 `lint-arch` 失败。
- **模块只能向下层导入**：任意模块只能引用层级编号小于自身的模块，否则报告“Layer X imports Layer Y (Y > X)”错误。
- **跳过目录**：`node_modules`、`dist`、`data`、`harness`、`scripts` 等目录在扫描时被排除，避免误报。

### 缺失/未实现的部分
- 没有统一的依赖升级流程（如 Dependabot、Renovate、`npm outdated` 自动化）。
- 没有私有 npm registry 或镜像源配置。
- 没有跨子项目共享依赖的统一版本约束（例如通过 shared workspace 或 lockfile 合并）。
- 没有针对 `package-lock.json` 的 diff 审查规则，升级依赖时不会自动比对变更。

## 总结

该项目采用最简化的多子项目 npm 管理模式：每个子工程独立声明依赖并锁定版本，通过根脚本集中编排安装与启动；同时通过自研 Python 脚本强制执行内部源码的分层依赖约束，防止前后端耦合。整体依赖管理体系轻量、直观，适合小型家庭激励系统的开发与迭代节奏。