# 运维指南

> 部署流程、环境配置、监控日志与运维手册

## 1 部署

### 1.1 本地开发

```bash
cd star-park && npm run install:all
npm run start:server    # 后端 :3001
npm run start:pc        # 管理后台 :5173
npm run start:mini      # 小程序 H5
```

### 1.2 生产部署

```bash
# 构建管理后台
cd star-park/pc-admin && npm run build
# 产出 dist/ 目录，部署到静态文件服务器

# 构建小程序
cd star-park/miniprogram && npm run build:mp-weixin
# 产出 dist/build/mp-weixin/，上传到微信开发者工具

# 后端服务
cd star-park/server && NODE_ENV=production node src/index.js
```

### 1.3 CI/CD 流水线

```bash
make build       # 构建项目
make lint-arch   # 架构检查
make test        # 测试
```

## 2 环境配置

### 2.1 环境列表

| 环境 | 用途 | 配置 |
|------|------|------|
| development | 本地开发 | 默认配置 |
| production | 生产部署 | NODE_ENV=production |

### 2.2 关键配置

```javascript
// 后端端口配置 — star-park/server/src/index.js:14
const PORT = 3001;

// 数据库路径 — star-park/server/src/database.js:10
const DB_PATH = path.join(DATA_DIR, 'star-park.db');
```

## 3 监控与日志

### 3.1 日志配置

- **框架**: console（开发环境）
- **级别**: 开发环境输出所有日志

### 3.2 健康检查

```bash
curl http://localhost:3001/api/health
# 期望返回: {"status":"ok","timestamp":"..."}
```

### 3.3 查看日志

```bash
# 直接运行查看控制台输出
cd star-park/server && npm run dev
```

## 4 运维手册

### 4.1 服务管理

```bash
# 启动后端
cd star-park/server && npm start

# 停止服务
pkill -f "node src/index.js" || true
```

### 4.2 数据库维护

```bash
# 备份 SQLite 数据库
cp star-park/server/data/star-park.db star-park/server/data/star-park.db.bak

# 恢复
cp star-park/server/data/star-park.db.bak star-park/server/data/star-park.db

# 重新初始化种子数据
rm star-park/server/data/star-park.db && npm start  # 自动重建
```

### 4.3 性能调优

- SQLite 已启用 WAL 模式提升并发性能
- 数据库文件位于 `star-park/server/data/` 目录
- 生产环境建议定期执行 `PRAGMA optimize`

## 5 安全与权限

- 当前无认证中间件，适合家庭内网使用
- 生产部署时应添加：
  - API 认证（JWT 或 Session）
  - CORS 白名单限制
  - HTTPS 反向代理
- 数据库文件仅本地访问，无远程连接风险
