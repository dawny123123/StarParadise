---
kind: logging_system
name: 后端使用原生 console 输出，无结构化日志系统
category: logging_system
scope:
    - '**'
source_files:
    - star-park/server/src/index.js
    - star-park/server/src/database.js
    - star-park/server/src/seed.js
    - star-park/server/src/app.js
    - star-park/server/package.json
---

## 1. 使用的系统/方案

本仓库的 Node.js 后端（`star-park/server`）未引入任何第三方日志框架（如 winston、pino、bunyan、log4js、morgan、debug 等），也未在 `package.json` 中声明相关依赖。所有日志输出均直接使用 Node.js 内置的 `console.log` / `console.error`。

- 启动阶段：`src/index.js` 通过 `console.log` 打印服务监听地址与 API 入口。
- 数据层异常：`src/database.js` 在数据库迁移失败时通过 `console.error` 输出错误信息（包含 `planned_date`、`points_reward`、`parent_id` 迁移失败的 message）。
- 初始化流程：`src/seed.js` 使用 `console.log` 报告种子数据状态（已存在/正在初始化/完成）。

前端（`star-park/miniprogram` 与 `star-park/pc-admin`）同样未发现统一的日志封装，仅作为普通 Vue/uni-app 应用存在，未见全局日志拦截或上报逻辑。

## 2. 关键文件

- `star-park/server/src/index.js`：服务启动入口，打印启动成功信息。
- `star-park/server/src/database.js`：数据库初始化与迁移，出错时 `console.error` 输出。
- `star-park/server/src/seed.js`：种子数据初始化，使用 `console.log` 报告进度。
- `star-park/server/package.json`：依赖列表中无任何日志库。

## 3. 架构与约定

- **无集中式日志模块**：不存在 `log/`、`logging/`、`logger.js` 等统一日志入口；每个文件按需直接调用 `console.*`。
- **无日志级别管理**：未定义 info/warn/error/debug 分级策略，全部以 `console.log` 或 `console.error` 区分。
- **无结构化字段**：日志为纯字符串拼接，不包含请求 ID、用户 ID、时间戳、traceId 等结构化字段。
- **无中间件聚合**：Express 应用（`src/app.js`）未注册任何日志中间件（如 morgan），请求/响应未被记录。
- **生产/开发无差异化配置**：未通过环境变量切换日志级别或输出目标（stdout/stderr/file）。进程由 systemd 托管（见 `deploy/star-park-server.service`），日志默认输出到 journald。

## 4. 约定与约束

- **约束来源**：`package.json` 的 dependencies 中未包含任何日志库，且全仓搜索 `winston|pino|bunyan|log4js|morgan|debug` 均无匹配——这构成事实上的约束：本项目当前不依赖第三方日志框架。
- **约定（描述性）**：仅在“启动”“初始化”“异常”三类场景使用 `console` 输出；业务路由层（`routes/*.js`）未发现显式日志调用，意味着运行时行为追踪主要依赖外部系统（systemd/journald）捕获 stdout/stderr。
- **部署侧约束**：服务以 systemd unit 运行，日志由 systemd journal 收集，因此 `console.log` 输出即生产日志的唯一载体，不应被重定向或丢弃。

综上，该仓库的日志系统处于最简形态：仅依赖 Node.js 原生 `console` 输出，无框架、无级别、无结构化、无中间件聚合，生产日志完全交由 systemd/journald 承载。