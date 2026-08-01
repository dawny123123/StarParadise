---
kind: error_handling
name: Express + SQLite 全栈错误处理模式
category: error_handling
scope:
    - '**'
source_files:
    - star-park/server/src/index.js
    - star-park/server/src/routes/rewards.js
    - star-park/server/src/routes/checkins.js
    - star-park/server/src/routes/children.js
    - star-park/server/src/routes/points.js
    - star-park/miniprogram/src/api/index.js
    - star-park/pc-admin/src/api/index.js
---

## 1. 系统/方法概述
本仓库采用「路由级 try/catch + HTTP 状态码 + 统一 JSON 结构」的轻量错误处理方案，未引入全局 Express error middleware、自定义 Error 子类或错误码枚举。前后端各自封装了请求层：小程序使用 `uni.request` Promise 包装，PC 管理端使用 axios 响应拦截器。

## 2. 关键文件与位置
- 后端入口（无全局错误中间件）：`star-park/server/src/index.js`
- 业务路由（每个 handler 自带 try/catch）：
  - `star-park/server/src/routes/rewards.js`
  - `star-park/server/src/routes/checkins.js`
  - `star-park/server/src/routes/children.js`
  - `star-park/server/src/routes/points.js`
- 小程序请求封装：`star-park/miniprogram/src/api/index.js`
- PC 管理端 axios 实例与拦截器：`star-park/pc-admin/src/api/index.js`

## 3. 架构与约定
### 3.1 后端（Express + better-sqlite3）
- **路由级捕获**：每个路由 handler 用 `try { ... } catch (err) { res.status(500).json({ error: err.message }) }` 包裹，未定义全局 `app.use((err, req, res, next) => {...})` 中间件。
- **参数校验错误**：在业务入口处直接返回 4xx，如 `res.status(400).json({ error: 'xxx 为必填项' })`、`res.status(404).json({ error: 'xxx 不存在' })`。
- **事务内异常**：通过 `db.transaction(fn)` 抛出 `Error`，由外层 catch 根据 message 内容区分 400（业务失败）与 500（数据库/运行时异常）。例如 rewards 兑换接口中按 message 包含关键字判断余额不足等场景。
- **HTTP 响应体统一字段**：错误一律以 `{ error: string }` 形式返回；成功数据直接返回对象或数组，没有统一的 `{ code, msg, data }` 信封。
- **健康检查**：`/api/health` 返回 `{ status: 'ok', timestamp }`，用于存活探针。

### 3.2 前端（小程序 & PC 管理端）
- **小程序**：`request()` 将 `uni.request` 转为 Promise，`success` 时仅当 `statusCode >= 200 && < 300` 才 resolve，否则 reject 整个 `res`；`fail` 分支弹出 toast 并 reject。
- **PC 管理端**：axios 创建实例，响应拦截器在成功时取 `response.data`，失败时 `console.error` 后 `Promise.reject(error)`，调用方自行 `.catch` 处理。
- 两个前端均未对后端 `{ error }` 做统一解析，业务组件直接消费原始数据。

## 4. 开发者应遵循的规则
1. **不要在路由外抛错**：所有异步/同步错误应在对应 handler 的 try/catch 中捕获，并以 `res.status(4xx/500).json({ error })` 返回，避免进程崩溃。
2. **业务失败优先 4xx**：参数缺失、资源不存在、余额不足等属于客户端可修复的错误，返回 400/404；仅数据库/未知异常返回 500。
3. **事务内抛错需带明确 message**：当前代码依赖 message 字符串匹配来区分 400 与 500，后续建议改用自定义错误类型或结构化错误码，避免硬编码字符串匹配。
4. **前端统一处理**：建议在小程序 `request` 与 PC axios 拦截器中统一解析后端 `{ error }`，并转换为可被 UI 消费的提示（toast/dialog），减少在各页面重复 `.catch`。
5. **禁止裸 throw**：除测试与配置校验（如 QoderWake 配置缺失）外，不要在业务逻辑中裸 `throw new Error(...)`，应通过返回值或 Promise reject 传递错误。
6. **不依赖全局错误中间件**：当前仓库未注册全局 error middleware，新增路由仍需自行 try/catch，保持一致风格。