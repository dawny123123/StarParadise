# 奖励管理功能完善

## 需求背景

当前奖励管理（Rewards）功能仅实现了基础的 CRUD：家长可创建和删除奖励目标，但缺少编辑、兑换、状态区分等核心功能。数据库 rewards 表缺少 description 和 reward_unit 列，导致前端字段映射不一致（description 始终为空，rewardUnit 硬编码为"元"）。奖励达成后（is_achieved=1）无兑换机制，孩子无法实际领取奖励。小程序端完全没有奖励查看页面，孩子无法了解自己的攒钱进度。这些缺陷使得奖励管理作为激励闭环的关键环节功能不完整，降低了产品的激励效果。

## 目标

- 目标 1: rewards 表新增 description 和 reward_unit 列，前后端字段映射一致
- 目标 2: 管理后台 Rewards.vue 支持编辑奖励目标、筛选孩子、区分达成状态、家长确认兑换
- 目标 3: 后端新增奖励兑换 API（POST /api/rewards/:id/redeem），含事务保护的余额扣减逻辑
- 目标 4: 小程序新增奖励进度查看页面，孩子可查看所有奖励目标的进度和达成状态
- 目标 5: 所有新增/修改代码符合层边界规则（lint-deps + lint-quality 通过）

## 范围

### 包含
- rewards 表 schema 迁移（新增 description、reward_unit、redeemed_at 列）
- 后端 rewards 路由完善（POST/PUT 支持 description/reward_unit；新增兑换端点）
- 管理后台 Rewards.vue 全面重写（编辑对话框、孩子筛选 tab、达成/兑换状态视觉区分、兑换确认操作）
- 管理后台 API 客户端新增 redeemReward 函数
- 小程序新增奖励查看页面（pages/rewards/index.vue）+ API 新增 createReward/deleteReward/updateReward
- 小程序 pages.json 路由注册

### 排除
- 不修改积分（points）或打卡（checkins）的业务逻辑
- 不修改管理后台 SideNav 导航顺序（奖励管理已存在）
- 不新增家长/孩子角色认证系统（当前无认证）
- 不修改 Goals.vue 页面（目标管理与奖励管理是独立功能）
- 不实现奖励兑换申请流程（孩子发起→家长审批），本次仅家长直接兑换

## 约束与设计原则

- 兑换操作 SHALL 在数据库事务中执行（余额扣减 + 标记 redeemed_at + 创建交易记录），防止数据不一致
- 兑换前 SHALL 验证 is_achieved=1 且 redeemed_at 为空，防止重复兑换
- 兑换扣减的金额 SHALL 等于 reward.current_amount（奖励攒到的金额），而非 target_amount
- rewards 表迁移 SHALL 使用 try/catch ALTER TABLE 模式（与已有迁移一致），避免列已存在报错
- 前端奖励单位支持"元"和"星星"两种，但打卡攒钱机制不变（仅影响显示文案）
- 所有新文件 SHALL 首日 lint-clean（lint-deps + lint-quality）

## 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 兑换扣余额但余额不足 | 金钱数据错误 | 兑换 API 先查余额验证 >= current_amount，不足时返回 400 |
| DB 迁移 ALTER TABLE 列已存在 | 服务启动报错 | 复用已有 try/catch 迁移模式，捕获错误后忽略 |
| 小程序新增页面未注册路由 | 页面无法访问 | 确保 pages.json 正确注册 rewards 页面 |
| reward_unit="星星"时兑换扣金钱余额 | 逻辑不一致 | 兑换端点根据 reward_unit 决定扣减对象（元→扣余额，星星→扣积分余额） |

## 技术方案

### DB 迁移
rewards 表新增 3 列：description(TEXT)、reward_unit(TEXT DEFAULT '元')、redeemed_at(TEXT)。使用 database.js 中已有的 try/catch ALTER TABLE 迁移模式。

### 兑换 API 设计
新增 `POST /api/rewards/:id/redeem` 端点。在 better-sqlite3 事务中执行：
1. 验证 reward 存在、is_achieved=1、redeemed_at 为空
2. 根据 reward_unit 查询对应余额（元→查 transactions 汇总余额，星星→查 points_balance）
3. 验证余额 >= current_amount，不足则返回 400
4. 执行：标记 redeemed_at=datetime('now')、创建 redeem 类型交易记录（扣减余额）、若 reward_unit=星星 则扣减 points_balance

### 管理后台重写
Rewards.vue 改为：顶部孩子筛选 tabs + 奖励卡片网格（含进度条）+ 新增/编辑对话框（支持 description/reward_unit）+ 兑换确认按钮（仅已达成奖励显示）+ 已兑换奖励灰化显示。

### 小程序新增页面
pages/rewards/index.vue：孩子选择器 + 奖励卡片列表（进度条+达成状态标识）+ 底部统计（攒了多少/还有多少）。纯查看页面，不包含兑换操作。

### 执行顺序
1. Task 1: DB 迁移（无依赖，先行）
2. Task 2: 后端 rewards API 完善（依赖 Task 1 schema）
3. Task 3: 管理后台 API 客户端更新（依赖 Task 2 API 契约）
4. Task 4: 管理后台 Rewards.vue 重写（依赖 Task 3 API 函数）
5. Task 5: 小程序 API + 页面新增（依赖 Task 2 API 契约）

## 依赖图

### 代码依赖图

| 组件 | 依赖 | 被依赖 |
|------|------|--------|
| database.js (L0) | better-sqlite3 | rewards.js, checkins.js |
| rewards.js (L1) | database.js | Rewards.vue (通过 API), 小程序 rewards 页面 |
| pc-admin/api/index.js (L3) | axios | Rewards.vue (L4) |
| Rewards.vue (L4) | api/index.js, app store | - |
| miniprogram/api/index.js (L3) | uni.request | rewards/index.vue (L4) |
| rewards/index.vue (L4) | api/index.js | - |

### 影响范围
- **直接修改**: `server/src/database.js`, `server/src/routes/rewards.js`, `pc-admin/src/api/index.js`, `pc-admin/src/views/Rewards.vue`, `miniprogram/src/api/index.js`
- **新建**: `miniprogram/src/pages/rewards/index.vue`
- **配置修改**: `miniprogram/src/pages.json`