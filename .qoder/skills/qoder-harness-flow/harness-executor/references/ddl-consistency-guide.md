# DDL/Entity 一致性验证指南

> harness-executor 在 Step 3 Layer 2 验证时，如果检测到数据库 + ORM 依赖，自动运行 DDL 一致性检查。

---

## 四端同步规则

任何字段变更必须同步以下四处，缺一不可：

### MyBatis 项目

```
1. src/main/resources/db/migration/mysql/V1.x.x__description.sql
2. src/main/resources/db/migration/h2/V1.x.x__description.sql
3. src/main/java/.../entity/XxxEntity.java
4. src/main/resources/mapper/xxx/XxxMapper.xml (resultMap)
```

### JPA 项目

```
1. src/main/resources/db/migration/mysql/V1.x.x__description.sql
2. src/main/resources/db/migration/h2/V1.x.x__description.sql
3. src/main/java/.../entity/XxxEntity.java (@Column)
```

> **最终校验以 testing MySQL 实际表结构为准**——DDL 和 Entity 可能包含未上线的新增字段，直接按其查询会报 `Unknown column` 错误。

---

## 一致性检查流程

### Step 1: 查看 testing 数据库实际表结构

```bash
# 如果项目有 db_init.sh
bash scripts/db_init.sh config   # 查看数据库连接配置
bash scripts/db_init.sh status   # 查看所有表状态

# 直接用 mysql 客户端
mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME -e "DESCRIBE table_name;"
```

### Step 2: 读取对应 Entity 字段

```bash
# 找到 Entity 文件
find src/main/java -name "*Entity.java" | grep -i "表名关键词"
```

对比要点：
- 字段名：Entity 的 camelCase ↔ MySQL 的 snake_case（如 `skillCode` ↔ `skill_code`）
- 字段类型：Java 类型 ↔ MySQL 类型（如 `String` ↔ `varchar`，`Integer` ↔ `int`）
- 是否可空：Entity 的包装类型（Integer vs int）↔ MySQL 的 NULL/NOT NULL

### Step 3: 读取 DDL 迁移脚本

```bash
# MySQL DDL
ls src/main/resources/db/migration/mysql/
# H2 DDL
ls src/main/resources/db/migration/h2/
```

确认 mysql/ 和 h2/ 的迁移脚本版本号和内容一致（H2 语法可能略有差异）。

### Step 4: 读取 Mapper XML 的 resultMap（MyBatis 专用）

```bash
find src/main/resources/mapper -name "*.xml" | xargs grep -l "表名关键词"
```

确认 resultMap 的 `<result>` 标签与 Entity 字段、DDL 列一致。

---

## Executor Layer 2 DDL 检查

当 harness-executor 在 Step 3 Layer 2 验证时，如果项目存在 `scripts/check-db-consistency.sh`：

```bash
# 运行 DDL 一致性检查
bash scripts/check-db-consistency.sh
```

**结果处理**：

| 退出码 | 含义 | 操作 |
|--------|------|------|
| 0 | 所有表结构一致 | 继续到 Layer 3 |
| 1 | 发现不一致 | 记录失败，分析原因，返回 Step 2 修复 |
| 2 | 无法连接数据库 | 警告，跳过 DDL 检查，继续验证 |

---

## 常见同步场景

### 新增字段

1. 在 Entity 中添加字段（含注释说明为什么加）
2. 创建 mysql/ 和 h2/ 迁移脚本 `V1.x.x__add_xxx_field.sql`
3. 更新 Mapper XML 的 resultMap（MyBatis 项目）
4. 运行 `bash scripts/db_init.sh migrate` 同步到 testing MySQL
5. 验证：DESCRIBE 表名 确认字段已存在

### 修改字段

1. 修改 Entity 字段类型/名称
2. 创建 mysql/ 和 h2/ 迁移脚本（ALTER TABLE MODIFY/CHANGE）
3. 更新 Mapper XML 的 resultMap（MyBatis 项目）
4. 运行迁移脚本

### 删除字段

1. 从 Entity 移除字段
2. 创建 mysql/ 和 h2/ 迁移脚本（ALTER TABLE DROP COLUMN）
3. 从 Mapper XML 的 resultMap 移除对应 `<result>`（MyBatis 项目）
4. 运行迁移脚本

---

## DDL 迁移脚本命名规范

```
V1.0.0__baseline.sql              # 初始化建表
V1.1.0__add_xxx_table.sql         # 新增表
V1.2.0__add_xxx_column.sql        # 新增字段
V1.3.0__modify_xxx_type.sql       # 修改字段类型
```

- 版本号严格递增，不可跳过
- 描述用蛇形命名（snake_case）
- mysql/ 和 h2/ 使用相同的版本号和描述
- 脚本需幂等（使用 `IF NOT EXISTS` / `IF EXISTS`）

---

## H2 与 MySQL 语法差异

| MySQL | H2 | 说明 |
|-------|-----|------|
| `int(11)` | `int` | H2 不支持长度限定 |
| `bigint NOT NULL AUTO_INCREMENT` | `bigint NOT NULL AUTO_INCREMENT` | 相同 |
| `COMMENT 'xxx'` | 不支持 | H2 不支持列级 COMMENT |
| `ON UPDATE CURRENT_TIMESTAMP` | 不支持 | H2 不支持 |
| `DEFAULT ''` | `DEFAULT ''` | 相同 |

---

## 常见错误诊断

### Unknown column 错误

**症状**：测试报 `java.sql.SQLSyntaxErrorException: Unknown column 'xxx'`

**原因**：Entity 有字段但 testing MySQL 实际表还没有。

**修复**：
```bash
bash scripts/db_init.sh migrate   # 执行增量迁移
```

### H2 单元测试语法错误

**症状**：H2 profile 下测试报 SQL 语法错误

**原因**：DDL 中使用了 H2 不支持的 MySQL 特有语法

**修复**：检查 h2/ 迁移脚本，移除 COMMENT、ON UPDATE 等 MySQL 专用语法

### Mapper resultMap 不匹配

**症状**：查询返回字段为 null 但数据库有值

**原因**：Mapper XML 的 resultMap 中 column 名与 DDL 列名不一致

**修复**：对比 resultMap 的 `column` 属性与 DDL 列名（注意 snake_case）

---

## 与 Executor Step 3 集成

在 harness-executor 的 Layer 2 验证中，DDL 一致性检查作为**条件步骤**插入：

```
Layer 2 验证流程：
  1. 项目级构建/lint/测试（标准）
  2. [条件] 如果 scripts/check-db-consistency.sh 存在：
     - 运行 DDL 一致性检查
     - 失败时记录失败并尝试修复
  3. [条件] 如果 scripts/code-review-check.sh 存在：
     - 运行编码规范检查
```

如果 DDL 检查失败但不是由当前任务变更引起的（即变更不涉及 Entity/DDL），将该失败记录为**警告**而非阻塞。