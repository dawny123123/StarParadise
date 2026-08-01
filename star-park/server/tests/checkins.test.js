const { createAgent, seedTestData, getTestDb } = require('./helpers');

describe('Checkins API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/checkins', () => {
    it('应返回空列表（无打卡记录）', async () => {
      const res = await agent.get('/api/checkins');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('应按日期筛选', async () => {
      // 先创建一条打卡
      await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-01-01'
      });
      const res = await agent.get('/api/checkins?date=2025-01-01');
      expect(res.body).toHaveLength(1);
    });

    it('应按 child_id 筛选', async () => {
      await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-01-01'
      });
      const res = await agent.get(`/api/checkins?child_id=${ids.child2Id}`);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/checkins', () => {
    it('应成功创建打卡记录', async () => {
      const res = await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-06-01',
        completed: 1
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.task_title).toBe('背单词');
    });

    it('打卡应创建交易记录', async () => {
      await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-06-01',
        completed: 1
      });
      const db = getTestDb();
      const txns = db.prepare("SELECT * FROM transactions WHERE child_id = ? AND type = 'earn'").all(ids.child1Id);
      expect(txns.length).toBeGreaterThan(0);
    });

    it('打卡应更新奖励进度', async () => {
      await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-06-01',
        completed: 1
      });
      const db = getTestDb();
      const reward = db.prepare('SELECT * FROM rewards WHERE id = 1').get();
      expect(reward.current_amount).toBe(6); // 5 + 1
    });

    it('缺少必填字段应返回 400', async () => {
      const res = await agent.post('/api/checkins').send({ child_id: ids.child1Id });
      expect(res.status).toBe(400);
    });

    it('不存在的任务应返回 400', async () => {
      const res = await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 9999,
        checkin_date: '2025-06-01'
      });
      expect(res.status).toBe(400);
    });

    it('未完成打卡 reward_earned 应为 0', async () => {
      const res = await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-06-01',
        completed: 0
      });
      expect(res.status).toBe(201);
      expect(res.body.reward_earned).toBe(0);
    });
  });

  describe('POST /api/checkins/auto-checkin-all', () => {
    it('应为所有活跃任务自动打卡', async () => {
      const res = await agent.post('/api/checkins/auto-checkin-all').send({
        checkin_date: '2025-06-01'
      });
      expect(res.status).toBe(200);
      expect(res.body.created).toBe(3); // 3 active tasks
      expect(res.body.skipped).toBe(0);
    });

    it('已打卡的任务应跳过', async () => {
      await agent.post('/api/checkins').send({
        child_id: ids.child1Id,
        task_id: 1,
        checkin_date: '2025-06-01'
      });
      const res = await agent.post('/api/checkins/auto-checkin-all').send({
        checkin_date: '2025-06-01'
      });
      expect(res.body.skipped).toBe(1);
      expect(res.body.created).toBe(2);
    });

    it('无活跃任务时应返回空', async () => {
      const db = getTestDb();
      db.prepare('UPDATE tasks SET is_active = 0').run();
      const res = await agent.post('/api/checkins/auto-checkin-all').send({
        checkin_date: '2025-06-01'
      });
      expect(res.body.created).toBe(0);
    });

    it('不提供 checkin_date 时应使用今日日期', async () => {
      const res = await agent.post('/api/checkins/auto-checkin-all').send({});
      expect(res.status).toBe(200);
      expect(res.body.created).toBe(3);
    });
  });
});
