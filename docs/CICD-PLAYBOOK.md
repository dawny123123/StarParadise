# 云效 CI/CD 落地 Playbook

> 从零把一个 Node.js 仓库接上「云效 Flow 流水线 → 主机部署到 ECS → 外网可访问 → 数据完整」的完整复盘。
> 记录**做了什么、需要人提供什么、踩了哪些坑怎么解的**，供下一个新仓库直接复制。
>
> 本次落地对象：Codeup `StartParadise` → 流水线 `star-park-nodejs-cicd`(ID 5212797) → ECS `8.147.58.185`。
> 全程未使用 SSH，所有主机操作通过 **ECS 云助手（Cloud Assistant）** 完成。

---

## 0 总览：七个阶段

| 阶段 | 产出 | 是否需要人介入 |
|------|------|----------------|
| 1 摸底 | 仓库结构、构建方式、目标机现状 | 提供仓库/流水线/ECS 信息 |
| 2 建流水线 | `.flow/*.yml` + 云端流水线 | 提供服务连接 uuid、批准新建 |
| 3 跑通 CI | 代码检查 / 单测 / 构建 三阶段绿 | 否（迭代调试） |
| 4 部署脚本 | `deploy/*.sh` + systemd unit | 确认端口冲突策略 |
| 5 首次部署 | 服务在目标机 active | **必须批准生产变更** |
| 6 打通访问 | 安全组 + firewalld 双层放通 | 提供来源 IP、批准放通方式 |
| 7 数据同步 | 生产库数据完整 | 批准覆盖策略 |

**关键认知**：阶段 3 花的时间最多（7 次失败运行），全部消耗在**云效公共构建镜像的老旧环境**上；
阶段 6 的坑最隐蔽（改完安全组仍不通，真凶是主机 firewalld）。

---

## 1 必须由人提供的信息（清单）

下次开工前一次性收齐，可省掉大量往返。

### 1.1 访问凭证与坐标

| # | 信息 | 为什么必须人给 | 本次取值 |
|---|------|----------------|----------|
| 1 | `aliyun` CLI 凭证（AK/STS） | 需同时具备 **ECS** 与 **devops(云效)** 权限 | 已配置 |
| 2 | Codeup 仓库地址 | — | `625d2340cfea268afc2158c5/StartParadise` |
| 3 | 目标 ECS 实例 ID + 公网 IP + 地域 | OpenAPI 调用必需 `RegionId` | `i-0jlhpo15qqlwky4ldk5x` / `8.147.58.185` / `cn-wulanchabu` |
| 4 | **代码源服务连接 uuid** | ⚠️ OpenAPI 不返回，只能从云效控制台拿；填数字 id 会被校验拒绝 | `dppdxrk3h4a4d88w` |
| 5 | **机器组 uuid** | ⚠️ 同上，`GetHostGroup` 只返回数字 id，不返回 uuid | `tnohf384amokxmtw` |
| 6 | 服务连接是否需重新同步 | 需在云效控制台点「同步」 | 服务连接 476474 |

> **第 4、5 项是最容易卡住的**。云效 OpenAPI 与控制台在标识符上不一致：
> 控制台 URL 里是 uuid，OpenAPI 返回的是数字 id，而 YAML 校验只认 uuid。
> **开工第一件事就去控制台把这两个 uuid 抄下来。**

### 1.2 需要人做决策的点

| # | 决策 | 本次结论 |
|---|------|----------|
| 1 | 应用端口（是否与现有服务冲突） | 3001 被无关 PM2 应用占用 → 改用 **3002** |
| 2 | 首次生产部署批准 | 已批准 |
| 3 | 外网放通的来源范围 | 白名单 `140.205.11.234/32`，不全网开放 |
| 4 | 主机防火墙放通方式 | firewalld rich rule 限定来源 |
| 5 | 生产数据覆盖策略 | 清空后全量导入本地数据 |

---

## 2 阶段 1：摸底

```bash
# 云效相关命令必须带 endpoint，否则报错
export YX="--endpoint devops.cn-hangzhou.aliyuncs.com"

aliyun devops GetPipeline $YX --organizationId <orgId> --pipelineId <id>   # 看 pipeline.pipelineConfig.flow
aliyun ecs DescribeInstances --RegionId <region> --InstanceIds '["<i-xxx>"]'
```

摸底目标机现状（**部署前一定要拍快照**，否则出问题说不清是谁改的）：

```bash
# 通过云助手执行，无需 SSH
CMD=$(printf '%s' '<你的脚本>' | base64)
INV=$(aliyun ecs RunCommand --RegionId <region> --InstanceId.1 <i-xxx> \
  --Type RunShellScript --ContentEncoding Base64 --CommandContent "$CMD" \
  | python3 -c "import json,sys;print(json.load(sys.stdin)['InvokeId'])")
sleep 8
aliyun ecs DescribeInvocationResults --RegionId <region> --InvokeId "$INV" \
  | python3 -c "
import json,sys,base64
d=json.load(sys.stdin)
for r in d['Invocation']['InvocationResults']['InvocationResult']:
    print('ExitCode:',r.get('ExitCode')); print(base64.b64decode(r['Output']).decode())
"
```

必查项：**已占用端口、已有服务（PM2/systemd）、磁盘、Node 版本、有无编译工具链、防火墙状态**。
本次就是靠这一步发现 3001 被 6 个月前的线上应用 `game-guess` 占着。

---

## 3 阶段 2：建流水线

流水线定义**版本化进仓库**（`.flow/<name>.yml`），再用 OpenAPI 推到云端，避免只在控制台点。

```bash
aliyun devops UpdatePipeline $YX --organizationId <orgId> --pipelineId <id> \
  --name star-park-nodejs-cicd --content "$(cat .flow/star-park-nodejs-cicd.yml)"
```

代码源写法（**uuid 是关键**）：

```yaml
sources:
  star_park_repo:
    type: codeup
    name: StartParadise
    endpoint: https://codeup.aliyun.com/<org>/<repo>.git
    branch: main
    certificate:
      type: serviceConnection
      serviceConnection: dppdxrk3h4a4d88w   # 必须 uuid，数字 id 会被拒
```

主机部署阶段：

```yaml
deploy_job:
  component: VMDeploy
  with:
    artifact: $[stages.build_stage.build_job.upload_step.artifacts.<artifactName>]
    machineGroup: tnohf384amokxmtw          # 必须 uuid
    artifactDownloadPath: /opt/<app>/package.tgz
    executeUser: root
    pauseStrategy: noPause
    run: |
      # 只负责解包并调用制品内的 deploy.sh，逻辑放脚本里便于本地复现
```

**调试期把 `branch` 指向特性分支**，验证完再改回 `main` 并开启推送触发。

---

## 4 阶段 3：跑通 CI —— 云效公共构建镜像的硬约束

> 本次 7 次失败运行几乎全部源于此。**这一节是最有复制价值的部分。**

公共构建集群镜像为 **Ubuntu 16.04**，且**无法通过 OpenAPI 换镜像**。

| 约束 | 现象 | 解法 |
|------|------|------|
| 只有 **Python 3.5** | lint 脚本 f-string 直接 `SyntaxError` | 脚本改用 `str.format()` 保持 3.5 兼容 |
| `apt` 无更高版本 Python、**无 docker**、**pypi 返回 403** | 三条升级路都堵死 | 放弃升级，改造脚本 |
| NodeBuild 的 `version` 字段**实测不生效** | 实际跑 Node 14.8.0 / npm 6，无法解析 `lockfileVersion 3` | 步骤内用镜像自带 nvm：`nvm install 20`，并断言 `MAJOR >= 18` |
| **g++ 5.4** 不支持 `-std=c++20` | 原生模块回退源码编译必然失败 | 见下方 better-sqlite3 方案 |
| 访问 **GitHub Releases 超时** | `prebuild-install warn install Request timed out` | 改用 npmmirror 取预编译产物 |
| `runsOn: {container: ...}` 经 `UpdatePipeline` 报 **"system error"** | 自定义构建镜像是**控制台专有能力** | OpenAPI 场景放弃，只能适配现有镜像 |

### 4.1 原生模块（better-sqlite3）通用解法

思路：**跳过安装脚本，直接下 ABI 匹配的预编译产物**。

```bash
npm ci --no-audit --no-fund --ignore-scripts
ABI="$(node -p 'process.versions.modules')"                 # Node 20 -> 115
BSV="$(node -p "require('./node_modules/better-sqlite3/package.json').version")"
URL="https://registry.npmmirror.com/-/binary/better-sqlite3/v${BSV}/better-sqlite3-v${BSV}-node-v${ABI}-linux-x64.tar.gz"
curl -fsSL --retry 3 -o /tmp/bs3.tar.gz "$URL"
tar -xzf /tmp/bs3.tar.gz -C node_modules/better-sqlite3
node -e "require('better-sqlite3')"                          # 必须验证可加载
```

⚠️ `--ignore-scripts` 会跳过**所有**包的安装脚本，需对其他依赖补验证，但要**先判断存在性**：

```bash
# 本项目 vitest 用 rolldown，树里没有 esbuild，无脑执行会 "Cannot find module"
if [ -f node_modules/esbuild/install.js ] && ! node -e "require('esbuild')" >/dev/null 2>&1; then
  node node_modules/esbuild/install.js
fi
```

> **ABI 必须两端一致**：CI 构建机 Node 20.20.2 与目标机 Node 20.20.0 同为 ABI 115，产物才能通用。

### 4.2 顺手清掉的供应链问题

`package.json` 里有一条**伪造依赖 `"2": "^3.0.0"`**（疑似误操作粘进去的）。
移除并重建 lock：`243 → 220` 个包，`package-lock.json` 净删 598 行。
**新仓库接管时值得扫一遍依赖名是否合理。**

### 4.3 排查手法

```bash
aliyun devops StartPipelineRun $YX --organizationId <orgId> --pipelineId <id>
aliyun devops GetPipelineRun   $YX ...   # 响应键是 pipelineRun
aliyun devops LogPipelineJobRun $YX ...  # 日志在 log.content
```

诊断不出来时，**故意加一个只打印环境信息的步骤**（OS 版本、可用 python、包管理器、网络可达性）跑一次，
比逐个猜测快得多 —— 本次正是靠这一步才确定「Ubuntu 16.04 + 只有 3.5 + pypi 403」。

⚠️ shell 陷阱：`set -e` 下 `[ -n "$X" ] && Y=...` 条件不成立时整个步骤会退出，需补 `|| true`。

---

## 5 阶段 4-5：部署脚本与首次上线

部署逻辑**全部放进制品内的 `deploy/deploy.sh`**，流水线只负责调用 —— 便于本地复现与回滚。

脚本要素（原子发布）：

```
/opt/<app>/
├── releases/<BUILD_NUMBER>/   # 历史版本（保留 5 个）
├── current -> releases/<N>    # 原子软链，切换即上线/回滚
├── shared/data/               # 数据持久化，跨版本保留
└── backups/                   # 每次部署前的数据库备份（保留 10 份）
```

必备守卫：

- `set -Eeuo pipefail` + `trap rollback ERR`，健康检查失败自动回滚
- **端口占用守卫**：端口被无关进程占用时主动中止（本次 3001 冲突就靠它兜底）
- **自适应解包**：`find -maxdepth 3 -name package.json` 定位真实包根，不写死目录层级
- 目标机**无编译工具链**，`npm ci` 失败时回退 `--ignore-scripts` + 预编译产物（同 §4.1）

首次部署前后各拍一次快照，并明确告知：**首次部署无历史版本可回退，回退路径是停用 unit + 移除目录**。

---

## 6 阶段 6：打通外网访问 —— 最隐蔽的坑

**外网访问要穿两层，只改安全组不够。**

```
公网请求 → [第1层 ECS 安全组] → [第2层 主机 firewalld] → 应用监听
```

本次现象：安全组已放通 3002，但 `curl` 仍失败。真凶是 **firewalld**（`public` zone 默认只放 ssh/cockpit/8000/8080，
其余 `reject with icmpx admin-prohibited`）。

### 6.1 快速判别（值得背下来）

| 现象 | 结论 |
|------|------|
| `curl` 在**约一个 RTT 内**快速失败（本次 38ms vs ping 35ms） | **主机在 reject** → 查 firewalld/iptables |
| `curl` 一直**超时**到 timeout | **安全组在丢包** → 查安全组规则 |
| `ping` 通但 TCP 不通 | ICMP 与 TCP 是两套规则，`ping` 通说明不了任何 TCP 问题 |
| 多个端口**同时**快速失败 | 大概率主机防火墙，而非单个端口配置问题 |

⚠️ `iptables -L` 看到空规则**不代表没有防火墙** —— firewalld 0.9 走 nftables，
要 `firewall-cmd --list-all` 或 `nft list table inet firewalld`。

### 6.2 两层都放通（限定来源，双层白名单）

```bash
# 第1层：安全组
aliyun ecs AuthorizeSecurityGroup --RegionId <region> --SecurityGroupId <sg-xxx> \
  --IpProtocol tcp --PortRange 3002/3002 --SourceCidrIp <CIDR> --Priority 100 --Description '<app> 3002'

# 第2层：firewalld（目标机执行）
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=<CIDR> port port=3002 protocol=tcp accept'
firewall-cmd --reload
```

还要确认**应用监听地址**：`ss -tlnp | grep <port>` 必须是 `*:<port>` 或 `0.0.0.0:<port>`，
若是 `127.0.0.1:<port>` 则两层都放通也不通。

---

## 7 阶段 7：本地数据同步到生产

详细命令见 `docs/OPERATIONS.md` §4.2.1，此处只记**结论性教训**。

| 坑 | 现象 | 解法 |
|----|------|------|
| **SQLite WAL 未落盘** | 本地 `.db` 仅 32KB，`-wal` 却有 1.7MB —— 数据几乎全在 WAL 里 | 用 `VACUUM INTO` 生成一致性快照，**绝不能只 cp `.db`** |
| 目标机 **sqlite3 3.26** | `VACUUM INTO` 报 `near "INTO": syntax error`（3.27 起才支持） | 目标机侧改用 `.backup` |
| 3.26 缺少 `chr()` 等函数 | 校验语句报错 + `set -e` 导致脚本提前退出，**服务没起来** | 校验语句避开新函数；起服放在 `trap`/独立步骤里，别跟校验绑一起 |
| **schema 漂移** | 本地库比线上旧（`checkins` 外键缺 `ON DELETE CASCADE`） | **只导数据不导 schema**，保留线上 schema |
| 无 SSH 如何传文件 | — | `aliyun ecs SendFile`（≤32KB）；数据 gzip 后仅 6KB，够用 |

顺序固定：**停服 → 备份（快照 + 原始三文件）→ 导入 → `integrity_check` + `foreign_key_check` → 起服 → 健康检查**。

> 教训：**校验语句本身也可能失败**。本次两次中断都不是数据问题，而是我的校验命令用了目标机不支持的语法，
> 在 `set -e` 下把脚本打断、服务停在半路（累计停服约 2 分钟）。
> 起服动作应独立于校验逻辑，或用 `trap ... EXIT` 保证兜底。

---

## 8 下一个新仓库的执行顺序（精简版）

1. **收齐 §1 清单**（尤其服务连接 uuid、机器组 uuid，去控制台抄）
2. 云助手拍目标机快照：**端口占用、已有服务、Node 版本、有无 g++、防火墙状态**
3. 写 `.flow/<name>.yml`，`branch` 先指特性分支
4. 按 §4 预防性适配镜像：lint 脚本兼容 Python 3.5、步骤内 `nvm install 20`、原生模块走 npmmirror 预编译
5. 写 `deploy/deploy.sh`（原子发布 + 端口守卫 + 健康检查 + 自动回滚）
6. 跑流水线到 CI 三阶段绿，再接部署阶段
7. **取得生产部署批准**后触发，部署后逐项验证（unit / 端口 / 健康检查 / 首页 / 软链 / 数据目录）
8. 打通访问：安全组 + firewalld **两层**，来源限定白名单，确认监听地址非回环
9. 数据同步：`VACUUM INTO` 快照 → 仅数据 SQL → `SendFile` → 停服备份导入校验起服
10. 收尾：`branch` 改回 `main` 开启推送触发、更新运维文档、列出残留风险

## 9 本次残留风险（新仓库同样要盯）

- 无 HTTPS / 无域名，管理后台凭证公网明文传输
- 管理后台无鉴权网关，仅靠 IP 白名单防护
- 安全组 `22` / `3389` 对 `0.0.0.0/0` 全开（P0）
- 生产库含测试数据（按用户选择全量导入）
