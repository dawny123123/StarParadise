const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/todos?child_id=x&goal_id=y&parent_id=z - 获取待办列表(可筛选)
router.get('/', (req, res) => {
  try {
    const { child_id, goal_id, parent_id } = req.query;
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
    if (parent_id !== undefined) {
      if (parent_id === 'null') {
        conditions.push('parent_id IS NULL');
      } else {
        conditions.push('parent_id = ?');
        params.push(parent_id);
      }
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
    const { goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed, parent_id } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title 为必填项' });
    }
    // 父任务验证
    let resolvedChildId = child_id;
    if (parent_id) {
      const parent = db.prepare('SELECT * FROM todos WHERE id = ?').get(parent_id);
      if (!parent) {
        return res.status(400).json({ error: '父任务不存在' });
      }
      if (parent.parent_id !== null) {
        return res.status(400).json({ error: '不支持多级嵌套，子任务不能再有子任务' });
      }
      // 子任务自动继承父任务的 child_id
      resolvedChildId = parent.child_id;
    }
    const result = db.prepare(
      `INSERT INTO todos (goal_id, child_id, title, creator, priority, expected_points, planned_date, description, completed, parent_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      goal_id ?? null,
      resolvedChildId ?? null,
      title,
      creator || null,
      priority || 'medium',
      expected_points ?? 0,
      planned_date || null,
      description || null,
      completed ? 1 : 0,
      parent_id ?? null
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
    const nullableFields = ['goal_id', 'child_id', 'planned_date', 'description', 'parent_id'];
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

// DELETE /api/todos/:id - 删除待办（级联删除子任务）
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '待办不存在' });
    }
    // 级联删除子任务
    const childResult = db.prepare('DELETE FROM todos WHERE parent_id = ?').run(id);
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    res.json({ message: '待办已删除', children_deleted: childResult.changes });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
