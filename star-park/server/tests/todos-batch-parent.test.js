const { createAgent, seedTestData } = require('./helpers');

describe('PATCH /api/todos/batch-parent', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  async function createTodo(data) {
    const res = await agent.post('/api/todos').send(data);
    expect(res.status).toBe(201);
    return res.body;
  }

  async function getTodosById(todoIds) {
    const res = await agent.get('/api/todos');
    expect(res.status).toBe(200);
    const todosById = new Map(res.body.map(todo => [todo.id, todo]));
    return todoIds.map(id => todosById.get(id));
  }

  function withoutParentId(todo) {
    const { parent_id: parentId, ...otherFields } = todo;
    return otherFields;
  }

  it('应将同一孩子的两个叶子任务批量设置为同一个顶级父任务', async () => {
    const parent = await createTodo({ child_id: ids.child1Id, title: '父任务' });
    const existingChild = await createTodo({
      child_id: ids.child1Id,
      parent_id: parent.id,
      title: '已有子任务'
    });
    const taskA = await createTodo({ child_id: ids.child1Id, title: '叶子任务A' });
    const taskB = await createTodo({ child_id: ids.child1Id, title: '叶子任务B' });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [taskA.id, taskB.id],
      parent_id: parent.id
    });

    expect(res.status).toBe(200);
    expect(res.body.updated_count).toBe(2);
    expect(res.body.todos.map(todo => todo.id)).toEqual([taskA.id, taskB.id]);
    expect(res.body.todos.every(todo => todo.parent_id === parent.id)).toBe(true);

    const [savedA, savedB, savedExistingChild] = await getTodosById([
      taskA.id,
      taskB.id,
      existingChild.id
    ]);
    expect(savedA.parent_id).toBe(parent.id);
    expect(savedB.parent_id).toBe(parent.id);
    expect(savedExistingChild.parent_id).toBe(parent.id);
  });

  it('parent_id 为 null 时应批量解除父任务且保留其他任务数据', async () => {
    const parent = await createTodo({ child_id: ids.child1Id, title: '原父任务' });
    const taskA = await createTodo({
      child_id: ids.child1Id,
      parent_id: parent.id,
      title: '待解除任务A',
      description: '描述A',
      expected_points: 3
    });
    const taskB = await createTodo({
      child_id: ids.child1Id,
      parent_id: parent.id,
      title: '待解除任务B',
      description: '描述B',
      priority: 'high'
    });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [taskA.id, taskB.id],
      parent_id: null
    });

    expect(res.status).toBe(200);
    expect(res.body.updated_count).toBe(2);
    const [savedA, savedB] = await getTodosById([taskA.id, taskB.id]);
    expect(savedA.parent_id).toBeNull();
    expect(savedB.parent_id).toBeNull();
    expect(withoutParentId(savedA)).toEqual(withoutParentId(taskA));
    expect(withoutParentId(savedB)).toEqual(withoutParentId(taskB));
  });

  it('不同孩子的任务批量解除父任务时应返回 400 且保留原父任务', async () => {
    const child1Parent = await createTodo({ child_id: ids.child1Id, title: '孩子一原父任务' });
    const child2Parent = await createTodo({ child_id: ids.child2Id, title: '孩子二原父任务' });
    const child1Task = await createTodo({ parent_id: child1Parent.id, title: '孩子一待解除任务' });
    const child2Task = await createTodo({ parent_id: child2Parent.id, title: '孩子二待解除任务' });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [child1Task.id, child2Task.id],
      parent_id: null
    });

    expect(res.status).toBe(400);
    const [savedChild1Task, savedChild2Task] = await getTodosById([child1Task.id, child2Task.id]);
    expect(savedChild1Task.parent_id).toBe(child1Parent.id);
    expect(savedChild2Task.parent_id).toBe(child2Parent.id);
  });

  it('父任务不存在时应返回 404 且不修改已选择任务', async () => {
    const originalParent = await createTodo({ child_id: ids.child1Id, title: '原父任务' });
    const taskA = await createTodo({
      child_id: ids.child1Id,
      parent_id: originalParent.id,
      title: '任务A'
    });
    const taskB = await createTodo({
      child_id: ids.child1Id,
      parent_id: originalParent.id,
      title: '任务B'
    });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [taskA.id, taskB.id],
      parent_id: 99999
    });

    expect(res.status).toBe(404);
    const [savedA, savedB] = await getTodosById([taskA.id, taskB.id]);
    expect(savedA).toEqual(taskA);
    expect(savedB).toEqual(taskB);
  });

  it('待办列表包含目标父任务时应返回 400 且不修改其他任务', async () => {
    const parent = await createTodo({ child_id: ids.child1Id, title: '目标父任务' });
    const task = await createTodo({ child_id: ids.child1Id, title: '待设置任务' });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [parent.id, task.id],
      parent_id: parent.id
    });

    expect(res.status).toBe(400);
    const [savedParent, savedTask] = await getTodosById([parent.id, task.id]);
    expect(savedParent).toEqual(parent);
    expect(savedTask).toEqual(task);
  });

  it('已选择任务含有直接子任务时应返回 400 且不修改其他已选择任务', async () => {
    const selectedParent = await createTodo({ child_id: ids.child1Id, title: '含子任务的待办' });
    await createTodo({ parent_id: selectedParent.id, title: '直接子任务' });
    const originalParent = await createTodo({ child_id: ids.child1Id, title: '另一父任务' });
    const otherTask = await createTodo({
      parent_id: originalParent.id,
      title: '其他已选择任务'
    });

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [selectedParent.id, otherTask.id],
      parent_id: null
    });

    expect(res.status).toBe(400);
    const [savedParent, savedOtherTask] = await getTodosById([selectedParent.id, otherTask.id]);
    expect(savedParent).toEqual(selectedParent);
    expect(savedOtherTask).toEqual(otherTask);
  });

  it('不同孩子的任务批量解除不同父任务时应返回 400 且不修改任务', async () => {
    const child1Parent = await createTodo({ child_id: ids.child1Id, title: '孩子一父任务' });
    const child2Parent = await createTodo({ child_id: ids.child2Id, title: '孩子二父任务' });
    const child1Task = await createTodo({
      child_id: ids.child1Id,
      parent_id: child1Parent.id,
      title: '孩子一任务'
    });
    const child2Task = await createTodo({
      child_id: ids.child2Id,
      parent_id: child2Parent.id,
      title: '孩子二任务'
    });
    const [originalChild1Task, originalChild2Task] = await getTodosById([
      child1Task.id,
      child2Task.id
    ]);

    expect(originalChild1Task.parent_id).toBe(child1Parent.id);
    expect(originalChild2Task.parent_id).toBe(child2Parent.id);
    expect(originalChild1Task.parent_id).not.toBe(originalChild2Task.parent_id);

    const res = await agent.patch('/api/todos/batch-parent').send({
      todo_ids: [child1Task.id, child2Task.id],
      parent_id: null
    });

    expect(res.status).toBe(400);
    const [savedChild1Task, savedChild2Task] = await getTodosById([child1Task.id, child2Task.id]);
    expect(savedChild1Task).toEqual(originalChild1Task);
    expect(savedChild2Task).toEqual(originalChild2Task);
  });

  it('todo_ids 为格式错误或重复数组时应返回 400', async () => {
    const task = await createTodo({ child_id: ids.child1Id, title: '待验证任务' });
    const invalidBodies = [
      { todo_ids: '1,2', parent_id: null },
      { todo_ids: [], parent_id: null },
      { todo_ids: [task.id, 0], parent_id: null },
      { todo_ids: [task.id, task.id], parent_id: null }
    ];

    for (const body of invalidBodies) {
      const res = await agent.patch('/api/todos/batch-parent').send(body);
      expect(res.status).toBe(400);
    }
  });
});
