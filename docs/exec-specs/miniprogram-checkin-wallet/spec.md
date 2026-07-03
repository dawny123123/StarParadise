# 小程序打卡与钱包（金额+积分）查看

## 需求背景

当前小程序的打卡功能（checkin/index.vue）已实现基本的任务列表展示和打卡提交，但存在以下问题：

1. **打卡状态不实时**：页面加载时任务 `done` 字段始终为 `false`，无法反映当天已打卡的任务。孩子无法一眼看出哪些任务已完成、哪些待完成，可能重复打卡。
2. **金额与积分散落在多处**：余额信息仅在打卡页底部 stats-card 以小字显示，积分余额也仅在该处出现，没有独立的"钱包"入口。孩子无法集中查看自己的金额明细、积分明细和历史变化。
3. **打卡记录页数据映射问题**：records/index.vue 的 `loadRecords` 调用 `api.getCheckins({ childId })` 但后端接口参数名为 `child_id`，导致接口调用可能失败，退回默认硬编码数据。
4. **缺少交易明细查看**：孩子无法查看自己的金钱收支明细（earn/spend），也无法查看积分变动历史。

## 目标

- **目标 1**：打卡页加载时从后端获取当日已打卡记录，自动标记已完成任务，防止重复打卡
- **目标 2**：新增小程序"钱包"页面，集中展示金额余额和积分余额，支持查看交易明细和积分变动记录
- **目标 3**：修复打卡记录页（records/index.vue）的 API 参数映射问题
- **目标 4**：所有新增/修改代码符合层边界规则（lint-deps + lint-quality 通过）

## 范围

### 包含

- 打卡页（checkin/index.vue）改造：加载时获取当日打卡记录，自动标记已完成任务；已打卡任务禁用重复打卡
- 新增钱包页面（pages/wallet/index.vue）：金额余额卡片 + 积分余额卡片 + 交易明细列表 + 积分变动列表
- 小程序 API 客户端新增 `getTransactions(childId)` 函数
- 小程序 pages.json 注册钱包页面 + TabBar 添加"钱包"入口
- 打卡记录页（records/index.vue）修复 API 参数名 `childId` → `child_id`
- 后端 children/:id/transactions 路由改造：同时返回 transactions 表的金钱交易记录（而非当前仅查 points 表）

### 排除

- 不修改后端打卡（checkins）的业务逻辑
- 不修改后端积分（points）的业务逻辑
- 不修改管理后台（pc-admin）的任何代码
- 不新增家长/孩子角色认证系统（当前无认证）
- 不修改首页（index/index.vue）的功能逻辑
- 不实现钱包提现/转账功能（仅查看）

## 约束与设计原则

- 打卡状态查询 SHALL 使用 `GET /api/checkins?child_id=x&date=YYYY-MM-DD`，该接口已存在
- 已打卡的任务 SHALL 禁用勾选并显示"已完成"标识，防止重复提交
- 钱包页面 SHALL 通过 `GET /api/children/:id/transactions` 获取金钱交易明细，通过 `GET /api/points?child_id=x` 获取积分记录
- 后端 `GET /api/children/:id/transactions` 当前仅查 points 表，SHALL 改为查 transactions 表以返回金钱收支记录
- TabBar 最多支持 5 个 tab（微信小程序限制），当前 4 个 + 新增钱包 = 5，刚好满足
- 所有新文件 SHALL 首日 lint-clean（lint-deps + lint-quality）
- 单个文件 ≤ 500 行

## 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| TabBar 达到 5 个上限 | 无法再添加 tab | 当前 5 个足够，暂不需要更多入口 |
| 后端 transactions 路由改造影响管理后台 | 管理后台可能依赖现有响应格式 | 检查 pc-admin 是否调用该接口，如有则保持兼容 |
| 重复打卡防护仅前端禁用 | 用户可通过 API 直接重复提交 | 后端 checkins POST 已有逻辑但无重复检测，本次不修改后端，仅前端防护 |
| 钱包页面数据量大时性能 | 交易记录过多导致加载慢 | 后端暂不分页，前端显示最近 50 条，后续可加分页 |

## 技术方案

### 1. 打卡页改造（checkin/index.vue）

**当前问题**：`loadData()` 调用 `api.getChildren()` 获取任务列表，但返回的 tasks 中 `done` 字段始终为 `false`（后端不返回打卡状态）。

**改造方案**：
1. `loadData()` 获取孩子和任务后，额外调用 `api.getCheckins({ child_id: activeChildId, date: today })` 获取今日打卡记录
2. 根据返回的打卡记录匹配 task_id，将已完成任务的 `done` 设为 `true`
3. 已完成的任务在 TaskItem 中显示为禁用状态（不可取消勾选），样式为灰色 + "已完成" 标识
4. 提交打卡时，跳过已完成的任务（仅提交 `done === true && 原始 done === false` 的任务）

**TaskItem 组件改造**：
- 新增 `disabled` prop，当为 true 时禁止点击 toggle
- 已完成任务显示样式：勾选框灰色、文字加删除线或灰色

### 2. 新增钱包页面（pages/wallet/index.vue）

**页面结构**：
```
┌─────────────────────────┐
│   孩子选择器 tabs        │
├─────────────────────────┤
│   ┌─────────┬─────────┐ │
│   │ 金额余额 │ 积分余额 │ │
│   │  ¥34.0  │  128    │ │
│   └─────────┴─────────┘ │
├─────────────────────────┤
│   Tab: 交易明细 | 积分记录│
├─────────────────────────┤
│   +1元  完成英语背单词    │
│         今天 08:30       │
│   +2元  完成数学练习      │
│         昨天 20:15       │
│   -30元 兑换粉色小书包    │
│         5月1日           │
│   ...                    │
└─────────────────────────┘
```

**数据获取**：
- 余额数据：`api.getChildren()` 返回的 `balance`（金额）和 `points_balance`（积分）
- 交易明细：`api.getTransactions(childId)` — 新增 API 函数，调用 `GET /api/children/:id/transactions`
- 积分记录：`api.getPoints(childId)` — 已有 API 函数，调用 `GET /api/points?child_id=x`

**交互**：
- 顶部孩子选择器切换
- 中部双卡片展示余额和积分
- 底部 tab 切换"交易明细"和"积分记录"两个列表

### 3. 后端 transactions 路由改造

**当前问题**：`GET /api/children/:id/transactions` 查询的是 `points` 表（积分记录），而非 `transactions` 表（金钱交易记录）。命名与语义不符。

**改造方案**：
- 改为查询 `transactions` 表：`SELECT * FROM transactions WHERE child_id = ? ORDER BY created_at DESC`
- 返回格式：`{ id, child_id, type, amount, description, created_at }`
- `type` 为 `earn`（收入）或 `spend`（支出）

### 4. 小程序 API 客户端更新

新增函数：
```js
getTransactions: (childId) => request({ url: `/children/${childId}/transactions` })
```

### 5. 打卡记录页修复

`records/index.vue` 中 `loadRecords()` 的 API 调用参数从 `childId` 修正为 `child_id`：
```js
// 修复前
const res = await api.getCheckins({ childId: activeChildId.value })
// 修复后
const res = await api.getCheckins({ child_id: activeChildId.value })
```

### 6. pages.json 和 TabBar 更新

- 新增页面注册：`{ "path": "pages/wallet/index", "style": { "navigationBarTitleText": "我的钱包" } }`
- TabBar 新增条目：钱包 tab（放在"记录"和"我的"之间）
- 需要准备钱包 tab 的图标文件（static/tabbar/wallet.png 和 wallet-active.png）

### 执行顺序

1. **Task 1**: 后端 transactions 路由改造（改为查 transactions 表）
2. **Task 2**: 小程序 API 客户端更新（新增 getTransactions、修复参数名）
3. **Task 3**: 打卡页改造（加载时标记已打卡任务 + 防重复打卡）
4. **Task 4**: TaskItem 组件改造（新增 disabled 状态）
5. **Task 5**: 新增钱包页面（pages/wallet/index.vue）
6. **Task 6**: pages.json + TabBar 配置更新

## 依赖图

### 代码依赖图

| 组件 | 依赖 | 被依赖 |
|------|------|--------|
| children.js routes (L1) | database.js (L0) | wallet/index.vue (L4), api/index.js (L3) |
| miniprogram/api/index.js (L3) | uni.request | checkin/index.vue (L4), wallet/index.vue (L4), records/index.vue (L4) |
| TaskItem.vue (L3) | - | checkin/index.vue (L4) |
| checkin/index.vue (L4) | api/index.js (L3), TaskItem.vue (L3) | - |
| wallet/index.vue (L4) | api/index.js (L3) | - |
| records/index.vue (L4) | api/index.js (L3) | - |
| pages.json (配置) | - | wallet/index.vue |

### 影响范围

- **直接修改**: `star-park/server/src/routes/children.js`, `star-park/miniprogram/src/api/index.js`, `star-park/miniprogram/src/pages/checkin/index.vue`, `star-park/miniprogram/src/components/TaskItem.vue`, `star-park/miniprogram/src/pages/records/index.vue`, `star-park/miniprogram/src/pages.json`
- **新建**: `star-park/miniprogram/src/pages/wallet/index.vue`
- **新增资源**: 钱包 tab 图标文件（2个 png）
