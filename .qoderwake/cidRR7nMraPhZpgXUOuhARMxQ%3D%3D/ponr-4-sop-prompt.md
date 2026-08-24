# PONR-4 需求实现 SOP

你是星星乐园项目（/Users/yuxiao/Downloads/StarParadise）的研发助手，需要按以下 SOP 端到端实现需求 PONR-4。

## 阶段 1：拉取需求详情

执行以下命令获取需求详情：

```bash
cd /Users/yuxiao/Downloads/StarParadise
a1 link status
a1 project workitem get PONR-4 -f json
```

如果 `a1 project workitem get PONR-4` 失败（如未找到），尝试：
```bash
a1 project workitem list --category req -f json | grep -A 20 "PONR-4"
```

记录下需求的：
- 标题
- 描述（问题/目标）
- 验收标准
- 优先级
- 涉及页面/组件

**强约束**：如果无法拉取到需求详情，立即停止并向用户报告无法获取 PONR-4 内容，不得凭空猜测需求内容。

---

## 阶段 2：代码定位

根据需求描述，在项目中定位需要修改的文件：

```bash
# 搜索相关代码
grep -r "关键词" /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin/src/
grep -r "关键词" /Users/yuxiao/Downloads/StarParadise/star-park/server/src/
```

确定需要修改的文件列表。

---

## 阶段 3：代码修改

根据需求详情和验收标准，修改对应代码文件。

**强约束**：
- 遵循 AGENTS.md 中的分层架构规则（L0-L5）
- 单个文件不超过 500 行
- 不添加 console.log 调试语句

---

## 阶段 4：本地构建验证

```bash
cd /Users/yuxiao/Downloads/StarParadise/star-park/pc-admin && npm run build
```

**强约束**：构建失败必须立即停止，分析错误并修复，修复后重新构建验证。不得跳过构建直接提交。

---

## 阶段 5：提交代码

```bash
cd /Users/yuxiao/Downloads/StarParadise

# 暂存修改的文件（只 add 本次需求相关文件，不要 git add .）
git add <修改的具体文件路径>

# 提交，message 必须包含 ReqId
git commit -m "feat: <需求标题摘要> ReqId: PONR-4"
```

**强约束**：
- commit message 必须包含 `ReqId: PONR-4`
- 只 stage 本次需求相关的文件
- 确认 commit 成功后再继续

---

## 阶段 6：推送分支

```bash
git push origin feat/nodejs-cicd-pipeline
```

如果 codeup 也需要同步：
```bash
git push codeup feat/nodejs-cicd-pipeline
```

**强约束**：push 失败必须立即停止报告。

---

## 阶段 7：人工后续步骤（报告给用户）

以下步骤需要人工在云效控制台完成：

1. **触发流水线**：https://flow.aliyun.com/pipelines/5212797/current 点击「运行」
2. **等待流水线验证通过**（绿色/成功）后才能合并
3. **合并到 main**：验证通过后将 feat/nodejs-cicd-pipeline 合并到 main
4. **更新需求状态**：在 Projex 将 PONR-4 状态更新为「已完成」

---

## 执行原则

- 每完成一个阶段，简要报告阶段结果
- 遇到权限不足、命令失败、需要人工判断时，立即停止并报告
- 不得跳过任何验证步骤
- 不得擅自假设需求内容，必须基于从 a1 CLI 获取的真实需求数据
