# 目标与待办任务数据库持久化

## 1. 背景与问题

PC 管理后台「目标管理」页（`star-park/pc-admin/src/views/Goals.vue`）中的**年度目标**与**待办任务**目前仅存储在浏览器 `localStorage`：

| 存储键 | 数据 | 结构 |
|--------|------|------|
| `star-park-pcadmin-goals` | 年度目标 | `{id, title, status, progress, target, childName?, childId?}` |
| `star-park-pcadmin-todos` | 待办任务 | `{id, title, goalId, creator, priority, expectedPoints, plannedDate, description, completed, childName?, childId?}` |

由此产生的问题：

1. **无法跨设备/浏览器共享** —— 换浏览器或清理缓存即数据丢失。
2. **与后端数据割裂** —— 同一系统内 `Tasks.vue` 的孩子任务已持久化到 SQLite，两套机制并存造成认知负担。
3. **无法被其他端消费** —— 小程序端、统计接口无法读取目标与待办数据。
4. **id 使用 `Date.now()`** —— 存在跨设备冲突风险，且无法建立可靠外键关联。

## 2. 目标

将目标与待办迁移到后端 SQLite 数据库持久化，形成单一数据源：

- 后端新增 `goals`、`todos` 两张表及完整 CRUD REST API。
- 前端 `Goals.vue` 改为通过 HTTP API 读写，移除 `localStorage` 作为数据源。
- 提供**一次性自动迁移**：把用户浏览器 `localStorage` 中已有的目标与待办导入数据库，并正确重映射目标关联关系。
- 保持现有 UI 行为与交互不变（包括待办完成时的积分自动汇总）。

## 3. 非目标

- 不改动 `Tasks.vue` 及 `/api/tasks` 相关逻辑（那是独立的「孩子任务」域）。
- 不为小程序端新增目标/待办页面。
- 不引入用户认证或多租户隔离。
- 不引入外部数据库迁移工具（沿用项目既有 try/catch ALTER TABLE 幂等模式）。

## 4. 数据模型设计

### 4.1 `goals` 表

```sql
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  progress INTEGER DEFAULT 0,
  target INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (child_id) REFERENCES children(id)
);
```

| 字段 | 说明 |
|------|------|
| `child_id` | 归属孩子；`NULL` 表示全局目标（在「全部目标」页展示） |
| `status` | 枚举字符串：`todo` / `rest` / `health` / `happy` / `study` |
| `progress` / `target` | 进度分子/分母，`target` 最小 1 |

### 4.2 `todos` 表

```sql
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER,
  child_id INTEGER,
  title TEXT NOT NULL,
  creator TEXT,
  priority TEXT DEFAULT 'medium',
  expected_points INTEGER DEFAULT 0,
  planned_date TEXT,
  description TEXT,
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (goal_id) REFERENCES goals(id),
  FOREIGN KEY (child_id) REFERENCES children(id)
);
```

| 字段 | 说明 |
|------|------|
| `goal_id` | 关联目标；`NULL` 表示未关联 |
| `child_id` | 归属孩子；`NULL` 表示全局待办 |
| `priority` | 枚举字符串：`high` / `medium` / `low` |
| `expected_points` | 完成时奖励的积分，默认 0 |
| `planned_date` | `YYYY-MM-DD` 格式，允许 `NULL` |
| `completed` | 0 / 1 |

### 4.3 字段命名映射

后端使用 snake_case，前端保持现有 camelCase，在 `Goals.vue` 内做双向映射：

| 前端字段 | 后端字段 |
|----------|----------|
| `childId` | `child_id` |
| `goalId` | `goal_id` |
| `expectedPoints` | `expected_points` |
| `plannedDate` | `planned_date` |
| `completed`（boolean） | `completed`（0/1） |

`childName` 不入库，由前端通过 `store.children` 按 `child_id` 反查得到。

## 5. API 设计

所有接口以 `/api` 为前缀，遵循项目既有风格（`db.prepare` 占位符、try/catch 返回 `{ error }` 500）。

### 5.1 目标接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/goals?child_id=x` | 列表；`child_id` 可选筛选，按 `id ASC` 排序 |
| POST | `/api/goals` | 创建；`title` 必填 |
| PUT | `/api/goals/:id` | 更新；不存在返回 404 |
| DELETE | `/api/goals/:id` | 删除；**事务内**先将关联 `todos.goal_id` 置 NULL 再删目标 |

### 5.2 待办接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/todos?child_id=x&goal_id=y` | 列表；两个筛选参数均可选，按 `id ASC` 排序 |
| POST | `/api/todos` | 创建；`title` 必填 |
| PUT | `/api/todos/:id` | 更新；不存在返回 404 |
| DELETE | `/api/todos/:id` | 删除 |

### 5.3 可空字段语义

`PUT` 请求需区分「未传字段」（保持原值）与「显式传 null」（清空），沿用 `routes/tasks.js` 中 `planned_date` 的处理模式：

```js
if ('planned_date' in req.body) {
  sql += `, planned_date = ?`;
  params.push(planned_date ?? null);
}
```

适用字段：`goals.child_id`；`todos.goal_id`、`todos.child_id`、`todos.planned_date`、`todos.expected_points`、`todos.completed`、`todos.description`。

## 6. 前端行为规格

### 6.1 过滤规则（严格沿用现有代码行为）

现有代码中目标与待办的过滤规则**并不对称**，本次迁移不做修正，保持行为一致：

| 页面 | 目标过滤 | 待办过滤 |
|------|---------|---------|
| 全部目标页（无 `childName` 路由参数） | 仅 `child_id IS NULL` | **全部待办**（含各孩子的） |
| 孩子子页面（如 `/goals/甜甜`） | `child_id = 该孩子 id` | `child_id = 该孩子 id` |

实现方式：前端一次性 `GET /api/goals` 与 `GET /api/todos` 拉取全量数据，过滤逻辑保留在 `visibleGoals` / `visibleTodos` computed 中，仅将判断依据从 `childName` 字符串改为 `childId`。

### 6.2 数据刷新策略

采用**写后重新拉取**（与 `Tasks.vue` 一致）：每次创建/更新/删除成功后调用 `fetchGoals()` 或 `fetchTodos()` 重新加载列表，不做乐观更新。

### 6.3 积分自动汇总（保留）

`toggleTodo` 现有逻辑完整保留：待办完成/取消完成时，若 `expectedPoints > 0`，调用 `POST /api/points` 对应加减积分。差异点：

- `child_id` 直接取自 `todo.childId`（已是数据库外键，天然有效），移除原有针对失效 localStorage id 的兜底重匹配逻辑。
- 若 `todo.childId` 为 `NULL`（全局待办），跳过积分汇总且不提示错误。

### 6.4 一次性数据迁移

新增迁移标记键 `star-park-pcadmin-migrated-v1`。`onMounted` 流程：

```
1. await store.fetchChildren()
2. await fetchGoals(); await fetchTodos()
3. if (localStorage 无迁移标记) {
     读取 localStorage 的 goals / todos
     if (两者都为空) { 写入迁移标记; return }
     try {
       a. 顺序 POST 每个 goal，记录 oldId -> newId 映射
       b. 顺序 POST 每个 todo，goal_id 用映射表转换（映射缺失则 null）
       c. localStorage.setItem('star-park-pcadmin-migrated-v1', '1')
       d. await fetchGoals(); await fetchTodos()
       e. ElMessage.success('本地数据已迁移到服务器')
     } catch {
       ElMessage.error('本地数据迁移失败，原数据已保留，请稍后重试')
       // 不写迁移标记，不清空 localStorage
     }
   }
```

**关键约束**：

- 迁移过程中 `childName` → `child_id` 通过 `store.children` 按名字匹配；匹配不到则置 `null`。
- 迁移**不删除** `localStorage` 原数据（作为备份保留），仅通过标记避免重复导入。
- 迁移失败时不写标记，下次进入页面自动重试。

### 6.5 移除的内容

- `defaultGoals`（7 条）与 `defaultTodos`（57 条）硬编码常量数组。
- `saveGoals()` / `saveTodos()` / `loadData()` / `mergeWithDefault()` 及 `DATA_KEY_GOALS` / `DATA_KEY_TODOS` 的写入用途（读取用途仅保留在迁移逻辑中）。

> 注：这些默认数据在本次改动前已通过 `mergeWithDefault` 落入用户 `localStorage`，因此会被 6.4 的迁移流程一并导入数据库，不会丢失。

## 7. 架构约束

遵循项目 L0–L5 分层规则（`scripts/lint-deps.py` 校验）：

| 新增/修改文件 | 层 | 允许导入 |
|--------------|-----|---------|
| `server/src/database.js` | L0 | 仅 npm 包 |
| `server/src/routes/goals.js` | L1 | L0 + npm 包 |
| `server/src/routes/todos.js` | L1 | L0 + npm 包 |
| `server/src/app.js` | L2 | L0, L1 + npm 包 |
| `pc-admin/src/api/index.js` | L3 | 仅 npm 包 |
| `pc-admin/src/views/Goals.vue` | L4 | L3 + npm 包 |

新增的两个路由模块必须登记到 `scripts/lint-deps.py` 的 `LAYERS[1]` 白名单，否则架构 lint 不覆盖新文件。

`routes/goals.js` 与 `routes/todos.js` **禁止互相引用**（同层禁止互引），目标删除时对 todos 表的级联操作直接通过 `db` 在 `goals.js` 内以 SQL 完成。

## 8. 影响范围

| 文件 | 类型 | 说明 |
|------|------|------|
| `star-park/server/src/database.js` | 修改 | 新增两张表 DDL，`resetForTest` 表列表追加 `todos`、`goals` |
| `star-park/server/src/routes/goals.js` | 新增 | 目标 CRUD 路由 |
| `star-park/server/src/routes/todos.js` | 新增 | 待办 CRUD 路由 |
| `star-park/server/src/app.js` | 修改 | 挂载 `/api/goals`、`/api/todos` |
| `star-park/server/tests/goals.test.js` | 新增 | 目标接口单测 |
| `star-park/server/tests/todos.test.js` | 新增 | 待办接口单测 |
| `star-park/pc-admin/src/api/index.js` | 修改 | 新增 8 个 API 方法 |
| `star-park/pc-admin/src/views/Goals.vue` | 修改 | 改为 API 读写 + 迁移逻辑 |
| `scripts/lint-deps.py` | 修改 | L1 白名单登记新路由 |
| `docs/api.md` | 修改 | `make api-doc` 重新生成 |

## 9. 风险与缓解

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 迁移时 `goalId` 关联丢失 | 高 | 建立 `oldId → newId` 映射表，先建目标再建待办；映射缺失时置 `null` 而非报错 |
| 迁移中途失败导致部分导入 | 中 | 不写迁移标记，下次重试；`localStorage` 原数据不清空。若产生重复数据，用户可手动删除 |
| 外键约束（`foreign_keys = ON`）导致插入失败 | 中 | `child_id` / `goal_id` 允许 `NULL`；插入前不做存在性校验，由 SQLite 外键报错并返回 500 |
| `resetForTest` 遗漏新表导致测试间数据污染 | 中 | 表列表按外键依赖倒序追加：`todos` 先于 `goals`，`goals` 先于 `children` |
| 新增路由无测试拉低覆盖率 | 中 | Task 5 配套单测，`make test` 需维持 ≥50% 行覆盖率阈值 |
| 后端服务未启动时页面白屏 | 低 | `fetchGoals` / `fetchTodos` 用 try/catch 包裹，失败时列表为空数组并 `console.error`，不阻断渲染 |

## 10. 验收标准摘要

详见 `acceptance.md`。核心要求：

1. `make test` 通过，行覆盖率不低于 50%。
2. `make lint-arch` 通过，无层违规。
3. `make check-db` 通过，新表可被识别。
4. `npm run build`（pc-admin）构建成功。
5. 手工验证：创建/编辑/删除/复制目标与待办后刷新页面数据仍在；清空 `localStorage` 后数据依然从服务端加载。
