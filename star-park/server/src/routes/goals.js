const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/goals?child_id=x - 获取目标列表(可按孩子筛选)
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    let goals;
    if (child_id) {
      goals = db.prepare('SELECT * FROM goals WHERE child_id = ? ORDER BY id ASC').all(child_id);
    } else {
      goals = db.prepare('SELECT * FROM goals ORDER BY id ASC').all();
    }
    res.json(goals);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals - 创建目标
router.post('/', (req, res) => {
  try {
    const { child_id, title, status, progress, target } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      'INSERT INTO goals (child_id, title, status, progress, target) VALUES (?, ?, ?, ?, ?)'
    ).run(child_id ?? null, title, status || 'todo', progress ?? 0, target ?? 1);
    const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(goal);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/goals/:id - 更新目标
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    const { child_id, title, status, progress, target } = req.body;
    let sql = `UPDATE goals SET
        title = COALESCE(?, title),
        status = COALESCE(?, status),
        progress = COALESCE(?, progress),
        target = COALESCE(?, target)`;
    const params = [title ?? null, status ?? null, progress ?? null, target ?? null];
    // child_id 需区分"未传"(保持原值)与"显式传 null"(清空归属)，不能用 COALESCE
    if ('child_id' in req.body) {
      sql += `, child_id = ?`;
      params.push(child_id ?? null);
    }
    sql += ` WHERE id = ?`;
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id - 删除目标(同时解除待办的关联)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM goals WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '目标不存在' });
    }
    // 使用事务确保先解除待办关联，再删目标，避免外键约束失败
    const deleteTransaction = db.transaction(() => {
      db.prepare('UPDATE todos SET goal_id = NULL WHERE goal_id = ?').run(id);
      db.prepare('DELETE FROM goals WHERE id = ?').run(id);
    });
    deleteTransaction();
    res.json({ message: '目标已删除' });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
