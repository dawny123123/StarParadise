const express = require('express');
const cors = require('cors');
const db = require('./database');
const seed = require('./seed');

const childrenRouter = require('./routes/children');
const tasksRouter = require('./routes/tasks');
const checkinsRouter = require('./routes/checkins');
const rewardsRouter = require('./routes/rewards');
const statsRouter = require('./routes/stats');
const pointsRouter = require('./routes/points');

const app = express();
const PORT = process.env.PORT || 3001;

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

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化种子数据
seed();

// 启动服务
app.listen(PORT, () => {
  console.log(`🌟 星星乐园后端服务已启动: http://localhost:${PORT}`);
  console.log(`📋 API 地址: http://localhost:${PORT}/api`);
});
