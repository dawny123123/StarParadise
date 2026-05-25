# 编码规范检查指南

> harness-executor 在 Step 3 Layer 2 验证时，如果项目存在编码规范检查脚本，自动运行规范检查。

---

## 检查维度

### 1. 代码格式

| 工具 | 语言 | 检查命令 | 自动修复 |
|------|------|---------|---------|
| Spotless | Java | `mvn spotless:check` | `mvn spotless:apply` |
| checkstyle | Java | `mvn checkstyle:check` | 部分可自动修复 |
| ktlint | Kotlin | `./gradlew ktlintCheck` | `./gradlew ktlintFormat` |
| Prettier | TypeScript | `npx prettier --check .` | `npx prettier --write .` |
| Black | Python | `black --check .` | `black .` |
| gofmt | Go | `gofmt -l .` | `gofmt -w .` |

### 2. 静态代码分析

| 工具 | 语言 | 检查命令 | 规则集 |
|------|------|---------|--------|
| PMD | Java | `mvn pmd:check` | pmd-ruleset.xml |
| p3c-pmd | Java | `mvn p3c-pmd:pmd` | 阿里巴巴 Java 开发规约 |
| SpotBugs | Java | `mvn spotbugs:check` | 默认规则 |
| ESLint | TypeScript | `npx eslint .` | .eslintrc |
| Pylint | Python | `pylint src/` | .pylintrc |
| golangci-lint | Go | `golangci-lint run` | .golangci.yml |

### 3. 代码复杂度

- 过大类检查：单文件 > 500 行
- 过长方法检查：单方法 > 50 行
- 圈复杂度检查：单方法 > 10
- 嵌套深度检查：嵌套 > 4 层

### 4. 依赖注入检查

- 硬编码依赖检测（直接 `new` 而非注入）
- 循环依赖检测
- 层级违规检测（跨层导入）

### 5. 异常处理检查

- 空 catch 块检测
- 通用 Exception 捕获检测
- 异常信息缺失检测
- 异常吞没检测（catch 后无任何处理）

### 6. 安全检查

| 检查项 | 检测方式 |
|--------|---------|
| SQL 注入 | 字符串拼接 SQL 查询 |
| 硬编码凭证 | 源码中的密码/API Key |
| 敏感数据日志 | 日志中打印密码/Token |
| 不安全的反序列化 | ObjectInputStream 无校验 |
| 路径遍历 | 用户输入直接拼接文件路径 |

### 7. 测试覆盖率

| 工具 | 命令 | 报告位置 |
|------|------|---------|
| JaCoCo | `mvn jacoco:report` | `target/site/jacoco/index.html` |
| Istanbul/nyc | `npx nyc report` | `coverage/index.html` |
| coverage.py | `coverage report` | 终端输出 |
| go test -cover | `go test -cover ./...` | 终端输出 |

### 8. 架构约束

| 工具 | 语言 | 说明 |
|------|------|------|
| ArchUnit | Java | 可编程的架构规则检查 |
| depguard | Go | 依赖白名单检查 |
| lint-deps.* | 项目脚本 | harness-creator 生成的层边界 linter |

---

## PMD 规则集配置（Java）

### pmd-ruleset.xml 模板

```xml
<?xml version="1.0"?>
<ruleset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        name="Custom Rules"
        xmlns="http://pmd.sourceforge.net/ruleset/2.0.0">

    <description>项目自定义 PMD 规则集</description>

    <!-- 阿里巴巴规约 - 注释 -->
    <rule ref="rulesets/java/ali-comment.xml">
        <exclude name="ClassMustHaveAuthorRule"/>
        <exclude name="AbstractMethodOrInterfaceMethodMustUseJavadocRule"/>
    </rule>

    <!-- 阿里巴巴规约 - 并发 -->
    <rule ref="rulesets/java/ali-concurrent.xml"/>

    <!-- 阿里巴巴规约 - 常量 -->
    <rule ref="rulesets/java/ali-constant.xml"/>

    <!-- 阿里巴巴规约 - 异常 -->
    <rule ref="rulesets/java/ali-exception.xml"/>

    <!-- 阿里巴巴规约 - 流程控制 -->
    <rule ref="rulesets/java/ali-flowcontrol.xml"/>

    <!-- 阿里巴巴规约 - 命名 -->
    <rule ref="rulesets/java/ali-naming.xml"/>

    <!-- 阿里巴巴规约 - OOP -->
    <rule ref="rulesets/java/ali-oop.xml"/>

    <!-- 阿里巴巴规约 - ORM -->
    <rule ref="rulesets/java/ali-orm.xml"/>

    <!-- 阿里巴巴规约 - 其他 -->
    <rule ref="rulesets/java/ali-other.xml"/>

    <!-- 阿里巴巴规约 - 集合 -->
    <rule ref="rulesets/java/ali-set.xml"/>
</ruleset>
```

### 排除规则的原则

- 排除规则必须有**正当理由**（在注释中说明）
- 不得因为"现有代码不符合"而排除规则
- 排除后应在后续迭代中逐步修复

---

## Executor Layer 2 编码规范检查

当 harness-executor 在 Step 3 Layer 2 验证时，如果项目存在 `scripts/code-review-check.sh`：

```bash
bash scripts/code-review-check.sh
```

### 结果处理

| 退出码 | 含义 | 操作 |
|--------|------|------|
| 0 | 所有检查通过 | 继续到 Layer 3 |
| 1 | 发现违规 | 区分新增 vs 历史，仅阻塞新增违规 |
| 2 | 检查工具不可用 | 警告，跳过检查 |

### 新增 vs 历史违规隔离

```bash
# 当前违规数
CURRENT=$(mvn pmd:check -q 2>&1 | grep -c 'PMD violation' || true)

# 基线违规数（使用 git stash 隔离）
git stash
BASELINE=$(mvn pmd:check -q 2>&1 | grep -c 'PMD violation' || true)
git stash pop

# 新增违规数
NEW=$((CURRENT - BASELINE))
if [ "$NEW" -gt 0 ]; then
  echo "新增 $NEW 个 PMD 违规，需修复"
  exit 1
else
  echo "无新增 PMD 违规（历史违规: $BASELINE）"
  exit 0
fi
```

---

## 常见违规修复

### Spotless 格式失败

```bash
mvn spotless:apply   # 自动修复
mvn spotless:check   # 验证
```

### PMD 违规

1. 查看违规详情：`cat target/pmd.xml`
2. 隔离验证：区分本次引入 vs 历史
3. 仅修复本次引入的违规
4. 不要修历史违规（降低风险）

### 命名不规范

- 类名：PascalCase（`SkillService`）
- 方法名：camelCase（`createSkill`）
- 常量：UPPER_SNAKE_CASE（`CACHE_TTL_SECONDS`）
- 数据库列：snake_case（`creator_work_no`）

---

## 与 Executor Step 3 集成

```
Layer 2 验证流程：
  1. 项目级构建/lint/测试（标准）
  2. [条件] 如果 scripts/code-review-check.sh 存在：
     - 运行编码规范检查
     - 区分新增 vs 历史违规
     - 仅阻塞新增违规
  3. [条件] 如果 scripts/check-db-consistency.sh 存在：
     - 运行 DDL 一致性检查
```

编码规范检查的失败**仅阻塞新增违规**。历史违规记录为警告，不阻塞执行。