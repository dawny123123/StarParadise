const express = require('express');
const cors = require('cors');

const childrenRouter = require('./routes/children');
const tasksRouter = require('./routes/tasks');
const checkinsRouter = require('./routes/checkins');
const rewardsRouter = require('./routes/rewards');
const statsRouter = require('./routes/stats');
const pointsRouter = require('./routes/points');
const goalsRouter = require('./routes/goals');
const todosRouter = require('./routes/todos');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/children', childrenRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/dashboard', statsRouter);
app.use('/api/points', pointsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/todos', todosRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
