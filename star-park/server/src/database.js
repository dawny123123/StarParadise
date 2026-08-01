const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 测试模式使用内存数据库，生产模式使用文件数据库
const isTest = process.env.NODE_ENV === 'test';

let db;
if (isTest) {
  db = new Database(':memory:');
} else { /* v8 ignore start */
  const DATA_DIR = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const DB_PATH = path.join(DATA_DIR, 'star-park.db');
  db = new Database(DB_PATH);
  /* v8 ignore stop */
}

// 启用 WAL 模式提升并发性能
/* v8 ignore next */
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    grade TEXT,
    focus TEXT,
    avatar_color TEXT DEFAULT '#19C8B9'
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    reward_amount REAL DEFAULT 1.0,
    reward_unit TEXT DEFAULT '元',
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    checkin_date TEXT NOT NULL,
    completed INTEGER DEFAULT 1,
    reward_earned REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0,
    is_achieved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );
`);

// 迁移：给 children 表添加 points_balance 字段（如果不存在）
try {
  db.exec(`ALTER TABLE children ADD COLUMN points_balance INTEGER DEFAULT 0`);
} catch (err) {
  /* v8 ignore next */
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 rewards 表添加 description 字段（如果不存在）
/* v8 ignore next 3 */
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN description TEXT DEFAULT ''`);
} catch (err) {
  /* v8 ignore next */
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 rewards 表添加 reward_unit 字段（如果不存在）
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN reward_unit TEXT DEFAULT '元'`);
} catch (err) {
  /* v8 ignore next */
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 rewards 表添加 redeemed_at 字段（记录兑换时间）
try {
  db.exec(`ALTER TABLE rewards ADD COLUMN redeemed_at TEXT`);
} catch (err) {
  /* v8 ignore next */
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 tasks 表添加 planned_date 字段（计划日期 YYYY-MM-DD，允许为空）
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN planned_date TEXT`);
} catch (err) {
  // 仅忽略重复列错误，其余错误记录后抛出
  /* v8 ignore next 4 */
  if (!/duplicate column name/i.test(err.message)) {
    console.error('planned_date 迁移失败:', err.message);
    throw err;
  }
}

// 迁移：给 tasks 表添加 points_reward 字段（任务完成奖励积分，允许为空/0）
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN points_reward INTEGER DEFAULT 0`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('points_reward 迁移失败:', err.message);
    throw err;
  }
}

// 测试辅助：重置所有表数据
function resetForTest() {
  /* v8 ignore next */
  const tables = ['points', 'transactions', 'checkins', 'rewards', 'tasks', 'children'];
  for (const table of tables) {
    /* v8 ignore next */
    db.exec(`DELETE FROM ${table}`);
  }
  // 重置自增计数器
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('${tables.join("','")}')`);
}

module.exports = db;
module.exports.resetForTest = resetForTest;
