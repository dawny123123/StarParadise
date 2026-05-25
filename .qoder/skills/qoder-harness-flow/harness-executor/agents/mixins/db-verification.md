# 数据库验证 Mixin

此 mixin 为验证器添加数据库验证能力。

## 何时包含

在以下情况包含此 mixin：
- `environment.json` 配置了 `databases`
- 任务涉及数据持久化
- 副作用需要数据库级验证

## 额外上下文

你正在验证数据库操作是否正常工作。这包括检查数据是否被持久化、约束是否被强制执行以及查询是否工作。

## 数据库特定协议

### 数据库连接

1. 从 `environment.json` 读取数据库配置：
   ```json
   {
     "databases": [
       {"type": "postgres", "name": "app_db", "port": 5432}
     ]
   }
   ```

2. 从环境获取连接字符串：
   - `DATABASE_URL`（完整连接字符串）
   - 或从单个变量构造：`DB_HOST`、`DB_PORT`、`DB_USER` 等

3. 使用测试凭证（永远不要使用生产环境）

### 查询执行

对于每个验证查询：

```python
# 伪代码
query = "SELECT * FROM users WHERE email = $1"
params = ["jane@example.com"]

try:
    result = db.execute(query, params)
    return {
        "query": query,
        "params": params,
        "rows": result.rows,
        "row_count": len(result.rows),
        "success": True
    }
except Exception as e:
    return {
        "query": query,
        "error": str(e),
        "success": False
    }
```

### 验证模式

**INSERT 后（POST）：**
```json
{
  "action": "verify_insert",
  "query": "SELECT * FROM users WHERE id = $1",
  "params": ["uuid-123"],
  "expected": {"row_count": 1},
  "actual": {"row_count": 1},
  "passed": true
}
```

**UPDATE 后（PUT/PATCH）：**
```json
{
  "action": "verify_update",
  "query": "SELECT name FROM users WHERE id = $1",
  "params": ["uuid-123"],
  "expected": {"name": "Jane Updated"},
  "actual": {"name": "Jane Updated"},
  "passed": true
}
```

**DELETE 后：**
```json
{
  "action": "verify_delete",
  "query": "SELECT * FROM users WHERE id = $1",
  "params": ["uuid-123"],
  "expected": {"row_count": 0},
  "actual": {"row_count": 0},
  "passed": true
}
```

### 约束测试

测试数据库约束：

| 约束 | 测试 | 预期 |
|------|------|------|
| 唯一 | 插入重复数据 | 错误（Postgres 中为 23505） |
| 非空 | 插入 NULL | 错误 |
| 外键 | 插入无效引用 | 错误 |
| 检查 | 插入无效值 | 错误 |

### 事务验证

对于应该是原子性的操作：

1. 启动事务
2. 执行操作
3. 验证所有变更或回滚
4. 检查相关表

### 常见验证查询

**用户创建：**
```sql
SELECT id, email, created_at FROM users WHERE email = $1
-- 验证：行存在，created_at 是最近的
```

**软删除：**
```sql
SELECT id, deleted_at FROM users WHERE id = $1
-- 验证：deleted_at 已设置，数据仍然存在
```

**硬删除：**
```sql
SELECT COUNT(*) FROM users WHERE id = $1
-- 验证：计数为 0
```

**审计日志：**
```sql
SELECT action, entity_id, created_at FROM audit_logs
WHERE entity_type = 'user' AND entity_id = $1
ORDER BY created_at DESC LIMIT 1
-- 验证：action 与操作匹配
```

### Redis 验证

对于 Redis 操作：

```json
{
  "action": "verify_cache_set",
  "command": "GET user:uuid-123",
  "expected": {"exists": true},
  "actual": {"exists": true, "value": "{...}"},
  "passed": true
}
```

### MongoDB 验证

对于 MongoDB 操作：

```json
{
  "action": "verify_document",
  "collection": "users",
  "query": {"email": "jane@example.com"},
  "expected": {"count": 1},
  "actual": {"count": 1, "doc": {...}},
  "passed": true
}
```

## 清理

验证后：
1. 回滚测试数据（如果在事务中）
2. 或显式删除测试记录
3. 恢复原始状态

永远不要在数据库中留下测试数据。

## 安全说明

1. 使用参数化查询（永远不要字符串拼接）
2. 仅使用测试/暂存凭证
3. 永远不要记录敏感数据（密码、令牌）
4. 验证后清理测试数据
