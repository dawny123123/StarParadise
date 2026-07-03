const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/children - 获取所有孩子及其任务
router.get('/', (req, res) => {
  try {
    const children = db.prepare('SELECT * FROM children ORDER BY id').all();

    // 获取每个孩子的任务和余额信息
    const childrenWithTasks = children.map(child => {
      const tasks = db.prepare('SELECT * FROM tasks WHERE child_id = ? AND is_active = 1').all(child.id);

      // 计算累计余额（通过 transactions 表汇总 earn 类型收入）
      const balanceResult = db.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE child_id = ? AND type = 'earn'`
      ).get(child.id);

      return {
        ...child,
        balance: `¥${balanceResult.total}`,
        points_balance: child.points_balance || 0,
        tasks: tasks.map(t => ({
          id: t.id,
          name: t.title,
          desc: t.description,
          reward: `${t.reward_amount}${t.reward_unit}`,
          standard: t.description
        }))
      };
    });

    res.json(childrenWithTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/children - 添加孩子
router.post('/', (req, res) => {
  try {
    const { name, age, grade, focus, avatar_color } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name 为必填项' });
    }
    const result = db.prepare(
      'INSERT INTO children (name, age, grade, focus, avatar_color) VALUES (?, ?, ?, ?, ?)'
    ).run(name, age || null, grade || null, focus || null, avatar_color || '#19C8B9');
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(child);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/children/:id/balance - 获取指定孩子的积分余额
router.get('/:id/balance', (req, res) => {
  try {
    const { id } = req.params;
    const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(id);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }
    res.json(child.points_balance || 0);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/children/:id/transactions - 获取指定孩子的交易记录
// ?type=money 返回 transactions 表（金钱收支），默认返回 points 表（积分记录，兼容管理后台）
router.get('/:id/transactions', (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (type === 'money') {
      const transactions = db.prepare(
        'SELECT * FROM transactions WHERE child_id = ? ORDER BY created_at DESC'
      ).all(id);
      res.json(transactions);
    } else {
      const transactions = db.prepare(
        `SELECT id, child_id, amount, reason as description, created_at as createdAt,
                CASE WHEN amount > 0 THEN 'earn' ELSE 'spend' END as type
         FROM points WHERE child_id = ? ORDER BY created_at DESC`
      ).all(id);
      res.json(transactions);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
