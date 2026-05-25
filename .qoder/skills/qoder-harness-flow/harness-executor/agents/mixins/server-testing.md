# 服务器测试 Mixin

此 mixin 为验证器添加 HTTP 服务器测试能力。

## 何时包含

在以下情况包含此 mixin：
- `app_type` 为 `server` 或 `hybrid`
- 项目有 HTTP 路由或 REST 端点
- `environment.json` 包含 `startup` 配置

## 额外上下文

你正在测试一个 HTTP 服务器。应用程序暴露 REST 端点。

## 服务器特定协议

### 启动服务器

1. 从 `test_environment.env_vars` 设置环境变量
2. 在后台用进程组隔离运行 `start_command`
3. 轮询就绪端点：
   - 首先尝试 `GET /health`
   - 回退到任务特定场景中的第一个 GET 端点
   - 回退到 TCP 端口检查
4. 就绪超时：30 秒
5. 如果未就绪，捕获 stdout/stderr 用于调试

### HTTP 请求执行

对于每个端点测试：

```python
# 请求执行的伪代码
request = {
    "method": endpoint["method"],
    "url": f"http://localhost:{port}{endpoint['path']}",
    "headers": {
        "Content-Type": "application/json",
        **endpoint.get("headers", {})
    },
    "body": endpoint.get("body")
}

response = http_request(request)

assertions = []
if "status" in endpoint:
    assertions.append(check_status(response, endpoint["status"]))
if "body_contains" in endpoint:
    assertions.append(check_body_contains(response, endpoint["body_contains"]))
if "json_path" in endpoint:
    for path_check in endpoint["json_path"]:
        assertions.append(check_json_path(response, path_check))
```

### 常见断言

**状态码：**
```json
{"type": "status_code", "expected": 200, "actual": 200, "passed": true}
```

**Body 包含：**
```json
{"type": "body_contains", "expected": "success", "found": true, "passed": true}
```

**JSON 路径：**
```json
{
  "type": "json_path",
  "path": "$.data.id",
  "operator": "exists",
  "passed": true
}
```

### 副作用验证

对于 POST/PUT/DELETE 请求，验证变更是否已持久化：

1. **直接数据库查询**（如果有数据库访问权限）：
   ```sql
   SELECT * FROM users WHERE email = 'jane@example.com'
   ```

2. **API 查询**（优先）：
   ```
   POST /api/users → 201 {id: "uuid-123"}
   GET /api/users/uuid-123 → 200 {id: "uuid-123", name: "Jane Doe"}
   ```

3. **报告副作用验证：**
   ```json
   {
     "side_effect": "user_created",
     "verified_by": "GET /api/users/uuid-123 returned 200",
     "passed": true
   }
   ```

### 错误测试

测试错误响应以获得完整覆盖：

| 场景 | 预期 |
|------|------|
| 缺少必填字段 | 400 Bad Request |
| 格式无效（例如，错误的邮箱） | 400 Bad Request |
| 重复的唯一字段 | 409 Conflict |
| 资源未找到 | 404 Not Found |
| 未授权访问 | 401 Unauthorized |
| 禁止的操作 | 403 Forbidden |

### 服务器关闭

1. 向进程组发送 SIGTERM
2. 等待最多 10 秒以优雅关闭
3. 如果仍在运行，发送 SIGKILL
4. 验证进程已终止
5. 在报告中记录关闭行为

## 框架特定说明

### REST API 模式
- JSON 请求体使用 `Content-Type: application/json`
- 认证端点包含 `Authorization: Bearer {token}`
- 检查 201 响应中的 `Location` 请求头

### GraphQL
- 所有请求都是 POST 到 `/graphql`
- 请求体包含 `query` 和 `variables`
- 检查响应中的 `data` 和 `errors`

### WebSocket
- 初始连接通过 HTTP upgrade
- 后续消息使用 WS 协议
- 测试连接生命周期：open → messages → close
