# 验收标准

## Task 1: rewards 表 schema 迁移

### 验证命令
1. `curl http://localhost:3001/api/health` — 预期输出 SHALL 包含: `"status":"ok"`（服务启动正常，迁移未报错）
2. `curl http://localhost:3001/api/rewards` — 预期输出 SHALL 包含: description、reward_unit、redeemed_at 字段（每条奖励记录包含这三列）

### 预期行为
- rewards 表新增 description(TEXT DEFAULT '')、reward_unit(TEXT DEFAULT '元')、redeemed_at(TEXT) 三列 SHALL 成功添加
- 已有奖励记录的 description SHALL 为空字符串、reward_unit SHALL 为"元"、redeemed_at SHALL 为 null
- 迁移脚本 SHALL 使用 try/catch 模式，列已存在时不报错

### 边界 Case
- 数据库已包含 description/reward_unit/redeemed_at 列时：SHALL 不报错，服务正常启动

## Task 2: 后端 rewards API 完善

### 验证命令
1. `curl -X POST http://localhost:3001/api/rewards -H "Content-Type: application/json" -d '{"child_id":1,"title":"测试奖励","target_amount":30,"description":"测试描述","reward_unit":"星星"}'` — 预期输出 SHALL 包含: `"description":"测试描述"` 和 `"reward_unit":"星星"`
2. `curl http://localhost:3001/api/rewards` — 预期输出 SHALL 包含: description 和 reward_unit 字段
3. `curl -X PUT http://localhost:3001/api/rewards/1 -H "Content-Type: application/json" -d '{"description":"更新描述","reward_unit":"元"}'` — 预期输出 SHALL 包含: `"description":"更新描述"` 和 `"reward_unit":"元"`
4. 创建一个已达成奖励后: `curl -X POST http://localhost:3001/api/rewards/REWARD_ID/redeem` — 预期输出 SHALL 包含: `"redeemed_at"` 有值

### 预期行为
- POST /api/rewards SHALL 支持 description 和 reward_unit 参数
- PUT /api/rewards/:id SHALL 支持 description 和 reward_unit 更新
- POST /api/rewards/:id/redeem SHALL 仅对 is_achieved=1 且 redeemed_at 为空的奖励执行兑换
- 兑换操作 SHALL 在事务中执行余额扣减 + 标记 redeemed_at + 创建交易记录
- reward_unit 为"元"时兑换 SHALL 扣减金钱余额（创建 redeem 类型 transaction）
- reward_unit 为"星星"时兑换 SHALL 扣减积分余额（扣减 children.points_balance + 创建负数 points 记录）

### 边界 Case
- 对未达成奖励兑换: SHALL 返回 400 `"奖励目标尚未达成，无法兑换"`
- 对已兑换奖励重复兑换: SHALL 返回 400 `"奖励已兑换，不能重复兑换"`
- 余额不足兑换: SHALL 返回 400 `"余额不足，无法兑换"` 或 `"积分余额不足，无法兑换"`
- 不支持的 reward_unit: SHALL 返回 400 `"不支持的奖励单位"`

## Task 3: 管理后台 API 客户端更新

### 验证命令
1. `grep 'redeemReward' star-park/pc-admin/src/api/index.js` — 预期输出 SHALL 包含: `export const redeemReward`

### 预期行为
- api/index.js SHALL 导出 redeemReward(id) 函数，调用 POST /api/rewards/:id/redeem
- api/index.js 奖励相关函数 SHALL 包含 5 个导出: getRewards、createReward、updateReward、deleteReward、redeemReward

### 边界 Case
- 无需额外边界测试（API 客户端仅封装 HTTP 调用）

## Task 4: 管理后台 Rewards.vue 全面重写

### 验证命令
1. 启动管理后台 `cd star-park/pc-admin && npm run dev` — 页面 SHALL 正常渲染无报错
2. 在浏览器访问 `/rewards` 页面 — SHALL 显示孩子筛选 tabs + 奖励卡片网格

### 预期行为
- 页面 SHALL 显示孩子筛选 tabs（全部 + 各孩子名称）
- 点击孩子 tab SHALL 筛选显示该孩子的奖励
- 每个奖励卡片 SHALL 显示: 名称、孩子标签、奖励单位、目标金额、进度条、已攒金额、描述
- 已达成（is_achieved=1 且 redeemed_at 空）奖励 SHALL 显示绿色庆祝标识和兑换按钮
- 已兑换（redeemed_at 有值）奖励 SHALL 灰化显示，显示"已兑换"标签和兑换日期
- 编辑按钮 SHALL 打开编辑对话框，预填当前奖励信息
- 编辑对话框提交 SHALL 调用 updateReward API
- 兑换按钮点击 SHALL 弹出确认对话框，确认后调用 redeemReward API
- 新增对话框 SHALL 支持 description 和 reward_unit 字段

### 边界 Case
- 无奖励数据时: SHALL 显示 el-empty "暂无奖励目标"
- 兑换 API 返回余额不足错误: SHALL 显示错误提示消息

## Task 5: 小程序 API + 奖励查看页面

### 验证命令
1. `grep 'createReward' star-park/miniprogram/src/api/index.js` — 预期输出 SHALL 包含 createReward 函数
2. `grep 'deleteReward' star-park/miniprogram/src/api/index.js` — 预期输出 SHALL 包含 deleteReward 函数
3. `test -f star-park/miniprogram/src/pages/rewards/index.vue && echo "EXISTS"` — 预期输出 SHALL 包含: "EXISTS"
4. `grep 'pages/rewards' star-park/miniprogram/src/pages.json` — 预期输出 SHALL 包含 rewards 页面路由配置

### 预期行为
- api/index.js SHALL 导出 createReward 和 deleteReward 函数
- pages/rewards/index.vue SHALL 显示孩子选择器 + 奖励列表
- 奖励列表 SHALL 显示每个奖励的: 名称、单位、进度条、当前/目标金额、描述
- 已达成奖励 SHALL 显示庆祝标识
- 已兑换奖励 SHALL 显示已兑换标识
- 页面底部 SHALL 显示统计卡片: 进行中数量、已达成数量、已兑换数量
- pages.json SHALL 注册 pages/rewards/index 路由，navigationBarTitleText 为"奖励目标"

### 边界 Case
- 无奖励数据时: SHALL 显示空状态提示 "暂无奖励目标"

## 全局验证 (MANDATORY)

> ⛔ executor 在所有 Task 标记 `- [x]` 后 **MUST** 执行本段所有命令。任何命令失败则报告错误并尝试修复，**SHALL NOT** 跳过或声明任务完成。

### 构建验证
`make build` — SHALL 输出: BUILD SUCCESS

### 回归验证
`make test` — SHALL 输出: 0 failures

### lint 验证
`make lint` — SHALL 输出: 所有 lint 检查通过，无错误

### 功能验证场景
1. 创建奖励含 description 和 reward_unit: `curl -X POST http://localhost:3001/api/rewards -H "Content-Type: application/json" -d '{"child_id":1,"title":"新玩具","target_amount":50,"description":"变形金刚","reward_unit":"元"}'` → SHALL 返回包含 description 和 reward_unit 的奖励对象
2. 兑换已达成奖励: 先创建奖励并模拟达成状态，然后调用 redeem → SHALL 返回 redeemed_at 有值的奖励对象，余额 SHALL 被扣减
3. 管理后台奖励页面加载: 访问 /rewards → SHALL 正常渲染所有奖励卡片，筛选 tab 功能正常
4. 小程序奖励页面: 确保 pages.json 注册正确 → 页面 SHALL 可访问且显示奖励进度数据