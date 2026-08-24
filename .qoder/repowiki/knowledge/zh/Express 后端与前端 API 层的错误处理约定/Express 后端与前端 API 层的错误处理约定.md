---
kind: error_handling
name: Express 后端与前端 API 层的错误处理约定
slug: error_handling
category: error_handling
scope:
    - '**'
---

## 1. 整体方案

本仓库的错误处理集中在 **Express + SQLite（better-sqlite3）后端**，以及前后端各自的 API 客户端中。后端没有引入统一的异常类或全局错误中间件，而是采用 **每个路由 handler 内 try/catch + 业务校验返回 4xx、未知异常返回 500** 的轻量约定；数据库迁移阶段使用 try/catch 吞掉重复列等可预期错误。

## 2. 关键文件与位置

- `star-park/server/src/app.js`：Express 应用装配，仅注册 CORS、JSON 解析中间件与路由，**未定义全局错误处理中间件**（无 `app.use((err, req, res, next) => ...)`）。
- `star-park/server/src/database.js`：better-sqlite3 连接、建表、增量迁移；所有 `ALTER TABLE` 迁移用 try/catch 包裹，忽略 `duplicate column name` 等幂等错误，其余错误记录后抛出。
- `star-park/server/src/routes/*.js`：八大业务路由（children/tasks/checkins/rewards/stats/points/goals/todos），统一以 try/catch 包裹 handler body。
- `star-park/server/src/index.js`：启动入口，调用 seed 并监听端口，无全局异常捕获。
- `star-park/miniprogram/src/api/index.js`：小程序端封装 `wx.request`，仅对 2xx 响应走成功分支，其他状态码由调用方自行处理。
- `star-park/pc-admin/src/api/index.js`：PC 管理后台基于 axios，配置了全局请求拦截器在失败时 `console.error('API Error:', error)` 并 reject Promise；另有 QoderWake 集成处直接 `throw new Error(...)` 抛错。

## 3. 架构与约定

### 3.1 后端路由层错误模式

每个路由 handler 遵循同一模板：

```js
router.post('/', (req, res) => {
  try {
    // 参数校验 → res.status(400).json({ error: '...' })
    // 业务校验（如资源不存在）→ res.status(404).json({ error: '...' })
    // 数据库操作
    res.json(...) / res.status(201).json(...)
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

- **参数缺失/非法**：返回 `400`，body 为 `{ error: '中文提示' }`（例如 `child_id、task_id 和 checkin_date 为必填项`、`积分分值必须是非零整数`）。
- **资源不存在**：返回 `404`，如 `奖励目标不存在`。
- **业务规则冲突**：返回 `400`，如 `任务不存在`、`奖励目标尚未达成，无法兑换`、`奖励已兑换，不能重复兑换`、`余额不足，无法兑换`、`积分余额不足，无法兑换`、`不支持的奖励单位`。
- **未知异常**：统一 `500` + `{ error: err.message }`。

### 3.2 事务内错误传播

涉及多表写操作的场景（打卡创建、自动打卡、积分发放、奖励兑换）使用 better-sqlite3 的 `db.transaction(() => {...})` 包装。事务内部通过 `throw new Error('...')` 主动中断（如余额不足、不支持的单位），外层 catch 根据错误消息前缀判断是否为已知业务错误：`knownErrors = ['余额不足', '积分余额不足', '不支持的奖励单位', '尚未达成', '已兑换']`，命中则降级为 `400`，否则 `500`。

### 3.3 数据库迁移错误

`database.js` 中多次执行 `ALTER TABLE ... ADD COLUMN` 做向后兼容迁移。每次迁移都包裹 try/catch：
- 若错误包含 `duplicate column name`（不区分大小写），视为字段已存在，静默忽略。
- 其他错误打印 `console.error('xxx 迁移失败:', err.message)` 后重新 throw，使服务启动失败。

### 3.4 前端错误处理

- **小程序端**：`wx.request` 回调中仅判断 `res.statusCode >= 200 && < 300` 为成功，其余状态码由页面逻辑自行处理，无统一错误弹窗或重试机制。
- **PC 管理后台**：axios 拦截器在 response error 时 `console.error('API Error:', error)` 并 `Promise.reject(error)`，由组件层 catch；QoderWake 集成处直接 `throw new Error(...)` 向上冒泡。

## 4. 约定与约束

| 约定 | 说明 | 证据来源 |
|---|---|---|
| 每个路由 handler 必须用 try/catch 包裹 | 所有现有路由均如此，未知异常统一 500 | `routes/*.js` 全部 handler |
| 业务校验失败返回 400，含中文 error 字段 | 参数缺失、业务规则冲突均按此格式 | `checkins.js`、`rewards.js`、`points.js` |
| 资源不存在返回 404 | 如 rewards GET/PUT/DELETE 中对 id 的查询 | `routes/rewards.js` |
| 多表写操作必须用 `db.transaction` 包裹 | 打卡、积分、兑换等写路径均如此 | `routes/checkins.js`、`routes/points.js`、`routes/rewards.js` |
| 事务内业务错误通过 `throw new Error` 中断 | 余额不足、单位不支持等场景 | `routes/rewards.js` redeem 分支 |
| 已知业务错误在外层 catch 中识别并降级为 400 | 通过 `knownErrors` 字符串匹配 | `routes/rewards.js` |
| 数据库迁移必须幂等 | ALTER TABLE 加 try/catch 忽略重复列 | `database.js` |
| 无全局错误中间件 | app.js 未注册 `(err, req, res, next)` | `src/app.js` |
| 前端无统一 HTTP 错误处理 | 小程序仅判断 2xx；PC 仅 console.error | `miniprogram/src/api/index.js`、`pc-admin/src/api/index.js` |

## 5. 风险与改进点

- 缺少全局 Express 错误中间件，新增路由容易遗漏 try/catch 导致未捕获异常。
- 错误类型分散为字符串消息，依赖 `knownErrors.some(msg => err.message.includes(msg))` 进行 400/500 分流，脆弱且易遗漏新错误文案。
- 前端未统一封装 API 响应错误，各页面需自行处理非 2xx 响应。
- 数据库迁移错误仅在开发/生产环境有日志输出，测试环境（内存库）下迁移失败不会暴露给调用方。