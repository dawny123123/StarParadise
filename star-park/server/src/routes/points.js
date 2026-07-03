const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/points?child_id=x - 获取孩子的积分记录
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    if (!child_id) {
      return res.status(400).json({ error: 'child_id 为必填项' });
    }

    const points = db.prepare(
      'SELECT p.*, c.name as child_name FROM points p LEFT JOIN children c ON p.child_id = c.id WHERE p.child_id = ? ORDER BY p.created_at DESC'
    ).all(child_id);

    const balance = db.prepare(
      'SELECT points_balance FROM children WHERE id = ?'
    ).get(child_id);

    res.json({
      records: points,
      balance: balance?.points_balance || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/points - 手动添加积分（家长操作）
router.post('/', (req, res) => {
  try {
    const { child_id, amount, reason } = req.body;
    if (!child_id || amount === undefined) {
      return res.status(400).json({ error: 'child_id 和 amount 为必填项' });
    }

    const pointsAmount = parseInt(amount);
    if (isNaN(pointsAmount) || pointsAmount === 0) {
      return res.status(400).json({ error: '积分分值必须是非零整数' });
    }

    const transaction = db.transaction(() => {
      // 插入积分记录
      const result = db.prepare(
        'INSERT INTO points (child_id, amount, reason) VALUES (?, ?, ?)'
      ).run(child_id, pointsAmount, reason || '特殊积分奖励');

      // 更新孩子的积分余额
      const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(child_id);
      if (child) {
        const newBalance = (child.points_balance || 0) + pointsAmount;
        db.prepare('UPDATE children SET points_balance = ? WHERE id = ?').run(newBalance, child_id);
      }

      return result.lastInsertRowid;
    });

    const insertId = transaction();
    const newBalance = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(child_id);

    res.status(201).json({
      id: insertId,
      child_id,
      amount: pointsAmount,
      reason: reason || '特殊积分奖励',
      new_balance: newBalance?.points_balance || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;