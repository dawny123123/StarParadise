# 目标管理需求实现标准操作流程（SOP）

> **适用范围**：星星乐园（StarParadise）项目，以后端 Express + 前端 Vue 3 + 云效 Flow CI/CD 为主的技术栈。  
> **文档目标**：把「目标管理任务列表移除创建人列」这一需求的完整落地过程沉淀为标准流程，供后续新需求复用。  
> **版本**：v1.1  
> **最后更新**：2026-08-21

---

## 1. 流程总览

| 阶段 | 关键动作 | 产出 | 负责角色 |
|------|----------|------|----------|
| 1. 需求确认 | 明确需求背景、验收标准、影响范围；从 Projex 提取需求 ID | 需求确认单 / 补充后的 PRD | 产品经理 + 需求提出方 |
| 2. 方案确认 | 确定改动点、分支策略、回滚方案 | 方案决策记录 | 技术负责人 |
| 3. 代码修改 | 按分层架构与项目规范修改代码 | 本地代码变更 | 开发 |
| 4. 本地验证 | 构建、测试、lint、页面验证 | 验证通过记录 | 开发 + QA |
| 5. 远端同步 | 提交并推送至 Codeup 目标分支 | 远端 commit | 开发 |
| 6. 流水线触发 | 触发云效 Flow 流水线执行并验证 | 流水线运行记录 | 开发 / 运维 |
| 7. 分支合并 | 部署验证通过后，将特性分支合并至 `main` | 合并记录 / MR | 开发 / 维护者 |
| 8. 验收 | 按验收标准逐项确认 | 验收结论 | 产品经理 |
| 9. 结项 | 更新 Projex 需求状态、更新文档、关闭任务、记录经验 | 结项记录 | 产品经理 |

---

## 2. 阶段 1：需求确认

### 2.1 收集原始需求

收到需求后，先补齐以下信息：

| 信息项 | 说明 | 本次示例 |
|--------|------|----------|
| 需求来源 | 谁提出、在什么场景下提出 | 产品迭代中提出，目标管理任务列表需隐藏「创建人」列 |
| Projex 需求链接 | 云效 Projex 需求页面 URL | `https://devops.aliyun.com/projex/project/1d2be88132d1ff30e96c1275c0/req#viewIdentifier=d7f112f9d023e2108fa1b0d8` |
| 需求 ID | 从 URL 的 `viewIdentifier` 参数提取 | `d7f112f9d023e2108fa1b0d8` |
| 问题/目标 | 要解决什么问题、达成什么效果 | 减少列表冗余列，避免创建人信息暴露 |
| 目标用户 | 受影响的用户角色 | 使用 pc-admin 管理后台的家长 |
| 期望行为 | 改完后用户看到什么 | 任务列表不再展示「创建人」列 |
| 非期望行为 | 明确不改什么 | 不删除数据模型中的 `creator` 字段；不修改表单/详情页 |

#### 如何从 Projex 链接提取需求 ID

标准 Projex 需求 URL 形如：

```
https://devops.aliyun.com/projex/project/<projectId>/req#viewIdentifier=<需求ID>
```

直接取 `viewIdentifier=` 后的字符串即可作为需求 ID：

```bash
# 示例
URL="https://devops.aliyun.com/projex/project/1d2be88132d1ff30e96c1275c0/req#viewIdentifier=d7f112f9d023e2108fa1b0d8"
echo "$URL" | grep -oP 'viewIdentifier=\K[^&]+'
# 输出：d7f112f9d023e2108fa1b0d8
```

> **规范**：需求 ID 必须写入需求确认单，并在 commit message / MR 标题中通过 `ReqId: <需求ID>` 或 `#[需求ID]` 形式关联，便于后续状态自动流转。

### 2.2 明确验收标准（AC）

每条验收标准必须可验证、可执行：

| 编号 | 验收项 | 验收标准 | 优先级 |
|------|--------|----------|--------|
| AC1 | 列表展示 | 目标管理任务列表不再展示「创建人」列 | P0 |
| AC2 | 数据保留 | 数据库、API、表单/详情页中的 `creator` 字段保留 | P0 |
| AC3 | 其他列 | 其余列（标题、关联目标、优先级、预期积分、描述、计划日期、操作）保持不变 | P0 |
| AC4 | 布局 | 表格宽度、对齐、操作列位置无错位 | P1 |
| AC5 | 构建 | pc-admin 构建通过 | P0 |

### 2.3 确认影响范围

| 维度 | 本次结论 |
|------|----------|
| 前端页面 | `star-park/pc-admin/src/components/TodoTree.vue` |
| 后端接口 | 不涉及（仅展示层变更） |
| 数据库 | 不涉及（不删字段、不改 schema） |
| 测试用例 | 无需新增单测；需验证页面 |
| 文档 | 无需更新 API 文档；可沉淀 SOP |

### 2.4 决策记录模板

```markdown
## 需求确认结论
- 需求标题：[一句话]
- 需求 ID：[从 Projex URL 提取]
- Projex 链接：[完整 URL]
- 技术方案：[纯展示层移除 / 数据层移除 / 其他]
- 工作分支：[feat/xxx]
- 目标分支：main
- 回滚方式：git revert <commit>
- 风险：[低 / 中 / 高]
- 需要人工审批的节点：[首次生产部署 / 数据变更 / 无]
```

---

## 3. 阶段 2：方案确认

### 3.1 定位改动点

使用项目内搜索或阅读源码，确认最小改动位置：

```bash
# 示例：搜索「创建人」相关代码
grep -r "创建人" star-park/pc-admin/src
grep -r "creator" star-park/pc-admin/src
```

本次定位结果：
- 列定义在 `star-park/pc-admin/src/components/TodoTree.vue` 第 68 行：
  ```vue
  <el-table-column prop="creator" label="创建人" width="80" />
  ```
- 数据字段 `creator` 在列表数据中存在，但表单、API 均保留，故仅需删除展示层列定义。

### 3.2 评估方案

| 方案 | 说明 | 适用场景 | 本次选择 |
|------|------|----------|----------|
| A. 仅移除列定义 | 删除 `<el-table-column>`，保留数据 | 数据还要在别处用 | ✅ 本次采用 |
| B. 移除字段 + 列 | 同时修改接口、数据模型、数据库 | 字段彻底废弃 | 不适用 |
| C. 条件展示 | 通过权限/配置控制显隐 | 不同角色显示不同 | 不适用 |

### 3.3 分支与提交流程

| 项 | 本次取值 | 备注 |
|----|----------|------|
| 仓库 | `https://codeup.aliyun.com/625d2340cfea268afc2158c5/StartParadise` | 固定 |
| 工作分支 | `feat/nodejs-cicd-pipeline` | 验证中 |
| 目标分支（长期） | `main` | 合并后流水线自动触发 |
| 提交规范 | Conventional Commits | 示例：`feat: 目标管理任务列表移除创建人列` |

---

## 4. 阶段 3：代码修改

### 4.1 修改原则

1. **最小改动**：只改必要的文件和行，避免顺手重构。
2. **保留数据**：展示层变更不污染数据层。
3. **遵循分层**：前端 L3 组件只依赖 npm 包和同级/下级层，不跨层引用。
4. **不引入 console.log**：如需要调试，使用项目内结构化日志或临时注释，提交前清理。

### 4.2 本次修改示例

文件：`star-park/pc-admin/src/components/TodoTree.vue`

修改前：
```vue
<el-table-column label="关联目标" width="120">
  ...
</el-table-column>
<el-table-column prop="creator" label="创建人" width="80" />
<el-table-column label="优先级" width="80">
  ...
</el-table-column>
```

修改后：
```vue
<el-table-column label="关联目标" width="120">
  ...
</el-table-column>
<el-table-column label="优先级" width="80">
  ...
</el-table-column>
```

### 4.3 修改后自查

- [ ] 只改了目标文件，没有误删其他列或样式。
- [ ] 数据字段（`creator`）在 `<script>`、API、表单、数据库中仍保留。
- [ ] 没有引入新的 lint 错误。
- [ ] 文件行数未超过项目限制（≤500 行）。

---

## 5. 阶段 4：本地验证

### 5.1 必跑命令

按子项目选择对应命令：

```bash
# 1. 架构与代码质量检查
make lint-arch

# 2. 前端构建（本次需求核心）
cd star-park/pc-admin && npm run build

# 或统一入口
make build

# 3. 后端测试（如涉及后端改动）
cd star-park/server && npm run test:coverage

# 4. 端到端验证（如有）
make verify
```

### 5.2 页面验证

启动本地开发环境，人工确认界面表现：

```bash
cd star-park
npm run start:server   # :3001
npm run start:pc       # :5173
```

打开 `http://localhost:5173`（以实际路由为准），进入目标管理任务列表，确认：
- [ ] 「创建人」列不再显示。
- [ ] 其余列顺序、宽度、对齐正常。
- [ ] 操作列按钮仍可正常点击。
- [ ] 无浏览器控制台报错。

### 5.3 验证记录模板

```markdown
## 本地验证记录
- 验证时间：2026-08-21 16:15
- 验证人：yuxiao
- 验证项：
  - [x] make lint-arch 通过
  - [x] pc-admin npm run build 通过
  - [x] 页面「创建人」列已消失
  - [x] 其余列与操作按钮正常
- 遗留问题：无
```

---

## 6. 阶段 5：远端同步

### 6.1 提交前检查

```bash
# 查看变更
git diff

# 确认只包含预期文件
git status

# 添加并提交（推荐按文件粒度，commit message 中关联需求 ID）
git add star-park/pc-admin/src/components/TodoTree.vue
git commit -m "feat: 目标管理任务列表移除创建人列

ReqId: d7f112f9d023e2108fa1b0d8"
```

> **规范**：`commit message` 必须包含 `ReqId: <需求ID>`，确保 Projex 能自动识别关联关系；若使用 MR/PR 合并，标题中也需包含需求 ID。

### 6.2 推送

```bash
# 确认当前分支正确
git branch

# 推送
git push origin feat/nodejs-cicd-pipeline
```

### 6.3 推送后确认

- [ ] Codeup 上可见最新 commit。
- [ ] commit message 符合规范。
- [ ] diff 只包含预期改动。

本次实际提交：
- Commit：`19f677da feat: 目标管理任务列表移除创建人列`
- 变更：`star-park/pc-admin/src/components/TodoTree.vue` 删除 1 行。

---

## 7. 阶段 6：流水线触发

### 7.1 自动触发（推荐）

在云效 Flow 流水线中开启「代码源触发」，绑定目标分支：

1. 打开流水线：[https://flow.aliyun.com/pipelines/5212797/current](https://flow.aliyun.com/pipelines/5212797/current)
2. 进入「编辑流水线」→「触发设置 / 代码源触发」。
3. 开启触发，选择 Codeup 仓库 `StartParadise`。
4. 选择触发分支：
   - 特性分支验证：`feat/nodejs-cicd-pipeline`
   - 生产发布（推荐）：`main` / `master`，MR 合并后自动部署
5. 保存，云效会自动在 Codeup 仓库添加 webhook。

### 7.2 手动触发

若因权限/配置原因无法自动触发，由有权限的同学手动执行：

1. 登录云效控制台 → 进入流水线 `star-park-nodejs-cicd`（ID `5212797`）。
2. 点击「运行」或「立即构建」。
3. 观察各阶段状态：代码检查 → 单元测试 → 构建 → 部署。

### 7.3 流水线阶段说明

| 阶段 | 内容 | 失败处理 |
|------|------|----------|
| 代码检查 | 架构 lint + 代码质量 lint | 修复后重跑 |
| 单元测试 | Vitest + 覆盖率 | 补充测试或调整阈值 |
| 构建 | `npm ci` + `vite build` + 打包制品 | 检查依赖/Node 版本 |
| 部署 | 主机部署 + `deploy/deploy.sh` + 健康检查 | 自动回滚，查看日志 |

### 7.4 触发后确认

- [ ] 流水线运行成功（四阶段绿）。
- [ ] 目标机服务 `star-park-server.service` 状态 `active`。
- [ ] 健康检查 `curl http://127.0.0.1:3002/api/health` 返回 `{"status":"ok"}`。
- [ ] 线上页面/功能已验证通过，满足验收标准。

> 只有上述确认项全部通过后，才允许将特性分支合并至 `main`。

---

## 8. 阶段 7：分支合并

### 8.1 合并前检查

在特性分支部署验证通过后，执行合并：

- [ ] 当前特性分支 `feat/nodejs-cicd-pipeline` 已推送远端且 CI 通过。
- [ ] 部署验证完成，无遗留阻塞问题。
- [ ] `main` 分支已更新到最新，无冲突。
- [ ] 已确认需求 ID 在 commit / MR 中已关联。

### 8.2 合并方式

推荐在 Codeup 控制台发起合并请求（MR），经代码评审后合并：

1. 打开 Codeup 仓库 → 合并请求 → 新建 MR。
2. 源分支：`feat/nodejs-cicd-pipeline`；目标分支：`main`。
3. 标题格式：`feat: 目标管理任务列表移除创建人列 (ReqId: d7f112f9d023e2108fa1b0d8)`。
4. 描述中列出改动点、验证结果、影响范围。
5. 通过评审后点击「合并」。

或使用命令行合并（仅推荐在明确无冲突、已评审的情况下）：

```bash
git checkout main
git pull origin main
git merge --no-ff feat/nodejs-cicd-pipeline -m "feat: 目标管理任务列表移除创建人列

ReqId: d7f112f9d023e2108fa1b0d8"
git push origin main
```

### 8.3 合并后确认

- [ ] `main` 分支包含目标 commit。
- [ ] Codeup 上 MR 状态为「已合并」。
- [ ] 云效 Flow 上 `main` 分支触发的流水线运行成功（如已开启代码源触发）。

---

## 9. 阶段 8：验收

### 9.1 验收 checklist

| 编号 | 验收项 | 验收方式 | 本次结果 |
|------|--------|----------|----------|
| AC1 | 列表不再展示「创建人」列 | 页面目视检查 | 通过 |
| AC2 | `creator` 数据仍保留 | 检查接口响应 / 数据库 | 通过 |
| AC3 | 其余列与数据行为不变 | 页面操作 + 接口校验 | 通过 |
| AC4 | 布局无错位 | 多分辨率/窗口大小检查 | 通过 |
| AC5 | pc-admin 构建通过 | 流水线构建阶段绿 | 通过 |
| TC1 | 架构 lint 通过 | `make lint-arch` / 流水线 | 通过 |
| TC2 | 特性分支已合并至 `main` | Codeup MR / 分支记录 | 通过 |

### 9.2 验收结论模板

```markdown
## 验收结论
- 验收时间：2026-08-21 16:50
- 验收人：轻眉
- 结论：通过
- 说明：
  - 改动点符合规格：仅移除 `TodoTree.vue` 中创建人列定义。
  - 表单与数据中的 `creator` 字段保留，无数据层影响。
  - 提交 19f677da 已推送至远端 feat/nodejs-cicd-pipeline 分支。
  - 流水线运行成功，页面验证通过。
  - 特性分支 feat/nodejs-cicd-pipeline 已合并至 main。
- 残留风险：无
```

---

## 10. 阶段 9：结项

### 10.1 结项动作

1. **更新 Projex 需求状态**：
   - 发布验证成功后，将 Projex 需求状态更新为「已完成」。
   - 可配置云效 Projex 自动化规则：当关联的 Codeup MR 合并且流水线成功后，自动将需求状态流转为「已完成」。
   - 若未配置自动化，由产品经理在 Projex 中手动将需求 `d7f112f9d023e2108fa1b0d8` 状态改为「已完成」。
2. **关闭需求/任务**：在 Aone / 钉钉待办 / 项目看板中同步更新状态为「已完成」。
3. **更新文档**：
   - 如需求涉及接口变更，同步更新 `docs/api.md`。
   - 如需求涉及部署/配置变更，同步更新 `docs/OPERATIONS.md` 或 `docs/CICD-PLAYBOOK.md`。
   - 本次为展示层小改动，无需更新接口文档，但沉淀了本 SOP。
4. **记录经验**：
   - 本次流水线需人工触发，后续应推动开启「代码源触发」。
   - 本地 `qoderwake_permission_guard` 会拦截跨目录 / a1 CLI / 网络命令，需提前确认执行环境权限。

### 10.2 Projex 自动化规则建议

为避免遗漏，建议在 Projex 项目中配置以下自动化规则：

| 触发条件 | 执行动作 |
|----------|----------|
| 关联的 Codeup MR 已合并 | 需求状态变更为「开发完成」 |
| 关联的流水线运行成功（main 分支） | 需求状态变更为「待验收」 |
| 验收结论为通过 | 需求状态变更为「已完成」 |

> 若暂时无法配置自动化，需在结项 checklist 中增加人工确认项。

### 10.3 结项记录模板

```markdown
## 结项记录
- 需求：目标管理任务列表移除创建人列
- 需求 ID：d7f112f9d023e2108fa1b0d8
- Projex 链接：https://devops.aliyun.com/projex/project/1d2be88132d1ff30e96c1275c0/req#viewIdentifier=d7f112f9d023e2108fa1b0d8
- 状态：已完成
- 提交：19f677da
- 分支：feat/nodejs-cicd-pipeline
- 合并目标分支：main
- 流水线：star-park-nodejs-cicd (5212797)
- 经验：
  1. 展示层变更优先采用「仅移除列定义」方案，避免数据层污染。
  2. 本地验证至少跑 `make lint-arch` + `pc-admin build`。
  3. 云效 Flow 自动触发需提前配置代码源触发与 webhook。
  4. 合并到 main 前必须确认流水线部署验证通过。
  5. 发布验证成功后，及时在 Projex 中将需求状态更新为「已完成」。
```

---

## 11. 工具 / 命令速查

| 目的 | 命令 |
|------|------|
| 安装依赖 | `cd star-park && npm run install:all` |
| 启动后端 | `npm run start:server` |
| 启动 pc-admin | `npm run start:pc` |
| 前端构建 | `cd star-park/pc-admin && npm run build` |
| 架构 lint | `make lint-arch` |
| 全部 lint | `make lint` |
| 端到端验证 | `make verify` |
| 查看流水线 | [https://flow.aliyun.com/pipelines/5212797/current](https://flow.aliyun.com/pipelines/5212797/current) |
| 生产健康检查 | `curl http://127.0.0.1:3002/api/health` |
| 服务日志 | `journalctl -u star-park-server -n 100 --no-pager` |
| 回滚 | `bash /opt/star-park/current/deploy/rollback.sh` |

---

## 12. 常见问题与踩坑记录

| 问题 | 现象 | 解法 |
|------|------|------|
| 权限守卫拦截 | 无法访问 `/Users/yuxiao/Downloads/StarParadise` 之外的路径，a1 CLI / 网络命令被拦截 | 在正确的项目根目录启动会话；无法自动执行的步骤转人工 |
| 流水线无法自动触发 | 推送后流水线没反应 | 在云效控制台检查「代码源触发」是否开启、分支是否匹配、webhook 是否存在 |
| 本地构建正常但 CI 失败 | 云效公共镜像为 Ubuntu 16.04 + Python 3.5 + Node 14.8.0 | 参考 `docs/CICD-PLAYBOOK.md` §4 做预防性适配 |
| 端口不通 | 安全组已放通但 `curl` 仍失败 | 同时检查目标机 `firewalld`；`curl` 快速失败是主机 reject，超时是安全组丢包 |
| 原生模块编译失败 | `better-sqlite3` 在云效构建机无法编译 | `npm ci --ignore-scripts` + 从 npmmirror 下对应 ABI 的预编译产物 |
| 合并后需求状态未更新 | Projex 状态仍停留在「开发中」 | 检查 MR/Commit 是否正确关联需求 ID；确认自动化规则已开启；必要时手动更新 |

---

## 13. 附录：全流程 Checklist

### 13.1 需求阶段

- [ ] 需求来源、目标用户、验收标准已明确
- [ ] Projex 需求链接与需求 ID 已提取并记录
- [ ] 影响范围（前端/后端/数据库/文档）已评估
- [ ] 方案已确认并记录

### 13.2 开发阶段

- [ ] 已在正确分支上开发
- [ ] Commit / MR 标题已关联需求 ID
- [ ] 改动最小化，符合分层架构
- [ ] 数据层与展示层变更已区分

### 13.3 验证阶段

- [ ] `make lint-arch` 通过
- [ ] 涉及子项目构建通过
- [ ] 页面/功能已人工验证
- [ ] 无新增 console.log 调试语句

### 13.4 发布阶段

- [ ] 已提交并推送至远端目标分支
- [ ] 流水线已触发并成功运行
- [ ] 生产环境健康检查通过
- [ ] 特性分支已合并至 `main`
- [ ] `main` 分支流水线运行成功

### 13.5 验收与结项

- [ ] 验收 checklist 全部通过
- [ ] Projex 需求状态已更新为「已完成」（自动或人工）
- [ ] 相关文档已更新
- [ ] 需求/任务状态已关闭
- [ ] 经验教训已记录

---

## 参考文档

- [项目开发设置](../docs/DEVELOPMENT.md)
- [测试策略](../docs/TESTING.md)
- [运维指南](../docs/OPERATIONS.md)
- [云效 CI/CD 落地 Playbook](../docs/CICD-PLAYBOOK.md)
- [产品需求规格模板](../docs/产品需求规格模板.md)
