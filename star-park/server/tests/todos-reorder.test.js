const { createAgent, seedTestData } = require('./helpers');

describe('PATCH /api/todos/reorder', () => {
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

  it('应按给定顺序重排同级任务且 GET 按新顺序返回', async () => {
    const taskA = await createTodo({ child_id: ids.child1Id, title: '任务A' });
    const taskB = await createTodo({ child_id: ids.child1Id, title: '任务B' });
    const taskC = await createTodo({ child_id: ids.child1Id, title: '任务C' });

    // 把任务A拖到末尾：B、C、A
    const res = await agent.patch('/api/todos/reorder').send({
      parent_id: null,
      todo_ids: [taskB.id, taskC.id, taskA.id]
    });

    expect(res.status).toBe(200);
    expect(res.body.updated_count).toBe(3);
    expect(res.body.todos.map(todo => todo.id)).toEqual([taskB.id, taskC.id, taskA.id]);

    const list = await agent.get(`/api/todos?child_id=${ids.child1Id}`);
    expect(list.status).toBe(200);
    expect(list.body.map(todo => todo.id)).toEqual([taskB.id, taskC.id, taskA.id]);

    const [savedB, savedC, savedA] = await getTodosById([taskB.id, taskC.id, taskA.id]);
    expect(savedB.sort_order).toBe(0);
    expect(savedC.sort_order).toBe(1);
    expect(savedA.sort_order).toBe(2);
    // 排序不改变父子关系与其他字段
    expect(savedA.parent_id).toBeNull();
    expect(savedA.title).toBe('任务A');
  });

  it('子任务在父任务内排序不影响顶级任务与其他父任务的子任务', async () => {
    const parentP = await createTodo({ child_id: ids.child1Id, title: '父任务P' });
    const c1 = await createTodo({ child_id: ids.child1Id, parent_id: parentP.id, title: '子任务C1' });
    const c2 = await createTodo({ child_id: ids.child1Id, parent_id: parentP.id, title: '子任务C2' });
    const topLevel = await createTodo({ child_id: ids.child1Id, title: '顶级任务' });
    const otherParent = await createTodo({ child_id: ids.child1Id, title: '另一父任务' });
    const otherChild = await createTodo({
      child_id: ids.child1Id,
      parent_id: otherParent.id,
      title: '其他子任务'
    });

    const res = await agent.patch('/api/todos/reorder').send({
      parent_id: parentP.id,
      todo_ids: [c2.id, c1.id]
    });

    expect(res.status).toBe(200);
    expect(res.body.updated_count).toBe(2);
    const [savedC1, savedC2, savedTop, savedOtherChild] = await getTodosById([
      c1.id,
      c2.id,
      topLevel.id,
      otherChild.id
    ]);
    expect(savedC2.sort_order).toBe(0);
    expect(savedC1.sort_order).toBe(1);
    expect(savedC1.parent_id).toBe(parentP.id);
    expect(savedC2.parent_id).toBe(parentP.id);
    expect(savedTop.parent_id).toBeNull();
    expect(savedOtherChild.parent_id).toBe(otherParent.id);
    expect(savedOtherChild.sort_order).toBe(otherChild.sort_order);
  });

  it('混合不同父任务的任务应返回 400 且不修改任何任务的 sort_order', async () => {
    const parent = await createTodo({ child_id: ids.child1Id, title: '父任务' });
    const childTask = await createTodo({
      child_id: ids.child1Id,
      parent_id: parent.id,
      title: '子任务'
    });
    const topLevel = await createTodo({ child_id: ids.child1Id, title: '顶级任务' });

    const res = await agent.patch('/api/todos/reorder').send({
      parent_id: null,
      todo_ids: [topLevel.id, childTask.id]
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('待办必须属于同一父任务下的同级任务');
    const [savedChild, savedTop] = await getTodosById([childTask.id, topLevel.id]);
    expect(savedChild.sort_order).toBe(childTask.sort_order);
    expect(savedTop.sort_order).toBe(topLevel.sort_order);
    expect(savedChild.parent_id).toBe(parent.id);
  });

  it('部分待办不存在应返回 404 且不修改任何任务', async () => {
    const taskA = await createTodo({ child_id: ids.child1Id, title: '任务A' });
    const taskB = await createTodo({ child_id: ids.child1Id, title: '任务B' });

    const res = await agent.patch('/api/todos/reorder').send({
      parent_id: null,
      todo_ids: [taskA.id, 99999]
    });

    expect(res.status).toBe(404);
    const [savedA, savedB] = await getTodosById([taskA.id, taskB.id]);
    expect(savedA.sort_order).toBe(taskA.sort_order);
    expect(savedB.sort_order).toBe(taskB.sort_order);
  });

  it('todo_ids 格式错误、为空或重复时应返回 400', async () => {
    const task = await createTodo({ child_id: ids.child1Id, title: '待验证任务' });
    const invalidBodies = [
      { parent_id: null, todo_ids: '1,2' },
      { parent_id: null, todo_ids: [] },
      { parent_id: null, todo_ids: [task.id, 0] },
      { parent_id: null, todo_ids: [task.id, task.id] },
      { parent_id: 0, todo_ids: [task.id] },
      { parent_id: -1, todo_ids: [task.id] }
    ];

    for (const body of invalidBodies) {
      const res = await agent.patch('/api/todos/reorder').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('新建任务应追加到同级任务末尾，重排后新建仍追加到末尾', async () => {
    const taskA = await createTodo({ child_id: ids.child1Id, title: '任务A' });
    const taskB = await createTodo({ child_id: ids.child1Id, title: '任务B' });
    expect(taskB.sort_order).toBeGreaterThan(taskA.sort_order);

    const reorderRes = await agent.patch('/api/todos/reorder').send({
      parent_id: null,
      todo_ids: [taskB.id, taskA.id]
    });
    expect(reorderRes.status).toBe(200);

    const taskC = await createTodo({ child_id: ids.child1Id, title: '任务C' });
    const list = await agent.get(`/api/todos?child_id=${ids.child1Id}`);
    expect(list.status).toBe(200);
    expect(list.body.map(todo => todo.id)).toEqual([taskB.id, taskA.id, taskC.id]);
  });
});
