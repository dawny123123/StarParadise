# 验收标准：目标与待办任务数据库持久化

> 每个任务的验收命令必须实际执行并通过。SHALL 约束为强制项，违反即视为任务未完成。

---

## Task 1: 新增 goals / todos 数据表

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
NODE_ENV=test node -e "
const db = require('./src/database');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('goals','todos')\").all().map(t => t.name).sort();
if (tables.join(',') !== 'goals,todos') { console.error('FAIL: 表缺失', tables); process.exit(1); }
const goalCols = db.prepare('PRAGMA table_info(goals)').all().map(c => c.name).sort().join(',');
const todoCols = db.prepare('PRAGMA table_info(todos)').all().map(c => c.name).sort().join(',');
if (goalCols !== 'child_id,created_at,id,progress,status,target,title') { console.error('FAIL: goals 字段不符', goalCols); process.exit(1); }
if (todoCols !== 'child_id,completed,created_at,creator,description,expected_points,goal_id,id,planned_date,priority,title') { console.error('FAIL: todos 字段不符', todoCols); process.exit(1); }
console.log('PASS: 表结构正确');
"
```

**SHALL 约束**：

- `goals` 表 SHALL 恰好包含 7 个字段：`id`、`child_id`、`title`、`status`、`progress`、`target`、`created_at`。
- `todos` 表 SHALL 恰好包含 11 个字段：`id`、`goal_id`、`child_id`、`title`、`creator`、`priority`、`expected_points`、`planned_date`、`description`、`completed`、`created_at`。
- `resetForTest()` 的 `tables` 数组 SHALL 以 `todos` 为首项、`goals` 为第二项（外键依赖倒序）。
- 建表语句 SHALL 使用 `CREATE TABLE IF NOT EXISTS`，重复启动 SHALL NOT 报错。

**幂等性验收**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
NODE_ENV=test node -e "require('./src/database'); require('./src/database'); console.log('PASS: 重复加载无报错');"
```

---

## Task 2: 新增目标 CRUD 路由

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
test -f src/routes/goals.js && echo "PASS: 文件存在" || { echo "FAIL: 文件不存在"; exit 1; }
node -e "const r = require('./src/routes/goals'); if (typeof r !== 'function') { console.error('FAIL: 未导出 router'); process.exit(1); } console.log('PASS: 导出 router');"
wc -l < src/routes/goals.js | awk '{ if ($1 > 500) { print "FAIL: 超过 500 行 ("$1")"; exit 1 } else print "PASS: "$1" 行" }'
grep -q "require('./todos')\|require(\"./todos\")" src/routes/goals.js && { echo "FAIL: 违规引用同层 todos 路由"; exit 1; } || echo "PASS: 无同层互引"
```

**SHALL 约束**：

- SHALL 实现 4 个端点：`GET /`、`POST /`、`PUT /:id`、`DELETE /:id`。
- `POST` 缺少 `title` 时 SHALL 返回 400，错误体 SHALL 为 `{ error: 'title 为必填项' }`。
- `PUT` / `DELETE` 目标不存在时 SHALL 返回 404，错误体 SHALL 为 `{ error: '目标不存在' }`。
- `DELETE` SHALL 使用 `db.transaction()` 包裹「UPDATE todos SET goal_id = NULL」与「DELETE FROM goals」两步操作。
- 所有 SQL SHALL 使用 `db.prepare(...)` 占位符形式，SHALL NOT 出现字符串拼接用户输入。
- SHALL NOT `require` `./todos`（同层禁止互引）。
- 文件 SHALL ≤ 500 行。

---

## Task 3: 新增待办 CRUD 路由

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
test -f src/routes/todos.js && echo "PASS: 文件存在" || { echo "FAIL: 文件不存在"; exit 1; }
node -e "const r = require('./src/routes/todos'); if (typeof r !== 'function') { console.error('FAIL: 未导出 router'); process.exit(1); } console.log('PASS: 导出 router');"
wc -l < src/routes/todos.js | awk '{ if ($1 > 500) { print "FAIL: 超过 500 行 ("$1")"; exit 1 } else print "PASS: "$1" 行" }'
grep -q "require('./goals')\|require(\"./goals\")" src/routes/todos.js && { echo "FAIL: 违规引用同层 goals 路由"; exit 1; } || echo "PASS: 无同层互引"
```

**SHALL 约束**：

- SHALL 实现 4 个端点：`GET /`、`POST /`、`PUT /:id`、`DELETE /:id`。
- `GET` SHALL 支持 `child_id` 与 `goal_id` 两个可选查询参数，可同时生效（AND 关系）。
- `POST` 缺少 `title` 时 SHALL 返回 400。
- `PUT` / `DELETE` 待办不存在时 SHALL 返回 404，错误体 SHALL 为 `{ error: '待办不存在' }`。
- `PUT` 中动态拼接的字段名 SHALL 来自硬编码白名单数组，SHALL NOT 直接使用 `Object.keys(req.body)` 拼接（防 SQL 注入）。
- 文件 SHALL ≤ 500 行。

**防注入验收**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
grep -q "Object.keys(req.body)" src/routes/todos.js && { echo "FAIL: 存在注入风险"; exit 1; } || echo "PASS: 无动态键名拼接"
```

---

## Task 4: 挂载路由并登记架构层级

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
NODE_ENV=test node -e "
const request = require('supertest');
const app = require('./src/app');
(async () => {
  const g = await request(app).get('/api/goals');
  const t = await request(app).get('/api/todos');
  if (g.status !== 200) { console.error('FAIL: /api/goals 未挂载, status='+g.status); process.exit(1); }
  if (t.status !== 200) { console.error('FAIL: /api/todos 未挂载, status='+t.status); process.exit(1); }
  if (!Array.isArray(g.body) || !Array.isArray(t.body)) { console.error('FAIL: 响应非数组'); process.exit(1); }
  console.log('PASS: 两个路由均已挂载并返回数组');
})();
"
cd /Users/yuxiao/Downloads/StarParadise && python3 scripts/lint-deps.py
grep -q "star-park/server/src/routes/goals" scripts/lint-deps.py && echo "PASS: goals 已登记" || { echo "FAIL: goals 未登记到 LAYERS"; exit 1; }
grep -q "star-park/server/src/routes/todos" scripts/lint-deps.py && echo "PASS: todos 已登记" || { echo "FAIL: todos 未登记到 LAYERS"; exit 1; }
```

**SHALL 约束**：

- `app.js` SHALL 挂载 `/api/goals` 与 `/api/todos`。
- `scripts/lint-deps.py` 的 `LAYERS[1]` SHALL 包含两个新路由模块路径。
- `python3 scripts/lint-deps.py` SHALL 以退出码 0 结束，输出 `✓ All package dependencies follow the layer hierarchy`。
- SHALL NOT 改动 `app.js` 中既有 6 个路由的挂载路径。

---

## Task 5: 后端接口单元测试

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
npx vitest run tests/goals.test.js tests/todos.test.js
```

**SHALL 约束**：

- 两个测试文件 SHALL 全部通过，退出码 SHALL 为 0。
- `goals.test.js` SHALL 至少包含 12 个 `it()` 用例，覆盖 GET(3) / POST(3) / PUT(4) / DELETE(3) 分组。
- `todos.test.js` SHALL 至少包含 13 个 `it()` 用例，覆盖 GET(4) / POST(3) / PUT(6) / DELETE(2) 分组。
- `goals.test.js` SHALL 包含级联验收用例：创建目标 → 创建关联该目标的待办 → 删除目标 → 断言待办仍存在且 `goal_id === null`。
- `todos.test.js` SHALL 包含用例：显式传 `expected_points: 0` 后断言值为 0（验证不被 COALESCE 吞掉）。
- `todos.test.js` SHALL 包含用例：请求体不含 `planned_date` 时断言原值保留。
- 测试 SHALL 使用 `createAgent()` 与 `seedTestData()`，SHALL NOT 直接操作 `db` 插入被测数据（除级联验收所需的前置准备）。

**用例数验收**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
G=$(grep -c "  it(\|    it(" tests/goals.test.js)
T=$(grep -c "  it(\|    it(" tests/todos.test.js)
echo "goals 用例数: $G, todos 用例数: $T"
[ "$G" -ge 12 ] && echo "PASS: goals 用例数达标" || { echo "FAIL: goals 用例不足 12"; exit 1; }
[ "$T" -ge 13 ] && echo "PASS: todos 用例数达标" || { echo "FAIL: todos 用例不足 13"; exit 1; }
```

---

## Task 6: 前端 API 方法封装

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
for fn in getGoals createGoal updateGoal deleteGoal getTodos createTodo updateTodo deleteTodo; do
  grep -q "export const $fn" src/api/index.js && echo "PASS: $fn 已导出" || { echo "FAIL: $fn 未导出"; exit 1; }
done
grep -q "export const getTasks" src/api/index.js && echo "PASS: 既有导出未被破坏" || { echo "FAIL: 既有导出丢失"; exit 1; }
```

**SHALL 约束**：

- SHALL 导出 8 个新方法，命名与 tasks.md 中完全一致。
- SHALL 使用既有 `api` axios 实例，SHALL NOT 新建 axios 实例或使用原生 `fetch`。
- SHALL NOT 修改或删除既有任何导出。

---

## Task 7: Goals.vue 改造为 API 读写 + 一次性迁移

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
# 构建必须通过
npm run build 2>&1 | tail -5
# 硬编码默认数据必须已移除
grep -q "defaultGoals" src/views/Goals.vue && { echo "FAIL: defaultGoals 未移除"; exit 1; } || echo "PASS: defaultGoals 已移除"
grep -q "defaultTodos" src/views/Goals.vue && { echo "FAIL: defaultTodos 未移除"; exit 1; } || echo "PASS: defaultTodos 已移除"
grep -q "mergeWithDefault" src/views/Goals.vue && { echo "FAIL: mergeWithDefault 未移除"; exit 1; } || echo "PASS: mergeWithDefault 已移除"
# 迁移标记与迁移函数必须存在
grep -q "star-park-pcadmin-migrated-v1" src/views/Goals.vue && echo "PASS: 迁移标记存在" || { echo "FAIL: 缺少迁移标记"; exit 1; }
grep -q "migrateLegacyData" src/views/Goals.vue && echo "PASS: 迁移函数存在" || { echo "FAIL: 缺少迁移函数"; exit 1; }
# API 调用必须存在
grep -q "await fetchGoals()" src/views/Goals.vue && echo "PASS: fetchGoals 已调用" || { echo "FAIL: 缺少 fetchGoals"; exit 1; }
grep -q "await fetchTodos()" src/views/Goals.vue && echo "PASS: fetchTodos 已调用" || { echo "FAIL: 缺少 fetchTodos"; exit 1; }
# localStorage 写入(非迁移标记)必须已移除
grep -n "localStorage.setItem" src/views/Goals.vue | grep -v "migrated-v1" && { echo "FAIL: 仍存在业务数据写入 localStorage"; exit 1; } || echo "PASS: 无业务数据写入 localStorage"
# 行数限制
wc -l < src/views/Goals.vue | awk '{ if ($1 > 500) { print "WARN: 超过 500 行 ("$1") — 需拆分或说明"; } else print "PASS: "$1" 行" }'
```

**SHALL 约束**：

- `npm run build` SHALL 成功，输出 SHALL 包含 `built in`，SHALL NOT 出现 `error` 或 `Rollup failed`。
- SHALL 移除 `defaultGoals`、`defaultTodos`、`mergeWithDefault`、`saveGoals`、`saveTodos`、`loadData`。
- SHALL NOT 存在除迁移标记外的任何 `localStorage.setItem` 调用。
- SHALL 保留 `localStorage.getItem` 对 `star-park-pcadmin-goals` / `star-park-pcadmin-todos` 的读取（仅用于迁移）。
- SHALL NOT 删除 `localStorage` 中的遗留键（不得出现 `localStorage.removeItem` 针对这两个键）。
- `deleteGoal` 与 `deleteTodo` SHALL 使用两段独立 try/catch：第一段捕获 `ElMessageBox.confirm` 取消并 `return`，第二段捕获 API 错误并 `ElMessage.error` 提示。
- `toggleTodo` SHALL 先 `await updateTodo(...)` 成功后才更新本地 `completed` 状态；失败时 SHALL `return` 且 SHALL NOT 调用 `addPoints`。
- `toggleTodo` SHALL 在 `todo.childId` 为空时跳过积分汇总且 SHALL NOT 显示错误提示。
- `migrateLegacyData` SHALL 在失败时 SHALL NOT 写入迁移标记。
- template 部分 SHALL NOT 改动（`git diff` 中 `<template>` 区块无变更）。
- 迁移逻辑 SHALL 先创建全部目标并建立 `oldId → newId` 映射，再创建待办。

**template 未改动验收**：

```bash
cd /Users/yuxiao/Downloads/StarParadise
git diff HEAD -- star-park/pc-admin/src/views/Goals.vue | grep "^[+-]" | grep -v "^[+-][+-]" | grep -c "el-table-column\|el-dialog\|el-form-item" | awk '{ if ($1 > 0) print "WARN: template 区块有 "$1" 处变更，需人工确认是否必要"; else print "PASS: template 未改动" }'
```

---

## Task 8: 更新 API 文档

**验收命令**：

```bash
cd /Users/yuxiao/Downloads/StarParadise
make api-doc
COUNT=$(grep -c "api/goals\|api/todos" docs/api.md)
echo "文档中新端点提及次数: $COUNT"
[ "$COUNT" -ge 8 ] && echo "PASS: 新端点已入文档" || { echo "FAIL: 文档缺少新端点（仅 $COUNT 处）"; exit 1; }
```

**SHALL 约束**：

- `docs/api.md` SHALL 包含 `/api/goals` 与 `/api/todos` 的全部 8 个端点。
- SHALL NOT 删除文档中既有的任何接口章节。

---

## 全局验证 (MANDATORY)

以下命令 SHALL 全部通过，任一失败即视为整个任务未完成。

### 1. 后端编译验证

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/server
NODE_ENV=test node -e "require('./src/app'); console.log('PASS: 后端模块加载正常');"
```

**SHALL**：退出码 0，无 `SyntaxError` / `MODULE_NOT_FOUND`。

### 2. 前端编译验证

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin
npm run build
```

**SHALL**：退出码 0，输出包含 `built in`，SHALL NOT 包含 `error` / `Rollup failed to resolve`。

### 3. 全量单测与覆盖率

```bash
cd /Users/yuxiao/Downloads/StarParadise && make test
```

**SHALL**：
- 全部测试通过，退出码 0。
- 行覆盖率 SHALL ≥ 50%（`vitest.config.js` 的 `coverage.thresholds.lines` 阈值）。
- SHALL NOT 出现既有测试因新表未加入 `resetForTest` 而失败的情况。

### 4. 架构层级 lint

```bash
cd /Users/yuxiao/Downloads/StarParadise && make lint-arch
```

**SHALL**：退出码 0，输出 `✓ All package dependencies follow the layer hierarchy`，无层违规。

### 5. 数据库一致性检查

```bash
cd /Users/yuxiao/Downloads/StarParadise && make check-db
```

**SHALL**：退出码 0。

### 6. 端到端 API 冒烟测试

```bash
cd /Users/yuxiao/Downloads/StarParadise
# 启动后端
bash harness/scripts/start-server.sh &
sleep 5
# 目标 CRUD 全链路
GOAL_ID=$(curl -s -X POST http://localhost:3001/api/goals -H 'Content-Type: application/json' -d '{"title":"E2E测试目标","status":"study","progress":1,"target":5}' | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "创建目标 id=$GOAL_ID"
TODO_ID=$(curl -s -X POST http://localhost:3001/api/todos -H 'Content-Type: application/json' -d "{\"title\":\"E2E测试待办\",\"goal_id\":$GOAL_ID,\"expected_points\":5}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "创建待办 id=$TODO_ID"
# 验证关联
curl -s "http://localhost:3001/api/todos?goal_id=$GOAL_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d)==1, 'FAIL: goal_id 筛选失效'; print('PASS: goal_id 筛选正常')"
# 删除目标后待办应仍存在且 goal_id 为 null
curl -s -X DELETE "http://localhost:3001/api/goals/$GOAL_ID" > /dev/null
curl -s "http://localhost:3001/api/todos" | python3 -c "
import sys, json
d = json.load(sys.stdin)
t = [x for x in d if x['id'] == $TODO_ID]
assert len(t) == 1, 'FAIL: 待办被误删'
assert t[0]['goal_id'] is None, 'FAIL: goal_id 未置空, 实际=' + str(t[0]['goal_id'])
print('PASS: 级联解除关联正确')
"
# 清理
curl -s -X DELETE "http://localhost:3001/api/todos/$TODO_ID" > /dev/null
bash harness/scripts/teardown-env.sh
```

**SHALL**：
- 目标与待办创建 SHALL 返回 201 且响应含 `id`。
- `goal_id` 筛选 SHALL 精确返回 1 条。
- 删除目标后关联待办 SHALL 仍存在且 `goal_id` SHALL 为 `null`。

### 7. 持久化人工验收（浏览器）

1. 启动后端与 pc-admin：`cd star-park && npm run start:server` + `npm run start:pc`
2. 打开 `http://localhost:5174/#/goals`
3. **首次迁移**：应出现「本地数据已迁移到服务器（N 个目标，M 条待办）」提示，且列表数据与迁移前一致（含目标关联标签正确显示）。
4. **持久化**：新增一个目标与一条待办 → 刷新页面（F5）→ 数据 SHALL 仍在。
5. **跨浏览器**：在另一浏览器（或隐私窗口）打开同一地址 → 数据 SHALL 完整显示（证明已脱离 localStorage）。
6. **清空 localStorage 验证**：DevTools 执行 `localStorage.clear()` → 刷新 → 数据 SHALL 仍从服务端加载（可能再次触发迁移提示，因标记被清除但 localStorage 业务数据也被清空，故应无数据可迁移、静默跳过）。
7. **复制功能**：点击待办的复制按钮 → 确认 → 副本 SHALL 被创建并持久化。
8. **积分汇总**：勾选一条 `expectedPoints > 0` 且归属某孩子的待办 → SHALL 提示「已奖励 N 积分」→ 到「余额管理」页确认该孩子积分已增加。
9. **删除目标解除关联**：删除一个有关联待办的目标 → 待办 SHALL 仍在列表中，「关联目标」列 SHALL 显示为「选择目标」（即 null）。

**SHALL**：以上 9 项人工验收全部符合预期，任一不符需修复后重新验收。

---

## 回归风险检查清单

- [ ] 既有 7 个测试文件（children、tasks、checkins、rewards、points、stats、seed）全部仍通过
- [ ] `Tasks.vue` 页面功能未受影响（任务列表、新增、编辑、删除正常）
- [ ] `Dashboard.vue`、`Rewards.vue`、`Balance.vue`、`Stats.vue` 页面正常加载
- [ ] `docs/api.md` 既有章节未被破坏
- [ ] `star-park/server/data/star-park.db` 中既有数据（children/tasks/rewards）未丢失
