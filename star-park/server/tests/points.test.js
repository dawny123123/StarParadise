const { createAgent, seedTestData, getTestDb } = require('./helpers');

describe('Points API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/points', () => {
    it('缺少 child_id 应返回 400', async () => {
      const res = await agent.get('/api/points');
      expect(res.status).toBe(400);
    });

    it('应返回积分记录和余额', async () => {
      const res = await agent.get(`/api/points?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('records');
      expect(res.body).toHaveProperty('balance');
      expect(Array.isArray(res.body.records)).toBe(true);
    });
  });

  describe('POST /api/points', () => {
    it('应成功添加积分', async () => {
      const res = await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 10,
        reason: '表现优秀'
      });
      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(10);
      expect(res.body.reason).toBe('表现优秀');
      expect(res.body.new_balance).toBe(10);
    });

    it('应成功扣减积分', async () => {
      // 先加积分
      await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 10,
        reason: '奖励'
      });
      // 扣减
      const res = await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: -3,
        reason: '惩罚'
      });
      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(-3);
      expect(res.body.new_balance).toBe(7);
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await agent.post('/api/points').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
    });

    it('积分为 0 应返回 400', async () => {
      const res = await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 0
      });
      expect(res.status).toBe(400);
    });

    it('非数字积分应返回 400', async () => {
      const res = await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 'abc'
      });
      expect(res.status).toBe(400);
    });

    it('应使用默认 reason', async () => {
      const res = await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 5
      });
      expect(res.status).toBe(201);
      expect(res.body.reason).toBe('特殊积分奖励');
    });

    it('应更新孩子的积分余额', async () => {
      await agent.post('/api/points').send({
        child_id: ids.child1Id,
        amount: 15,
        reason: '测试'
      });
      const db = getTestDb();
      const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(ids.child1Id);
      expect(child.points_balance).toBe(15);
    });
  });
});
