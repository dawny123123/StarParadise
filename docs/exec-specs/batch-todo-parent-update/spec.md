# 任务多选与批量修改父任务

## 需求背景

目标管理的任务树目前只能逐条设置或取消父任务。整理一批同类日志时，操作人员需要重复打开每条任务的父任务选择，容易遗漏且耗时。将同一批任务批量归属到“日常工作”等父任务，可以缩短分类操作并保持任务层级清晰。

## 目标

- 目标 1: 操作人员 SHALL 能在任务树中选中多条可作为子任务的任务，并看到已选数量。
- 目标 2: 操作人员 SHALL 能将同一孩子的已选任务一次性设置为同一个父任务，或一次性取消父任务。
- 目标 3: 批量操作 SHALL 在服务端原子完成；任一任务、父任务或层级关系不合法时，不更新任何任务。

## 范围

### 包含
- 管理后台任务树的多选列、已选数量与批量修改父任务入口。
- 批量父任务选择对话框、确认提示、成功刷新和失败提示。
- `PATCH /api/todos/batch-parent` 接口及输入、父任务、孩子归属和一层层级校验。
- 独立的后端接口测试，覆盖批量设置、批量取消、无效父任务、选中父任务和跨孩子批量操作。

### 排除
- 批量删除、批量完成、批量编辑标题或优先级。
- 超过一层的任务嵌套。
- 小程序端的多选和批量操作。
- 修改既有单条父任务设置交互。

## 约束与设计原则

- 保持现有前后端分层：Vue 组件经 API 客户端调用 Express 路由，路由直接使用 SQLite 数据层。
- 只允许顶级任务作为父任务，且选中的任务不能包含已有子任务。
- 批量设置父任务时，所有被选任务与父任务 MUST 属于同一孩子，防止跨孩子移动。
- 批量取消父任务允许 `parent_id: null`，不修改任务的其他字段。
- 批量更新使用 SQLite 事务，失败时不保留部分更新。

## 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 选中含子任务的父任务 | 可能形成两层以上结构 | 前端禁选有子任务的行；后端在事务中再次校验 |
| 选中不同孩子的任务 | 任务被错误归属 | 前端阻止提交；后端校验每个任务的 `child_id` |
| 父任务在提交时被删除或变为子任务 | 批量操作出现部分更新 | 事务内查询并校验父任务后再执行单条 SQL 更新 |
| 过滤视图导致树节点不完整 | 前端错误判断可选任务 | 基于完整 `todos` 列表判断任务是否已有子任务 |

## 技术方案

在 `todos.js` 新增批量父任务接口，接收唯一任务 ID 数组和可空的父任务 ID。接口在 SQLite 事务内读取所有目标任务和父任务，校验任务数量、孩子归属、父任务顶级状态和选中任务的子任务状态；校验通过后以一条 `UPDATE ... WHERE id IN (...)` 更新 `parent_id` 并返回更新后的任务列表。

在 `TodoTree.vue` 使用 Element Plus 的 selection 列保存已选任务。批量工具栏仅在存在选中项时展示；设置父任务动作要求所有选中项属于同一孩子，并仅展示未选中且属于该孩子的顶级任务，允许父任务已有其他子任务。确认后清空选择并刷新树。

### 执行顺序

1. 新增服务端批量接口及事务校验（无依赖，先行）。
2. 为批量接口补充回归测试（依赖步骤 1）。
3. 在 API 客户端暴露批量请求方法（依赖步骤 1）。
4. 在任务树接入多选、批量对话框和 API 调用（依赖步骤 1、3）。
5. 执行接口测试、架构检查和管理后台构建（依赖步骤 2、4）。

## 依赖图

### 代码依赖图
| 组件 | 依赖 | 被依赖 |
|------|------|--------|
| `server/src/routes/todos.js` | `server/src/database.js` | Express 应用、接口测试 |
| `server/tests/todos-batch-parent.test.js` | todos 路由、测试 helper | Vitest 回归套件 |
| `pc-admin/src/api/index.js` | Axios 实例 | `TodoTree.vue` |
| `pc-admin/src/components/TodoTree.vue` | Vue、Element Plus、批量对话框组件 | `Goals.vue` |
| `pc-admin/src/components/TodoBatchParentDialog.vue` | Vue、Element Plus、待办 API | `TodoTree.vue` |

### 影响范围
- **直接修改**: `star-park/server/src/routes/todos.js`、`star-park/server/tests/todos-batch-parent.test.js`、`star-park/pc-admin/src/api/index.js`、`star-park/pc-admin/src/components/TodoTree.vue`、`star-park/pc-admin/src/components/TodoBatchParentDialog.vue`。
- **间接影响**: `Goals.vue` 通过既有 `refresh` 事件重新加载任务；现有 `/api/todos/:id` 单条更新不改变。