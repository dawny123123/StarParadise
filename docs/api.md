# 星星乐园 - API 接口文档

> **版本**: v1.0
> **最后更新**: 2026-05-25

## 概述

星星乐园后端 API 服务，提供孩子管理、任务打卡、奖励目标和积分系统的 RESTful 接口。

## 基础信息

- **Base URL**: `http://localhost:3001/api`
- **认证方式**: 无（家庭内网使用）
- **数据格式**: JSON

## 接口列表

### 健康检查

- **路径**: `/api/health`
- **方法**: GET
- **说明**: 检查服务是否正常运行

#### 响应

```json
{
  "status": "ok",
  "timestamp": "2026-05-25T12:00:00.000Z"
}
```

### 获取孩子列表

- **路径**: `/api/children`
- **方法**: GET
- **说明**: 获取所有孩子及其任务和余额

#### 响应

```json
[
  {
    "id": 1,
    "name": "老二",
    "age": 13,
    "grade": "初一",
    "focus": "各学科提分",
    "avatar_color": "#FF6B6B",
    "balance": "¥3",
    "points_balance": 0,
    "tasks": [
      { "id": 1, "name": "英语背单词", "desc": "每天背10个单词", "reward": "1元" }
    ]
  }
]
```

### 添加孩子

- **路径**: `/api/children`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 孩子姓名 |
| age | number | 否 | 年龄 |
| grade | string | 否 | 年级 |
| focus | string | 否 | 专注方向 |
| avatar_color | string | 否 | 头像颜色（默认 #19C8B9） |

### 获取积分余额

- **路径**: `/api/children/:id/balance`
- **方法**: GET

### 获取交易记录

- **路径**: `/api/children/:id/transactions`
- **方法**: GET

### 获取任务列表

- **路径**: `/api/tasks`
- **方法**: GET

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 否 | 按孩子筛选 |

### 创建任务

- **路径**: `/api/tasks`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 是 | 关联孩子 ID |
| title | string | 是 | 任务标题 |
| description | string | 否 | 任务描述 |
| reward_amount | number | 否 | 奖励金额（默认 1.0） |
| reward_unit | string | 否 | 奖励单位（默认 "元"） |

### 更新任务

- **路径**: `/api/tasks/:id`
- **方法**: PUT

### 删除任务

- **路径**: `/api/tasks/:id`
- **方法**: DELETE

### 获取打卡记录

- **路径**: `/api/checkins`
- **方法**: GET

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| date | string | 否 | 日期筛选（YYYY-MM-DD） |
| child_id | number | 否 | 按孩子筛选 |

### 创建打卡

- **路径**: `/api/checkins`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 是 | 孩子 ID |
| task_id | number | 是 | 任务 ID |
| checkin_date | string | 是 | 打卡日期（YYYY-MM-DD） |
| completed | number | 否 | 是否完成（默认 1） |

### 获取奖励目标

- **路径**: `/api/rewards`
- **方法**: GET

### 创建奖励目标

- **路径**: `/api/rewards`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 是 | 关联孩子 ID |
| title | string | 是 | 奖励名称 |
| target_amount | number | 是 | 目标金额 |
| description | string | 否 | 奖励描述 |
| reward_unit | string | 否 | 奖励单位（默认"元"，可选"积分"） |

### 更新/删除奖励目标

- **路径**: `/api/rewards/:id`
- **方法**: PUT / DELETE

### 兑换奖励

- **路径**: `/api/rewards/:id/redeem`
- **方法**: POST
- **说明**: 兑换已达成的奖励，根据 reward_unit 扣减对应余额

#### 前置条件

- 奖励的 `is_achieved` 必须为 1（已达成）
- 奖励的 `redeemed_at` 必须为空（未兑换）

#### 响应

```json
{
  "id": 1,
  "title": "新玩具",
  "redeemed_at": "2026-05-25T12:00:00.000Z",
  "message": "兑换成功"
}
```

#### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 奖励未达成或已兑换 |
| 404 | 奖励不存在 |

### 获取统计数据

- **路径**: `/api/stats/:childId`
- **方法**: GET

#### 响应

```json
{
  "child_id": 1,
  "streak": 5,
  "weekly_rate": 75,
  "balance": 3.0,
  "daily_data": [{ "date": "2026-05-25", "count": 2 }]
}
```

### 获取仪表盘数据

- **路径**: `/api/dashboard`
- **方法**: GET

### 获取积分记录

- **路径**: `/api/points`
- **方法**: GET

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 是 | 孩子 ID |

### 添加积分

- **路径**: `/api/points`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 是 | 孩子 ID |
| amount | number | 是 | 积分数量（非零整数） |
| reason | string | 否 | 原因（默认"特殊积分奖励"） |

## 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误（缺少必填字段） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
