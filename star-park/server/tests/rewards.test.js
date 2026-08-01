const { createAgent, seedTestData, getTestDb } = require('./helpers');

describe('Rewards API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/rewards', () => {
    it('应返回所有奖励目标', async () => {
      const res = await agent.get('/api/rewards');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('应按 child_id 筛选', async () => {
      const res = await agent.get(`/api/rewards?child_id=${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('玩具车');
    });
  });

  describe('POST /api/rewards', () => {
    it('应成功创建奖励目标', async () => {
      const res = await agent.post('/api/rewards').send({
        child_id: ids.child1Id,
        title: '新奖励',
        target_amount: 30,
        description: '测试奖励',
        reward_unit: '元'
      });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('新奖励');
      expect(res.body.target_amount).toBe(30);
      expect(res.body.current_amount).toBe(0);
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await agent.post('/api/rewards').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
    });

    it('默认 reward_unit 应为元', async () => {
      const res = await agent.post('/api/rewards').send({
        child_id: ids.child1Id,
        title: '默认单位',
        target_amount: 10
      });
      expect(res.status).toBe(201);
      expect(res.body.reward_unit).toBe('元');
    });
  });

  describe('PUT /api/rewards/:id', () => {
    it('应成功更新奖励', async () => {
      const res = await agent.put('/api/rewards/1').send({ title: '新标题' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('新标题');
    });

    it('不存在的奖励应返回 404', async () => {
      const res = await agent.put('/api/rewards/9999').send({ title: '更新' });
      expect(res.status).toBe(404);
    });

    it('应可更新所有字段', async () => {
      const res = await agent.put('/api/rewards/1').send({
        title: '全更新奖励',
        target_amount: 50,
        current_amount: 25,
        is_achieved: 1,
        description: '新描述',
        reward_unit: '星星'
      });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('全更新奖励');
      expect(res.body.target_amount).toBe(50);
      expect(res.body.current_amount).toBe(25);
      expect(res.body.is_achieved).toBe(1);
    });
  });

  describe('DELETE /api/rewards/:id', () => {
    it('应成功删除奖励', async () => {
      const res = await agent.delete('/api/rewards/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('不存在的奖励应返回 404', async () => {
      const res = await agent.delete('/api/rewards/9999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/rewards/:id/redeem', () => {
    it('未达成目标应返回 400', async () => {
      const res = await agent.post('/api/rewards/1/redeem');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('尚未达成');
    });

    it('不存在的奖励应返回 404', async () => {
      const res = await agent.post('/api/rewards/9999/redeem');
      expect(res.status).toBe(404);
    });

    it('达成后应可兑换（元）', async () => {
      const db = getTestDb();
      // 先充值足够余额
      db.prepare("INSERT INTO transactions (child_id, type, amount, description) VALUES (?, 'earn', 100, '充值')").run(ids.child1Id);
      // 达成目标
      db.prepare('UPDATE rewards SET current_amount = target_amount, is_achieved = 1 WHERE id = ?').run(1);

      const res = await agent.post('/api/rewards/1/redeem');
      expect(res.status).toBe(200);
      expect(res.body.redeemed_at).toBeTruthy();
    });

    it('达成后应可兑换（星星）', async () => {
      const db = getTestDb();
      // 充值积分
      db.prepare('UPDATE children SET points_balance = 100 WHERE id = ?').run(ids.child2Id);
      // 达成目标
      db.prepare('UPDATE rewards SET current_amount = target_amount, is_achieved = 1 WHERE id = ?').run(2);

      const res = await agent.post('/api/rewards/2/redeem');
      expect(res.status).toBe(200);
      expect(res.body.redeemed_at).toBeTruthy();
    });

    it('已兑换不能重复', async () => {
      const db = getTestDb();
      db.prepare("INSERT INTO transactions (child_id, type, amount, description) VALUES (?, 'earn', 100, '充值')").run(ids.child1Id);
      db.prepare('UPDATE rewards SET current_amount = target_amount, is_achieved = 1 WHERE id = ?').run(1);

      await agent.post('/api/rewards/1/redeem');
      const res = await agent.post('/api/rewards/1/redeem');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('已兑换');
    });

    it('余额不足应返回 400', async () => {
      const db = getTestDb();
      // 余额为 0，但目标已达成
      db.prepare('UPDATE rewards SET current_amount = target_amount, is_achieved = 1 WHERE id = ?').run(1);

      const res = await agent.post('/api/rewards/1/redeem');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('余额不足');
    });

    it('星星类型积分余额不足时兑换应返回 400', async () => {
      const db = getTestDb();
      // 确保 child2 的 points_balance 为 0
      db.prepare('UPDATE children SET points_balance = 0 WHERE id = ?').run(ids.child2Id);
      // 达成星星奖励目标（reward id=2）
      db.prepare('UPDATE rewards SET current_amount = target_amount, is_achieved = 1 WHERE id = ?').run(2);

      const res = await agent.post('/api/rewards/2/redeem');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('积分余额不足');
    });

    it('不支持的奖励单位兑换应返回 400', async () => {
      const db = getTestDb();
      // 创建一个非标准奖励单位的奖励
      const result = db.prepare(
        'INSERT INTO rewards (child_id, title, target_amount, current_amount, reward_unit, is_achieved) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(ids.child1Id, '钻石奖励', 10, 10, '钻石', 1);

      const res = await agent.post(`/api/rewards/${result.lastInsertRowid}/redeem`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('不支持的奖励单位');
    });
  });
});
