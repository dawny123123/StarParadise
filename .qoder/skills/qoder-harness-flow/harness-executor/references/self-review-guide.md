# 提交前自检指南

> harness-executor 在 Step 3.5 Review 和 Step 5 交接前，可参考此指南进行代码质量自检。

---

## 代码质量

- 代码格式化通过（`mvn spotless:check` / `npx prettier --check .` 等）
- 静态分析无新增违规（PMD / ESLint / Pylint）
- 编译器无警告
- 死代码已移除（未使用的 import、变量、方法）

## 架构与设计

- 使用现有模式（无正当理由不引入新抽象）
- 遵循分层架构（Controller → Service → Mapper/Repository）
- 单一职责原则（类/方法职责明确）
- DRY 原则（无代码重复）
- 依赖注入（非硬编码依赖）

## 命名与可读性

- 类名：PascalCase（`SkillService`）
- 方法名：camelCase（`createSkill`）
- 变量名：camelCase（`skillCode`）
- 常量：UPPER_SNAKE_CASE（`CACHE_TTL_SECONDS`）
- 命名有意义且可描述
- 无不必要的缩写（DTO、ID、URL 等通用缩写除外）

## 注释与文档

- 复杂逻辑有 "Why" 注释（解释为什么，不是做什么）
- 无 "What" 注释（代码本身已表达的内容）
- 公共方法有 Javadoc / docstring
- 设计决策有 `@see` 引用到文档
- **API 文档已更新**（如果 API 有变更，更新 `docs/api.md`）

## 错误处理

- 异常处理适当
- 业务异常使用统一的异常类（如 `BusinessException`）
- 错误码定义在统一枚举中
- 错误信息清晰有用
- 无异常吞没（空 catch 块）

## 安全

- 无 SQL 注入（使用参数化查询）
- 输入校验已实现
- 敏感数据未记入日志（密码、Token）
- 权限检查已就位
- 无硬编码凭证

## 性能

- 无 N+1 查询问题
- 高频查询有数据库索引
- 大结果集有分页
- 合理使用缓存
- 循环内无不必要的对象创建

## 测试

- 新逻辑有单元测试
- 测试覆盖率 > 80%
- 测试遵循 AAA 模式（Arrange, Act, Assert）
- 测试独立（无执行顺序依赖）
- API 变更后有 API 测试更新
- 边界情况已覆盖（null、空值、边界值）

## 数据库（Web 应用 + DB）

- DDL 脚本在正确目录（`mysql/` 或 `h2/`）
- DDL 脚本使用语义化版本（`V1.x.x__description.sql`）
- MySQL 和 H2 脚本同步
- 迁移脚本幂等（`IF NOT EXISTS` / `IF EXISTS`）
- 无破坏性变更（或有备份计划）
- Mapper resultMap 与 Entity、DDL 一致（MyBatis 项目）

## API 特定（Web 应用）

- 使用统一入口（如 `/data/api.json`）或有正当理由的独立端点
- `@Action` 注解已定义（或等效的路由注解）
- 参数在 `params` 字段中传递
- 响应格式遵循统一规范（如 `ApiResponse<T>`）
- 请求 DTO 已创建（不使用 Map）
- 响应 DTO 已创建（不返回 Entity）
- **API 文档已更新**（`docs/api.md`）

## 常见 AI 生成代码问题

- **长方法**：方法 > 50 行（考虑拆分）
- **大类**：类 > 300 行（考虑拆分）
- **重复代码**：相同/相似代码在多处出现
- **魔法数字**：使用命名常量
- **长参数列表**：> 4 个参数（考虑参数对象）
- **特性嫉妒**：方法更多使用其他类的数据
- **数据泥团**：相同字段组在多处出现

---

## 与 Executor Step 3.5 Review 集成

在 Step 3.5 跨模型 Review 中，reviewer 参考此清单进行审查。重点关注：

1. **与变更相关的检查项**（不是逐项全查）
2. **AI 生成代码的常见问题**
3. **Web 应用特定检查**（如果适用）

### 快速自检命令

```bash
# 格式化
mvn spotless:apply  # Java
npx prettier --write .  # TypeScript

# 质量检查
mvn pmd:check       # Java
npx eslint .        # TypeScript

# 测试
mvn test            # Java
npm test            # TypeScript

# API 测试（Web 应用）
bash scripts/run-api-tests.sh --external

# DDL 一致性（Web 应用 + DB）
bash scripts/check-db-consistency.sh
```