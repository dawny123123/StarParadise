---
kind: build_system
name: Monorepo 构建与编排体系
category: build_system
scope:
    - '**'
source_files:
    - Makefile
    - star-park/package.json
    - star-park/server/package.json
    - star-park/pc-admin/package.json
    - star-park/miniprogram/package.json
    - scripts/generate-api-doc.sh
    - scripts/check-db-consistency.sh
    - scripts/run-api-tests.sh
    - harness/scripts/setup-env.sh
    - harness/scripts/start-server.sh
---

本仓库采用基于 npm scripts + Makefile + Bash 脚本的轻量级 monorepo 构建系统，以 star-park/ 为应用根目录，聚合 Express 后端、PC 管理前端（Vite）与 UniApp 小程序三个子项目。

## 1. 构建系统与工具链
- 顶层入口：Makefile 提供统一命令集（build、api-doc、check-db、api-test、lint-arch、verify、setup-env、start-server、teardown-env），所有目标均通过 @echo 或调用 scripts/、harness/scripts/ 下的脚本实现。
- 子包脚本：每个子项目各自维护 package.json 中的 scripts，由顶层 Makefile 或 star-park/package.json 的 install:all / start:* 组合调用。
- 依赖安装：无共享 lockfile；各子包独立 npm install，harness/scripts/setup-env.sh 按模块检查 node_modules 是否存在后按需安装。

## 2. 关键文件与职责
- Makefile：全局构建编排，定义 Web 条件目标与架构检查流水线。
- star-park/package.json：monorepo 根脚本，集中 install:all、start:server、start:pc、start:mini。
- star-park/server/package.json：Express 服务启动（node src/index.js，开发模式用 --watch）。
- star-park/pc-admin/package.json：Vite 开发/构建（vite dev、vite build）。
- star-park/miniprogram/package.json：UniApp CLI 多端构建（uni -p mp-weixin、uni build、uni H5 模式）。
- scripts/generate-api-doc.sh：扫描 src/routes/*.js 中 router.get/post/put/delete 正则抽取端点，更新 docs/api.md。
- scripts/check-db-consistency.sh：使用 sqlite3 校验 data/star-park.db 核心表与字段存在性。
- scripts/run-api-tests.sh：通过 curl 对 /api/health、/children、/tasks、/dashboard 做端到端冒烟测试，默认 BASE_URL=http://localhost:3001/api。
- harness/scripts/setup-env.sh / start-server.sh / teardown-env.sh：环境初始化、带健康检查的后端启动、清理流程。

## 3. 架构与约定
- 分层组织：star-park/ 下按领域分 server / pc-admin / miniprogram；scripts/ 放跨模块质量脚本；harness/scripts/ 放运行期编排脚本。
- 环境变量：PORT（默认 3001）、NODE_ENV（默认 development）在 harness/scripts/start-server.sh 中导出并注入后端进程。
- 数据库：SQLite 嵌入式，无需外部服务；首次启动由 server/src/database.js 自动建库，check-db-consistency.sh 仅在有 .db 文件时执行。
- 文档生成：API 文档通过正则从路由源码抽取，非 OpenAPI/Swagger 规范，属于代码即文档的轻量方案。

## 4. 开发者应遵循的规则
- 新增构建目标优先写进 Makefile，并通过 scripts/*.sh 或 python3 脚本实现具体逻辑，保持 Makefile 薄而稳定。
- 子包只暴露最小 scripts（dev/build/start），复杂流程下沉到 scripts/ 或 harness/scripts/。
- 对外部服务（如 SQLite）的可用性检查应在 setup-env.sh 中完成，start-server.sh 负责健康轮询等待就绪。
- API 变更需同步更新 scripts/generate-api-doc.sh 的正则匹配规则，确保 make api-doc 能产出最新 docs/api.md。
- 端到端测试通过 make api-test 触发，如需新增用例请在 scripts/run-api-tests.sh 追加 curl 断言。