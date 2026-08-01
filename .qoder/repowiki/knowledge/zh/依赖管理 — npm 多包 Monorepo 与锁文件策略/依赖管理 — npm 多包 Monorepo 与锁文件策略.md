---
kind: dependency_management
name: 依赖管理 — npm 多包 Monorepo 与锁文件策略
category: dependency_management
scope:
    - '**'
source_files:
    - star-park/package.json
    - star-park/server/package.json
    - star-park/pc-admin/package.json
    - star-park/miniprogram/package.json
    - star-park/server/package-lock.json
    - scripts/lint-deps.py
    - Makefile
---

## 1. 使用的系统与工具
- **包管理器**：npm（每个子项目独立 package.json，使用 package-lock.json 锁定版本）
- **Monorepo 组织方式**：以 star-park/ 为应用根，内含 server、pc-admin、miniprogram 三个独立 npm 包，通过顶层 star-park/package.json 的 scripts 统一编排安装与启动。
- **无共享工作区**：未使用 pnpm workspace / yarn workspaces / npm workspaces，而是通过脚本在多个子目录间切换执行 npm install。

## 2. 关键文件与位置
- star-park/package.json：顶层聚合脚本，提供 install:all、start:server、start:pc、start:mini 等命令。
- star-park/server/package.json：后端 Express + better-sqlite3 依赖声明。
- star-park/pc-admin/package.json：PC 管理端 Vue3 + Vite + Element Plus 依赖声明。
- star-park/miniprogram/package.json：UniApp 小程序依赖声明。
- star-park/server/package-lock.json：服务端依赖锁定文件（lockfileVersion 3）。
- scripts/lint-deps.py：自定义依赖层次检查脚本，强制模块按定义层导入，禁止前端直接导入后端代码。
- Makefile：顶层构建入口，封装 build、api-test、lint、verify、setup-env、start-server、teardown-env 等目标。

## 3. 架构与约定
- **分层依赖约束**：scripts/lint-deps.py 将代码划分为 L0~L5 五层（数据层→路由→入口→前端基础→页面→入口），并通过正则解析 import/require 语句，校验仅能导入更低层以及禁止前端直接导入后端的规则，违反时退出码非零。
- **跨子项目隔离**：每个子项目拥有独立的 node_modules，不存在跨包的本地依赖引用；前后端通过 HTTP API 通信，禁止直接 import 对方源码。
- **版本范围策略**：所有依赖均使用 ^ 语义化版本范围（如 express@^4.21.0、vue@^3.4.0），由 lockfile 固定实际安装版本。
- **开发/生产依赖分离**：测试与构建工具（vitest、supertest、vite、sass 等）放在 devDependencies，运行时依赖放在 dependencies。

## 4. 约定与约束
- **必须使用 npm 并提交 lockfile**：各子项目均生成 package-lock.json，用于保证依赖树可重现。
- **禁止跨层/跨子项目直接导入**：scripts/lint-deps.py 显式列出 FORBIDDEN_IMPORTS，前端任何层级不得直接 import 后端 L0~L2 模块，必须通过 HTTP API 客户端。
- **统一的安装与启动入口**：开发者应通过 star-park/package.json 的 install:all 一次性安装全部子项目依赖，通过 Makefile 或 harness/scripts/* 启动服务。
- **无私有仓库/代理配置**：未发现 .npmrc、pnpm-workspace.yaml、yarn.lock 或私有 registry 相关配置，默认使用官方 npm 源。
- **无 vendoring 策略**：未使用 vendor/ 目录或类似机制，第三方库均通过 npm 安装到 node_modules。

## 5. 已知问题与观察
- server/package.json 和 miniprogram/package.json 中存在名为 2 的异常依赖项（值为 ^3.0.0），疑似误填，需清理。
- 未对 package-lock.json 的更新流程做额外约束（如 CI 中校验 diff），依赖升级依赖人工维护。