const { createAgent, seedTestData } = require('./helpers');

describe('Goals API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/goals', () => {
    it('初始应返回空数组', async () => {
      const res = await agent.get('/api/goals');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('应返回已创建的目标', async () => {
      await agent.post('/api/goals').send({ child_id: ids.child1Id, title: '期末考进前十' });
      await agent.post('/api/goals').send({ child_id: ids.child2Id, title: '读完十本书' });
      const res = await agent.get('/api/goals');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('期末考进前十');
      expect(res.body[1].title).toBe('读完十本书');
    });

    it('应按 child_id 筛选', async () => {
      await agent.post('/api/goals').send({ child_id: ids.child1Id, title: '目标A' });
      await agent.post('/api/goals').send({ child_id: ids.child1Id, title: '目标B' });
      await agent.post('/api/goals').send({ child_id: ids.child2Id, title: '目标C' });
      const res = await agent.get(`/api/goals?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every(g => g.child_id === ids.child1Id)).toBe(true);
    });
  });

  describe('POST /api/goals', () => {
    it('应成功创建目标', async () => {
      const res = await agent.post('/api/goals').send({
        child_id: ids.child1Id,
        title: '学会游泳',
        status: 'doing',
        progress: 3,
        target: 10
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('学会游泳');
      expect(res.body.child_id).toBe(ids.child1Id);
      expect(res.body.status).toBe('doing');
      expect(res.body.progress).toBe(3);
      expect(res.body.target).toBe(10);
    });

    it('缺少 title 应返回 400', async () => {
      const res = await agent.post('/api/goals').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('仅传 title 时应使用默认值', async () => {
      const res = await agent.post('/api/goals').send({ title: '默认值目标' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('默认值目标');
      expect(res.body.status).toBe('todo');
      expect(res.body.progress).toBe(0);
      expect(res.body.target).toBe(1);
      expect(res.body.child_id).toBeNull();
    });
  });

  describe('PUT /api/goals/:id', () => {
    it('应成功更新目标', async () => {
      const created = await agent.post('/api/goals').send({
        child_id: ids.child1Id,
        title: '原标题',
        status: 'todo',
        progress: 1,
        target: 5
      });
      const res = await agent.put(`/api/goals/${created.body.id}`).send({
        title: '新标题',
        status: 'done',
        progress: 5,
        target: 5,
        child_id: ids.child2Id
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('新标题');
      expect(res.body.status).toBe('done');
      expect(res.body.progress).toBe(5);
      expect(res.body.target).toBe(5);
      expect(res.body.child_id).toBe(ids.child2Id);
    });

    it('不存在的目标应返回 404', async () => {
      const res = await agent.put('/api/goals/9999').send({ title: '更新' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('部分更新应保留原值', async () => {
      const created = await agent.post('/api/goals').send({
        child_id: ids.child1Id,
        title: '原标题',
        status: 'doing',
        progress: 2,
        target: 8
      });
      const res = await agent.put(`/api/goals/${created.body.id}`).send({ title: '仅改标题' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('仅改标题');
      expect(res.body.status).toBe('doing');
      expect(res.body.progress).toBe(2);
      expect(res.body.target).toBe(8);
      expect(res.body.child_id).toBe(ids.child1Id);
    });

    it('显式传 child_id: null 应清空归属', async () => {
      const created = await agent.post('/api/goals').send({
        child_id: ids.child1Id,
        title: '待解绑目标'
      });
      expect(created.body.child_id).toBe(ids.child1Id);
      const res = await agent.put(`/api/goals/${created.body.id}`).send({ child_id: null });
      expect(res.status).toBe(200);
      expect(res.body.child_id).toBeNull();
      expect(res.body.title).toBe('待解绑目标');
    });
  });

  describe('DELETE /api/goals/:id', () => {
    it('应成功删除目标', async () => {
      const created = await agent.post('/api/goals').send({ title: '待删除目标' });
      const res = await agent.delete(`/api/goals/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '目标已删除');
      const list = await agent.get('/api/goals');
      expect(list.body).toHaveLength(0);
    });

    it('不存在的目标应返回 404', async () => {
      const res = await agent.delete('/api/goals/9999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('删除目标后关联待办应仍存在且 goal_id 变为 null', async () => {
      const goal = await agent.post('/api/goals').send({
        child_id: ids.child1Id,
        title: '带待办的目标'
      });
      const todo = await agent.post('/api/todos').send({
        goal_id: goal.body.id,
        child_id: ids.child1Id,
        title: '目标下的待办'
      });
      expect(todo.status).toBe(201);
      expect(todo.body.goal_id).toBe(goal.body.id);

      const res = await agent.delete(`/api/goals/${goal.body.id}`);
      expect(res.status).toBe(200);

      const todos = await agent.get('/api/todos');
      expect(todos.status).toBe(200);
      expect(todos.body).toHaveLength(1);
      expect(todos.body[0].id).toBe(todo.body.id);
      expect(todos.body[0].goal_id).toBeNull();
    });
  });
});
