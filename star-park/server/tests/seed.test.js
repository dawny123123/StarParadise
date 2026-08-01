const { getTestDb, seedTestData } = require('./helpers');
const seed = require('../src/seed');

describe('seed()', () => {
  const db = getTestDb();

  it('空数据库时应插入种子数据', () => {
    // setup.js beforeEach 已清空数据库，确认数据库为空
    const beforeChildCount = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
    const beforeTaskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const beforeRewardCount = db.prepare('SELECT COUNT(*) as count FROM rewards').get().count;
    expect(beforeChildCount).toBe(0);
    expect(beforeTaskCount).toBe(0);
    expect(beforeRewardCount).toBe(0);

    seed();

    const childCount = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
    const rewardCount = db.prepare('SELECT COUNT(*) as count FROM rewards').get().count;

    expect(childCount).toBe(3);
    expect(taskCount).toBe(3);
    expect(rewardCount).toBe(1);
  });

  it('非空数据库时应跳过插入', () => {
    // 使用 helpers 插入测试数据，使数据库非空
    seedTestData();

    const beforeCount = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
    expect(beforeCount).toBe(2); // seedTestData 插入了 2 个孩子

    // 调用 seed()，应跳过插入
    seed();

    const afterCount = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
    expect(afterCount).toBe(2); // 数据不应变化
  });

  it('插入的孩子数据应正确', () => {
    seed();

    const children = db.prepare('SELECT name, age, grade FROM children ORDER BY id').all();
    expect(children).toEqual([
      { name: '甜甜', age: 13, grade: '初一' },
      { name: '甄甄', age: 8, grade: '小学三年级' },
      { name: '欣甜', age: 6, grade: '幼儿园大班' },
    ]);
  });
});
