const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/todos?child_id=x&goal_id=y - 获取待办列表(可筛选)
router.get('/', (req, res) => {
  try {
    const { child_id, goal_id } = req.query;
    const conditions = [];
    const params = [];
    if (child_id) {
      conditions.push('child_id = ?');
      params.push(child_id);
    }
    if (goal_id) {
      conditions.push('goal_id = ?');
      params.push(goal_id);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const todos = db.prepare(`SELECT * FROM todos${where} ORDER BY id ASC`).all(...params);
    res.json(todos);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/todos - 创建待办
router.post('/', (req, res) => {
  try {
    const { goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    const result = db.prepare(
      `INSERT INTO todos (goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goal_id ?? null,
      child_id ?? null,
      title,
      creator || null,
      priority || 'medium',
      expected_points ?? 0,
      planned_date || null,
      description || null,
      completed ? 1 : 0
    );
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(todo);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/todos/:id - 更新待办
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    const { title, creator, priority } = req.body;
    let sql = `UPDATE todos SET
        title = COALESCE(?, title),
        creator = COALESCE(?, creator),
        priority = COALESCE(?, priority)`;
    const params = [title ?? null, creator ?? null, priority ?? null];
    // 以下字段需区分"未传"(保持原值)与"显式传 null/0"(清空或置零)，不能用 COALESCE
    const nullableFields = ['goal_id', 'child_id', 'planned_date', 'description'];
    for (const field of nullableFields) {
      if (field in req.body) {
        sql += `, ${field} = ?`;
        params.push(req.body[field] ?? null);
      }
    }
    if ('expected_points' in req.body) {
      sql += `, expected_points = ?`;
      params.push(req.body.expected_points ?? 0);
    }
    if ('completed' in req.body) {
      sql += `, completed = ?`;
      params.push(req.body.completed ? 1 : 0);
    }
    sql += ` WHERE id = ?`;
    db.prepare(sql).run(...params, id);
    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/todos/:id - 删除待办
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    res.json({ message: '待办已删除' });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
