---
name: star-park-fullstack-feature
description: "指导StarParadise全栈功能开发：从DB迁移到API、管理后台、小程序的自底向上开发模式与项目特定约定"
---

# StarParadise 全栈功能开发

## 适用场景

当需要为 StarParadise 实现跨模块的新功能时使用此 Skill。
典型触发：需求涉及数据库变更 + API 新增/修改 + 管理后台 + 小程序端的完整功能。

## 变量

| 变量 | 含义 | 来源 |
|------|------|------|
| `$PROJECT_ROOT` | 项目根目录 | 环境 |
| `$SKILL_DIR` | 本 Skill 目录 | 环境 |

## 执行流程

### Step 1: 数据库迁移

1. 在 `star-park/server/src/database.js` 的 `initDB()` 函数中添加迁移逻辑
2. **MUST** 使用 `try/catch ALTER TABLE` 模式确保幂等性，与已有 `children.points_balance` 一致：
   ```javascript
   try {
     await db.run('ALTER TABLE rewards ADD COLUMN description TEXT');
   } catch (e) {
     if (!e.message.includes('duplicate column')) throw e;
   }
   ```
3. 仅添加列级变更，不修改已有列定义
4. 验证：重启服务后数据库包含新列，重复启动不报错

### Step 2: API 路由实现

1. 在 `star-park/server/src/routes/` 对应路由文件中添加新端点
2. 涉及多表更新的操作 **MUST** 使用 `db.transaction()` 保证原子性：
   ```javascript
   await db.transaction(async () => {
     await db.run('UPDATE rewards SET redeemed_at = ? WHERE id = ?', [now, id]);
     await db.run('UPDATE children SET points_balance = points_balance - ? WHERE id = ?', [cost, childId]);
   });
   ```
3. 写操作前 **MUST** 验证业务前置条件（如 `is_achieved=1` 且 `redeemed_at IS NULL`）
4. 根据 `reward_unit` 字段区分扣减逻辑（金钱余额 vs 积分余额）
5. 验证：使用 curl 测试新端点的正常流程和边界条件

### Step 3: 管理后台 API 客户端

1. 在 `star-park/pc-admin/src/api/index.js` 中新增对应的导出函数
2. 函数签名与后端路由一致，使用项目已有的 axios 实例
3. 验证：浏览器控制台可调用新函数，返回预期数据

### Step 4: 管理后台视图实现

1. 在 `star-park/pc-admin/src/views/` 对应组件中实现交互逻辑
2. 关键约定：
   - 编辑场景中如存在关联实体（如孩子），**MUST** 禁止切换关联实体以防止数据错乱
   - 确认操作 **MUST** 显示具体扣减金额和单位
   - 状态区分使用视觉标记：已兑换灰化、已达成绿色背景 + 庆祝标识
3. 使用 Element Plus 组件库，与项目已有风格一致
4. 验证：手动测试所有交互流程

### Step 5: 小程序页面实现

1. 在 `star-park/miniprogram/src/api/index.js` 新增 API 调用函数
2. 新建页面文件 `star-park/miniprogram/src/pages/<feature>/index.vue`
3. 在 `star-park/miniprogram/src/pages.json` 注册新路由
4. 关键约定：
   - 小程序端仅实现查看功能，**不包含** 管理操作（兑换等）
   - 页面风格 **MUST** 与已有页面（如 `records/index.vue`）保持一致
   - 进度条使用 SCSS 变量，与 `uni.scss` 保持一致
5. 验证：小程序开发者工具预览页面显示正常

## 验证标准

- [ ] 服务重启无报错，数据库迁移幂等
- [ ] API 端点正常响应，事务操作保证一致性
- [ ] 管理后台 CRUD 操作完整，状态视觉区分正确
- [ ] 小程序页面可正常查看，风格一致
- [ ] `make lint-arch` 通过，无层边界违规

## 常见陷阱

- **遗漏幂等迁移**：ALTER TABLE 不加 try/catch 会导致服务重启失败
- **事务遗漏**：涉及多表更新未用 transaction，数据可能不一致
- **小程序端过度实现**：小程序是轻量端，不应包含管理操作
- **编辑时切换关联实体**：会导致数据归属错乱
