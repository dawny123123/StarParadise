# 星星乐园 - 家庭激励管理系统

> 帮助妈妈管理 3 个孩子的学习任务打卡和积分奖励系统，让孩子在激励中成长 🌟

## 项目简介

星星乐园是一个家庭激励管理系统，专为妈妈管理三个孩子（老二初一、老三小学三年级、老四 6 岁）设计。通过每日任务打卡、积分奖励机制，培养孩子的学习习惯和自我驱动力。

- **老二**（13 岁，初一）：各学科提分，每天背 10 个英语单词 → +1 元
- **老三**（8 岁，小学三年级）：提升记忆力，每天写 50 个字以上 → +1 元
- **老四**（6 岁，幼儿园大班）：古诗启蒙，每天背 1 首诗 → +1 元

## 技术架构

| 模块 | 技术栈 |
|------|--------|
| 后端 | Node.js + Express + SQLite (better-sqlite3) |
| PC 管理后台 | Vue3 + Vite + Element Plus + ECharts |
| 小程序端 | uni-app (Vue3) + Pinia |

## 项目结构

```
star-park/
├── server/                  # 后端服务
│   ├── src/
│   │   ├── index.js         # 入口文件，Express 服务启动
│   │   ├── database.js      # SQLite 数据库初始化与建表
│   │   ├── seed.js          # 种子数据（孩子、任务、奖励）
│   │   └── routes/
│   │       ├── children.js  # 孩子管理 API
│   │       ├── tasks.js     # 任务管理 API
│   │       ├── checkins.js  # 打卡记录 API
│   │       ├── rewards.js   # 奖励目标 API
│   │       └── stats.js     # 数据统计 API
│   ├── data/                # SQLite 数据库文件（自动生成）
│   └── package.json
├── pc-admin/                # PC 管理后台
│   ├── src/
│   │   ├── main.js          # 应用入口
│   │   ├── App.vue          # 根组件
│   │   ├── api/             # 后端 API 调用封装
│   │   ├── components/      # 公共组件
│   │   ├── router/          # 路由配置
│   │   ├── stores/          # Pinia 状态管理
│   │   ├── styles/          # 全局样式
│   │   └── views/
│   │       ├── Dashboard.vue  # 仪表盘首页
│   │       ├── Checkin.vue    # 打卡管理
│   │       ├── Tasks.vue      # 任务管理
│   │       ├── Balance.vue    # 余额管理
│   │       ├── Rewards.vue    # 奖励目标
│   │       └── Stats.vue      # 数据统计
│   └── package.json
├── miniprogram/             # 小程序端
│   ├── src/
│   │   ├── main.js          # 应用入口
│   │   ├── App.vue          # 根组件
│   │   ├── manifest.json    # uni-app 配置
│   │   ├── pages.json       # 页面路由配置
│   │   ├── api/             # 后端 API 调用封装
│   │   ├── components/      # 公共组件
│   │   ├── pages/
│   │   │   ├── index/       # 首页
│   │   │   ├── checkin/     # 打卡页
│   │   │   ├── records/     # 打卡记录
│   │   │   └── profile/     # 个人中心
│   │   └── static/          # 静态资源
│   └── package.json
└── package.json             # 根目录便捷脚本
```

## 环境要求

- **Node.js** >= 18
- **npm** >= 9

## 快速启动

### 方式一：使用根目录脚本（推荐）

```bash
# 安装所有依赖
npm run install:all

# 启动后端服务
npm run start:server

# 启动 PC 管理后台（新终端）
npm run start:pc

# 启动小程序 H5 预览（新终端）
npm run start:mini
```

### 方式二：分别启动各服务

```bash
# 1. 启动后端
cd server && npm install && npm start
# 后端运行在 http://localhost:3001

# 2. 启动 PC 管理后台
cd pc-admin && npm install && npm run dev
# PC 端运行在 http://localhost:5173

# 3. 启动小程序 H5 预览
cd miniprogram && npm install && npm run dev:h5
# 小程序 H5 运行在 http://localhost:5174
```

## 核心功能

### 每日打卡
- 孩子每日完成学习任务后打卡
- 支持按日期查看打卡记录
- 自动计算打卡积分

### 积分管理
- 打卡自动获取积分（元）
- 支持手动调整余额
- 余额变动记录可追溯

### 任务规则
- 为每个孩子定制专属学习任务
- 每个任务设定积分奖励额度
- 支持任务的启用/停用管理

### 奖励目标
- 设定积分目标换取心仪奖励
- 实时展示进度百分比
- 达成后标记完成

### 数据统计
- 打卡趋势图表（ECharts）
- 各孩子积分对比
- 任务完成率分析
- 仪表盘数据总览

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/children` | 获取所有孩子列表 |
| GET | `/api/tasks` | 获取任务列表 |
| POST | `/api/tasks` | 创建新任务 |
| PUT | `/api/tasks/:id` | 更新任务 |
| DELETE | `/api/tasks/:id` | 删除任务 |
| GET | `/api/checkins` | 获取打卡记录 |
| POST | `/api/checkins` | 提交打卡 |
| DELETE | `/api/checkins/:id` | 撤销打卡 |
| GET | `/api/rewards` | 获取奖励目标列表 |
| POST | `/api/rewards` | 创建奖励目标 |
| PUT | `/api/rewards/:id` | 更新奖励目标 |
| GET | `/api/stats/dashboard` | 仪表盘统计数据 |
| GET | `/api/stats/trend` | 打卡趋势数据 |
| GET | `/api/stats/balance` | 余额统计 |

## 三个孩子的任务规则

| 孩子 | 年龄 | 年级 | 专注方向 | 每日任务 | 奖励 |
|------|------|------|----------|----------|------|
| 老二 | 13 岁 | 初一 | 各学科提分 | 英语背单词（每天背 10 个单词） | +1 元 |
| 老三 | 8 岁 | 小学三年级 | 提升记忆力 | 练字（每天写 50 个字以上） | +1 元 |
| 老四 | 6 岁 | 幼儿园大班 | 古诗启蒙 | 背古诗（每天背 1 首诗） | +1 元 |

> 老四还有一个特别奖励目标：攒够 **50 元** 换取变形金刚玩具 🤖

## 数据库

项目使用 SQLite (better-sqlite3) 作为数据库，数据文件自动创建在 `server/data/star-park.db`，首次启动时会自动初始化种子数据。

数据表结构：
- **children** - 孩子信息
- **tasks** - 任务定义
- **checkins** - 打卡记录
- **rewards** - 奖励目标
- **transactions** - 余额变动流水
