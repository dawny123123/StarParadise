const { createAgent, seedTestData, getTestDb } = require('./helpers');

describe('Flowers API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/flowers', () => {
    it('应返回红花记录和余额', async () => {
      const db = getTestDb();
      db.prepare('INSERT INTO flowers (child_id, amount, reason) VALUES (?, ?, ?)')
        .run(ids.child1Id, 5, '表现优秀');
      db.prepare('UPDATE children SET flowers_balance = 5 WHERE id = ?').run(ids.child1Id);

      const res = await agent.get(`/api/flowers?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(1);
      expect(res.body.records[0].amount).toBe(5);
      expect(res.body.balance).toBe(5);
    });

    it('缺少 child_id 应返回 400', async () => {
      const res = await agent.get('/api/flowers');
      expect(res.status).toBe(400);
    });

    it('无红花记录时应返回空数组和余额 0', async () => {
      const res = await agent.get(`/api/flowers?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.records).toHaveLength(0);
      expect(res.body.balance).toBe(0);
    });
  });

  describe('POST /api/flowers', () => {
    it('应成功发放红花', async () => {
      const res = await agent.post('/api/flowers').send({
        child_id: ids.child1Id,
        amount: 3,
        reason: '帮助同学'
      });
      expect(res.status).toBe(201);
      expect(res.body.amount).toBe(3);
      expect(res.body.reason).toBe('帮助同学');
      expect(res.body.new_balance).toBe(3);
    });

    it('默认理由应为特殊红花奖励', async () => {
      const res = await agent.post('/api/flowers').send({
        child_id: ids.child1Id,
        amount: 2
      });
      expect(res.status).toBe(201);
      expect(res.body.reason).toBe('特殊红花奖励');
    });

    it('多次发放应累计余额', async () => {
      await agent.post('/api/flowers').send({ child_id: ids.child1Id, amount: 3 });
      const res = await agent.post('/api/flowers').send({ child_id: ids.child1Id, amount: 2 });
      expect(res.status).toBe(201);
      expect(res.body.new_balance).toBe(5);
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await agent.post('/api/flowers').send({ amount: 1 });
      expect(res.status).toBe(400);
    });

    it('零值应返回 400', async () => {
      const res = await agent.post('/api/flowers').send({
        child_id: ids.child1Id,
        amount: 0
      });
      expect(res.status).toBe(400);
    });
  });
});
