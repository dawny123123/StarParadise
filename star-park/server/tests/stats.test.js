const { createAgent, seedTestData, getTestDb } = require('./helpers');
const dayjs = require('dayjs');

describe('Stats API', () => {
  let agent;
  let ids;

  beforeEach(() => {
    ids = seedTestData();
    agent = createAgent();
  });

  describe('GET /api/stats/:childId', () => {
    it('应返回统计数据', async () => {
      const res = await agent.get(`/api/stats/${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('child_id', ids.child1Id);
      expect(res.body).toHaveProperty('streak');
      expect(res.body).toHaveProperty('weekly_rate');
      expect(res.body).toHaveProperty('weekly_checkins');
      expect(res.body).toHaveProperty('weekly_expected');
      expect(res.body).toHaveProperty('active_tasks');
      expect(res.body).toHaveProperty('balance');
      expect(res.body).toHaveProperty('daily_data');
    });

    it('daily_data 应有 30 条记录', async () => {
      const res = await agent.get(`/api/stats/${ids.child1Id}`);
      expect(res.body.daily_data).toHaveLength(30);
    });

    it('不存在的孩子应返回 404', async () => {
      const res = await agent.get('/api/stats/9999');
      expect(res.status).toBe(404);
    });

    it('有打卡记录时应计算连续天数', async () => {
      const db = getTestDb();
      const today = new Date().toISOString().slice(0, 10);
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, today);

      const res = await agent.get(`/api/stats/${ids.child1Id}`);
      expect(res.body.streak).toBe(1);
    });

    it('无打卡时 streak 应为 0', async () => {
      const res = await agent.get(`/api/stats/${ids.child1Id}`);
      expect(res.body.streak).toBe(0);
    });

    it('无今日打卡时 streak 应从昨天开始计算', async () => {
      const db = getTestDb();
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      const twoDaysAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, yesterday);
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, twoDaysAgo);

      const res = await agent.get(`/api/stats/${ids.child1Id}`);
      expect(res.status).toBe(200);
      expect(res.body.streak).toBe(2);
    });
  });

  describe('GET /api/dashboard', () => {
    it('应返回所有孩子的仪表盘数据', async () => {
      const res = await agent.get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it('每个孩子应包含今日打卡和统计信息', async () => {
      const res = await agent.get('/api/dashboard');
      const child = res.body[0];
      expect(child).toHaveProperty('today_checkins');
      expect(child).toHaveProperty('active_tasks');
      expect(child).toHaveProperty('streak');
      expect(child).toHaveProperty('weekly_rate');
      expect(child).toHaveProperty('balance');
      expect(child).toHaveProperty('points_balance');
      expect(child).toHaveProperty('flowers_balance');
      expect(child).toHaveProperty('rewards');
    });

    it('无数据时应返回空数组结构', async () => {
      const res = await agent.get('/api/dashboard');
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('有打卡记录时应返回正确的 streak 天数', async () => {
      const db = getTestDb();
      const today = dayjs().format('YYYY-MM-DD');
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, today);
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, yesterday);

      const res = await agent.get('/api/dashboard');
      expect(res.status).toBe(200);
      const child1 = res.body.find(c => c.id === ids.child1Id);
      expect(child1).toBeDefined();
      expect(child1.streak).toBeGreaterThanOrEqual(1);
    });

    it('仅昨日打卡时 streak 应为 1', async () => {
      const db = getTestDb();
      const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      db.prepare('INSERT INTO checkins (child_id, task_id, checkin_date, completed) VALUES (?, ?, ?, 1)')
        .run(ids.child1Id, 1, yesterday);

      const res = await agent.get('/api/dashboard');
      expect(res.status).toBe(200);
      const child1 = res.body.find(c => c.id === ids.child1Id);
      expect(child1).toBeDefined();
      expect(child1.streak).toBe(1);
    });

    it('应过滤名称为「测试」且积分为0的孩子（PONR-11）', async () => {
      const db = getTestDb();
      db.prepare('INSERT INTO children (name, age, grade, focus, avatar_color, points_balance) VALUES (?, ?, ?, ?, ?, ?)')
        .run('测试', 5, '幼儿园', '测试', '#FF0000', 0);

      const res = await agent.get('/api/dashboard');
      expect(res.status).toBe(200);
      const testChild = res.body.find(c => c.name === '测试');
      expect(testChild).toBeUndefined();
    });

    it('不应过滤名称为「测试」但积分不为0的孩子（PONR-11）', async () => {
      const db = getTestDb();
      db.prepare('INSERT INTO children (name, age, grade, focus, avatar_color, points_balance) VALUES (?, ?, ?, ?, ?, ?)')
        .run('测试', 5, '幼儿园', '测试', '#FF0000', 100);

      const res = await agent.get('/api/dashboard');
      expect(res.status).toBe(200);
      const testChild = res.body.find(c => c.name === '测试');
      expect(testChild).toBeDefined();
      expect(testChild.points_balance).toBe(100);
    });
  });

  describe('GET /api/health', () => {
    it('应返回健康状态', async () => {
      const res = await agent.get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
