# 运维指南

> 部署流程、环境配置、监控日志与运维手册

## 1 部署

### 1.1 本地开发

```bash
cd star-park && npm run install:all
npm run start:server    # 后端 :3001
npm run start:pc        # 管理后台 :5173
npm run start:mini      # 小程序 H5
```

### 1.2 生产部署（云效 Flow 自动部署）

生产部署由云效流水线 **star-park-nodejs-cicd** 全自动完成，不要手工登录目标机部署。

| 项 | 值 |
|----|-----|
| 代码仓库 | Codeup `625d2340cfea268afc2158c5/StartParadise`，分支 `main` |
| 目标主机 | ECS `i-0jlhpo15qqlwky4ldk5x` / `8.147.58.185`（华北6 乌兰察布 B） |
| 云效机器组 | `star-park-prod`（id 359190，uuid `tnohf384amokxmtw`） |
| 后端端口 | **3002** |
| 服务名 | `star-park-server.service`（systemd） |

> ⚠️ **端口 3001 禁止使用**：该端口被目标机上另一个无关线上应用
> `game-guess`（PM2 托管的 Next.js 应用）占用。`deploy/deploy.sh`
> 内置端口占用守卫，检测到被无关进程占用时会主动中止部署。

目标机目录布局：

```
/opt/star-park/
├── releases/<BUILD_NUMBER>/   # 历史版本（保留最近 5 个）
├── current -> releases/<N>    # 原子软链，切换即上线/回滚
├── shared/
│   ├── data/                  # SQLite 持久化，跨版本保留
│   └── star-park.env          # 生产环境变量（600 权限，不入库）
└── backups/                   # 每次部署前的数据库备份（保留 10 份）
```

小程序需人工发布：`cd star-park/miniprogram && npm run build:mp-weixin`
产出 `dist/build/mp-weixin/`，再用微信开发者工具上传。

### 1.3 CI/CD 流水线

流水线名称 **star-park-nodejs-cicd**（云效 Flow ID `5212797`），定义版本化于
`.flow/star-park-nodejs-cicd.yml`。

| 阶段 | 内容 | 卡点 | 状态 |
|------|------|------|------|
| 代码检查 | 架构分层 lint + 代码质量 lint（`scripts/lint-*.py`） | 失败即中断 | 已验证通过 |
| 单元测试 | `vitest run --coverage`（行覆盖率阈值 80%） | 失败即中断 | 已验证通过 |
| 构建 | `npm ci` 干净安装 + pc-admin `vite build` + 打包制品 | 失败即中断 | 已验证通过 |
| 部署 | 主机部署 → `deploy/deploy.sh` → 健康检查 | 健康检查失败自动回滚 | 已验证通过 |

> **机器组标识**：VMDeploy 组件的 `machineGroup` 只接受机器组 **uuid**
> `tnohf384amokxmtw`，OpenAPI（`GetHostGroup`）只返回数字 id `359190`，不返回 uuid，
> 该 uuid 只能从 Flow 控制台主机组页面获取。填数字 id 会报「该机器组uuid不存在」。
>
> **首次生产部署**：流水线运行 #10（2026-08-19）四阶段全部 SUCCESS，
> 目标机 `star-park-server.service` 已 enabled + active，`/api/health` 返回 `status: ok`，
> `current -> releases/10`，同机 `game-guess`(3001) 未受影响。
>
> **触发分支**：当前临时指向 `feat/nodejs-cicd-pipeline` 用于验证，
> 合并后需改回 `main` 并开启推送触发。
>
> **端口 3002 访问控制**：外网访问需同时穿过**两层**，缺一层都不通。

**第 1 层 — 安全组 `sg-0jlcfjm7lp3p2dmwag8d`（来源白名单）**

| 端口 | 来源 CIDR | 规则 ID | 说明 |
|------|-----------|---------|------|
| 3002 | `140.205.11.234/32` | `sgr-0jlinf1pmsafsh8fuhpu` | star-park pc-admin 3002 |

```bash
# 新增白名单（每个来源一条规则，便于单独回收）
aliyun ecs AuthorizeSecurityGroup --RegionId cn-wulanchabu \
  --SecurityGroupId sg-0jlcfjm7lp3p2dmwag8d \
  --IpProtocol tcp --PortRange 3002/3002 \
  --SourceCidrIp <CIDR> --Priority 100 --Description 'star-park pc-admin 3002'

# 回收白名单
aliyun ecs RevokeSecurityGroup --RegionId cn-wulanchabu \
  --SecurityGroupId sg-0jlcfjm7lp3p2dmwag8d \
  --IpProtocol tcp --PortRange 3002/3002 --SourceCidrIp <CIDR>
```

**第 2 层 — 目标机 firewalld（易被忽略）**

目标机 firewalld 处于 running，`public` zone 默认只放通 `ssh(22) / cockpit(9090) / 8000 / 8080`，
其余端口一律 `reject with icmpx admin-prohibited`。**只改安全组不改 firewalld 依然不通。**

```bash
# 查看当前放通情况
firewall-cmd --list-all

# 放通 3002（rich rule 限定来源，与安全组构成双层白名单）
firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=<CIDR> port port=3002 protocol=tcp accept'
firewall-cmd --reload

# 回收
firewall-cmd --permanent --remove-rich-rule='rule family=ipv4 source address=<CIDR> port port=3002 protocol=tcp accept'
firewall-cmd --reload
```

**排障判别**：`curl` 在**约一个 RTT（~40ms）内快速失败** → firewalld reject；
**一直超时到 timeout** → 安全组丢包。ICMP 能 ping 通不代表 TCP 可达。

> 注：同机 `game-guess`(3001) 同样未在 firewalld 放通，对外不可达，属其既有状态，本次未改动。

本地等价校验命令：

```bash
make lint-arch                                           # 架构与质量检查
cd star-park/server && npm ci && npm run test:coverage    # 单测 + 覆盖率
cd star-park/pc-admin && npm ci && npm run build          # 前端构建
```

> 依赖目录 `node_modules/` 不入库。CI 必须执行 `npm ci` 干净安装，
> 因为提交历史中曾包含 macOS arm64 原生二进制，复用会导致 Linux 构建失败。

#### 1.3.1 云效公共构建镜像的硬约束

云效北京公共构建集群镜像为 **Ubuntu 16.04**，以下三点是实测结论，修改流水线前务必确认：

| 约束 | 影响 | 应对 |
|------|------|------|
| 只有 Python 3.5（apt 无更高版本、无 docker、pypi 不可达） | lint 脚本用 f-string 会直接语法错误 | `scripts/lint-*.py` 必须保持 3.5 兼容，用 `str.format()` |
| NodeBuild 的 `version` 字段不生效，默认 Node 14.8.0 | npm 6 无法解析 `lockfileVersion 3` | 步骤内用镜像自带 nvm 显式 `nvm install 20` 并校验主版本 |
| g++ 5.4 不支持 `-std=c++20`，且 GitHub Releases 超时 | better-sqlite3 无法源码编译，prebuild 下载失败 | `npm ci --ignore-scripts` + 从 npmmirror 取对应 ABI 的预编译产物 |

> 自定义构建镜像（`runsOn.container`）无法通过 OpenAPI 配置——传该字段
> `UpdatePipeline` 会直接返回 system error，只能在控制台设置。

### 1.4 服务管理与回滚

```bash
# 服务状态与日志
systemctl status star-park-server
journalctl -u star-park-server -n 100 --no-pager
tail -f /var/log/star-park/server.log

# 健康检查
bash /opt/star-park/current/deploy/health-check.sh 3002

# 回滚到上一个版本
bash /opt/star-park/current/deploy/rollback.sh
# 回滚到指定版本
bash /opt/star-park/current/deploy/rollback.sh <BUILD_NUMBER>

# 查看可回滚版本与数据库备份
ls -1t /opt/star-park/releases/
ls -1t /opt/star-park/backups/
```

## 2 环境配置

### 2.1 环境列表

| 环境 | 用途 | 配置 |
|------|------|------|
| development | 本地开发 | 默认配置 |
| production | 生产部署 | NODE_ENV=production |

### 2.2 关键配置

```javascript
// 后端端口配置 — star-park/server/src/index.js:14
const PORT = 3001;

// 数据库路径 — star-park/server/src/database.js:10
const DB_PATH = path.join(DATA_DIR, 'star-park.db');
```

## 3 监控与日志

### 3.1 日志配置

- **框架**: console（开发环境）
- **级别**: 开发环境输出所有日志

### 3.2 健康检查

```bash
# 本地
curl http://localhost:3001/api/health
# 生产（目标机上，端口 3002）
curl http://127.0.0.1:3002/api/health
# 期望返回: {"status":"ok","timestamp":"..."}
```

### 3.3 查看日志

```bash
# 本地：直接运行查看控制台输出
cd star-park/server && npm run dev

# 生产
journalctl -u star-park-server -f
tail -f /var/log/star-park/server.log
tail -f /var/log/star-park/server.err.log
```

## 4 运维手册

### 4.1 服务管理

```bash
# 本地
cd star-park/server && npm start
pkill -f "node src/index.js" || true

# 生产（systemd 托管，勿用 pkill：会绕过 systemd 的自动重启语义）
systemctl status  star-park-server
systemctl restart star-park-server
systemctl stop    star-park-server
```

### 4.2 数据库维护

```bash
# 本地备份 / 恢复
cp star-park/server/data/star-park.db star-park/server/data/star-park.db.bak
cp star-park/server/data/star-park.db.bak star-park/server/data/star-park.db

# 重新初始化种子数据
rm star-park/server/data/star-park.db && npm start  # 自动重建

# 生产：数据库位于 /opt/star-park/shared/data/star-park.db
# 每次部署前由 deploy.sh 自动备份到 /opt/star-park/backups/（保留 10 份）
ls -1t /opt/star-park/backups/
# 手工恢复（需先停服，避免 WAL 状态不一致）
systemctl stop star-park-server
cp /opt/star-park/backups/star-park.db.<BUILD_NUMBER> /opt/star-park/shared/data/star-park.db
rm -f /opt/star-park/shared/data/star-park.db-wal /opt/star-park/shared/data/star-park.db-shm
systemctl start star-park-server
```

### 4.3 性能调优

- SQLite 已启用 WAL 模式提升并发性能
- 数据库文件位于 `star-park/server/data/` 目录
- 生产环境建议定期执行 `PRAGMA optimize`

## 5 安全与权限

### 5.1 当前状态

- **后端无认证中间件**：所有 `/api/*` 接口无鉴权，任何人可读写全部数据
- **CORS 全开**：`app.use(cors())` 未做来源白名单
- **无 HTTPS**：仅 HTTP 明文
- **安全组过宽**：目标机安全组 `sg-0jlcfjm7lp3p2dmwag8d` 对 `0.0.0.0/0`
  放通 22、3389、80、3001、8080

### 5.2 待办（按优先级）

| 优先级 | 项 | 说明 |
|--------|-----|------|
| P0 | 收紧安全组 | 22/3389 限制为办公出口 IP，移除未使用的 3389 |
| P0 | 3002 不对公网开放 | 生产端口默认不放通；对外访问统一走反向代理 |
| P1 | 增加 API 认证 | JWT 或 Session，覆盖全部 `/api/*` 写接口 |
| P1 | CORS 白名单 | 限定为实际前端域名 |
| P2 | HTTPS 反向代理 | 目标机未装 nginx，需先安装并申请证书 |
| P2 | 数据库异地备份 | 当前备份与数据同盘，磁盘故障会一并丢失 |

> ⚠️ 在完成 P0/P1 之前，不应把该服务端口暴露到公网。
