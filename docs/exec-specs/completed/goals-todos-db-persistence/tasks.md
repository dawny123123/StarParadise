# 执行任务清单：目标与待办任务数据库持久化

> 执行顺序：严格按 Task 1 → 8 自底向上（DB → API → 前端），符合项目 domain 约定「全栈功能开发遵循 DB→API→pc-admin→miniprogram 的自底向上顺序」。

## 执行进度

- [x] Task 1: 新增 goals / todos 数据表
- [x] Task 2: 新增目标 CRUD 路由
- [x] Task 3: 新增待办 CRUD 路由
- [x] Task 4: 挂载路由并登记架构层级
- [x] Task 5: 后端接口单元测试
- [x] Task 6: 前端 API 方法封装
- [x] Task 7: Goals.vue 改造为 API 读写 + 一次性迁移
- [x] Task 8: 更新 API 文档

---

## Task 1: 新增 goals / todos 数据表

**文件**：`star-park/server/src/database.js`（修改）
**层**：L0

**描述**：在既有建表 DDL 的 `db.exec()` 模板字符串末尾追加两张新表，并更新 `resetForTest` 的表清单。新表使用 `CREATE TABLE IF NOT EXISTS` 保证幂等，无需 ALTER TABLE 迁移（全新表）。

**改动 1** —— 在 `db.exec()` 内 `points` 表定义之后追加：

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

**改动 2** —— `resetForTest()` 中的 `tables` 数组按外键依赖倒序追加（`todos` 依赖 `goals`，`goals` 依赖 `children`）：

```js
const tables = ['todos', 'goals', 'points', 'transactions', 'checkins', 'rewards', 'tasks', 'children'];
```

**验证**：
```bash
cd star-park/server && node -e "require('./src/database'); console.log('ok')"
```

---

## Task 2: 新增目标 CRUD 路由

**文件**：`star-park/server/src/routes/goals.js`（新增）
**层**：L1

**描述**：按 `routes/tasks.js` 的既有风格实现目标 CRUD。**关键点**：DELETE 时必须在事务内先将关联待办的 `goal_id` 置 NULL 再删除目标，对应前端原有 `deleteGoal` 行为（清除待办中的关联）。

```js
const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/goals?child_id=x - 获取目标列表(可按孩子筛选)
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    let goals;
    if (child_id) {
      goals = db.prepare('SELECT * FROM goals WHERE child_id = ? ORDER BY id ASC').all(child_id);
    } else {
      goals = db.prepare('SELECT * FROM goals ORDER BY id ASC').all();
    }
    res.json(goals);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals - 创建目标
router.post('/', (req, res) => {
  try {
    const { child_id, title, status, progress, target } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      'INSERT INTO goals (child_id, title, status, progress, target) VALUES (?, ?, ?, ?, ?)'
    ).run(child_id ?? null, title, status || 'todo', progress ?? 0, target ?? 1);
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(goal);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/goals/:id - 更新目标
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    const { child_id, title, status, progress, target } = req.body;
    let sql = `UPDATE goals SET
        title = COALESCE(?, title),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        target = COALESCE(?, target)`;
    const params = [title ?? null, status ?? null, progress ?? null, target ?? null];
    // child_id 需区分"未传"(保持原值)与"显式传 null"(清空归属)，不能用 COALESCE
    if ('child_id' in req.body) {
      sql += `, child_id = ?`;
      params.push(child_id ?? null);
    }
    sql += ` WHERE id = ?`;
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id - 删除目标(同时解除待办的关联)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    // 使用事务确保先解除待办关联，再删目标，避免外键约束失败
    const deleteTransaction = db.transaction(() => {
      db.prepare('UPDATE todos SET goal_id = NULL WHERE goal_id = ?').run(id);
      db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    });
    deleteTransaction();
    res.json({ message: '目标已删除' });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

**约束**：
- SHALL NOT 引用 `routes/todos.js`（同层禁止互引），对 todos 表的操作直接用 SQL。
- SHALL 使用 `db.prepare(...).run/get/all` 占位符形式。
- 文件行数 SHALL ≤ 500。

---

## Task 3: 新增待办 CRUD 路由

**文件**：`star-park/server/src/routes/todos.js`（新增）
**层**：L1

**描述**：实现待办 CRUD。`completed`、`goal_id`、`child_id`、`planned_date`、`expected_points`、`description` 均需支持「显式传 null/0」语义，因此统一采用 `'field' in req.body` 判断动态拼接 SQL。

```js
const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/todos?child_id=x&goal_id=y - 获取待办列表(可筛选)
router.get('/', (req, res) => {
  try {
    const { child_id, goal_id } = req.query;
    const conditions = [];
    const params = [];
    if (child_id) {
      conditions.push('child_id = ?');
      params.push(child_id);
    }
    if (goal_id) {
      conditions.push('goal_id = ?');
      params.push(goal_id);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const todos = db.prepare(`SELECT * FROM todos${where} ORDER BY id ASC`).all(...params);
    res.json(todos);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos - 创建待办
router.post('/', (req, res) => {
  try {
    const { goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      `INSERT INTO todos (goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goal_id ?? null,
      child_id ?? null,
      title,
      creator || null,
      priority || 'medium',
      expected_points ?? 0,
      planned_date || null,
      description || null,
      completed ? 1 : 0
    );
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(todo);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id - 更新待办
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    const { title, creator, priority } = req.body;
    let sql = `UPDATE todos SET
        title = COALESCE(?, title),
        creator = COALESCE(?, creator),
        priority = COALESCE(?, priority)`;
    const params = [title ?? null, creator ?? null, priority ?? null];
    // 以下字段需区分"未传"(保持原值)与"显式传 null/0"(清空或置零)，不能用 COALESCE
    const nullableFields = ['goal_id', 'child_id', 'planned_date', 'description'];
    for (const field of nullableFields) {
      if (field in req.body) {
        sql += `, ${field} = ?`;
        params.push(req.body[field] ?? null);
      }
    }
    if ('expected_points' in req.body) {
      sql += `, expected_points = ?`;
      params.push(req.body.expected_points ?? 0);
    }
    if ('completed' in req.body) {
      sql += `, completed = ?`;
      params.push(req.body.completed ? 1 : 0);
    }
    sql += ` WHERE id = ?`;
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id - 删除待办
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    res.json({ message: '待办已删除' });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
```

**约束**：
- `nullableFields` 循环拼接 SQL 时字段名来自**硬编码白名单数组**，SHALL NOT 使用 `req.body` 的键名直接拼接（防注入）。
- 文件行数 SHALL ≤ 500。

---

## Task 4: 挂载路由并登记架构层级

**文件**：`star-park/server/src/app.js`（修改）、`scripts/lint-deps.py`（修改）
**层**：L2 / 工具

**改动 1** —— `app.js` 在既有 require 区块追加，并挂载路由：

```js
const goalsRouter = require('./routes/goals');
const todosRouter = require('./routes/todos');
```

```js
app.use('/api/goals', goalsRouter);
app.use('/api/todos', todosRouter);
```

**改动 2** —— `scripts/lint-deps.py` 的 `LAYERS[1]` 数组追加两项：

```python
        "star-park/server/src/routes/goals",
        "star-park/server/src/routes/todos",
```

**验证**：
```bash
cd star-park/server && node -e "require('./src/app'); console.log('app ok')"
cd /Users/yuxiao/Downloads/StarParadise && python3 scripts/lint-deps.py
```

---

## Task 5: 后端接口单元测试

**文件**：`star-park/server/tests/goals.test.js`（新增）、`star-park/server/tests/todos.test.js`（新增）
**层**：测试

**描述**：按既有测试文件风格（`tests/tasks.test.js`）编写，使用 `createAgent()` 与 `seedTestData()`。

**`goals.test.js` 必须覆盖的用例**：

| 分组 | 用例 |
|------|------|
| GET | 返回空列表；返回已创建目标；按 `child_id` 筛选 |
| POST | 成功创建（201）；缺少 `title` 返回 400；仅传 `title` 时使用默认值（`status='todo'`、`progress=0`、`target=1`、`child_id=null`） |
| PUT | 成功更新；不存在返回 404；部分更新保留原值；显式传 `child_id: null` 清空归属 |
| DELETE | 成功删除（200）；不存在返回 404；**删除目标后关联待办的 `goal_id` 变为 null 且待办本身仍存在** |

**`todos.test.js` 必须覆盖的用例**：

| 分组 | 用例 |
|------|------|
| GET | 返回空列表；返回已创建待办；按 `child_id` 筛选；按 `goal_id` 筛选 |
| POST | 成功创建（201）；缺少 `title` 返回 400；仅传 `title` 时使用默认值（`priority='medium'`、`expected_points=0`、`completed=0`） |
| PUT | 成功更新；不存在返回 404；`completed` 从 0 切到 1；显式传 `goal_id: null` 解除关联；显式传 `expected_points: 0` 置零；未传 `planned_date` 时保留原值 |
| DELETE | 成功删除（200）；不存在返回 404 |

**约束**：SHALL 使用 `expect(res.status).toBe(...)` 风格断言，与既有测试保持一致。

**验证**：
```bash
cd star-park/server && npx vitest run tests/goals.test.js tests/todos.test.js
```

---

## Task 6: 前端 API 方法封装

**文件**：`star-park/pc-admin/src/api/index.js`（修改）
**层**：L3

**描述**：在「任务相关」区块之后插入两个新区块，风格与既有导出一致。

```js
// ========== 目标相关 ==========
export const getGoals = (params) => api.get('/goals', { params })
export const createGoal = (data) => api.post('/goals', data)
export const updateGoal = (id, data) => api.put(`/goals/${id}`, data)
export const deleteGoal = (id) => api.delete(`/goals/${id}`)

// ========== 待办相关 ==========
export const getTodos = (params) => api.get('/todos', { params })
export const createTodo = (data) => api.post('/todos', data)
export const updateTodo = (id, data) => api.put(`/todos/${id}`, data)
export const deleteTodo = (id) => api.delete(`/todos/${id}`)
```

**约束**：SHALL NOT 修改既有导出的签名或行为。

---

## Task 7: Goals.vue 改造为 API 读写 + 一次性迁移

**文件**：`star-park/pc-admin/src/views/Goals.vue`（修改）
**层**：L4

**描述**：这是本次改动的核心，包含 6 个子改动。

### 7.1 更新 import

```js
import {
  triggerGoalAutoAssociation, addPoints,
  getGoals, createGoal, updateGoal, deleteGoal as deleteGoalApi,
  getTodos, createTodo, updateTodo, deleteTodo as deleteTodoApi
} from '../api'
```

> `deleteGoal` / `deleteTodo` 与组件内既有函数名冲突，SHALL 用 `as` 重命名为 `deleteGoalApi` / `deleteTodoApi`。

### 7.2 新增字段映射与数据拉取函数

```js
// 后端 snake_case ↔ 前端 camelCase 映射
const mapGoalFromApi = (g) => ({
  id: g.id,
  childId: g.child_id,
  childName: store.children.find(c => c.id === g.child_id)?.name || null,
  title: g.title,
  status: g.status,
  progress: g.progress,
  target: g.target
})

const mapTodoFromApi = (t) => ({
  id: t.id,
  goalId: t.goal_id,
  childId: t.child_id,
  childName: store.children.find(c => c.id === t.child_id)?.name || null,
  title: t.title,
  creator: t.creator,
  priority: t.priority,
  expectedPoints: t.expected_points,
  plannedDate: t.planned_date,
  description: t.description,
  completed: t.completed === 1
})

const fetchGoals = async () => {
  loading.value = true
  try {
    const data = await getGoals()
    goals.value = (Array.isArray(data) ? data : []).map(mapGoalFromApi)
  } catch (err) {
    console.error('获取目标失败:', err)
  } finally {
    loading.value = false
  }
}

const fetchTodos = async () => {
  tableLoading.value = true
  try {
    const data = await getTodos()
    todos.value = (Array.isArray(data) ? data : []).map(mapTodoFromApi)
  } catch (err) {
    console.error('获取待办失败:', err)
  } finally {
    tableLoading.value = false
  }
}
```

### 7.3 过滤逻辑改用 childId（保持现有不对称行为）

```js
// 全部目标页仅展示未归属孩子的目标；子页面展示该孩子的目标
const visibleGoals = computed(() => {
  if (!childName.value) return goals.value.filter(g => !g.childId)
  return goals.value.filter(g => g.childId === currentChildId.value)
})

// 沿用现有行为：全部目标页展示所有待办，子页面仅展示该孩子的待办
const visibleTodos = computed(() => {
  if (!childName.value) return todos.value
  return todos.value.filter(t => t.childId === currentChildId.value)
})
```

### 7.4 改写所有写操作为 API 调用

`saveGoal`：

```js
const saveGoal = async () => {
  if (!goalForm.title.trim()) {
    ElMessage.warning('请输入目标名称')
    return
  }
  const payload = {
    title: goalForm.title,
    status: goalForm.status,
    progress: goalForm.progress,
    target: goalForm.target
  }
  try {
    if (editingGoal.value) {
      await updateGoal(editingGoal.value.id, payload)
      ElMessage.success('目标已更新')
    } else {
      await createGoal({ ...payload, child_id: currentChildId.value })
      ElMessage.success('目标已添加')
    }
    goalDialogVisible.value = false
    await fetchGoals()
  } catch (err) {
    ElMessage.error('保存失败，请重试')
    console.error(err)
  }
}
```

`deleteGoal`（组件内函数名保持不变，内部调 `deleteGoalApi`）：

```js
const deleteGoal = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除此目标？', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteGoalApi(id)
    ElMessage.success('目标已删除')
    await fetchGoals()
    await fetchTodos()  // 后端已解除关联，需重新拉取待办
  } catch (err) {
    ElMessage.error('删除失败')
    console.error(err)
  }
}
```

> **注意**：原实现把 `ElMessageBox.confirm` 与业务逻辑放在同一 try/catch，导致 API 失败被静默吞掉。SHALL 拆分为两段 try/catch，取消确认时 `return`，API 失败时提示错误。`deleteTodo` 同样处理。

`saveTodo`：

```js
const saveTodo = async () => {
  if (!todoForm.title.trim()) {
    ElMessage.warning('请输入待办名称')
    return
  }
  const payload = {
    title: todoForm.title,
    goal_id: todoForm.goalId ?? null,
    creator: todoForm.creator,
    priority: todoForm.priority,
    expected_points: todoForm.expectedPoints || 0,
    planned_date: todoForm.plannedDate || null,
    description: todoForm.description || null
  }
  try {
    let savedTodo
    if (editingTodo.value) {
      savedTodo = await updateTodo(editingTodo.value.id, payload)
      ElMessage.success('待办已更新')
    } else {
      savedTodo = await createTodo({ ...payload, child_id: currentChildId.value, completed: 0 })
      ElMessage.success('待办已添加')
    }
    todoDialogVisible.value = false
    await fetchTodos()
    // 未关联目标时，异步触发 QoderWake 自动关联（不阻断保存主流程）
    if (savedTodo && !savedTodo.goal_id) {
      triggerGoalAutoAssociation(mapTodoFromApi(savedTodo), goals.value)
        .then(() => ElMessage.success('已触发目标自动关联'))
        .catch(() => ElMessage.warning('目标自动关联触发失败，不影响待办保存'))
    }
  } catch (err) {
    ElMessage.error('保存失败，请重试')
    console.error(err)
  }
}
```

`deleteTodo`：拆分双 try/catch，调 `deleteTodoApi(id)` 后 `await fetchTodos()`。

`cloneTodo`：保持现有实现不变（仅填充表单，实际创建走 `saveTodo`）。

### 7.5 toggleTodo 改为 API 调用

```js
const toggleTodo = async (id) => {
  const todo = todos.value.find(t => t.id === id)
  if (!todo) return

  const nextCompleted = !todo.completed
  try {
    await updateTodo(id, { completed: nextCompleted ? 1 : 0 })
  } catch (err) {
    ElMessage.error('状态更新失败')
    console.error(err)
    return
  }
  todo.completed = nextCompleted

  // 根据待办的预期积分值自动汇总到对应孩子的总积分
  const points = parseInt(todo.expectedPoints) || 0
  // 全局待办(childId 为 null)不参与积分汇总
  if (points === 0 || !todo.childId) return

  try {
    await addPoints({
      child_id: todo.childId,
      amount: nextCompleted ? points : -points,
      reason: nextCompleted
        ? `完成待办「${todo.title}」获得预期积分`
        : `取消完成待办「${todo.title}」扣减预期积分`
    })
    ElMessage.success(nextCompleted ? `已奖励 ${points} 积分` : `已扣减 ${points} 积分`)
  } catch (err) {
    ElMessage.error('积分汇总失败')
    console.error('积分汇总失败:', err)
  }
}
```

> 原有针对失效 localStorage `childId` 的兜底重匹配逻辑（`store.children.some(...)` 那段）SHALL 移除，因 `child_id` 已是数据库外键。

### 7.6 替换持久化区块为一次性迁移

删除 `DATA_KEY_GOALS`、`DATA_KEY_TODOS`、`defaultGoals`、`defaultTodos`、`saveGoals`、`saveTodos`、`loadData`，替换为：

```js
// ========== localStorage 一次性迁移 ==========

const LEGACY_KEY_GOALS = 'star-park-pcadmin-goals'
const LEGACY_KEY_TODOS = 'star-park-pcadmin-todos'
const MIGRATED_FLAG = 'star-park-pcadmin-migrated-v1'

// 将浏览器本地遗留数据一次性导入服务端；原数据保留作备份，仅用标记避免重复导入
const migrateLegacyData = async () => {
  if (localStorage.getItem(MIGRATED_FLAG)) return false

  let legacyGoals = []
  let legacyTodos = []
  try {
    legacyGoals = JSON.parse(localStorage.getItem(LEGACY_KEY_GOALS) || '[]')
    legacyTodos = JSON.parse(localStorage.getItem(LEGACY_KEY_TODOS) || '[]')
  } catch {
    // 本地数据已损坏，无可迁移内容，直接打标记跳过
    localStorage.setItem(MIGRATED_FLAG, '1')
    return false
  }

  if (legacyGoals.length === 0 && legacyTodos.length === 0) {
    localStorage.setItem(MIGRATED_FLAG, '1')
    return false
  }

  const resolveChildId = (item) => {
    if (item.childName) {
      return store.children.find(c => c.name === item.childName)?.id ?? null
    }
    return null
  }

  try {
    // 先建目标并记录 旧id → 新id 映射，供待办关联转换使用
    const idMap = new Map()
    for (const g of legacyGoals) {
      const created = await createGoal({
        child_id: resolveChildId(g),
        title: g.title,
        status: g.status || 'todo',
        progress: g.progress ?? 0,
        target: g.target ?? 1
      })
      idMap.set(g.id, created.id)
    }
    for (const t of legacyTodos) {
      await createTodo({
        goal_id: t.goalId ? (idMap.get(t.goalId) ?? null) : null,
        child_id: resolveChildId(t),
        title: t.title,
        creator: t.creator || null,
        priority: t.priority || 'medium',
        expected_points: t.expectedPoints ?? 0,
        planned_date: t.plannedDate || null,
        description: t.description || null,
        completed: t.completed ? 1 : 0
      })
    }
    localStorage.setItem(MIGRATED_FLAG, '1')
    ElMessage.success(`本地数据已迁移到服务器（${legacyGoals.length} 个目标，${legacyTodos.length} 条待办）`)
    return true
  } catch (err) {
    // 不写标记，下次进入页面自动重试；原数据保留
    ElMessage.error('本地数据迁移失败，原数据已保留，请稍后重试')
    console.error('迁移失败:', err)
    return false
  }
}

onMounted(async () => {
  // 先加载孩子列表：迁移时需按名字匹配 child_id，映射时需按 id 反查名字
  if (store.children.length === 0) {
    await store.fetchChildren()
  }
  await fetchGoals()
  await fetchTodos()
  const migrated = await migrateLegacyData()
  if (migrated) {
    await fetchGoals()
    await fetchTodos()
  }
})
```

**约束**：
- template 部分 SHALL NOT 改动（字段名映射后与原 camelCase 一致）。
- SHALL NOT 删除 `localStorage` 中的遗留键（保留作备份）。
- 文件行数 SHALL ≤ 500（移除 64 行硬编码默认数据后应显著低于原 910 行）。

---

## Task 8: 更新 API 文档

**文件**：`docs/api.md`（修改）

**描述**：运行文档生成脚本，将新增的 8 个端点纳入文档。

```bash
cd /Users/yuxiao/Downloads/StarParadise && make api-doc
```

若脚本正则未能识别新路由，SHALL 手工在 `docs/api.md` 中补充「目标管理接口」与「待办管理接口」两节，格式与既有「任务管理接口」一致（含 URL、方法、请求体参数、请求/响应示例）。

**验证**：
```bash
grep -c "api/goals\|api/todos" docs/api.md
```
