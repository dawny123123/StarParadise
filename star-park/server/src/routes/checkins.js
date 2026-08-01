const express = require('express');
const db = require('../database');
const dayjs = require('dayjs');
const router = express.Router();

// 辅助函数：给孩子奖励积分
function rewardPoints(childId, amount, reason) {
  const pointsAmount = parseInt(amount) || 0;
  if (pointsAmount <= 0) return;
  db.prepare('INSERT INTO points (child_id, amount, reason) VALUES (?, ?, ?)').run(childId, pointsAmount, reason);
  const child = db.prepare('SELECT points_balance FROM children WHERE id = ?').get(childId);
  const newBalance = ((child?.points_balance) ?? 0) + pointsAmount;
  db.prepare('UPDATE children SET points_balance = ? WHERE id = ?').run(newBalance, childId);
}

// GET /api/checkins?date=YYYY-MM-DD&child_id=x - 获取打卡记录
router.get('/', (req, res) => {
  try {
    const { date, child_id } = req.query;
    let sql = 'SELECT c.*, t.title as task_title FROM checkins c LEFT JOIN tasks t ON c.task_id = t.id WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND c.checkin_date = ?';
      params.push(date);
    }
    if (child_id) {
      sql += ' AND c.child_id = ?';
      params.push(child_id);
    }
    sql += ' ORDER BY c.created_at DESC';

    const checkins = db.prepare(sql).all(...params);
    res.json(checkins);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkins - 创建打卡(同时更新 transactions 和 rewards.current_amount)
router.post('/', (req, res) => {
  try {
    const { child_id, task_id, checkin_date, completed, points_reward } = req.body;
    if (!child_id || !task_id || !checkin_date) {
      return res.status(400).json({ error: 'child_id、task_id 和 checkin_date 为必填项' });
    }

    const isCompleted = completed !== undefined ? completed : 1;

    // 获取任务信息以确定奖励金额
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task_id);
    if (!task) {
      return res.status(400).json({ error: '任务不存在' });
    }

    const rewardEarned = isCompleted ? task.reward_amount : 0;
    // 优先使用人工传入的积分奖励，否则使用任务预设积分
    const pointsReward = isCompleted ? (parseInt(points_reward) || task.points_reward || 0) : 0;

    const transaction = db.transaction(() => {
      // 插入打卡记录
      const result = db.prepare(
        'INSERT INTO checkins (child_id, task_id, checkin_date, completed, reward_earned) VALUES (?, ?, ?, ?, ?)'
      ).run(child_id, task_id, checkin_date, isCompleted, rewardEarned);

      // 如果完成了任务，创建 transaction 记录、积分奖励并更新 rewards
      if (isCompleted) {
        if (rewardEarned > 0) {
          // 创建交易记录
          db.prepare(
            'INSERT INTO transactions (child_id, type, amount, description) VALUES (?, ?, ?, ?)'
          ).run(child_id, 'earn', rewardEarned, `完成「${task.title}」打卡奖励`);

          // 更新该孩子所有未达成的奖励目标的 current_amount
          const rewards = db.prepare(
            'SELECT * FROM rewards WHERE child_id = ? AND is_achieved = 0'
          ).all(child_id);

          for (const reward of rewards) {
            const newAmount = reward.current_amount + rewardEarned;
            const isAchieved = newAmount >= reward.target_amount ? 1 : 0;
            db.prepare(
              'UPDATE rewards SET current_amount = ?, is_achieved = ? WHERE id = ?'
            ).run(newAmount, isAchieved, reward.id);
          }
        }

        // 任务完成自动奖励积分
        if (pointsReward > 0) {
          rewardPoints(child_id, pointsReward, `完成「${task.title}」任务积分奖励`);
        }
      }

      return result.lastInsertRowid;
    });

    const insertId = transaction();
    const checkin = db.prepare(
      'SELECT c.*, t.title as task_title FROM checkins c LEFT JOIN tasks t ON c.task_id = t.id WHERE c.id = ?'
    ).get(insertId);

    res.status(201).json(checkin);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkins/auto-checkin-all - 一键自动打卡（为所有孩子的所有活跃任务完成当日打卡，已打卡的跳过）
router.post('/auto-checkin-all', (req, res) => {
  try {
    const checkinDate = req.body.checkin_date || dayjs().format('YYYY-MM-DD');

    // 获取所有活跃任务
    const activeTasks = db.prepare(
      'SELECT t.*, c.name as child_name FROM tasks t LEFT JOIN children c ON t.child_id = c.id WHERE t.is_active = 1 ORDER BY t.planned_date IS NULL, t.planned_date ASC, t.id ASC'
    ).all();

    if (activeTasks.length === 0) {
      return res.json({ message: '没有活跃的打卡任务', created: 0, skipped: 0, details: [] });
    }

    // 获取当日已有打卡记录（去重用）
    const existingCheckins = db.prepare(
      'SELECT child_id, task_id FROM checkins WHERE checkin_date = ?'
    ).all(checkinDate);
    const checkedSet = new Set(existingCheckins.map(c => `${c.child_id}-${c.task_id}`));

    const autoCheckinAll = db.transaction(() => {
      const details = [];
      let created = 0;
      let skipped = 0;

      for (const task of activeTasks) {
        const key = `${task.child_id}-${task.id}`;
        if (checkedSet.has(key)) {
          skipped++;
          details.push({
            child_id: task.child_id,
            child_name: task.child_name,
            task_id: task.id,
            task_title: task.title,
            status: 'skipped',
            reason: '今日已打卡'
          });
          continue;
        }

        const rewardEarned = task.reward_amount > 0 ? task.reward_amount : 0;

        // 插入打卡记录
        const result = db.prepare(
          'INSERT INTO checkins (child_id, task_id, checkin_date, completed, reward_earned) VALUES (?, ?, ?, 1, ?)'
        ).run(task.child_id, task.id, checkinDate, rewardEarned);

        // 创建交易记录、积分奖励并更新奖励进度
        if (rewardEarned > 0) {
          db.prepare(
            'INSERT INTO transactions (child_id, type, amount, description) VALUES (?, ?, ?, ?)'
          ).run(task.child_id, 'earn', rewardEarned, `完成「${task.title}」打卡奖励`);

          const rewards = db.prepare(
            'SELECT * FROM rewards WHERE child_id = ? AND is_achieved = 0'
          ).all(task.child_id);

          for (const reward of rewards) {
            const newAmount = reward.current_amount + rewardEarned;
            const isAchieved = newAmount >= reward.target_amount ? 1 : 0;
            db.prepare(
              'UPDATE rewards SET current_amount = ?, is_achieved = ? WHERE id = ?'
            ).run(newAmount, isAchieved, reward.id);
          }
        }

        // 任务完成自动奖励积分
        if (task.points_reward > 0) {
          rewardPoints(task.child_id, task.points_reward, `完成「${task.title}」任务积分奖励`);
        }

        created++;
        checkedSet.add(key);
        details.push({
          child_id: task.child_id,
          child_name: task.child_name,
          task_id: task.id,
          task_title: task.title,
          reward_earned: rewardEarned,
          checkin_id: Number(result.lastInsertRowid),
          status: 'created'
        });
      }

      return { message: `自动打卡完成：新增 ${created} 条，跳过 ${skipped} 条`, checkin_date: checkinDate, created, skipped, details };
    });

    const result = autoCheckinAll();
    res.json(result);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
