const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/tasks?child_id=x - 获取任务列表(可按孩子筛选)
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    let tasks;
    if (child_id) {
      tasks = db.prepare('SELECT * FROM tasks WHERE child_id = ? ORDER BY id').all(child_id);
    } else {
      tasks = db.prepare('SELECT * FROM tasks ORDER BY id').all();
    }
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks - 创建任务
router.post('/', (req, res) => {
  try {
    const { child_id, title, description, reward_amount, reward_unit } = req.body;
    if (!child_id || !title) {
      return res.status(400).json({ error: 'child_id 和 title 为必填项' });
    }
    const result = db.prepare(
      'INSERT INTO tasks (child_id, title, description, reward_amount, reward_unit) VALUES (?, ?, ?, ?, ?)'
    ).run(child_id, title, description || null, reward_amount || 1.0, reward_unit || '元');
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/tasks/:id - 更新任务
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '任务不存在' });
    }
    const { title, description, reward_amount, reward_unit, is_active } = req.body;
    db.prepare(
      `UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        reward_amount = COALESCE(?, reward_amount),
        reward_unit = COALESCE(?, reward_unit),
        is_active = COALESCE(?, is_active)
      WHERE id = ?`
    ).run(
      title ?? null,
      description ?? null,
      reward_amount ?? null,
      reward_unit ?? null,
      is_active ?? null,
      id
    );
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id - 删除任务
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '任务不存在' });
    }
    // 使用事务确保先删打卡记录，再删任务
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM checkins WHERE task_id = ?').run(id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    });
    deleteTransaction();
    res.json({ message: '任务已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
