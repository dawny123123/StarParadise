# 验收标准

## Task 1: 新增原子批量父任务接口

### 验证命令
1. `cd star-park/server && npx vitest run tests/todos.test.js tests/todos-batch-parent.test.js` — 预期输出 SHALL 包含: `Tests` 且失败数为 `0`。

### 预期行为
- `PATCH /api/todos/batch-parent` 接收非空、无重复的 `todo_ids` 和可空 `parent_id` SHALL 返回 `updated_count` 及更新后的任务列表。
- 设置非空 `parent_id` 时，父任务和所有选中任务 SHALL 属于同一孩子，且父任务 SHALL 为顶级任务。
- `parent_id: null` SHALL 仅清除选中任务的父任务，不修改其他字段。

### 边界 Case
- 空数组、重复 ID、非数组、缺失任务、父任务不存在、选中父任务本身、选中任务已有子任务或跨孩子选中 SHALL 返回明确的 4xx 错误且不更新任何任务。

## Task 2: 覆盖批量父任务接口的成功与失败路径

### 验证命令
1. `cd star-park/server && npx vitest run tests/todos.test.js tests/todos-batch-parent.test.js` — 预期输出 SHALL 包含: `0 failed` 或等价的零失败结果。

### 预期行为
- 批量设置父任务测试 SHALL 断言两个任务均持久化到同一父任务，并断言 `updated_count` 等于 2。
- 批量取消父任务测试 SHALL 断言两个任务的 `parent_id` 均为 `null`。
- 每个失败测试 SHALL 在请求后重新读取任务并断言父任务关系未变化。

### 边界 Case
- 选中一个可更新任务和一个非法任务时，测试 SHALL 验证可更新任务也不发生父任务变更。

## Task 3: 暴露批量父任务 API 客户端方法

### 验证命令
1. `cd star-park/pc-admin && npm run build` — 预期输出 SHALL 包含: `built in` 且退出码为 0。

### 预期行为
- `batchUpdateTodoParent` SHALL 使用 `PATCH /todos/batch-parent` 并发送 `todo_ids` 与 `parent_id`。
- `parentId` 为 `null` 时，请求体 SHALL 保留 `parent_id: null`，不省略该字段。

### 边界 Case
- API 方法 SHALL 不改变既有 `getTodos`、`updateTodo`、上传接口或响应拦截器行为。

## Task 4: 在任务树提供多选与批量改父任务交互

### 验证命令
1. `cd star-park/pc-admin && npm run build` — 预期输出 SHALL 包含: `built in` 且退出码为 0。

### 预期行为
- 任务树 SHALL 提供独立于完成状态复选框的多选列，并在至少选中一项后显示已选数量和批量修改父任务按钮。
- 有子任务的任务 SHALL 不可被批量选中为子任务；选中不同孩子任务时，批量设置按钮 SHALL 阻止提交并给出提示。
- 候选父任务 SHALL 排除已选任务和不同孩子的任务，并允许同一孩子的顶级父任务已有其他子任务。
- 批量更新成功后，界面 SHALL 清空选中状态、关闭对话框、刷新任务树并提示成功。

### 边界 Case
- 选择“无父任务”并确认时，界面 SHALL 调用批量接口传递 `parent_id: null`。

## 全局验证 (MANDATORY)

> 所有 Task 标记完成后 MUST 执行以下命令。任一命令失败 SHALL 先修复或如实报告，不能跳过。

### 构建验证
`make build` — SHALL 以退出码 0 完成，并包含管理后台 Vite 构建成功输出。

### 回归验证
`cd star-park/server && npx vitest run tests/todos.test.js tests/todos-batch-parent.test.js` — SHALL 以退出码 0 完成，且没有失败测试。

### 功能验证场景
1. 批量归属: 创建同一孩子的“日常工作”和两条顶级日志，在任务树选中两条日志、选择“日常工作”并确认 → SHALL 同时显示为“日常工作”的子任务。
2. 批量取消: 选中两个已有父任务的日志、选择“无父任务”并确认 → SHALL 同时恢复为顶级任务。
3. 非法选择: 尝试选中含子任务的任务或混选不同孩子任务 → SHALL 无法提交批量父任务更新，且原有层级保持不变。