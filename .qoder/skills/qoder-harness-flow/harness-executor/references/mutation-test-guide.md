# 变异测试突击检查指南

> harness-executor 可在 Step 3 后运行可选的变异测试突击检查，验证单元测试的有效性。变异测试不是每次执行都运行的——它是一种**按需质量抽查**机制。

---

## 核心理念

**行覆盖率告诉你"代码被执行了"，变异测试告诉你"测试真的验证了什么"。**

- 行覆盖率 80% 只意味着代码行被执行，不意味着断言充分
- 变异测试修改代码（变异），如果测试没发现变异 → 测试不充分
- 变异杀死率 = 被测试发现的变异数 / 总变异数

---

## 突击检查模式

### 设计原则：临时增强 → 检查 → 清理

变异测试不应污染项目配置。采用"突击检查"模式：

1. **临时添加** PIT/变异测试工具配置到构建文件
2. **运行** 变异测试
3. **分析** 结果
4. **自动清理** 临时配置，不留痕迹

### 何时运行

| 场景 | 运行变异测试？ | 原因 |
|------|--------------|------|
| 安全相关变更 | **推荐** | 安全面需要更高测试质量保证 |
| 核心 Service 变更 | **推荐** | 核心逻辑的测试应更充分 |
| 用户明确要求 | **必须** | 用户指令优先 |
| 发布前验证 | **推荐** | 作为发布质量门禁 |
| 简单修复 | 不推荐 | 成本高于收益 |
| 文档变更 | 不推荐 | 无代码可测试 |

---

## 执行流程

### Step 1: 临时添加配置

**Java (PIT)** — 在 `pom.xml` 的 `<plugins>` 中临时添加：

```xml
<!-- 突击检查模式 - 临时添加，检查后删除 -->
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.19.0</version>
    <dependencies>
        <dependency>
            <groupId>org.pitest</groupId>
            <artifactId>pitest-junit5-plugin</artifactId>
            <version>1.2.3</version>
        </dependency>
    </dependencies>
    <configuration>
        <targetClasses>
            <param>{TARGET_CLASSES}</param>
        </targetClasses>
        <targetTests>
            <param>{TARGET_TESTS}</param>
        </targetTests>
        <features>
            <feature>+CLASSLIMIT(limit[{LIMIT}])</feature>
        </features>
        <outputFormats>
            <outputFormat>HTML</outputFormat>
        </outputFormats>
        <timeoutFactor>2</timeoutFactor>
    </configuration>
</plugin>
<!-- 突击检查模式 - 临时添加结束 -->
```

**Python (mutmut)** — 无需修改配置，直接运行：
```bash
mutmut run --paths-to-mutate src/module/
```

**TypeScript (Stryker)** — 临时配置：
```bash
npx stryker run stryker-temp.conf.json
```

### Step 2: 运行变异测试

```bash
# Java - 使用直接 java 启动（绕过 mvn 脚本的 --enable-native-access 注入）
java \
    -Dclassworlds.conf="$M2_HOME/bin/m2.conf" \
    -Dmaven.home="$M2_HOME" \
    -classpath "$M2_HOME/boot/plexus-classworlds-*.jar" \
    org.codehaus.plexus.classworlds.launcher.Launcher \
    pitest:mutationCoverage \
    -DtargetClasses="{TARGET}" \
    -DtargetTests="{TEST}" \
    -DtimeoutFactor=2

# Python
mutmut run --paths-to-mutate src/module/

# TypeScript
npx stryker run
```

### Step 3: 分析结果

#### 关键指标

| 指标 | 说明 | 阈值 |
|------|------|------|
| **变异杀死率** | 测试发现的变异比例 | >= 70% 优秀 |
| **行覆盖率** | PIT 识别的覆盖行 | >= 80% 优秀 |
| **存活变异数** | 测试未发现的变异 | = 0 最佳 |

#### 存活变异分析模板

对每个存活变异，分析原因：

| 存活变异类型 | 典型原因 | 修复建议 |
|------------|---------|---------|
| 条件边界修改 | 缺少边界值测试 | 补充 `==` vs `>=` 的边界测试 |
| 返回值修改 | 断言不充分 | 用 `assertEquals` 替代 `assertNotNull` |
| 方法调用删除 | 未验证副作用 | 用 `verify()` 验证调用 |
| 算术运算替换 | 缺少计算结果验证 | 验证计算结果的精确值 |

### Step 4: 自动清理

```bash
# 删除 PIT 临时配置（使用标记注释定位）
# macOS: sed -i ''，Linux: sed -i
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' '/<!-- 突击检查模式 - 临时添加/,/<!-- 突击检查模式 - 临时添加结束 -->/d' pom.xml
else
  sed -i '/<!-- 突击检查模式 - 临时添加/,/<!-- 突击检查模式 - 临时添加结束 -->/d' pom.xml
fi

# 删除临时报告
rm -rf target/pit-reports/
rm -rf target/pitests/

# 验证清理结果
grep -n "突击检查模式" pom.xml  # 应无输出

# 验证项目正常
mvn clean test-compile -q
```

### Step 5: Pre-commit 防护

防止误提交临时 PIT 配置。在 `.git/hooks/pre-commit` 中添加：

```bash
# 变异测试突击检查 - Pre-commit 防护
if grep -q "突击检查模式 - 临时添加" pom.xml 2>/dev/null; then
    echo "错误: 检测到未清理的变异测试配置！"
    echo "请运行清理命令后再提交"
    exit 1
fi
```

---

## 与 JaCoCo 的配合策略

| 工具 | 用途 | 频率 | 指标 |
|------|------|------|------|
| **JaCoCo** | 日常覆盖率监控 | 每次构建 | 行覆盖率 >= 80% |
| **PIT 突击检查** | 深度质量验证 | 按需/月度 | 变异杀死率 >= 70% |

**最佳实践**：
- 日常：JaCoCo 质量门禁（80%/60%）
- 定期：PIT 突击检查（变异杀死率 >= 70%）
- 发布前：两者结合验证

---

## Executor 集成

### Layer 2.5（可选步骤）

在 Step 3 Layer 2 和 Layer 3 之间，可插入可选的变异测试突击检查：

```
Step 3 验证流程：
  Layer 1: 每任务验证（标准）
  Layer 2: 项目级构建/lint/测试（标准）
  [Layer 2.5]: 变异测试突击检查（可选，仅限用户要求或安全相关变更）
  Layer 3: acceptance.md 全局验证（标准）
```

### 执行条件

Layer 2.5 仅在以下条件**同时满足**时执行：

1. 用户明确要求运行变异测试，**或**任务涉及安全/认证/核心 Service 变更
2. 项目的 Makefile 包含 `mutation-test` target，**或**项目有 `scripts/mutation-spot-check.sh`
3. 前序 Layer（1 和 2）已通过

### 结果处理

| 变异杀死率 | 操作 |
|-----------|------|
| >= 70% | 通过，继续 Layer 3 |
| 50% - 69% | 警告，记录存活变异，继续 Layer 3 |
| < 50% | 记录问题，但不阻塞（变异测试是建议性的） |

> **重要**：变异测试结果**不阻塞**执行流程。它是质量反馈，不是门禁。即使变异杀死率低，也继续 Layer 3 和 Step 4，但在交接给 recorder 时记录变异测试结果。

---

## Spring 项目兼容性

PIT 在 Spring 项目中可能需要额外插件：

| 方案 | 说明 | 推荐度 |
|------|------|--------|
| Arcmutate Spring 插件 | 专为 Spring 设计，需付费 | 推荐（有预算时） |
| 只测试纯 Java 类 | 不依赖 Spring 注入的 Service | 可行 |
| 使用 JaCoCo 为主 + PIT 辅助 | JaCoCo 日常监控 + PIT 按需抽查 | 推荐（当前采用） |

---

## 报告模板

```markdown
# 变异测试突击检查报告

**检查日期**: {date}
**检查对象**: {target_classes}
**执行模式**: {quick/standard}

## 变异测试结果

| 指标 | 数值 | 评级 |
|------|------|------|
| 生成变异数 | {total} | - |
| 杀死变异数 | {killed} | - |
| 存活变异数 | {survived} | {survived > 0 则为"需关注", 否则为"优秀"} |
| **变异杀死率** | **{rate}%** | {rate >= 70 则为"良好", 否则为"需改进"} |
| PIT 行覆盖率 | {coverage}% | {coverage >= 80 则为"优秀", 否则为"需改进"} |

## 存活变异分析

{对每个存活变异的分析}

## 建议

1. {具体建议}
2. {具体建议}

## 状态
已通过突击检查（变异杀死率 {rate}%）
```