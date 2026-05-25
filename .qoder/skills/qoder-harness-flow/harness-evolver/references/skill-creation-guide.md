# Skill 创建规范

> 本文档供 evolver Nudge 步骤使用，指导 agent 从执行经验中创建合格的 Skill。
> **自包含** — 不依赖任何外部 Skill 或工具。

## 1. Skill 目录结构

```
<skill-name>/
├── SKILL.md          # 必需：指令正文
├── scripts/          # 可选：可执行脚本（Python/Bash）
├── references/       # 可选：按需加载的参考文档
└── assets/           # 可选：模板、配置等静态资源
```

放置位置：`harness/drafts/skills/<skill-name>/`（草稿，需人工 review 后激活）

## 2. SKILL.md 格式

### 2.1 YAML Frontmatter（必需）

```yaml
---
name: batch-optimization
description: "指导批量数据库操作的最佳实践，包括分片策略、伪批量检测和MyBatis批量写法"
---
```

规则：
- `name`：小写字母+数字+连字符，不超过 64 字符
- `description`：不含尖括号，不超过 1024 字符
- 正文用中文，`name` 字段用英文

### 2.2 正文结构

采用**工作流模式**（最常用）：

```markdown
# <Skill 名称>

## 适用场景

描述什么时候应该使用此 Skill（触发条件）。

## 变量

| 变量 | 含义 | 来源 |
|------|------|------|
| `$PROJECT_ROOT` | 项目根目录 | 环境 |
| `$SKILL_DIR` | 本 Skill 目录 | 环境 |

## 执行流程

### Step 1: <步骤名>

具体指令...

### Step 2: <步骤名>

具体指令...

## 验证标准

如何判断 Skill 执行成功。

## 常见陷阱

从 lessons 中提炼的注意事项。
```

## 3. 内容编写原则

### 3.1 只写 agent 不知道的

- **写**：项目特定的约定、踩过的坑、具体的技术决策
- **不写**：通用编程知识（如"什么是批量操作"）

### 3.2 可执行 > 描述性

差的写法：
> 批量操作要注意分片

好的写法：
> 批量操作 MUST 使用 `BATCH_SIZE=500` 分片，避免 SQL 超长。示例：
> ```java
> Lists.partition(items, 500).forEach(batch -> mapper.insertBatch(batch));
> ```

### 3.3 从 lessons 提炼为规则

原始 lesson：
> "伪批量问题本质是循环调用单条insert/update"

提炼为 Skill 规则：
> **伪批量检测**：在修改 Service 层代码前，检查是否存在 for 循环内调用单条 insert/update 的模式。
> 如果存在，MUST 改为调用 Mapper 的 `insertBatch` / `updateBatch` 方法。

### 3.4 精简控制

- SKILL.md 正文 **≤ 300 行**（上下文是公共资源）
- 详细内容放 `references/` 按需加载
- 代码示例只放关键片段，不放完整文件

## 4. 从经验数据到 Skill 的转换步骤

输入：`skill_nudge.py context` 输出的 `skill_context`

```
skill_context:
  name: "batch-optimization"
  pattern: "批量操作优化"
  sample_tasks: [...]
  lessons: [...]
  failure_reasons: [...]
```

转换流程：

1. **归纳模式**：从 sample_tasks 提炼出通用的任务模式（去掉具体类名/文件名）
2. **提炼规则**：将每条 lesson 转为可执行的规则（见 3.3）
3. **编排步骤**：按执行顺序组织规则为 Step 1/2/3...
4. **补充陷阱**：从 failure_reasons 提炼常见错误
5. **定义验证**：怎么判断 Skill 执行成功
6. **写入文件**：创建 `harness/drafts/skills/<name>/SKILL.md`

## 5. 质量检查清单

写完后自查：

- [ ] frontmatter 包含 name 和 description
- [ ] name 符合 hyphen-case 格式
- [ ] 有明确的适用场景（什么时候触发）
- [ ] 每个 Step 有具体的可执行指令（不是 TODO）
- [ ] lessons 已转为规则，不是原样照搬
- [ ] 正文 ≤ 300 行
- [ ] 有验证标准
- [ ] 不包含通用知识，只有项目特定经验
