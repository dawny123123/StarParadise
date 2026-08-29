const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const childrenRouter = require('./routes/children');
const tasksRouter = require('./routes/tasks');
const checkinsRouter = require('./routes/checkins');
const rewardsRouter = require('./routes/rewards');
const statsRouter = require('./routes/stats');
const pointsRouter = require('./routes/points');
const flowersRouter = require('./routes/flowers');
const goalsRouter = require('./routes/goals');
const todosRouter = require('./routes/todos');
const bestPracticesRouter = require('./routes/best-practices');
const forwardDeliveryRouter = require('./routes/forward-delivery');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// uploads 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));

// 路由
app.use('/api/children', childrenRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/checkins', checkinsRouter);
app.use('/api/rewards', rewardsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/dashboard', statsRouter);
app.use('/api/points', pointsRouter);
app.use('/api/flowers', flowersRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/todos', todosRouter);
app.use('/api/best-practices', bestPracticesRouter);
app.use('/api/forward-delivery', forwardDeliveryRouter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态资源托管：仅生产部署设置 STATIC_DIR（目标机未装 nginx，由后端直接托管前端产物）
/* v8 ignore start */
const staticDir = process.env.STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    const indexFile = path.join(staticDir, 'index.html');
    if (!fs.existsSync(indexFile)) return next();
    res.sendFile(indexFile);
  });
}
/* v8 ignore stop */

module.exports = app;
