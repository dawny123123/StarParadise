# 验证指南

关于自验证循环、失败处理和轨迹捕获的详细指南。

## 验证流水线

按顺序运行检查。如有任何必需检查失败，修复并从该检查重新开始。

```bash
# 完整验证（自动检测项目类型）
python3 scripts/validate.py .

# 仅特定步骤
python3 scripts/validate.py . --steps build lint-arch test

# JSON 输出用于编程使用
python3 scripts/validate.py . --json --output report.json

# 继续处理失败（用于获取完整情况）
python3 scripts/validate.py . --no-stop-on-failure
```

## 检查顺序和原理

**检查 1：构建** —— 代码必须编译/解析。首先修复编译错误 —— 在此之前其他都不重要。

**检查 2：架构 Lint** —— 结构检查器：依赖方向、接口合规性、质量规则。设计良好的 harness lint 器具有代理可操作的错误消息 —— 阅读完整消息，它会告诉你**什么**错了以及**如何**修复。

**检查 3：测试** —— 所有现有测试必须通过。如果你的变更破坏了测试，要么你的变更有 bug（修复它），要么测试需要更新（更新它，但先理解它为什么存在）。

**检查 4：质量评分**（可选）—— 如果有，检查你的变更没有降低质量。

**检查 5：评估任务**（可选）—— 如果项目有覆盖你变更的评估数据集，运行它们。

**检查 6：性能目标**（可选）—— 如果任务有性能要求，用实际测量验证。

## 按语言的命令

始终优先使用 `docs/DEVELOPMENT.md` 中的命令。如果不可用，常用默认值：

| 步骤 | Go | TypeScript | Python |
|------|-----|-----------|--------|
| 构建 | `go build ./...` | `npm run build` | `ruff check .` |
| Lint | `make lint-arch` | `npm run lint:arch` | `python scripts/lint_deps.py src/` |
| 测试 | `go test ./...` | `npm test` | `pytest` |

### 自定义命令

如果项目使用非标准工具（pnpm、yarn、poetry 等），创建 `harness/config/validate.json`：

```json
{
  "steps": [
    {"name": "build", "command": "pnpm build", "required": true, "timeout": 300},
    {"name": "lint-arch", "command": "pnpm lint:arch", "required": true},
    {"name": "test", "command": "pnpm test", "required": true, "timeout": 600}
  ]
}
```

`validate.py` 先读取此文件；硬编码默认值仅作为回退。

## 处理失败

### 3 次重试规则

如果卡在循环中（同一失败 3+ 次迭代）：

1. **重新阅读相关文档** —— 你可能误解了约束
2. **检查已知问题** —— lint/测试本身是否有 bug？
3. **检查情景记忆** —— `harness/memory/episodes/` 可能有类似的过去失败
4. **上报** —— 向用户报告阻塞点以及你已尝试的内容

### 上报信号

| 信号 | 可能原因 | 操作 |
|--------|-------------|--------|
| 同一规则 3+ 次失败 | 误解架构 | 重新阅读 ARCHITECTURE.md |
| 测试先通过然后失败 | 引入了回归 | 仔细对比你的变更 |
| 需求不清晰 | 规格模糊 | 请求澄清 |
| 冲突约束 | 设计张力 | 报告冲突，提出替代方案 |

绝不要默默忽略失败的检查或修改 lint 配置来绕过问题。

## 轨迹捕获

每次验证循环都产生有用的数据。在重大失败或恢复后，记录到情景记忆：

```json
{
  "event": "lint_failure_resolved",
  "timestamp": "2026-03-23T10:30:00Z",
  "details": "Imported core/config from types/ — layer violation",
  "resolution": "Moved config-dependent code to core/",
  "lesson": "Layer 0 cannot import Layer 2"
}
```

这构建机构知识。未来代理可以避免同样的错误。

## 错误恢复模式

**构建失败：** 仔细阅读错误消息。检查是否从错误的层导入。验证函数签名是否匹配接口。

**Lint 失败：** 在设计良好的 harness 中，lint 错误是**指令**。阅读完整消息。常见问题：
- 依赖违规 → 重组导入以尊重层层次结构
- 质量违规 → 使用结构化日志，尊重文件大小限制
- 模板违规 → 检查标签对

如果错误消息没有解释如何修复，那就是 harness 缺口 —— 记录它供 `harness-creator` 稍后处理。

**测试失败：** 阅读测试名称和断言以理解意图。使用详细输出运行特定测试以调试。

---

## 失败记录模板

Step 4：静态验证失败时，在重试前先记录失败到 `harness/trace/failures/`。

```bash
mkdir -p harness/trace/failures
cat >> harness/trace/failures/$(date +%Y-%m-%d).jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","task_id":"$TASK_ID","failure_type":"build_error|lint_violation|test_failure","details":{"file":"<path>","line":<N>,"rule":"<rule-id>","message":"<error message>","attempted_fix":"<what was tried>","fix_succeeded":false}}
EOF
```

记录后：
1. 分析错误输出
2. 返回 Step 3 并带修复指令（再次生成执行器）
3. 最多 2 次重试，然后上报用户

---

## 验证失败记录

Step 5.3：功能验证失败时，记录结构化失败信息。

```bash
mkdir -p harness/trace/failures
cat >> harness/trace/failures/$(date +%Y-%m-%d).jsonl << EOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","task_id":"$TASK_ID","failure_type":"verification_failure","details":{"scenario":"<scenario-name>","expected":"<expected behavior>","actual":"<actual behavior>","attempted_fix":"<what was tried>","fix_succeeded":false}}
EOF
```

---

## 验证跳过报告

Step 5.4：当应用无法启动（无 server、库项目、缺少基础设施）时，写入 skip 报告。

```bash
mkdir -p harness/trace
cat > harness/trace/verification-report.json << 'EOF'
{
  "overall_status": "skip",
  "skip_reason": "[explain why: e.g., 'Library project with no runnable server', 'Missing required database']",
  "server": {"started": false},
  "task_specific_scenarios": [],
  "summary": {"task_specific_total": 0, "task_specific_passed": 0, "pass_rate": 0}
}
EOF
```
