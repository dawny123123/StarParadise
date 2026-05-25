# 测试策略

> 最后更新：2026-05-25
> 覆盖率目标：60%（单元测试）/ 50%（集成测试）

## 1 测试分级

| 级别 | 范围 | 工具 | 目标覆盖率 |
|------|------|------|-----------|
| 单元测试 | 单个函数/路由 | Jest / Vitest | 60% |
| 集成测试 | API 端点 | curl + shell | 50% |
| 端到端测试 | 完整用户场景 | `scripts/verify/` | 关键路径 |

## 2 单元测试

### 2.1 命名规范

- 后端：`star-park/server/src/routes/__tests__/children.test.js`
- 前端：`star-park/pc-admin/src/views/__tests__/Dashboard.spec.js`
- 一个测试只测一件事

### 2.2 运行单元测试

```bash
make test        # 运行全部测试
```

### 2.3 Mock 策略

- 后端测试使用内存 SQLite 数据库（`:memory:`）
- 前端测试 Mock API 层（axios / uni.request）

## 3 集成测试

### 3.1 前置条件

集成测试依赖后端服务运行：

```bash
make setup-env   # 启动测试环境
```

### 3.2 运行集成测试

```bash
make api-test    # 运行 API 接口测试
```

### 3.3 清理

```bash
make teardown-env
```

## 4 端到端验证

端到端测试位于 `scripts/verify/`，从用户视角验证应用行为。

| 场景 | 脚本 | 验证内容 |
|------|------|----------|
| 健康检查 | `verify/health-check.sh` | 服务启动与健康端点 |
| API 功能 | `verify/api-check.sh` | 核心 CRUD 操作 |

运行全部验证场景：

```bash
make verify
```

## 5 测试数据

### 5.1 种子数据

- 位置：`star-park/server/src/seed.js`
- 格式：JavaScript 函数，使用 `better-sqlite3` 事务
- 首次启动时自动执行（children 表为空时触发）

## 6 覆盖率目标

- 单元测试：60%（项目初期，逐步提高）
- 集成测试：50%（覆盖核心 API 端点）
- 关键业务逻辑（打卡奖励计算、积分余额）需 100% 覆盖

## 7 不稳定测试策略

| 操作 | 触发条件 |
|------|----------|
| 隔离 | 连续失败 3+ 次且无代码变更 |
| 排查 | 24h 内分配负责人 |
| 删除 | 3 次修复尝试后仍不稳定 |
