const express = require('express');
const db = require('../database');
const router = express.Router();

// 查询孩子金钱余额（earn − spend/redeem，与仪表盘累计余额口径一致）
function getMoneyBalance(childId) {
  return db.prepare(
    `SELECT COALESCE(SUM(CASE WHEN type='earn' THEN amount ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN type IN ('spend', 'redeem') THEN amount ELSE 0 END), 0) as balance
     FROM transactions WHERE child_id = ?`
  ).get(childId).balance;
}

// 金额类奖励的进度与累计余额对齐：已攒 = min(余额, 目标)，达成 = 余额 >= 目标
// 红花类奖励同理，与 flowers_balance 对齐
function syncMoneyRewardProgress(rewards) {
  const balanceCache = {};
  const flowerCache = {};
  for (const reward of rewards) {
    const unit = reward.reward_unit || '元';
    if (unit !== '元' && unit !== '红花') continue;
    if (reward.redeemed_at) continue;

    if (unit === '元') {
      if (!(reward.child_id in balanceCache)) {
        balanceCache[reward.child_id] = getMoneyBalance(reward.child_id);
      }
      const balance = balanceCache[reward.child_id];
      const newCurrent = Math.min(balance, reward.target_amount);
      const newAchieved = balance >= reward.target_amount ? 1 : 0;
      if (newCurrent !== reward.current_amount || newAchieved !== reward.is_achieved) {
        db.prepare('UPDATE rewards SET current_amount = ?, is_achieved = ? WHERE id = ?')
          .run(newCurrent, newAchieved, reward.id);
        reward.current_amount = newCurrent;
        reward.is_achieved = newAchieved;
      }
    } else if (unit === '红花') {
      if (!(reward.child_id in flowerCache)) {
        const child = db.prepare('SELECT flowers_balance FROM children WHERE id = ?').get(reward.child_id);
        flowerCache[reward.child_id] = child?.flowers_balance || 0;
      }
      const balance = flowerCache[reward.child_id];
      const newCurrent = Math.min(balance, reward.target_amount);
      const newAchieved = balance >= reward.target_amount ? 1 : 0;
      if (newCurrent !== reward.current_amount || newAchieved !== reward.is_achieved) {
        db.prepare('UPDATE rewards SET current_amount = ?, is_achieved = ? WHERE id = ?')
          .run(newCurrent, newAchieved, reward.id);
        reward.current_amount = newCurrent;
        reward.is_achieved = newAchieved;
      }
    }
  }
  return rewards;
}

// GET /api/rewards?child_id=x - 获取奖励目标
router.get('/', (req, res) => {
  try {
    const { child_id } = req.query;
    let rewards;
    if (child_id) {
      rewards = db.prepare('SELECT * FROM rewards WHERE child_id = ? ORDER BY id').all(child_id);
    } else {
      rewards = db.prepare('SELECT * FROM rewards ORDER BY id').all();
    }
    res.json(syncMoneyRewardProgress(rewards));
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rewards - 创建奖励目标
router.post('/', (req, res) => {
  try {
    const { child_id, title, target_amount, description, reward_unit } = req.body;
    if (!child_id || !title || target_amount === undefined) {
      return res.status(400).json({ error: 'child_id、title 和 target_amount 为必填项' });
    }
    const unit = reward_unit || '元';
    const desc = description || '';
    const result = db.prepare(
      'INSERT INTO rewards (child_id, title, target_amount, current_amount, description, reward_unit) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(child_id, title, target_amount, 0, desc, unit);
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(reward);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/rewards/:id - 更新奖励目标
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '奖励目标不存在' });
    }
    const { title, target_amount, current_amount, is_achieved, description, reward_unit } = req.body;
    const fields = [title, target_amount, current_amount, is_achieved, description, reward_unit];
    /* v8 ignore start */
    db.prepare(
      `UPDATE rewards SET
        title = COALESCE(?, title),
        target_amount = COALESCE(?, target_amount),
        current_amount = COALESCE(?, current_amount),
        is_achieved = COALESCE(?, is_achieved),
        description = COALESCE(?, description),
        reward_unit = COALESCE(?, reward_unit)
      WHERE id = ?`
    ).run(...fields.map(f => f ?? null), id);
    /* v8 ignore stop */
    const updated = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/rewards/:id - 删除奖励目标
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '奖励目标不存在' });
    }
    db.prepare('DELETE FROM rewards WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/rewards/:id/redeem - 兑换奖励（家长操作）
router.post('/:id/redeem', (req, res) => {
  try {
    const { id } = req.params;
    const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    if (!reward) {
      return res.status(404).json({ error: '奖励目标不存在' });
    }
    if (reward.is_achieved !== 1) {
      return res.status(400).json({ error: '奖励目标尚未达成，无法兑换' });
    }
    if (reward.redeemed_at) {
      return res.status(400).json({ error: '奖励已兑换，不能重复兑换' });
    }

    const redeemAmount = reward.current_amount;
    const unit = reward.reward_unit || '元';

    const transaction = db.transaction(() => {
      if (unit === '元') {
        // 校验余额（与仪表盘累计余额口径一致）
        const balance = getMoneyBalance(reward.child_id);

        if (balance < redeemAmount) {
          throw new Error('余额不足，无法兑换');
        }

        // 标记兑换时间
        db.prepare("UPDATE rewards SET redeemed_at = datetime('now', 'localtime') WHERE id = ?").run(id);

        // 创建 redeem 交易记录（扣减余额）
        db.prepare(
          'INSERT INTO transactions (child_id, type, amount, description) VALUES (?, ?, ?, ?)'
        ).run(reward.child_id, 'redeem', redeemAmount, `兑换奖励「${reward.title}」`);

      } else if (unit === '星星') {
        // 查询孩子积分余额
        const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(reward.child_id);

        if ((child?.points_balance || 0) < redeemAmount) {
          throw new Error('积分余额不足，无法兑换');
        }

        // 标记兑换时间
        db.prepare("UPDATE rewards SET redeemed_at = datetime('now', 'localtime') WHERE id = ?").run(id);

        // 扣减积分余额
        db.prepare(
          'UPDATE children SET points_balance = points_balance - ? WHERE id = ?'
        ).run(redeemAmount, reward.child_id);

        // 创建积分兑换记录
        db.prepare(
          'INSERT INTO points (child_id, amount, reason) VALUES (?, ?, ?)'
        ).run(reward.child_id, -redeemAmount, `兑换奖励「${reward.title}」`);

      } else if (unit === '红花') {
        // 查询孩子红花余额
        const child = db.prepare('SELECT flowers_balance FROM children WHERE id = ?').get(reward.child_id);

        if ((child?.flowers_balance || 0) < redeemAmount) {
          throw new Error('红花余额不足，无法兑换');
        }

        // 标记兑换时间
        db.prepare("UPDATE rewards SET redeemed_at = datetime('now', 'localtime') WHERE id = ?").run(id);

        // 扣减红花余额
        db.prepare(
          'UPDATE children SET flowers_balance = flowers_balance - ? WHERE id = ?'
        ).run(redeemAmount, reward.child_id);

        // 创建红花兑换记录
        db.prepare(
          'INSERT INTO flowers (child_id, amount, reason) VALUES (?, ?, ?)'
        ).run(reward.child_id, -redeemAmount, `兑换奖励「${reward.title}」`);

      } else {
        throw new Error(`不支持的奖励单位: ${unit}`);
      }

      return db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
    });

    const redeemed = transaction();
    res.json(redeemed);
  } catch (err) {
    /* v8 ignore start */
    const knownErrors = ['余额不足', '积分余额不足', '红花余额不足', '不支持的奖励单位', '尚未达成', '已兑换'];
    if (knownErrors.some(msg => err.message.includes(msg))) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
    /* v8 ignore stop */
  }
});

module.exports = router;
