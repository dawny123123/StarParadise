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
- **说明**: 返回按计划日期排序的任务列表（有 `planned_date` 的按日期升序在前，无日期的按 id 升序在后）

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 否 | 按孩子筛选 |

#### 响应字段说明

任务对象包含 `planned_date` 字段（string 或 null，格式 `YYYY-MM-DD`），表示任务计划日期，未设置时为 `null`。

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
| planned_date | string | 否 | 计划日期，格式 `YYYY-MM-DD`，不传为 null |

### 更新任务

- **路径**: `/api/tasks/:id`
- **方法**: PUT
- **说明**: 部分更新，未出现在请求体中的字段保持原值；`planned_date` 可更新，显式传 `null` 表示清空计划日期

### 删除任务

- **路径**: `/api/tasks/:id`
- **方法**: DELETE

### 获取目标列表

- **路径**: `/api/goals`
- **方法**: GET
- **说明**: 返回年度目标列表，按 id 升序排列

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 否 | 按孩子筛选 |

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| child_id | number 或 null | 归属孩子，`null` 表示全局目标 |
| status | string | 状态：`todo` / `rest` / `health` / `happy` / `study` |
| progress | number | 当前进度 |
| target | number | 目标值 |

### 创建目标

- **路径**: `/api/goals`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 目标名称 |
| child_id | number | 否 | 归属孩子 ID，不传为 null（全局目标） |
| status | string | 否 | 状态（默认 `todo`） |
| progress | number | 否 | 当前进度（默认 0） |
| target | number | 否 | 目标值（默认 1） |

### 更新目标

- **路径**: `/api/goals/:id`
- **方法**: PUT
- **说明**: 部分更新，未出现在请求体中的字段保持原值；`child_id` 显式传 `null` 表示清空归属。目标不存在返回 404

### 删除目标

- **路径**: `/api/goals/:id`
- **方法**: DELETE
- **说明**: 在事务内先将关联待办的 `goal_id` 置为 `NULL`，再删除目标（关联待办不会被删除）。目标不存在返回 404

### 获取待办列表

- **路径**: `/api/todos`
- **方法**: GET
- **说明**: 返回待办任务列表，按 id 升序排列

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| child_id | number | 否 | 按孩子筛选 |
| goal_id | number | 否 | 按关联目标筛选 |

> 两个筛选参数可同时传入，为 AND 关系。

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| goal_id | number 或 null | 关联目标，`null` 表示未关联 |
| child_id | number 或 null | 归属孩子，`null` 表示全局待办 |
| priority | string | 优先级：`high` / `medium` / `low` |
| expected_points | number | 完成时奖励的预期积分 |
| planned_date | string 或 null | 计划日期，格式 `YYYY-MM-DD` |
| completed | number | 是否已完成（0 / 1） |

### 创建待办

- **路径**: `/api/todos`
- **方法**: POST

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 待办名称 |
| goal_id | number | 否 | 关联目标 ID，不传为 null |
| child_id | number | 否 | 归属孩子 ID，不传为 null |
| creator | string | 否 | 创建人 |
| priority | string | 否 | 优先级（默认 `medium`） |
| expected_points | number | 否 | 预期积分（默认 0） |
| planned_date | string | 否 | 计划日期，格式 `YYYY-MM-DD` |
| description | string | 否 | 待办描述 |
| completed | number | 否 | 是否已完成（默认 0） |

### 更新待办

- **路径**: `/api/todos/:id`
- **方法**: PUT
- **说明**: 部分更新，未出现在请求体中的字段保持原值。`goal_id`、`child_id`、`planned_date`、`description` 显式传 `null` 表示清空；`expected_points` 显式传 `0` 表示置零；`completed` 可切换完成状态。待办不存在返回 404

### 删除待办

- **路径**: `/api/todos/:id`
- **方法**: DELETE
- **说明**: 待办不存在返回 404

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
