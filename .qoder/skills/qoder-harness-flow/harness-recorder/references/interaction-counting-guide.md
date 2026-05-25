# 交互计数指南

本文档定义 harness-recorder Step 2 中交互计数的规则、信号词表和模板。

## 核心规则

1. **逐条列举，禁止估算**: 每个 interaction 事件必须附 turn 编号和用户原话摘要
2. **全会话扫描**: 包括 spec 阶段、executor 阶段的所有用户消息
3. **不合并**: 用户在 turn 5 和 turn 8 分别提出修改 = 2 次，不是 1 次
4. **零也要写**: 所有 5 个字段都必须输出，值为 0 时标注 "(none)"

---

## 信号词表

### corrections（用户纠正）

用户指出 agent 的做法有误，要求改正。

| 信号词 | 语言 | 示例 |
|--------|------|------|
| "不对" | zh | "不对，应该用 BatchUpdate 而不是单条更新" |
| "改一下" | zh | "这里改一下，不要用 if-else" |
| "这样写不对" | zh | "这样写不对，在每个类里面抽取自己的公共方法就可以了" |
| "不要" | zh | "不要删这个文件" |
| "少写" | zh | "少写了一个参数" |
| "不能超过" | zh | "这个值不能超过 100" |
| "should be" | en | "should be async, not sync" |
| "wrong" | en | "That's wrong, use the other method" |
| "instead" | en | "Use X instead of Y" |

### interruptions（用户中断）

用户在 subagent 运行中发消息，或执行日志出现 "Interrupted"。

| 信号 | 示例 |
|------|------|
| 用户在 subagent 执行中发消息 | 用户在代码生成过程中说 "等一下" |
| "等一下" / "先看看" | "等一下，让我先看看当前的改动" |
| 执行日志 "Interrupted" | Subagent execution log shows "Interrupted" |

### takeovers（用户接管）

用户放弃 agent 的方式，自己动手修改。

| 信号 | 示例 |
|------|------|
| "算了我自己来" | "算了我自己来改这个文件" |
| 用户直接编辑文件 | `git diff` 显示 agent 未修改的文件有改动 |
| 用户运行命令修复 | 用户自己跑 `sed` 或手动修改 |

### plan_revisions（计划/规格修订）

spec 或 plan 在用户反馈后被修改。

| 信号 | 示例 |
|------|------|
| 用户要求增加/删除 task | "添加扫描批量插入的功能" |
| 用户要求修改方案 | "性能问题也考虑进去" |
| spec artifact 被重写 | requirement.md 被用户否决后重写 |

> **注意**: 每次用户的独立请求算一次。"添加 A" 和 "再加上 B" 如果在不同 turn 里 = 2 次。

### retries（重试）

Task N 失败后被重新 spawn。

| 信号 | 示例 |
|------|------|
| executor subagent 返回 failed | Task 2 executor failed, re-spawned |
| Layer 1 验证失败后重试 | build 失败，重新 spawn executor 修复 |

---

## 输出模板

```
Interaction review:
- corrections: <N>
  - [turn X] user said "不对，应该用xxx" → 1
  - [turn Y] user said "这样写不对" → 1
- interruptions: <N>
  - (none)
- takeovers: <N>
  - (none)
- plan_revisions: <N>
  - [turn X] user said "添加扫描批量插入" → spec updated → 1
  - [turn Y] user said "性能问题也考虑" → spec updated again → 1
- retries: <N>
  - [Task 2] executor failed, re-spawned with error context → 1
```

---

## WRONG / CORRECT 示例

### 示例 1: Plan Revisions 合并错误

**场景**: 用户在 turn 5 说 "加一个批量扫描"，在 turn 8 说 "还要考虑性能"

> ⛔ **WRONG**:
> ```
> - plan_revisions: 1
>   - user requested changes to plan → 1
> ```

> **CORRECT**:
> ```
> - plan_revisions: 2
>   - [turn 5] user said "加一个批量扫描" → spec updated → 1
>   - [turn 8] user said "还要考虑性能" → spec updated again → 1
> ```

### 示例 2: 零值省略错误

> ⛔ **WRONG**:
> ```
> Interaction review:
> - corrections: 1
>   - [turn 3] user said "不对" → 1
> ```
> （省略了其他 4 个字段）

> **CORRECT**:
> ```
> Interaction review:
> - corrections: 1
>   - [turn 3] user said "不对" → 1
> - interruptions: 0
>   - (none)
> - takeovers: 0
>   - (none)
> - plan_revisions: 0
>   - (none)
> - retries: 0
>   - (none)
> ```

### 示例 3: 估算而非列举

> ⛔ **WRONG**:
> ```
> - corrections: 2 (approximately)
> ```

> **CORRECT**:
> ```
> - corrections: 2
>   - [turn 3] user said "不对，应该用 async" → 1
>   - [turn 7] user said "这里少了一个参数" → 1
> ```

---

## 与 task_state.py 的对接

计数完成后，构造 `--interaction` JSON 传给 `task_state.py`:

```bash
--interaction '{"corrections": 2, "interruptions": 0, "takeovers": 0, "plan_revisions": 1, "retries": 0}'
```

> `--interaction` 是 `required=True` 参数，缺失直接报错退出。JSON 解析失败也是硬报错。
