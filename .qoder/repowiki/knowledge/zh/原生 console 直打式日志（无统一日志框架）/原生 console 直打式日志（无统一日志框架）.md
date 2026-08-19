---
kind: logging_system
name: 原生 console 直打式日志（无统一日志框架）
category: logging_system
scope:
    - '**'
source_files:
    - star-park/server/src/index.js
    - star-park/server/src/app.js
    - star-park/server/src/database.js
    - star-park/server/src/seed.js
    - star-park/server/package.json
    - star-park/pc-admin/src/api/index.js
    - star-park/pc-admin/src/stores/app.js
---

## 1. 使用的系统/方案

仓库中**没有引入任何第三方日志框架**（如 winston、pino、bunyan、morgan、debug、loglevel 等）。后端 Express 服务与前端 PC 管理后台均直接使用 Node.js / 浏览器原生的 `console.log`、`console.error` 输出日志，未封装统一的 logger 模块，也未配置中间件或全局拦截器。

- 后端依赖清单（`star-park/server/package.json`）仅包含 `express`、`better-sqlite3`、`cors`、`dayjs`，无任何日志库。
- 小程序端（`star-park/miniprogram/src`）未发现 `console.*` 调用，业务逻辑通过 API 层与后端交互，不直接打印日志。
- PC 管理后台仅在两处使用 `console.error` 打印错误：`pc-admin/src/api/index.js` 的 API 请求错误捕获，以及 `pc-admin/src/stores/app.js` 获取孩子列表失败时的错误输出。

## 2. 关键文件

| 文件 | 作用 |
|---|---|
| `star-park/server/src/index.js` | 服务启动入口，使用 `console.log` 输出服务监听地址与 API 根路径 |
| `star-park/server/src/database.js` | 数据库迁移失败时通过 `console.error` 打印错误信息（如 `planned_date 迁移失败`、`points_reward 迁移失败`） |
| `star-park/server/src/seed.js` | 种子数据初始化过程中使用 `console.log` 输出进度提示 |
| `star-park/server/src/app.js` | Express 应用装配，**未注册任何日志中间件**（如 morgan），仅挂载 CORS、JSON 解析与路由 |
| `star-park/pc-admin/src/api/index.js` | 前端 API 请求失败时 `console.error('API Error:', error)` |
| `star-park/pc-admin/src/stores/app.js` | Pinia store 中获取孩子列表失败时 `console.error('获取孩子列表失败:', err)` |

## 3. 架构与约定

- **无集中式日志初始化**：不存在 `logger.js`、`log.js` 之类的公共模块；每个需要输出的位置自行调用 `console.*`。
- **无结构化字段**：日志为纯字符串拼接或模板字符串，不包含统一的 JSON 结构、traceId、userId、childId、action 等业务上下文字段。
- **无日志级别策略**：全部使用 `console.log` / `console.error`，没有区分 info/warn/debug/error 的分级输出，也没有按环境（dev/prod）切换级别的机制。
- **无请求级日志**：Express 未接入 morgan 或自定义 request/response 日志中间件，HTTP 请求的 URL、method、status、latency 不会被记录。
- **无日志落盘/收集**：没有 Winston/Pino 的 file/stream sink，也没有将 stdout 重定向到文件的脚本；日志仅输出到进程标准输出，由运行环境（如 Docker、PM2、终端）决定去向。
- **错误处理模式**：业务异常通过 try/catch + `console.error` 输出，未向上抛出或未返回统一错误响应体中的日志字段。

## 4. 约定与约束

本仓库**未定义任何强制性的日志规范**。从现有代码可观察到的事实性约定如下：

- 服务启动成功时，使用带 emoji 的 `console.log` 输出可读提示（如 `🌟 星星乐园后端服务已启动`、`📋 API 地址`）。
- 数据库迁移失败时使用 `console.error` 并附带中文说明（如 `planned_date 迁移失败:`、`points_reward 迁移失败:`）。
- 种子数据初始化过程使用 `console.log` 输出阶段性提示（`正在初始化种子数据...`、`种子数据初始化完成！`）。
- 前端仅在错误分支使用 `console.error` 输出，正常流程不主动打印日志。
- 所有日志均为开发/调试用途，生产环境未做脱敏或过滤，因此不应在日志中写入敏感信息（如用户密码、token）——这是基于当前实现方式的经验性约束，而非被 lint/CI 强制检查的规则。

由于没有统一的日志框架和中间件，当前日志体系属于“散点式 console 输出”，不具备跨请求追踪、结构化查询、分级开关、持久化归档等能力。若后续需要增强，建议在后端引入 `winston`/`pino` 并在 `app.js` 中注册全局中间件，在前端引入 `loglevel` 或 `pino-browser` 以统一格式与级别。