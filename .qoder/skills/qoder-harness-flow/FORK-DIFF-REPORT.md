# Fork 差异对比报告

> **生成时间**：2026-05-15
> **当前仓库**：`gitlab.alibaba-inc.com:dbpaas/qoder-harness-flow.git`
> **上游仓库**：`http://gitlab.alibaba-inc.com/qoder-open/qoder-harness-flow.git`
> **比较基准**：`upstream/main` (merge-base `ae553b9`) → `origin/main` (HEAD `e8f0967`)

> **说明**：本仓库的 `harness/`、`scripts/`、`docs/`、`AGENTS.md`、`Makefile` 均为 Agent 生成的实例化产物，**不入库**，由 [harness-creator](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-creator) 在目标项目按需重新生成。本报告仅记录 **入库的 Skill 源码** 相对上游的差异。详见 [SYNC-FROM-UPSTREAM.md §不入库策略](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/SYNC-FROM-UPSTREAM.md)。

---

## 1. 总体概览

| 指标 | 数值 |
|------|------|
| 领先上游提交数 | **8** |
| 落后上游提交数 | 0 |
| 入库源码改造时间跨度 | 2026-05-05 ~ 2026-05-12 |

### 提交时间线

| 提交哈希 | 日期 | 主题 |
|----------|------|------|
| `0ad88e1` | 2026-05-05 | feat: CDD 模式适配 + lessons 质量校验 + 自动模式检测 |
| `87c2000` | 2026-05-07 | fix(doctor): P0 scaffold 只创建缺失文件 |
| `d5574f3` | 2026-05-08 | feat: scaffold 中文化与文档增强 |
| `33f98f7` | 2026-05-09 | refactor: 提取 Agent 模板、移除 SKILL.md Troubleshooting |
| `b7d8994` | 2026-05-09 | 增加 harness-spec 引导 |
| `229776d` | 2026-05-11 | i18n: 六个 Skill 说明文本和标题中文化 |
| `c6b37d8` | 2026-05-11 | feat: 新增 harness-upgrader Skill |
| `e8f0967` | 2026-05-12 | web 增强（六大 Web 应用验证能力） |

---

## 2. 核心改造主题

### 2.1 架构演进 — Skill 体系扩展

| 改造项 | 类型 | 说明 |
|--------|------|------|
| 新增 [harness-upgrader](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-upgrader) | 新 Skill | 支持已安装项目的版本升级 |
| 强化 [harness-spec](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-spec) | 子代理拆分 | 新增 `code-analyzer.md`、`memory-recall.md` |
| 强化 [harness-recorder](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-recorder) | 子代理拆分 | 新增 `interaction-counter.md`、`lesson-extractor.md` 与 `lesson_extractor.py` |
| 强化 [harness-doctor](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-doctor) | 子代理拆分 | 新增 `architecture-analyzer.md`、`component-analyzer.md`、`environment-analyzer.md` |
| [harness-executor](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor) 模板化 | 重构 | 新增 `agents/templates/`（executor-core / verifier-core）+ `agents/mixins/`（cli-testing / db-verification / server-testing） |

### 2.2 Web 应用能力增强（commit `e8f0967`）

参考 dukang-ai-service 实践，通过**条件激活**机制对 Web 项目补齐 6 项验证能力，非 Web 项目零影响。

| # | 能力 | 集成位置 | 关键文件（新增） |
|---|------|----------|------------------|
| 1 | Web 应用检测 | Creator Phase 4 | [harness-creator/references/web-app-detection-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-creator/references/web-app-detection-guide.md) |
| 2 | DDL/Entity 一致性 | Executor Step 3 Layer 2 | [harness-executor/references/ddl-consistency-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor/references/ddl-consistency-guide.md) |
| 3 | 编码规范检查 | Executor Step 3 Layer 2 | [harness-executor/references/code-convention-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor/references/code-convention-guide.md) |
| 4 | 变异测试突击 | Executor Step 3 Layer 2.5 | [harness-executor/references/mutation-test-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor/references/mutation-test-guide.md) |
| 5 | API 接口测试 | Executor Step 4 | [harness-executor/references/api-test-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor/references/api-test-guide.md) |
| 6 | 提交前自检 | Executor Step 3.5 | [harness-executor/references/self-review-guide.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-executor/references/self-review-guide.md) |

### 2.3 Scaffold 中文化与安全加固（commit `d5574f3` + `87c2000`）

| 主题 | 改动 |
|------|------|
| 模板级中文化 | `scaffold-template.md`、`create-scaffold.sh`、`documentation-templates.md` 全部中文化，新项目默认产出中文骨架 |
| 必需文档升级 | `TESTING.md` / `OPERATIONS.md` 从可选提升为必需 scaffold 文件 |
| Doctor 安全 | `create-scaffold.sh` 新增 `--missing-only`，P0 阶段只补缺失文件不覆盖 |
| AGENTS.md 模板增强 | 模板新增 Harness Skills 速查表 + `environment.json` 完整骨架（含 `skills` + `functional_scenarios` 字段） |
| 六个 Skill i18n | 所有 SKILL.md 说明文本和标题全部中文化（commit `229776d`） |

### 2.4 工程治理（入库部分）

| 主题 | 改动 |
|------|------|
| CDD 默认模式 | 项目默认触发模式从 SDD 改为 CDD，自动模式检测 |
| Lessons 质量校验 | `task_state.py` 通过 `exit 1` 硬性门禁；recorder/executor/spec 三处副本必须同步 |
| Agent 模板提取 | 移除 SKILL.md 中冗余 Troubleshooting，提取到独立 references |
| 测试 | 新增 `tests/test_lesson_extractor.py`、`tests/test_task_state.py` |

---

## 3. 入库源码变更范围

### 3.1 新增 Skill 源码文件

| 类别 | 文件 |
|------|------|
| 新 Skill | `harness-upgrader/SKILL.md`、`harness-upgrader/scripts/deploy.sh` |
| Doctor 子代理 | `harness-doctor/agents/{architecture-analyzer,component-analyzer,environment-analyzer}.md` |
| Recorder 子代理 + 脚本 | `harness-recorder/agents/{interaction-counter,lesson-extractor}.md`、`harness-recorder/scripts/lesson_extractor.py` |
| Spec 子代理 | `harness-spec/agents/{code-analyzer,memory-recall}.md` |
| Creator 参考 | `harness-creator/references/web-app-detection-guide.md` |
| Executor 参考（Web 增强） | `harness-executor/references/{api-test-guide,code-convention-guide,ddl-consistency-guide,mutation-test-guide,self-review-guide}.md` |
| 测试 | `tests/test_lesson_extractor.py`、`tests/test_task_state.py` |
| 同步指南 | `SYNC-FROM-UPSTREAM.md`、`FORK-DIFF-REPORT.md`（本文件）|

### 3.2 重大修改（按 Skill 归类）

- **harness-creator**：`SKILL.md`、`scaffold-template.md`、`documentation-templates.md`、`create-scaffold.sh`、`creator-config.md`、`creator-docs.md`、`adapters/java.md` 等
- **harness-doctor**：`SKILL.md`（拆分子代理）、`audit-checklist.md`、`gc-templates.md`
- **harness-executor**：`SKILL.md`（Step 3/4 增加 Web 条件检查）、`agents/{templates,mixins}/*`、`verifier.md`、`verification-guide.md`、`task_state.py`
- **harness-recorder**、**harness-spec**：`SKILL.md` 重写、`task_state.py` 同步副本
- **harness-evolver**：`SKILL.md` 适配 recorder 拆分

> 完整文件级 diff 请运行 §5 中的命令查看。

---

## 4. 上游合并冲突预案

| 冲突文件 | 本 fork 改动 | 处理策略 |
|----------|-------------|---------|
| `harness-executor/SKILL.md` | Step 3/4 增加 Web 应用条件检查 | **保留本 fork** |
| `harness-creator/references/scaffold-template.md` | 中文化 + Web 条件文件 + Makefile target | **保留本 fork** |
| `harness-creator/references/adapters/java.md` | 新增 web_app_detection YAML 配置 | **保留本 fork** |
| `harness-creator/agents/creator-config.md` | 新增 Web 应用增强配置章节 | **保留本 fork** |
| `harness-creator/scripts/create-scaffold.sh` | 新增 `--missing-only`、中文骨架 | **保留本 fork** |
| `harness-doctor/SKILL.md` | P0 改用 `--missing-only`、子代理拆分 | **保留本 fork** |
| `harness-creator/agents/creator-docs.md` | 新增 TESTING/OPERATIONS 填充指令 | **保留本 fork** |
| `harness-*/scripts/task_state.py` | 三处副本同步修改 | **保留本 fork**（注意三处同步） |

---

## 5. 关键设计决策

1. **最小改动 SKILL.md 行为骨架**：增强主要落在 `references/` 与 `agents/` 模板，保证上游 SKILL.md 行为变更可低冲突合并。
2. **条件激活非 Web 零影响**：Web 应用增强通过 `web-app-detection.json` 的 `is_web_app` 字段激活；Makefile target 用 `if [ -f scripts/xxx.sh ]` 守护。
3. **变异测试不阻塞流程**：Layer 2.5 为建议性步骤，结果不阻塞执行。
4. **新增 vs 历史违规隔离**：编码规范检查通过 `git stash` 隔离，仅阻塞新增违规。
5. **模板级中文化优先于实例级**：所有中文化改动落在 scaffold 模板源头，新项目默认产出中文骨架。
6. **Agent 生成产物不入库**：本仓库的 `harness/`、`scripts/`、`docs/`、`AGENTS.md`、`Makefile` 是 Skill 的输出产物，由 harness-creator 在目标项目重新生成；保证 fork 仓库纯粹只含 Skill 源码，便于上游同步。
7. **`task_state.py` 三处副本必须同步**：分散在 recorder/executor/spec 三个 Skill 目录，修改后三处必须同步。

---

## 6. 复现命令

```bash
# 配置上游
git remote add upstream http://gitlab.alibaba-inc.com/qoder-open/qoder-harness-flow.git
git fetch upstream main

# 查看本报告对应的差异
git log upstream/main..HEAD --oneline
git diff upstream/main..HEAD --stat
git diff upstream/main..HEAD --name-status

# 仅看入库源码（排除 .gitignore 中的 Agent 生成产物）
git diff upstream/main..HEAD -- 'harness-*/' 'tests/' README.md SYNC-FROM-UPSTREAM.md FORK-DIFF-REPORT.md
```

---

## 7. 维护说明

- 每次大规模改造合并入 `main` 后，应在本报告 §1「提交时间线」与 §2「核心改造主题」追加条目。
- 同步上游前先阅读 [SYNC-FROM-UPSTREAM.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/SYNC-FROM-UPSTREAM.md) 与本报告 §4 冲突预案。
- 项目实例化产物（`docs/`、`scripts/`、`harness/`、`AGENTS.md`、`Makefile`）若需更新，应通过修改 `harness-creator/references/` 模板源头实现，由目标项目重新运行 harness-creator 产出。
