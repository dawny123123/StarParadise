const express = require('express');
const db = require('../database');
const router = express.Router();

// GET /api/flowers?child_id=x - 获取孩子的红花记录
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    if (!child_id) {
      return res.status(400).json({ error: 'child_id 为必填项' });
    }

    const flowers = db.prepare(
      'SELECT f.*, c.name as child_name FROM flowers f LEFT JOIN children c ON f.child_id = c.id WHERE f.child_id = ? ORDER BY f.created_at DESC'
    ).all(child_id);

    const balance = db.prepare(
      'SELECT flowers_balance FROM children WHERE id = ?'
    ).get(child_id);

    res.json({
      records: flowers,
      balance: balance?.flowers_balance || 0
    });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/flowers - 手动发放红花（家长操作）
router.post('/', (req, res) => {
  try {
    const { child_id, amount, reason } = req.body;
    if (!child_id || amount === undefined) {
      return res.status(400).json({ error: 'child_id 和 amount 为必填项' });
    }

    const flowersAmount = parseInt(amount);
    if (isNaN(flowersAmount) || flowersAmount === 0) {
      return res.status(400).json({ error: '红花数量必须是非零整数' });
    }

    const transaction = db.transaction(() => {
      // 插入红花记录
      const result = db.prepare(
        'INSERT INTO flowers (child_id, amount, reason) VALUES (?, ?, ?)'
      ).run(child_id, flowersAmount, reason || '特殊红花奖励');

      // 更新孩子的红花余额
      const child = db.prepare('SELECT flowers_balance FROM children WHERE id = ?').get(child_id);
      const newBalance = ((child?.flowers_balance) ?? 0) + flowersAmount;
      db.prepare('UPDATE children SET flowers_balance = ? WHERE id = ?').run(newBalance, child_id);

      return result.lastInsertRowid;
    });

    const insertId = transaction();
    const newBalance = db.prepare('SELECT flowers_balance FROM children WHERE id = ?').get(child_id);

    res.status(201).json({
      id: insertId,
      child_id,
      amount: flowersAmount,
      reason: reason || '特殊红花奖励',
      new_balance: newBalance?.flowers_balance || 0
    });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
