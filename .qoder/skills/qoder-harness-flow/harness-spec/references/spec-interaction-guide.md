# 规格交互指南：多轮交互式需求规格生成

本文档为 harness-spec 提供详细的交互指南，按 artifact 组织交互轮次，使用 AskUserQuestion 推荐方案+确认模式。

## 核心原则

1. **AI 是需求工程师，不是提问机器**: 先给完整推荐方案，再让用户确认
2. **先分析后推荐**: 阅读代码、分析依赖、识别风险，然后带着你的理解给方案
3. **有限轮次**: 按任务复杂度分配轮次，不超过 4 轮
4. **渐进式深入**: spec.md → tasks → acceptance

## 交互策略

### 按复杂度分配轮次

| 复杂度 | 轮次 | 交互内容 |
|--------|------|---------|
| Trivial | 1 轮 | spec.md + tasks 合并确认 |
| Standard | 2 轮 | spec.md → tasks + acceptance |
| Complex | 2-3 轮 | spec.md → tasks → acceptance 逐个确认 |

---

## Round 0: 自动分析（所有任务，无交互）

**目的**: 在第一次向用户提问前，先完成代码分析和 memory 查询。

### 分析步骤

1. 读取 episodic memory（7天内）和 knowledge 层
2. 追踪代码 import（1 级）
3. 识别影响范围、风险、未知项
4. 输出 **Code Analysis Report**

### Code Analysis Report 格式

```markdown
## Code Analysis Report

### Dependency Map
| Component | Depends On | Depended By |
|-----------|-----------|-------------|
| [file/module] | [upstream] | [downstream] |

### Impact Radius
- **Direct**: [直接修改的文件]
- **Indirect**: [接口/类型变更波及的文件]

### Cross-Cutting Concerns
- [ ] Error handling patterns consistent?
- [ ] Logging/observability affected?
- [ ] Configuration changes needed?
- [ ] Database migrations required?
- [ ] API contract changes (breaking/non-breaking)?

### Unknowns & Risks
- [unknown 1]: needs user input to resolve
- [risk 1]: [description] → proposed mitigation: [approach]
```

### 分析深度规则

| 复杂度 | 分析深度 | Dependency Map | 时间上限 |
|--------|---------|----------------|---------|
| Trivial | 直接文件 + 1 级导入 | 1-2 行 | <1 min |
| Standard | 受影响模块 + 跨层边界 | 完整 | <3 min |
| Complex | 全链路依赖 + 循环检测 | 完整 + 间接影响 | <5 min |

---

## Round 1: Spec 确认

**目的**: 展示推荐的需求定义与技术方案，让用户确认或调整。

### AskUserQuestion 模板

```json
{
  "question": "Based on code analysis, here's my recommended spec for this task:\n\n**Background**: [why]\n**Goals**: [measurable goals]\n**Scope**: [in-scope] / [out-of-scope]\n**Technical Approach**: [core implementation approach]\n**Dependency Graph**: [component dependencies]\n**Risks**: [identified risks]\n\nDo you agree with this spec definition?",
  "header": "Spec",
  "multiSelect": false,
  "options": [
    {"label": "Adopt recommended (Recommended)", "description": "Spec definition is correct, proceed to tasks"},
    {"label": "Fine-tune", "description": "Minor adjustments needed, I'll specify changes"},
    {"label": "Re-analyze", "description": "Fundamentally wrong, re-read code and try again"}
  ]
}
```

### 处理规则

| 用户选择 | 操作 |
|---------|------|
| **Adopt recommended** | 写入 spec.md，进入下一轮 |
| **Fine-tune** | 等待用户输入修改意见，修改后写入 spec.md |
| **Re-analyze** | 重新执行 Round 0 代码分析，重新给出推荐 |
| **Other** | 用户自由输入，据此调整后写入 spec.md |

> **Trivial 任务**：Round 1 同时展示 spec.md + tasks 的推荐，合并确认后直接写入 spec.md + tasks.md + acceptance.md，跳到最终审批。

---

## Round 2: Tasks + Acceptance 确认

**目的**: 展示推荐的任务列表和验收标准。

### AskUserQuestion 模板

```json
{
  "question": "Based on the approved spec, here's my recommended task plan:\n\n**Tasks**: [N items with checkbox, Location/Problem/After/Reason]\n**Execution order**: [sequence]\n\nAnd the corresponding acceptance criteria with SHALL constraints.\n\nDo you agree with this task plan and acceptance criteria?",
  "header": "Tasks",
  "multiSelect": false,
  "options": [
    {"label": "Adopt recommended (Recommended)", "description": "Tasks and acceptance criteria are correct"},
    {"label": "Fine-tune", "description": "Adjust task scope, ordering, or acceptance criteria"},
    {"label": "Re-analyze", "description": "Task approach is wrong, rethink"}
  ]
}
```

### 处理规则

| 用户选择 | 操作 |
|---------|------|
| **Adopt recommended** | 写入 tasks.md + acceptance.md，进入最终审批 |
| **Fine-tune** | 等待用户输入，修改后写入 |
| **Re-analyze** | 重新分析代码，重新给出推荐方案 |
| **Other** | 用户自由输入，据此调整 |

> **Standard 任务**：Round 2 同时展示 tasks + acceptance，合并确认后写入两个文件。
> **Complex 任务**：Round 2 仅确认 tasks，acceptance 在 Round 3 单独确认。

---

## Round 3: Acceptance 确认（Complex 任务）

**目的**: 展示推荐的验收标准。

### AskUserQuestion 模板

```json
{
  "question": "Here are the acceptance criteria for each task:\n\n[per-task verification commands + expected output + edge cases]\n\nPlus global verification: build, regression, functional scenarios.\n\nDo you agree with these acceptance criteria?",
  "header": "Acceptance",
  "multiSelect": false,
  "options": [
    {"label": "Adopt recommended (Recommended)", "description": "Acceptance criteria are comprehensive enough"},
    {"label": "Fine-tune", "description": "Add/remove/modify specific criteria"},
    {"label": "Stricter coverage", "description": "Need more edge cases and error scenarios"}
  ]
}
```

---

## Round 4: 最终审批（所有任务）

**目的**: 三个 artifact 全部就绪后，最终确认。

### AskUserQuestion 模板

```json
{
  "question": "All 3 spec artifacts are ready:\n- spec.md ✓\n- tasks.md ([N] tasks) ✓\n- acceptance.md ✓\n\nReady to initialize task and start execution?",
  "header": "Spec",
  "multiSelect": false,
  "options": [
    {"label": "Approve & Execute (Recommended)", "description": "Spec is complete, init TASK_ID and handoff to executor"},
    {"label": "Review changes", "description": "I want to review specific artifact details first"},
    {"label": "Reject", "description": "Rethink the approach entirely"}
  ]
}
```

### 处理规则

| 用户选择 | 操作 |
|---------|------|
| **Approve & Execute** | 调用 `task_state.py init`，输出 TASK_ID，衔接 executor |
| **Review changes** | 展示用户指定的 artifact 详情，修改后重新审批 |
| **Reject** | 返回 Round 1，重新执行需求分析 |
| **Other** | 用户自由输入修改意见 |

---

## 退出条件

交互必须满足以下条件之一才能退出：

| 退出条件 | 说明 |
|---------|------|
| 用户 Approve 最终审批 | 所有 artifact 已确认 |
| 用户明确表示 "就这样，开始做" | 用户的主动停止信号 |
| 达到轮次上限 | Trivial: 1轮, Standard: 2轮, Complex: 3轮 |

> **轮次上限退出规则**：未澄清的 unknowns 必须记录到 spec.md 的 Risk 表格中，不可忽略。

---

## 纯文本降级模板

**If AskUserQuestion is NOT available:**

```markdown
## Spec Review: [artifact name]

### Recommended Approach
[展示推荐方案]

### Options
1. **Adopt** — proceed with this approach
2. **Fine-tune** — specify modifications: [your changes]
3. **Re-analyze** — rethink from scratch

Please respond with your choice.
```

---

## 质量检查

每个推荐方案展示前，自检：

| 检查项 | 标准 |
|--------|------|
| 具体性 | 方案是否具体到文件和函数级别？ |
| 可操作性 | 另一个开发者能按此方案直接执行吗？ |
| 完整性 | 是否覆盖了所有已识别的 unknowns？ |
| 有推荐 | 是否明确标注了推荐选项？ |
| 无 Placeholder | 方案中无 TBD/TODO/待定？ |
