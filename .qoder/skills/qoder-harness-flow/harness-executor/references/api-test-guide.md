# API 接口测试验证指南

> harness-executor 在 Step 4 功能验证时，如果是 Web 应用，优先使用 API 测试脚本验证接口有效性。

---

## 测试分层体系

| 层级 | 类型 | 数据库 | 运行方式 | 验证范围 |
|------|------|--------|---------|---------|
| 1 | 单元测试 | 内存/H2 | `make test` | 逻辑正确性 |
| 2 | 集成测试 | 真实 DB | `make test`（IT 类） | 组件交互 |
| 3 | API 测试 | 真实 DB | `make api-test` | 端到端接口 |
| 4 | E2E 测试 | 真实 DB | Playwright 等 | 用户流程 |

API 测试处于第 3 层，验证 HTTP 接口从请求到响应的完整链路。

---

## API 测试脚本编写模式

### 基本模式

```
curl 调用 → 断言响应 → 记录结果 → 清理数据
```

### curl 调用模式

```bash
# 通用 curl 调用模式
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X {METHOD} \
  -H "Content-Type: application/json" \
  {EXTRA_HEADERS} \
  -d '{REQUEST_BODY}' \
  "${BASE_URL}{PATH}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
```

### 断言模式

```bash
# 状态码断言
assert_status() {
  local expected=$1
  local actual=$2
  if [ "$actual" != "$expected" ]; then
    echo "  ✗ 状态码断言失败: 期望 $expected, 实际 $actual"
    return 1
  fi
  echo "  ✓ 状态码: $actual"
}

# JSON 字段断言
# $field 格式为 Python dict 访问表达式，如 '["data"]["id"]'
assert_json_field() {
  local field=$1
  local expected=$2
  local actual=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)$field)")
  if [ "$actual" != "$expected" ]; then
    echo "  ✗ 字段断言失败: $field 期望 $expected, 实际 $actual"
    return 1
  fi
  echo "  ✓ 字段 $field: $actual"
}

# JSON 字段存在断言
# $field 格式同上，如 '["data"]["id"]'
assert_json_exists() {
  local field=$1
  local result=$(echo "$BODY" | python3 -c "import sys,json; v=json.load(sys.stdin)$field; print('exists' if v is not None else 'missing')")
  if [ "$result" != "exists" ]; then
    echo "  ✗ 字段存在断言失败: $field 不存在或为 null"
    return 1
  fi
  echo "  ✓ 字段 $field 存在"
}
```

---

## 测试阶段设计原则

1. **资源生命周期**：最先创建、最后删除——确保测试链完整
2. **内容有意义**：使用真实的业务数据，而非 "test123"
3. **测试用例匹配**：API 测试用例应与业务功能匹配
4. **清理彻底**：测试结束必须删除所有创建的数据
5. **幂等设计**：同一脚本可重复运行，不影响后续测试

### 测试阶段示例

```
阶段 1: 创建资源（CRUD - Create）
阶段 2: 查询资源（CRUD - Read）
阶段 3: 更新资源（CRUD - Update）
阶段 4: 异常场景（参数校验、权限、边界值）
阶段 5: 删除资源（CRUD - Delete + 验证删除后查询）
```

---

## 运行模式

### 启动模式（默认）

脚本自动启动应用并运行测试：

```bash
bash scripts/run-api-tests.sh
```

流程：
1. 检查端口是否空闲
2. 启动应用（后台进程）
3. 等待就绪（健康检查）
4. 运行测试用例
5. 停止应用
6. 输出报告

### 外部模式

测试已启动的应用：

```bash
bash scripts/run-api-tests.sh --external
bash scripts/run-api-tests.sh --url http://staging.example.com
```

---

## 测试报告格式

测试完成后生成 Markdown 格式报告：

```markdown
# API 测试报告

**执行时间**: 2026-05-12 14:30:00
**目标地址**: http://localhost:8080
**运行模式**: 启动模式

## 测试统计

| 指标 | 数值 |
|------|------|
| 总测试数 | 45 |
| 通过 | 42 |
| 失败 | 2 |
| 跳过 | 1 |
| 通过率 | 93.3% |

## 失败详情

### 失败 #1: 创建资源 - 缺少必填字段
- **接口**: POST /api/resources
- **期望**: 400 Bad Request
- **实际**: 201 Created
- **原因**: 服务端未校验必填字段

### 失败 #2: 查询资源 - 分页参数
- **接口**: GET /api/resources?page=1&size=10
- **期望**: 200 + 分页元数据
- **实际**: 200 + 无分页信息
- **原因**: 分页响应格式未包含 total 字段

## 结论
- 基础 CRUD 流程: 通过
- 异常场景: 部分失败
- 建议: 补充必填字段校验
```

---

## 与 Executor Step 4 集成

当 harness-executor 在 Step 4 功能验证时，如果是 Web 应用且存在 `scripts/run-api-tests.sh`：

### 优先级

```
1. scripts/run-api-tests.sh --external  （如果应用已启动）
2. scripts/run-api-tests.sh             （启动应用并测试）
3. verify.py 端点测试                    （后备）
```

### 验证场景增强

在标准验证场景基础上，Web 应用增加：

1. **acceptance.md API 验证** → 运行 API 测试脚本中与变更相关的阶段
2. **新增端点测试** → 如果任务新增了 API 端点，必须在 API 测试中有对应测试
3. **修改端点测试** → 如果任务修改了 API 行为，验证新行为 + 旧行为兼容性
4. **删除端点测试** → 如果任务废弃了 API 端点，验证返回 404 或正确的废弃响应

### 失败处理

| API 测试结果 | 操作 |
|-------------|------|
| 全部通过 | 继续到 Step 5 |
| 部分失败（与变更无关） | 记录警告，继续 |
| 部分失败（与变更相关） | 返回 Step 2 修复，最多 2 次重试 |
| 应用无法启动 | 记录跳过原因，使用 verify.py 后备 |

---

## API 文档同步

API 测试与 API 文档（`docs/api.md`）应保持同步：

- 新增接口 → 测试 + 文档同时更新
- 修改接口 → 测试用例更新 + 文档字段更新
- 废弃接口 → 测试验证废弃响应 + 文档标记废弃

在 Step 3.5 Review 中，reviewer 应检查 API 文档是否与代码变更同步。

---

## 常见问题

### 应用启动超时

- Spring Boot 通常需要 60+ 秒启动
- 检查数据库连接是否正常
- 检查环境变量是否完整

### 数据清理失败

- 使用唯一标识（如时间戳）创建测试数据
- 清理时按标识删除，避免误删其他数据
- 最后兜底：清理所有测试前缀的数据

### 并发测试冲突

- 避免在并行测试中操作相同的资源
- 每个测试阶段使用独立的测试数据
- 考虑使用数据库事务回滚