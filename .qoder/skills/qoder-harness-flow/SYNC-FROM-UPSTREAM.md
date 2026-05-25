# 从 Fork 来源更新代码指南

本文档说明如何从上游仓库（fork 来源）同步最新代码到当前仓库。

## 背景信息

- **当前仓库**: `git@gitlab.alibaba-inc.com:dbpaas/qoder-harness-flow.git`
- **上游仓库 (Fork 来源)**: `http://gitlab.alibaba-inc.com/qoder-open/qoder-harness-flow.git`

## 入库范围策略（重要）

本仓库**只入库 Skill 源码**（`harness-*/` 各 Skill 目录、`tests/`、`README.md`、`SYNC-FROM-UPSTREAM.md`、`FORK-DIFF-REPORT.md`、`.gitignore`）。

以下路径均为 **Agent 自动生成的实例化产物，不入库**，由 [harness-creator](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/harness-creator) 在目标项目按需重新生成：

| 路径 | 性质 | 重新生成方式 |
|------|------|--------------|
| `harness/` | 运行时数据（环境配置、记忆、任务状态、trace） | `Skill("harness-creator")` 初始化 |
| `scripts/` | 项目级 linter / 验证脚本 | Creator Phase 4 `fill-linters` |
| `docs/` | 项目实例文档（ARCHITECTURE/DEVELOPMENT/TESTING/OPERATIONS/...） | Creator Phase 4 `fill-documentation` |
| `AGENTS.md` | AI 代理导航地图 | Creator Phase 4 `fill-documentation` |
| `Makefile` | 构建自动化 | Creator Phase 4 `fill-harness-config` |

### 设计原则

1. **fork 仓库纯粹只含 Skill 源码**：所有改造价值通过 `harness-creator/references/` 模板源头沉淀，任何人 fork 后即可通过 Skill 自动产出本 fork 增强后的项目骨架。
2. **实例化产物不污染上游同步**：避免上游合并时产生大量与 Skill 源码无关的冲突。
3. **本地工作区可保留**：`git rm --cached` 仅从索引移除，工作区文件保留供本地开发参考；新克隆者按需通过 `Skill("harness-creator")` 重新生成。
4. **更新方式**：若需修改这些产物，应改 `harness-creator/references/` 模板源头，让所有 fork 共享。

### 已从索引移除的文件

2026-05-15 一次性清理（`git rm --cached`，工作区保留）：

```
AGENTS.md
Makefile
docs/{ARCHITECTURE,COMPATIBILITY,DEVELOPMENT,ERRORS,OBSERVABILITY,PERFORMANCE,PRODUCT_SENSE}.md
harness/config/project.json
scripts/lint-{markdown,python,structure}.py
```

## 前置准备

### 1. 查看当前远程仓库配置

```bash
git remote -v
```

应该只看到 `origin` 远程仓库。

### 2. 添加上游仓库 (upstream)

首次需要同步时，需要添加上游仓库：

```bash
git remote add upstream git@gitlab.alibaba-inc.com:qoder-open/qoder-harness-flow.git
```

> **注意**: 使用 SSH 格式而不是 HTTP 格式，这样可以避免每次都需要输入认证信息。

### 3. 验证远程仓库配置

```bash
git remote -v
```

现在应该看到：
- `origin`: 当前仓库 (dbpaas/qoder-harness-flow)
- `upstream`: 上游仓库 (qoder-open/qoder-harness-flow)

## 同步代码流程

### 方法一：Merge 方式（推荐，保留完整历史）

#### 1. 获取上游最新代码

```bash
git fetch upstream
```

#### 2. 切换到主分支

```bash
git checkout main
```

#### 3. 合并上游变更

```bash
git merge upstream/main
```

#### 4. 解决冲突（如果有）

如果合并时出现冲突：

```bash
# 查看冲突文件
git status

# 手动编辑冲突文件，解决冲突标记
# <<<<<<< HEAD
# 当前代码
# =======
# 上游代码
# >>>>>>> upstream/main

# 标记已解决
git add <冲突文件>

# 完成合并
git commit
```

#### 5. 推送到当前仓库

```bash
git push origin main
```

### 方法二：Rebase 方式（保持线性历史）

#### 1. 获取上游最新代码

```bash
git fetch upstream
```

#### 2. 切换到主分支

```bash
git checkout main
```

#### 3. 变基到上游分支

```bash
git rebase upstream/main
```

#### 4. 解决冲突（如果有）

```bash
# 查看冲突文件
git status

# 手动编辑冲突文件

# 标记已解决并继续
git add <冲突文件>
git rebase --continue
```

#### 5. 强制推送到当前仓库

```bash
git push origin main --force-with-lease
```

> **警告**: `--force-with-lease` 比 `--force` 更安全，会检查远程分支是否有其他人的提交。

## 常见场景

### 场景 1: 定期同步（保持最新）

建议定期执行同步操作：

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### 场景 2: 同步特定分支

如果要同步其他分支（如 `develop`）：

```bash
git fetch upstream
git checkout develop
git merge upstream/develop
git push origin develop
```

### 场景 3: 查看上游有哪些更新

```bash
# 获取最新信息
git fetch upstream

# 查看上游有新提交
git log main..upstream/main --oneline

# 查看具体变更
git diff main..upstream/main
```

### 场景 4: 丢弃本地修改，完全使用上游代码

⚠️ **警告**: 这会丢失所有本地提交！

```bash
git fetch upstream
git checkout main
git reset --hard upstream/main
git push origin main --force-with-lease
```

## 自动化脚本

可以创建一个脚本来简化同步流程：

```bash
#!/bin/bash
# sync-from-upstream.sh

echo "=== 从上游仓库同步代码 ==="

# 获取上游最新代码
echo "1. 获取上游最新代码..."
git fetch upstream

# 切换到主分支
echo "2. 切换到 main 分支..."
git checkout main

# 合并上游变更
echo "3. 合并 upstream/main..."
git merge upstream/main

if [ $? -eq 0 ]; then
    echo "4. 推送到 origin..."
    git push origin main
    echo "✅ 同步完成！"
else
    echo "❌ 合并冲突，请手动解决后执行："
    echo "   git add <冲突文件>"
    echo "   git commit"
    echo "   git push origin main"
fi
```

使用方法：

```bash
chmod +x sync-from-upstream.sh
./sync-from-upstream.sh
```

## 最佳实践

1. **同步前提交本地修改**: 确保本地工作区是干净的
   ```bash
   git status
   git add .
   git commit -m "保存本地修改"
   ```

2. **定期同步**: 建议每周或在上游有重要更新时同步

3. **使用 Merge 而非 Rebase**: 除非你了解 rebase 的影响，否则使用 merge 更安全

4. **保持分支策略**: 
   - 在 `main` 分支上只做同步操作
   - 在特性分支上进行开发

5. **检查同步结果**: 同步后运行测试确保没有破坏现有功能
   ```bash
   # 如果有测试的话
   make test
   # 或者
   npm test
   ```

## 故障排查

### 问题 1: 权限错误

```
fatal: unable to access 'git@gitlab.alibaba-inc.com:qoder-open/qoder-harness-flow.git': 
Permission denied (publickey).
```

**解决方案**:
- 确保已配置 SSH key: `ssh-keygen -t rsa -b 4096`
- 将公钥添加到 GitLab: `cat ~/.ssh/id_rsa.pub`

### 问题 2: 大量冲突

**解决方案**:
- 评估是否可以丢弃本地修改
- 与团队成员沟通，确认本地修改的必要性
- 考虑是否可以 rebase 而不是 merge

### 问题 3: 同步后代码不工作

**解决方案**:
```bash
# 回退到同步前
git log --oneline  # 找到同步前的提交
git reset --hard <commit-hash>
git push origin main --force-with-lease
```

## 相关资源

- [Git 官方文档 - Configuring a remote for a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/configuring-a-remote-for-a-fork)
- [Git 官方文档 - Syncing a fork](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
- [GitLab Fork 工作流指南](https://docs.gitlab.com/ee/topics/gitlab_flow.html)

## 维护记录

| 日期 | 操作 | 说明 |
|------|------|------|
| 2026-05-05 | 初始创建 | 创建同步指南文档 |
| 2026-05-15 | 入库范围治理 | 把 `harness/`、`scripts/`、`docs/`、`AGENTS.md`、`Makefile` 列为 Agent 生成产物不入库；新增 [FORK-DIFF-REPORT.md](file:///Users/suipengfei/IdeaProjects/qoder-harness-flow/FORK-DIFF-REPORT.md) |
