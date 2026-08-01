---
kind: error_handling
name: Express 后端与前后端错误处理体系
category: error_handling
scope:
    - '**'
source_files:
    - star-park/server/src/app.js
    - star-park/server/src/database.js
    - star-park/server/src/routes/checkins.js
    - star-park/server/src/routes/children.js
    - star-park/server/src/routes/rewards.js
    - star-park/server/src/routes/points.js
    - star-park/miniprogram/src/api/index.js
    - star-park/pc-admin/src/api/index.js
---

## 1. 系统/方法概述
- 后端基于 Express + better-sqlite3，采用**每个路由 handler 内 try/catch 包裹 + 统一返回 `{ error }` JSON 体**的模式；未使用全局错误中间件或自定义 Error 子类。
- 数据库层通过 `db.transaction()` 封装事务，业务校验失败时直接 `throw new Error(...)`，由外层 catch 转为 HTTP 状态码。
- 前端侧：小程序用 `uni.request` 的 `success/fail` 回调区分网络成功/失败；PC 管理端用 axios 拦截器统一打印错误并 reject Promise。

## 2. 关键文件与位置
- 后端应用入口与路由注册：`star-park/server/src/app.js`
- 数据库初始化与迁移（含迁移异常处理）：`star-park/server/src/database.js`
- 各业务路由的错误处理模式示例：
  - `star-park/server/src/routes/checkins.js`
  - `star-park/server/src/routes/children.js`
  - `star-park/server/src/routes/rewards.js`
  - `star-park/server/src/routes/points.js`
- 小程序 API 请求封装（HTTP 状态判断 + toast）：`star-park/miniprogram/src/api/index.js`
- PC 管理端 axios 实例与响应拦截器：`star-park/pc-admin/src/api/index.js`
- 测试中对错误状态的断言：`star-park/server/tests/*.test.js`

## 3. 架构与约定
- **路由级 try/catch 模式**：每个 handler 用 try/catch 包裹，catch 分支一律 `res.status(500).json({ error: err.message })`，保证异常不会导致进程崩溃。
- **参数校验失败 → 400**：对必填字段、数值合法性等做前置检查，直接返回 `res.status(400).json({ error: '...' })`，不抛异常。
- **资源不存在 → 404**：如 `children/:id/balance`、`rewards/:id` 更新/删除前查询不到记录，返回 404。
- **业务异常通过 throw new Error 表达**：在 `rewards.js` 的兑换流程中，余额不足、积分不足、不支持单位等情况抛出 Error，再由 catch 分支根据 message 内容映射为 400 或 500。
- **事务一致性**：所有涉及多表写入的操作（打卡创建、奖励兑换、积分增减）均使用 `db.transaction()` 包裹，内部抛错自动回滚。
- **数据库迁移容错**：`database.js` 中 ALTER TABLE 迁移用 try/catch 捕获“重复列”错误并忽略，其他错误记录日志后重新抛出。
- **健康检查接口**：`/api/health` 直接返回 `{ status: 'ok', timestamp }`，无错误路径。

## 4. 约定与约束
- **统一错误体结构**：所有错误响应均为 `{ error: string }`，成功响应则直接返回数据对象（不含 `status` 字段），由前端自行判断。
- **HTTP 状态码约定**：
  - 400：参数缺失/非法、业务规则不满足（如任务不存在、奖励未达成、已兑换）
  - 404：资源不存在
  - 500：未预期异常（数据库错误、未知错误）
- **前端错误处理约定**：
  - 小程序：`statusCode >= 200 && < 300` 视为成功，否则 reject；网络失败时弹出 toast “网络请求失败”。
  - PC 管理端：axios 响应拦截器仅 `console.error` 并 reject，具体错误提示由各页面调用处决定。
- **测试覆盖错误路径**：tests 中对 400、404、500 等状态码进行断言，确保错误分支稳定。
- **未实现的全局错误中间件**：当前没有统一的 Express error middleware，错误处理分散在各路由 handler 中，属于可改进点。