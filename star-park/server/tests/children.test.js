const { createAgent, seedTestData } = require('./helpers');

describe('Children API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/children', () => {
    it('应返回所有孩子及其任务信息', async () => {
      const res = await agent.get('/api/children');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('name', '测试孩子1');
      expect(res.body[0]).toHaveProperty('tasks');
      expect(res.body[0].tasks).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('balance');
      expect(res.body[0]).toHaveProperty('points_balance', 0);
    });

    it('余额格式应为 ¥X', async () => {
      const res = await agent.get('/api/children');
      expect(res.body[0].balance).toMatch(/^¥/);
    });

    it('孩子的 tasks 应按 planned_date 升序，无日期的排在最后', async () => {
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
      const res = await agent.get('/api/children');
      expect(res.status).toBe(200);
      const taskIds = res.body[0].tasks.map(t => t.id);
      // 有计划日期的按日期升序在前
      expect(taskIds[0]).toBe(earlier.body.id);
      expect(taskIds[1]).toBe(later.body.id);
      // 无计划日期的种子任务（id 1、2）按 id 升序排在最后
      expect(taskIds.slice(2)).toEqual([1, 2]);
    });
  });

  describe('POST /api/children', () => {
    it('应成功添加孩子', async () => {
      const res = await agent.post('/api/children').send({
        name: '新孩子',
        age: 7,
        grade: '二年级'
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('新孩子');
      expect(res.body.age).toBe(7);
    });

    it('缺少 name 应返回 400', async () => {
      const res = await agent.post('/api/children').send({ age: 7 });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('应使用默认头像颜色', async () => {
      const res = await agent.post('/api/children').send({ name: '默认色' });
      expect(res.status).toBe(201);
      expect(res.body.avatar_color).toBe('#19C8B9');
    });
  });

  describe('GET /api/children/:id/balance', () => {
    it('应返回孩子的积分余额', async () => {
      const res = await agent.get(`/api/children/${ids.child1Id}/balance`);
      expect(res.status).toBe(200);
      expect(res.body).toBe(0);
    });

    it('不存在的孩子应返回 404', async () => {
      const res = await agent.get('/api/children/9999/balance');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/children/:id/transactions', () => {
    it('默认返回积分记录', async () => {
      const res = await agent.get(`/api/children/${ids.child1Id}/transactions`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('type=money 返回金钱交易记录', async () => {
      const res = await agent.get(`/api/children/${ids.child1Id}/transactions?type=money`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
