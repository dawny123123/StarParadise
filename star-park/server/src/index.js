const app = require('./app');
const seed = require('./seed');

const PORT = process.env.PORT || 3001;

// 初始化种子数据
seed();

// 启动服务
app.listen(PORT, () => {
  console.log(`🌟 星星乐园后端服务已启动: http://localhost:${PORT}`);
  console.log(`📋 API 地址: http://localhost:${PORT}/api`);
});
