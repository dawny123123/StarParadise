const { createAgent, seedTestData } = require('./helpers');

describe('Tasks API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/tasks', () => {
    it('应返回所有任务', async () => {
      const res = await agent.get('/api/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
    });

    it('应按 child_id 筛选', async () => {
      const res = await agent.get(`/api/tasks?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('应按计划日期升序排列，无计划日期的排在最后', async () => {
      const later = await agent.post('/api/tasks').send({
        child_id: ids.child1Id,
        title: '较晚计划任务',
        planned_date: '2026-06-01'
      });
      const earlier = await agent.post('/api/tasks').send({
        child_id: ids.child1Id,
        title: '较早计划任务',
        planned_date: '2026-05-01'
      });
      const res = await agent.get(`/api/tasks?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      const idsInOrder = res.body.map(t => t.id);
      // 有计划日期的按日期升序在前
      expect(idsInOrder[0]).toBe(earlier.body.id);
      expect(idsInOrder[1]).toBe(later.body.id);
      // 无计划日期的种子任务按 id 升序排在最后
      const rest = res.body.slice(2);
      expect(rest.every(t => t.planned_date === null)).toBe(true);
    });
  });

  describe('POST /api/tasks', () => {
    it('应成功创建任务', async () => {
      const res = await agent.post('/api/tasks').send({
        child_id: ids.child1Id,
        title: '新任务',
        description: '测试描述',
        reward_amount: 3,
        reward_unit: '元'
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('新任务');
      expect(res.body.reward_amount).toBe(3);
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await agent.post('/api/tasks').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
    });

    it('缺少 child_id 应返回 400', async () => {
      const res = await agent.post('/api/tasks').send({ title: '测试' });
      expect(res.status).toBe(400);
    });

    it('仅提供必填字段时应使用默认值', async () => {
      const res = await agent.post('/api/tasks').send({
        child_id: ids.child1Id,
        title: '默认值任务'
      });
      expect(res.status).toBe(201);
      expect(res.body.reward_amount).toBe(1.0);
      expect(res.body.reward_unit).toBe('元');
      expect(res.body.planned_date).toBeNull();
    });

    it('创建时应正确保存 planned_date', async () => {
      const res = await agent.post('/api/tasks').send({
        child_id: ids.child1Id,
        title: '带计划日期的任务',
        planned_date: '2026-08-01'
      });
      expect(res.status).toBe(201);
      expect(res.body.planned_date).toBe('2026-08-01');
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('应成功更新任务', async () => {
      const res = await agent.put('/api/tasks/1').send({ title: '更新标题' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('更新标题');
    });

    it('不存在的任务应返回 404', async () => {
      const res = await agent.put('/api/tasks/9999').send({ title: '更新' });
      expect(res.status).toBe(404);
    });

    it('部分更新应保留原值', async () => {
      const res = await agent.put('/api/tasks/1').send({ title: '新标题' });
      expect(res.status).toBe(200);
      expect(res.body.description).toBe('每天背10个');
    });

    it('应可更新所有字段', async () => {
      const res = await agent.put('/api/tasks/1').send({
        title: '全更新',
        description: '新描述',
        reward_amount: 5,
        reward_unit: '星星',
        is_active: 0
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('全更新');
      expect(res.body.description).toBe('新描述');
      expect(res.body.reward_amount).toBe(5);
      expect(res.body.reward_unit).toBe('星星');
      expect(res.body.is_active).toBe(0);
    });

    it('应可更新 planned_date', async () => {
      const res = await agent.put('/api/tasks/1').send({ planned_date: '2026-09-15' });
      expect(res.status).toBe(200);
      expect(res.body.planned_date).toBe('2026-09-15');
      // 其他字段保持原值
      expect(res.body.description).toBe('每天背10个');
    });

    it('显式传 planned_date: null 应清空计划日期', async () => {
      await agent.put('/api/tasks/1').send({ planned_date: '2026-09-15' });
      const res = await agent.put('/api/tasks/1').send({ planned_date: null });
      expect(res.status).toBe(200);
      expect(res.body.planned_date).toBeNull();
    });

    it('请求体不含 planned_date 键时应保留原值', async () => {
      await agent.put('/api/tasks/1').send({ planned_date: '2026-09-15' });
      const res = await agent.put('/api/tasks/1').send({ title: '仅改标题' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('仅改标题');
      expect(res.body.planned_date).toBe('2026-09-15');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('应成功删除任务', async () => {
      const res = await agent.delete('/api/tasks/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', '任务已删除');
    });

    it('不存在的任务应返回 404', async () => {
      const res = await agent.delete('/api/tasks/9999');
      expect(res.status).toBe(404);
    });

    it('删除后任务列表应减少', async () => {
      await agent.delete('/api/tasks/1');
      const res = await agent.get('/api/tasks');
      expect(res.body).toHaveLength(2);
    });
  });
});
