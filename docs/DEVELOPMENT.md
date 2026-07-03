# 开发设置

## 1 前置条件

- Node.js 18+
- npm 9+
- Python 3.10+（用于验证脚本）

## 2 快速开始

```bash
# 克隆并设置
git clone <repo>
cd StarParadise

# 安装所有依赖
cd star-park && npm run install:all

# 启动后端服务
npm run start:server

# 启动管理后台（另一个终端）
npm run start:pc

# 启动小程序 H5 预览（另一个终端）
npm run start:mini
```

## 3 构建命令

| 命令 | 说明 | 持续时间 |
|------|------|----------|
| `make build` | 构建管理后台 | ~30s |
| `make test` | 运行测试 | ~5s |
| `make lint-arch` | 运行架构 linter | ~5s |
| `make lint` | 运行所有 linter | ~10s |
| `make verify` | 运行端到端验证 | ~15s |
| `make api-doc` | 生成/更新 API 接口文档 | ~5s |
| `make check-db` | DDL/Entity 一致性检查 | ~3s |
| `make api-test` | 运行 API 接口测试 | ~10s |
| `make check-conventions` | 编码规范检查 | ~3s |
| `make setup-env` | 设置开发环境 | ~30s |
| `make start-server` | 启动后端服务器 | ~5s |
| `make teardown-env` | 清理环境 | ~2s |

## 4 各子项目命令

### 后端服务（server）

| 命令 | 说明 |
|------|------|
| `cd star-park/server && npm start` | 启动生产模式 |
| `cd star-park/server && npm run dev` | 启动开发模式（--watch） |

### 管理后台（pc-admin）

| 命令 | 说明 |
|------|------|
| `cd star-park/pc-admin && npm run dev` | 启动开发服务器 |
| `cd star-park/pc-admin && npm run build` | 构建生产版本 |
| `cd star-park/pc-admin && npm run preview` | 预览生产构建 |

### 小程序（miniprogram）

| 命令 | 说明 |
|------|------|
| `cd star-park/miniprogram && npm run dev:h5` | H5 开发模式 |
| `cd star-park/miniprogram && npm run dev:mp-weixin` | 微信小程序开发模式 |
| `cd star-park/miniprogram && npm run build:h5` | 构建 H5 版本 |
| `cd star-park/miniprogram && npm run build:mp-weixin` | 构建微信小程序版本 |

## 5 项目结构

```
star-park/
├── server/               — 后端 API 服务 (Layer 0-2)
│   └── src/
│       ├── index.js      — Express 入口 (L2)
│       ├── database.js   — SQLite 初始化 (L0)
│       ├── seed.js       — 种子数据 (L0)
│       └── routes/       — API 路由 (L1)
├── miniprogram/          — 小程序前端 (Layer 3-5)
│   └── src/
│       ├── main.js       — 应用入口 (L5)
│       ├── api/          — API 客户端 (L3)
│       ├── components/   — 组件 (L3)
│       └── pages/        — 页面 (L4)
├── pc-admin/             — 管理后台 (Layer 3-5)
│   └── src/
│       ├── main.js       — 应用入口 (L5)
│       ├── api/          — API 客户端 (L3)
│       ├── components/   — 组件 (L3)
│       ├── router/       — 路由配置 (L3)
│       ├── stores/       — Pinia 状态 (L3)
│       └── views/        — 视图页面 (L4)
├── docs/                 — 文档
├── scripts/              — Linter 和工具
└── harness/              — Agent 基础设施
```

## 6 环境变量

| 变量 | 默认值 | 必需 | 说明 |
|------|---------|------|------|
| `PORT` | 3001 | 否 | 后端服务端口 |
| `NODE_ENV` | development | 否 | 运行环境 |

## 7 开发代理配置

管理后台开发时需要配置代理转发 API 请求：

```javascript
// star-park/pc-admin/vite.config.js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```
