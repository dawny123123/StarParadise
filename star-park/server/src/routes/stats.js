const express = require('express');
const db = require('../database');
const dayjs = require('dayjs');
const router = express.Router();

// GET /api/stats/:childId - 统计数据
router.get('/:childId', (req, res) => {
  try {
    const { childId } = req.params;
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
    if (!child) {
      return res.status(404).json({ error: '孩子不存在' });
    }

    const today = dayjs().format('YYYY-MM-DD');

    // 计算连续打卡天数（从今天往前连续有打卡记录的天数）
    let streak = 0;
    const allCheckinDates = db.prepare(
      'SELECT DISTINCT checkin_date FROM checkins WHERE child_id = ? ORDER BY checkin_date DESC'
    ).all(childId);

    if (allCheckinDates.length > 0) {
      let checkDate = dayjs(today);
      // 如果今天没有打卡，从昨天开始计算
      const hasTodayCheckin = allCheckinDates.some(d => d.checkin_date === today);
      if (!hasTodayCheckin) {
        checkDate = checkDate.subtract(1, 'day');
      }

      const dateSet = new Set(allCheckinDates.map(d => d.checkin_date));
      while (dateSet.has(checkDate.format('YYYY-MM-DD'))) {
        streak++;
        checkDate = checkDate.subtract(1, 'day');
      }
    }

    // 本周完成率
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

    // 获取该孩子的活跃任务数
    const activeTasks = db.prepare(
      'SELECT COUNT(*) as count FROM tasks WHERE child_id = ? AND is_active = 1'
    ).get(childId).count;

    // 本周应该打卡的天数（从周初到今天）
    const daysFromWeekStart = dayjs().diff(dayjs().startOf('week'), 'day') + 1;
    const expectedCheckins = activeTasks * daysFromWeekStart;

    // 本周实际完成打卡数
    const weekCheckins = db.prepare(
      'SELECT COUNT(*) as count FROM checkins WHERE child_id = ? AND checkin_date >= ? AND checkin_date <= ? AND completed = 1'
    ).get(childId, weekStart, weekEnd).count;

    const weeklyRate = expectedCheckins > 0 ? Math.round((weekCheckins / expectedCheckins) * 100) : 0;

    // 最近30天每日完成情况
    const thirtyDaysAgo = dayjs().subtract(29, 'day').format('YYYY-MM-DD');
    const dailyCheckins = db.prepare(
      `SELECT checkin_date, COUNT(*) as count
       FROM checkins
       WHERE child_id = ? AND checkin_date >= ? AND completed = 1
       GROUP BY checkin_date
       ORDER BY checkin_date`
    ).all(childId, thirtyDaysAgo);

    // 填充30天的数据
    const dailyData = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const found = dailyCheckins.find(d => d.checkin_date === date);
      dailyData.push({
        date,
        count: found ? found.count : 0
      });
    }

    // 余额（总收入 - 总支出 - 已兑换）
    const earnings = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE child_id = ? AND type = 'earn'"
    ).get(childId).total;
    const spendings = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE child_id = ? AND type IN ('spend', 'redeem')"
    ).get(childId).total;
    const balance = earnings - spendings;

    res.json({
      child_id: parseInt(childId),
      streak,
      weekly_rate: weeklyRate,
      weekly_checkins: weekCheckins,
      weekly_expected: expectedCheckins,
      active_tasks: activeTasks,
      balance,
      daily_data: dailyData
    });
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard - 仪表盘数据
router.get('/', (req, res) => {
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const weekStart = dayjs().startOf('week').format('YYYY-MM-DD');
    const weekEnd = dayjs().endOf('week').format('YYYY-MM-DD');

    const children = db.prepare('SELECT * FROM children ORDER BY id').all();
    const dashboardData = children.map(child => {
      // 今日打卡情况
      const todayCheckins = db.prepare(
        'SELECT c.*, t.title as task_title FROM checkins c LEFT JOIN tasks t ON c.task_id = t.id WHERE c.child_id = ? AND c.checkin_date = ?'
      ).all(child.id, today);

      // 今日活跃任务
      const activeTasks = db.prepare(
        'SELECT * FROM tasks WHERE child_id = ? AND is_active = 1 ORDER BY planned_date IS NULL, planned_date ASC, id ASC'
      ).all(child.id);

      // 连续打卡天数
      let streak = 0;
      const allCheckinDates = db.prepare(
        'SELECT DISTINCT checkin_date FROM checkins WHERE child_id = ? ORDER BY checkin_date DESC'
      ).all(child.id);

      if (allCheckinDates.length > 0) {
        let checkDate = dayjs(today);
        const hasTodayCheckin = allCheckinDates.some(d => d.checkin_date === today);
        if (!hasTodayCheckin) {
          checkDate = checkDate.subtract(1, 'day');
        }
        const dateSet = new Set(allCheckinDates.map(d => d.checkin_date));
        while (dateSet.has(checkDate.format('YYYY-MM-DD'))) {
          streak++;
          checkDate = checkDate.subtract(1, 'day');
        }
      }

      // 本周完成率
      const daysFromWeekStart = dayjs().diff(dayjs().startOf('week'), 'day') + 1;
      const expectedCheckins = activeTasks.length * daysFromWeekStart;
      const weekCheckins = db.prepare(
        'SELECT COUNT(*) as count FROM checkins WHERE child_id = ? AND checkin_date >= ? AND checkin_date <= ? AND completed = 1'
      ).get(child.id, weekStart, weekEnd).count;
      const weeklyRate = expectedCheckins > 0 ? Math.round((weekCheckins / expectedCheckins) * 100) : 0;

      // 余额（总收入 - 总支出 - 已兑换）
      const earnings = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE child_id = ? AND type = 'earn'"
      ).get(child.id).total;
      const spendings = db.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE child_id = ? AND type IN ('spend', 'redeem')"
      ).get(child.id).total;
      const balance = earnings - spendings;

      // 奖励目标
      const rewards = db.prepare(
        'SELECT * FROM rewards WHERE child_id = ? AND is_achieved = 0'
      ).all(child.id);

      return {
        ...child,
        today_checkins: todayCheckins,
        active_tasks: activeTasks,
        streak,
        weekly_rate: weeklyRate,
        balance,
        points_balance: child.points_balance || 0,
        rewards
      };
    });

    res.json(dashboardData);
  } catch (err) { /* v8 ignore next */
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
