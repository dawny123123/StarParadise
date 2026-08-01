---
kind: logging_system
name: 日志系统 — 基于 console 的原生输出
category: logging_system
scope:
    - '**'
source_files:
    - star-park/server/src/index.js
    - star-park/server/src/database.js
    - star-park/server/src/seed.js
    - star-park/server/package.json
    - star-park/miniprogram/src/App.vue
    - star-park/pc-admin/src/api/index.js
---

本仓库未引入任何第三方日志框架（如 winston、pino、bunyan、morgan 等），后端与前端均直接使用语言内置的 `console` API 进行输出，属于最基础的日志方式。

### 后端（Express + SQLite）
- 启动与初始化：`star-park/server/src/index.js` 使用 `console.log` 打印服务监听地址与 API 入口；`seed.js` 通过 `console.log` 输出种子数据初始化进度。
- 数据库迁移错误：`database.js` 在迁移失败时通过 `console.error` 输出错误信息。
- 路由层：各 `routes/*.js` 文件中未发现显式日志调用，业务异常通常由 Express 默认错误处理或上层捕获后返回 JSON 响应，未统一记录请求/响应日志。
- 依赖清单：`package.json` 中无日志相关依赖，确认未集成结构化日志库。

### 小程序端（UniApp）
- 应用生命周期：`App.vue` 中使用 `console.log('App Launch'|'Show'|'Hide')` 输出生命周期事件。
- 页面与组件：各页面（checkin、records、rewards、wallet、index 等）与组件（PointsModal）在异步失败分支中使用 `console.error` 打印中文错误描述，无统一错误上报或日志收集。

### PC 管理端（Vue3 + Vite）
- API 拦截器：`src/api/index.js` 中在请求失败时通过 `console.error('API Error:', error)` 输出错误。
- 状态管理与视图：`stores/app.js` 与各 `views/*.vue` 文件在数据获取失败时使用 `console.error` 输出中文错误信息，无集中式日志模块。

### 约定与约束
- 未定义统一的日志级别策略（info/warn/error/debug 等），仅凭 `console.log` 与 `console.error` 区分正常输出与错误。
- 未实现结构化日志字段（如 timestamp、level、service、traceId 等），所有日志均为纯文本字符串。
- 未配置日志输出目标（stdout/stderr 文件、远程收集等），完全依赖运行时的控制台输出。
- 前后端均未对请求/响应进行统一日志记录，调试主要依赖浏览器开发者工具与服务端控制台。