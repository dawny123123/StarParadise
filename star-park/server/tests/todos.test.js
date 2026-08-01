const { createAgent, seedTestData } = require('./helpers');

describe('Todos API', () => {
  let agent;
  let ids;
  let goal1Id;
  let goal2Id;

  beforeEach(async () => {
    ids = seedTestData();
    agent = createAgent();
    // todos.goal_id 有外键约束，必须先创建真实目标
    const g1 = await agent.post('/api/goals').send({ child_id: ids.child1Id, title: '目标一' });
    const g2 = await agent.post('/api/goals').send({ child_id: ids.child2Id, title: '目标二' });
    goal1Id = g1.body.id;
    goal2Id = g2.body.id;
  });

  describe('GET /api/todos', () => {
    it('初始应返回空数组', async () => {
      const res = await agent.get('/api/todos');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('应返回已创建的待办', async () => {
      await agent.post('/api/todos').send({ child_id: ids.child1Id, title: '待办A' });
      await agent.post('/api/todos').send({ child_id: ids.child2Id, title: '待办B' });
      const res = await agent.get('/api/todos');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('待办A');
      expect(res.body[1].title).toBe('待办B');
    });

    it('应按 child_id 筛选', async () => {
      await agent.post('/api/todos').send({ child_id: ids.child1Id, title: '孩子1待办1' });
      await agent.post('/api/todos').send({ child_id: ids.child1Id, title: '孩子1待办2' });
      await agent.post('/api/todos').send({ child_id: ids.child2Id, title: '孩子2待办' });
      const res = await agent.get(`/api/todos?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.every(t => t.child_id === ids.child1Id)).toBe(true);
    });

    it('应按 goal_id 筛选', async () => {
      await agent.post('/api/todos').send({ goal_id: goal1Id, child_id: ids.child1Id, title: '目标一待办' });
      await agent.post('/api/todos').send({ goal_id: goal2Id, child_id: ids.child2Id, title: '目标二待办' });
      await agent.post('/api/todos').send({ child_id: ids.child1Id, title: '无目标待办' });
      const res = await agent.get(`/api/todos?goal_id=${goal1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].goal_id).toBe(goal1Id);
      expect(res.body[0].title).toBe('目标一待办');
    });
  });

  describe('POST /api/todos', () => {
    it('应成功创建待办', async () => {
      const res = await agent.post('/api/todos').send({
        goal_id: goal1Id,
        child_id: ids.child1Id,
        title: '完成数学练习',
        creator: '妈妈',
        priority: 'high',
        expected_points: 5,
        planned_date: '2026-08-01',
        description: '第三章习题',
        completed: 1
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.goal_id).toBe(goal1Id);
      expect(res.body.child_id).toBe(ids.child1Id);
      expect(res.body.title).toBe('完成数学练习');
      expect(res.body.creator).toBe('妈妈');
      expect(res.body.priority).toBe('high');
      expect(res.body.expected_points).toBe(5);
      expect(res.body.planned_date).toBe('2026-08-01');
      expect(res.body.description).toBe('第三章习题');
      expect(res.body.completed).toBe(1);
    });

    it('缺少 title 应返回 400', async () => {
      const res = await agent.post('/api/todos').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('仅传 title 时应使用默认值', async () => {
      const res = await agent.post('/api/todos').send({ title: '默认值待办' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('默认值待办');
      expect(res.body.priority).toBe('medium');
      expect(res.body.expected_points).toBe(0);
      expect(res.body.completed).toBe(0);
      expect(res.body.goal_id).toBeNull();
      expect(res.body.child_id).toBeNull();
      expect(res.body.creator).toBeNull();
      expect(res.body.planned_date).toBeNull();
      expect(res.body.description).toBeNull();
    });
  });

  describe('PUT /api/todos/:id', () => {
    it('应成功更新待办', async () => {
      const created = await agent.post('/api/todos').send({
        goal_id: goal1Id,
        child_id: ids.child1Id,
        title: '原待办',
        creator: '爸爸',
        priority: 'low',
        expected_points: 1,
        planned_date: '2026-08-01',
        description: '原描述'
      });
      const res = await agent.put(`/api/todos/${created.body.id}`).send({
        title: '新待办',
        creator: '妈妈',
        priority: 'high',
        expected_points: 8,
        planned_date: '2026-09-01',
        description: '新描述',
        goal_id: goal2Id,
        child_id: ids.child2Id,
        completed: 1
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('新待办');
      expect(res.body.creator).toBe('妈妈');
      expect(res.body.priority).toBe('high');
      expect(res.body.expected_points).toBe(8);
      expect(res.body.planned_date).toBe('2026-09-01');
      expect(res.body.description).toBe('新描述');
      expect(res.body.goal_id).toBe(goal2Id);
      expect(res.body.child_id).toBe(ids.child2Id);
      expect(res.body.completed).toBe(1);
    });

    it('不存在的待办应返回 404', async () => {
      const res = await agent.put('/api/todos/9999').send({ title: '更新' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('completed 应可从 0 切到 1', async () => {
      const created = await agent.post('/api/todos').send({
        child_id: ids.child1Id,
        title: '待完成'
      });
      expect(created.body.completed).toBe(0);
      const done = await agent.put(`/api/todos/${created.body.id}`).send({ completed: 1 });
      expect(done.status).toBe(200);
      expect(done.body.completed).toBe(1);
      const undone = await agent.put(`/api/todos/${created.body.id}`).send({ completed: 0 });
      expect(undone.status).toBe(200);
      expect(undone.body.completed).toBe(0);
    });

    it('显式传 goal_id: null 应解除关联', async () => {
      const created = await agent.post('/api/todos').send({
        goal_id: goal1Id,
        child_id: ids.child1Id,
        title: '关联待办'
      });
      expect(created.body.goal_id).toBe(goal1Id);
      const res = await agent.put(`/api/todos/${created.body.id}`).send({ goal_id: null });
      expect(res.status).toBe(200);
      expect(res.body.goal_id).toBeNull();
      expect(res.body.title).toBe('关联待办');
    });

    it('显式传 expected_points: 0 应置零', async () => {
      const created = await agent.post('/api/todos').send({
        child_id: ids.child1Id,
        title: '积分待办',
        expected_points: 10
      });
      expect(created.body.expected_points).toBe(10);
      const res = await agent.put(`/api/todos/${created.body.id}`).send({ expected_points: 0 });
      expect(res.status).toBe(200);
      expect(res.body.expected_points).toBe(0);
    });

    it('请求体不含 planned_date 时应保留原值', async () => {
      const created = await agent.post('/api/todos').send({
        child_id: ids.child1Id,
        title: '有计划日期的待办',
        planned_date: '2026-08-15',
        description: '原描述'
      });
      expect(created.body.planned_date).toBe('2026-08-15');
      const res = await agent.put(`/api/todos/${created.body.id}`).send({ title: '仅改标题' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('仅改标题');
      expect(res.body.planned_date).toBe('2026-08-15');
      expect(res.body.description).toBe('原描述');
    });
  });

  describe('DELETE /api/todos/:id', () => {
    it('应成功删除待办', async () => {
      const created = await agent.post('/api/todos').send({
        child_id: ids.child1Id,
        title: '待删除待办'
      });
      const res = await agent.delete(`/api/todos/${created.body.id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '待办已删除');
      const list = await agent.get('/api/todos');
      expect(list.body).toHaveLength(0);
    });

    it('不存在的待办应返回 404', async () => {
      const res = await agent.delete('/api/todos/9999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });
  });
});
