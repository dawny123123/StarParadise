const request = require('supertest');
const app = require('../src/app');
const db = require('../src/database');

/**
 * 创建测试请求代理
 */
function createAgent() {
  return request(app);
}

/**
 * 重置数据库并插入种子数据
 */
function seedTestData() {
  db.resetForTest();

  const insertChild = db.prepare(
    'INSERT INTO children (name, age, grade, focus, avatar_color) VALUES (?, ?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (child_id, title, description, reward_amount, reward_unit) VALUES (?, ?, ?, ?, ?)'
  );
  const insertReward = db.prepare(
    'INSERT INTO rewards (child_id, title, target_amount, current_amount, reward_unit) VALUES (?, ?, ?, ?, ?)'
  );

  const child1 = insertChild.run('测试孩子1', 10, '四年级', '学习', '#19C8B9');
  const child2 = insertChild.run('测试孩子2', 8, '三年级', '阅读', '#FF6B6B');

  insertTask.run(child1.lastInsertRowid, '背单词', '每天背10个', 1, '元');
  insertTask.run(child1.lastInsertRowid, '练字', '每天写50字', 2, '元');
  insertTask.run(child2.lastInsertRowid, '读书', '每天读30分钟', 1, '星星');

  insertReward.run(child1.lastInsertRowid, '玩具车', 20, 5, '元');
  insertReward.run(child2.lastInsertRowid, '星星奖励', 10, 3, '星星');

  return {
    child1Id: Number(child1.lastInsertRowid),
    child2Id: Number(child2.lastInsertRowid),
  };
}

function getTestDb() {
  return db;
}

module.exports = { createAgent, seedTestData, getTestDb };
