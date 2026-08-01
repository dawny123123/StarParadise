const db = require('./database');

function seed() {
  // 检查是否已有数据
  const childCount = db.prepare('SELECT COUNT(*) as count FROM children').get().count;
  if (childCount > 0) {
    console.log('种子数据已存在，跳过初始化');
    return;
  }

  console.log('正在初始化种子数据...');

  const insertChild = db.prepare(
    'INSERT INTO children (name, age, grade, focus, avatar_color) VALUES (?, ?, ?, ?, ?)'
  );
  const insertTask = db.prepare(
    'INSERT INTO tasks (child_id, title, description, reward_amount, reward_unit, planned_date) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertReward = db.prepare(
    'INSERT INTO rewards (child_id, title, target_amount, current_amount) VALUES (?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    // 插入三个孩子
    const child2 = insertChild.run('甜甜', 13, '初一', '各学科提分', '#FF6B6B');
    const child3 = insertChild.run('甄甄', 8, '小学三年级', '提升记忆力', '#4ECDC4');
    const child4 = insertChild.run('欣甜', 6, '幼儿园大班', '古诗启蒙', '#FFD93D');

    // 甜甜的任务
    insertTask.run(child2.lastInsertRowid, '英语背单词', '每天背10个单词', 1, '元', null);
    // 甄甄的任务
    insertTask.run(child3.lastInsertRowid, '练字', '每天写50个字以上', 1, '元', null);
    // 欣甜的任务
    insertTask.run(child4.lastInsertRowid, '背古诗', '每天背1首诗', 1, '元', null);

    // 欣甜的奖励目标
    insertReward.run(child4.lastInsertRowid, '变形金刚玩具', 50, 0);
  });

  transaction();
  console.log('种子数据初始化完成！');
}

module.exports = seed;
