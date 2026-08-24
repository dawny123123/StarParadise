---
kind: error_handling
name: Express 路由级 try/catch + SQLite 事务的错误处理模式
category: error_handling
scope:
    - '**'
source_files:
    - star-park/server/src/app.js
    - star-park/server/src/database.js
    - star-park/server/src/routes/checkins.js
    - star-park/server/src/routes/rewards.js
    - star-park/server/src/routes/children.js
    - star-park/server/src/routes/goals.js
---

## 1. 整体方案

该 Monorepo 的后端服务（`star-park/server/src`）基于 Express + better-sqlite3，**没有引入统一的错误中间件或自定义 Error 类**。错误处理采用最直接的“每个路由 handler 包裹 try/catch”的方式：
- 参数校验失败 → 直接 `res.status(400).json({ error: '...' })` 返回。
- 资源不存在 → `res.status(404).json({ error: '...' })`。
- 业务规则违反（如奖励未达成、重复兑换、余额不足）→ 在事务内 `throw new Error('...')`，由外层 catch 捕获后按消息关键字映射为 400。
- 数据库/运行时异常 → 统一 `res.status(500).json({ error: err.message })`。

全局层 (`app.js`) 仅注册 `cors()`、`express.json()` 和路由，**未定义全局错误处理器**（如 `app.use((err, req, res, next) => ...)`），因此所有异常必须由各自路由的 try/catch 兜底。

## 2. 关键文件与位置

| 文件 | 作用 |
|---|---|
| `star-park/server/src/app.js` | Express 应用装配，无全局错误中间件 |
| `star-park/server/src/database.js` | SQLite 连接、建表、迁移；迁移语句用 try/catch 忽略“列已存在”等幂等错误 |
| `star-park/server/src/routes/*.js` | 八大业务路由（children/tasks/checkins/rewards/stats/points/goals/todos），每个 handler 独立 try/catch |
| `star-park/server/tests/helpers.js` / `tests/setup.js` | 测试环境通过 `resetForTest()` 清理数据，不依赖全局错误处理 |

## 3. 架构与约定

### 3.1 路由级 try/catch 模式
每个 Express 路由 handler 都形如：
```js
router.post('/', (req, res) => {
  try { /* 业务逻辑 */ }
  catch (err) { /* v8 ignore next */ res.status(500).json({ error: err.message }); }
});
```
所有 catch 块均使用 `/* v8 ignore next */` 注释标记以跳过覆盖率统计。这是仓库中观察到的统一风格。

### 3.2 参数校验前置
在 try 内部、执行 DB 操作前进行入参校验，失败时立即返回 400，例如：
- `checkins.js`: `child_id、task_id 和 checkin_date 为必填项`
- `rewards.js`: `child_id、title 和 target_amount 为必填项`
- `children.js`: `name 为必填项`
- `goals.js`: `title 为必填项`

### 3.3 业务错误通过 throw + 关键字匹配降级为 400
`rewards.js` 的 `/redeem` 接口是典型示例：在 `db.transaction` 回调中遇到余额不足、单位不支持等情况 `throw new Error('余额不足，无法兑换')`，外层 catch 通过白名单 `knownErrors = ['余额不足', '积分余额不足', '不支持的奖励单位', '尚未达成', '已兑换']` 判断是否为已知业务错误，若是则返回 400，否则回退到 500。

### 3.4 资源不存在统一 404
多个路由在查询目标记录后立即判空并返回 404：
- `rewards.js`: `'奖励目标不存在'`
- `children.js`: `'孩子不存在'`
- `goals.js`: `'目标不存在'`
- `checkins.js`: `'任务不存在'`

### 3.5 SQLite 事务用于复合写操作
打卡创建、自动打卡、奖励兑换等涉及多表写入的操作全部通过 `db.transaction(() => {...})` 包裹，保证原子性。事务内抛出的错误会触发回滚并被上层 catch 捕获。

### 3.6 迁移脚本的幂等错误处理
`database.js` 中所有 `ALTER TABLE` 和 `CREATE INDEX` 都用 try/catch 包裹，对 `duplicate column name` 等可预期错误静默忽略，对其他错误记录 `console.error` 后重新抛出。这使同一份代码可在首次部署和后续升级中安全运行。

## 4. 约定与约束

- **无全局错误中间件**：所有异常必须在路由 handler 内被 try/catch 捕获，否则 Express 默认行为会将未处理异常转为 500 响应。
- **错误体格式统一**：客户端期望 `{ error: string }` 结构，400/404/500 均遵循此格式。
- **业务错误必须 throw Error**：在事务内部通过 `throw new Error(...)` 表达业务违规，再由外层 catch 根据消息内容区分 400 与 500。
- **v8 覆盖率豁免**：catch 分支统一使用 `/* v8 ignore next */` 注释，避免污染覆盖率报告。
- **前端侧无集中错误处理**：小程序 (`miniprogram/src/api/index.js`) 与管理后台 (`pc-admin/src/api/index.js`) 的 API 调用均为简单 fetch/axios 封装，未发现全局拦截器或错误重试机制，错误由页面组件自行处理。
- **健康检查**：`/api/health` 始终返回 `{ status: 'ok', timestamp }`，作为部署健康探针的基础。

## 5. 风险与改进空间

当前模式简单直观，但缺乏以下能力：
- 没有统一的错误类型（如 `NotFoundError`、`ValidationError`），导致 400 vs 500 的判断依赖字符串匹配（见 `knownErrors` 列表），新增业务错误需同步维护白名单。
- 缺少全局错误中间件，新增路由若遗漏 try/catch 会导致未捕获异常。
- 日志缺失：catch 块仅返回 JSON，未记录堆栈或请求上下文，生产排障困难。
- 前端未统一处理 4xx/5xx，各页面自行展示错误提示，体验不一致。
