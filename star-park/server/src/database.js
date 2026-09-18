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

  CREATE TABLE IF NOT EXISTS flowers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'todo',
    progress INTEGER DEFAULT 0,
    target INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER,
    child_id INTEGER,
    title TEXT NOT NULL,
    creator TEXT,
    priority TEXT DEFAULT 'medium',
    expected_points INTEGER DEFAULT 0,
    planned_date TEXT,
    description TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (goal_id) REFERENCES goals(id),
    FOREIGN KEY (child_id) REFERENCES children(id)
  );

  CREATE TABLE IF NOT EXISTS best_practices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    problem_description TEXT,
    key_points TEXT,
    file_url TEXT,
    file_name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS forward_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requirement TEXT NOT NULL,
    title TEXT,
    practice_id INTEGER,
    template_id TEXT,
    session_id TEXT,
    status TEXT DEFAULT 'pending',
    stop_reason TEXT,
    result TEXT,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (practice_id) REFERENCES best_practices(id)
  );
`);

// 迁移：给 children 表添加 points_balance 字段（如果不存在）
try {
  db.exec(`ALTER TABLE children ADD COLUMN points_balance INTEGER DEFAULT 0`);
} catch (err) {
  /* v8 ignore next */
  // 如果字段已存在会报错，忽略即可
}

// 迁移：给 children 表添加 flowers_balance 字段（红花余额，PONR-5）
try {
  db.exec(`ALTER TABLE children ADD COLUMN flowers_balance INTEGER DEFAULT 0`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('flowers_balance 迁移失败:', err.message);
    throw err;
  }
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

// 迁移：给 todos 表添加 parent_id 字段（父子任务支持）
try {
  db.exec(`ALTER TABLE todos ADD COLUMN parent_id INTEGER REFERENCES todos(id)`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('parent_id 迁移失败:', err.message);
    throw err;
  }
}
// 索引：加速子任务查询
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id)`);
} catch (err) { /* 忽略已存在 */ }

// 迁移：给 goals 表添加 description 字段（如果不存在）
try {
  db.exec(`ALTER TABLE goals ADD COLUMN description TEXT DEFAULT ''`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('description 迁移失败:', err.message);
    throw err;
  }
}

// 迁移：给 goals 表添加附件字段（JSON 数组，支持目标描述附件，PONR-31）
try {
  db.exec(`ALTER TABLE goals ADD COLUMN attachments TEXT`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('goals.attachments 迁移失败:', err.message);
    throw err;
  }
}

// 迁移：给 todos 表添加附件字段（任务描述支持上传附件）
try {
  db.exec(`ALTER TABLE todos ADD COLUMN file_url TEXT`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('todos.file_url 迁移失败:', err.message);
    throw err;
  }
}
try {
  db.exec(`ALTER TABLE todos ADD COLUMN file_name TEXT`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('todos.file_name 迁移失败:', err.message);
    throw err;
  }
}

// 迁移：给 todos 表添加 attachments 字段（JSON 数组，支持多附件，PONR-14）
try {
  db.exec(`ALTER TABLE todos ADD COLUMN attachments TEXT`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('todos.attachments 迁移失败:', err.message);
    throw err;
  }
}
// 数据迁移：将旧的 file_url/file_name 单附件数据迁移到 attachments JSON 数组
/* v8 ignore next 4 */
try {
  db.exec(`UPDATE todos SET attachments = json('[{"file_url":"' || file_url || '","file_name":"' || COALESCE(file_name, file_url) || '"}]') WHERE attachments IS NULL AND file_url IS NOT NULL`);
} catch (err) {
  // JSON 函数不可用或数据已迁移，忽略
}

// 迁移：给 best_practices 表添加 attachments 字段（JSON 数组，支持多附件，PONR-27）
try {
  db.exec(`ALTER TABLE best_practices ADD COLUMN attachments TEXT`);
} catch (err) {
  if (!/duplicate column name/i.test(err.message)) {
    console.error('best_practices.attachments 迁移失败:', err.message);
    throw err;
  }
}
// 数据迁移：将旧的 file_url/file_name 单附件数据迁移到 attachments JSON 数组
/* v8 ignore next 4 */
try {
  db.exec(`UPDATE best_practices SET attachments = json('[{"file_url":"' || file_url || '","file_name":"' || COALESCE(file_name, file_url) || '"}]') WHERE attachments IS NULL AND file_url IS NOT NULL`);
} catch (err) {
  // JSON 函数不可用或数据已迁移，忽略
}

// 测试辅助：重置所有表数据
function resetForTest() {
  /* v8 ignore next */
  const tables = ['forward_deliveries', 'todos', 'goals', 'flowers', 'points', 'transactions', 'checkins', 'rewards', 'tasks', 'children', 'best_practices'];
  for (const table of tables) {
    /* v8 ignore next */
    db.exec(`DELETE FROM ${table}`);
  }
  // 重置自增计数器
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('${tables.join("','")}')`);
}

module.exports = db;
module.exports.resetForTest = resetForTest;
