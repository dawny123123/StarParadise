# 任务感知场景设计指南

本指南解释协调器如何为每个任务设计功能验证场景。与 `environment.json` 中的预定义场景不同，这些是**基于任务实际变更动态生成**的。

## 为什么每个任务都要设计场景

`environment.json` 中的预定义场景覆盖常见流程：
- 用户注册/登录
- 健康检查
- 标准 CRUD 操作

但它们**无法**覆盖：
- 你刚添加的特定端点
- 你刚实现的验证规则
- 你的变更引入的边界情况
- 你修改的副作用

**任务特定场景填补这一空白。**

---

## 设计流程

### 第 1 步：收集上下文

设计场景前，协调器收集：

| 来源 | 提取内容 |
|--------|-----------------|
| 任务描述 | 请求了什么功能/修复 |
| 计划文件（目标部分） | 预期结果 |
| 子代理结果 | `files_changed`、`files_created`、`summary` |
| environment.json | 可用的数据库、服务、脚本 |
| 代码检查 | 路由、处理器、验证逻辑 |

### 第 2 步：识别变更内容

对变更进行分类：

| 变更类型 | 示例 | 验证内容 |
|-------------|---------|----------------|
| 新端点 | `POST /api/v1/products` | 返回正确状态、创建数据、验证输入 |
| 修改端点 | 更新 `/api/v1/users/{id}` | 新字段工作正常、旧行为未变 |
| 新验证 | 邮箱格式检查 | 拒绝无效输入、接受有效输入 |
| 新业务规则 | "订单必须至少包含 1 项" | 规则生效、错误信息清晰 |
| 副作用 | "注册时发送邮件" | 副作用发生（或模拟被调用） |
| 认证变更 | 添加仅管理员端点 | 拒绝非管理员、接受管理员 |

### 第 3 步：设计场景

对每个重大变更，创建 1-3 个覆盖以下内容的场景：

1. **成功路径**：功能按预期工作
2. **错误路径**：无效输入被正确拒绝
3. **边界情况**：边界条件、并发访问等

---

## 场景模板

```json
{
  "name": "verify_<feature>_<behavior>",
  "description": "One sentence describing what this verifies",
  "requires": ["<dependency from environment.json>"],
  "steps_hint": [
    "<step 1>",
    "<step 2>",
    "<step 3>"
  ],
  "why": "<business reason this matters>",
  "priority": "high | medium | low"
}
```

### 字段说明

| 字段 | 用途 | 示例 |
|-------|---------|---------|
| `name` | 唯一标识符，snake_case | `verify_product_price_validation` |
| `description` | 成功是什么样 | "Verify product creation rejects negative prices" |
| `requires` | environment.json 中的依赖 | `["postgres", "redis"]` 或 `[]` |
| `steps_hint` | 自然语言步骤（verifier 填充细节） | 见下方示例 |
| `why` | 业务理由 | "Price integrity is critical for billing" |
| `priority` | 执行优先级 | `high` = 必须通过, `medium` = 应该通过 |

---

## 按变更类型的示例

### 新端点（CRUD）

**任务**："添加产品管理 API"

```json
[
  {
    "name": "verify_create_product_success",
    "description": "Verify POST /api/products creates product in database",
    "requires": ["postgres"],
    "steps_hint": [
      "POST /api/products with valid data (name, price, category)",
      "Assert 201 response with product ID",
      "GET /api/products/{id} to verify persistence",
      "Assert returned data matches input"
    ],
    "why": "Core CRUD - products must be persistable",
    "priority": "high"
  },
  {
    "name": "verify_create_product_validation",
    "description": "Verify product creation validates required fields",
    "requires": [],
    "steps_hint": [
      "POST /api/products with missing name",
      "Assert 400 response with error for 'name required'",
      "POST /api/products with negative price",
      "Assert 400 response with error for 'invalid price'"
    ],
    "why": "Data integrity - garbage in, garbage out",
    "priority": "high"
  },
  {
    "name": "verify_list_products_pagination",
    "description": "Verify product listing supports pagination",
    "requires": ["postgres"],
    "steps_hint": [
      "Create 15 products",
      "GET /api/products?page=1&limit=10",
      "Assert 10 items returned with pagination metadata",
      "GET /api/products?page=2&limit=10",
      "Assert 5 items returned"
    ],
    "why": "Large catalogs need pagination for performance",
    "priority": "medium"
  }
]
```

### 新验证

**任务**："为注册添加邮箱格式验证"

```json
[
  {
    "name": "verify_email_format_rejected",
    "description": "Verify registration rejects malformed emails",
    "requires": [],
    "steps_hint": [
      "POST /api/register with email='not-an-email'",
      "Assert 400 response",
      "Assert error message mentions email format",
      "Verify no user created (if possible)"
    ],
    "why": "Email validation was the task goal",
    "priority": "high"
  },
  {
    "name": "verify_valid_email_accepted",
    "description": "Verify registration accepts valid emails",
    "requires": ["postgres"],
    "steps_hint": [
      "POST /api/register with email='valid@example.com'",
      "Assert 201 response",
      "GET /api/users/{id} to verify user created"
    ],
    "why": "Ensure validation doesn't over-block",
    "priority": "high"
  },
  {
    "name": "verify_edge_case_emails",
    "description": "Verify edge case email formats",
    "requires": [],
    "steps_hint": [
      "POST /api/register with email='user+tag@example.com' (valid)",
      "Assert 201",
      "POST /api/register with email='user@localhost' (depends on rules)",
      "Document actual behavior"
    ],
    "why": "Edge cases reveal spec ambiguity",
    "priority": "medium"
  }
]
```

### 修改业务逻辑

**任务**："更新订单总价以包含税费"

```json
[
  {
    "name": "verify_order_includes_tax",
    "description": "Verify order total includes calculated tax",
    "requires": ["postgres"],
    "steps_hint": [
      "Create product with price $100",
      "Create order with 1x product",
      "GET /api/orders/{id}",
      "Assert total = $100 + tax (e.g., $110 for 10% tax)",
      "Assert tax_amount field present and correct"
    ],
    "why": "Tax calculation was the task goal",
    "priority": "high"
  },
  {
    "name": "verify_tax_rate_configurable",
    "description": "Verify tax rate respects configuration",
    "requires": ["postgres"],
    "steps_hint": [
      "Set TAX_RATE env var to 0.15 (15%)",
      "Create order",
      "Assert tax calculated at 15%"
    ],
    "why": "Tax rates vary by jurisdiction",
    "priority": "medium"
  }
]
```

### 认证/权限变更

**任务**："添加仅管理员可访问的用户删除端点"

```json
[
  {
    "name": "verify_admin_can_delete_user",
    "description": "Verify admin can delete users",
    "requires": ["postgres"],
    "steps_hint": [
      "Create regular user A",
      "Login as admin",
      "DELETE /api/admin/users/{userA_id}",
      "Assert 200 or 204 response",
      "GET /api/users/{userA_id}",
      "Assert 404 (user deleted)"
    ],
    "why": "Core admin functionality",
    "priority": "high"
  },
  {
    "name": "verify_non_admin_cannot_delete",
    "description": "Verify regular users cannot delete users",
    "requires": [],
    "steps_hint": [
      "Login as regular user",
      "DELETE /api/admin/users/{some_id}",
      "Assert 403 Forbidden",
      "Verify user not deleted"
    ],
    "why": "Security - privilege escalation prevention",
    "priority": "high"
  },
  {
    "name": "verify_unauthenticated_rejected",
    "description": "Verify unauthenticated requests rejected",
    "requires": [],
    "steps_hint": [
      "DELETE /api/admin/users/{id} without auth header",
      "Assert 401 Unauthorized"
    ],
    "why": "Security baseline",
    "priority": "high"
  }
]
```

---

## 将 environment.json 映射到场景

使用 `environment.json` 了解可用的基础设施：

### 数据库 → 持久化测试

```json
// environment.json
{
  "databases": [
    {"name": "postgres", "type": "postgres", "required": true}
  ]
}
```

**设计含义**：包含持久化验证。使用 `requires: ["postgres"]`。

### 服务 → 集成测试

```json
// environment.json
{
  "services": [
    {"name": "redis", "type": "redis", "purpose": "session cache"},
    {"name": "email_service", "type": "http", "url_env": "EMAIL_SERVICE_URL"}
  ]
}
```

**设计含义**：
- 如与认证相关，测试 Redis 中的会话持久化
- 如与邮件相关，验证 email_service 是否被调用（或模拟它）

### 脚本 → 设置/清理

```json
// environment.json
{
  "scripts": {
    "setup_env": "harness/scripts/setup-env.sh",
    "seed_data": "harness/scripts/seed-data.sh"
  }
}
```

**设计含义**：在场景中引用填充的数据。示例："GET /api/products 应返回填充的产品"。

---

## 反模式

| 反模式 | 为什么不好 | 应该怎么做 |
|--------------|---------|------------|
| 只测试成功路径 | 遗漏错误处理中的 bug | 包含错误和边界情况 |
| 使用占位数据 | `{"name": "test", "email": "a@a.com"}` 不真实 | 使用真实的模拟数据 |
| 跳过副作用检查 | 数据实际上没有持久化 | POST 后验证 GET |
| 场景过多 | 浪费时间，让 verifier 不堪重负 | 聚焦 2-5 个关键场景 |
| 缺少 `why` 字段 | Verifier 不知道意图 | 始终解释业务原因 |
| 要求不可用基础设施 | 场景会被跳过 | 先检查 environment.json |

---

## 决策树

```
任务完成 → 分析 files_changed
    │
    ├─ 新端点？
    │   └─ 设计：创建/读取/错误场景
    │
    ├─ 修改端点？
    │   └─ 设计：验证新行为 + 回归
    │
    ├─ 新验证？
    │   └─ 设计：有效/无效/边界场景
    │
    ├─ 认证变更？
    │   └─ 设计：允许/拒绝/未认证场景
    │
    ├─ 业务逻辑变更？
    │   └─ 设计：验证计算/规则应用
    │
    └─ 纯重构（无行为变更）？
        └─ 设计：仅回归场景（或跳过）
```

---

## 移交给 Verifier

设计场景后，将它们传递给 Verifier 子代理：

```
Agent(
    description="Verify: functional checks for [task]",
    prompt="""
...

## Task-Specific Scenarios (designed by Coordinator)
{task_specific_scenarios as JSON}

Execute ALL task-specific scenarios. They verify THIS task's changes.
"""
)
```

Verifier：
1. 读取 `steps_hint`
2. 检查代码以获取精确的请求格式
3. 生成真实的测试数据
4. 执行并带有证据地报告
