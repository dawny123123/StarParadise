# 任务列表

## Task 1: 新增原子批量父任务接口
- [x] `star-park/server/src/routes/todos.js`

现有待办路由只有单条 `PUT /api/todos/:id`，无法保证一批父任务变更的完整性。新增 `PATCH /api/todos/batch-parent`，在 SQLite 事务中校验选中任务、父任务存在性、同孩子归属、顶级父任务和一层任务结构，再只更新 `parent_id` 字段并返回更新数量和任务列表。

```js
router.patch('/batch-parent', (req, res) => {
  const { todo_ids: todoIds, parent_id: parentId = null } = req.body
  const result = db.transaction(() => {
    const todos = loadSelectedTodos(todoIds)
    validateBatchParentAssignment(todos, parentId)
    updateParentIds(todoIds, parentId)
    return loadSelectedTodos(todoIds)
  })()
  res.json({ updated_count: result.length, todos: result.map(parseAttachments) })
})
```

## Task 2: 覆盖批量父任务接口的成功与失败路径
- [x] `star-park/server/tests/todos-batch-parent.test.js` — (NEW FILE)

既有 `todos.test.js` 已接近单文件行数上限，因此为新接口创建独立测试组。测试确保批量设置和取消父任务会返回更新数量并持久化；同时覆盖不存在的父任务、父任务被选中、选中任务已有子任务和跨孩子任务。失败用例必须验证所有任务仍保持调用前的父任务值，证明事务没有部分落库。

```js
it('批量设置父任务时应原子更新所有选中任务', async () => {
  const res = await agent.patch('/api/todos/batch-parent').send({
    todo_ids: [first.body.id, second.body.id],
    parent_id: parent.body.id
  })
  expect(res.status).toBe(200)
  expect(res.body.updated_count).toBe(2)
})
```

## Task 3: 暴露批量父任务 API 客户端方法
- [x] `star-park/pc-admin/src/api/index.js`

任务树不应直接构造 Axios 请求。新增与既有待办方法一致的导出，将选中任务 ID 和可空父任务 ID 映射为批量接口所需的请求体。

```js
export const batchUpdateTodoParent = (todoIds, parentId) => api.patch('/todos/batch-parent', {
  todo_ids: todoIds,
  parent_id: parentId
})
```

## Task 4: 在任务树提供多选与批量改父任务交互
- [x] `star-park/pc-admin/src/components/TodoTree.vue`
- [x] `star-park/pc-admin/src/components/TodoBatchParentDialog.vue` — (NEW FILE)

当前复选框切换完成状态，不能复用为多选。`TodoTree.vue` 增加独立的 selection 列并维护选中状态；新组件承载已选数量工具栏、批量父任务对话框和批量 API 调用，以保持两个组件都低于单文件行数上限。可选择项必须是没有子任务的任务。批量设置仅在已选任务属于同一孩子时可提交，候选父任务必须是该孩子的未选中顶级任务，且可已有其他子任务。成功后清空选择并触发既有 `refresh` 事件。

```vue
<el-table-column type="selection" :selectable="isBatchSelectable" width="48" />
<el-button :disabled="!canBatchSetParent" @click="openBatchParentDialog">
  批量修改父任务
</el-button>
```

```js
const confirmBatchParent = async () => {
  await batchUpdateTodoParent(selectedTodos.value.map(todo => todo.id), selectedParentId.value)
  todoTableRef.value?.clearSelection()
  emit('refresh')
}
```

## 涉及文件汇总

| 操作 | 文件 |
|------|------|
| 修改 | `star-park/server/src/routes/todos.js` |
| 新建 | `star-park/server/tests/todos-batch-parent.test.js` |
| 修改 | `star-park/pc-admin/src/api/index.js` |
| 修改 | `star-park/pc-admin/src/components/TodoTree.vue` |
| 新建 | `star-park/pc-admin/src/components/TodoBatchParentDialog.vue` |