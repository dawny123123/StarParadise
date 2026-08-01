---
kind: dependency_management
name: 基于 npm 多包工作区的依赖管理策略
category: dependency_management
scope:
    - '**'
source_files:
    - star-park/package.json
    - star-park/server/package.json
    - star-park/pc-admin/package.json
    - star-park/miniprogram/package.json
    - scripts/lint-deps.py
---

本仓库采用 npm 多包工作区（monorepo）模式，以 star-park/ 为应用根目录，内含三个独立子项目：后端 Express 服务、PC 管理前端与 UniApp 小程序。每个子项目拥有独立的 package.json 与 node_modules，通过顶层脚本统一编排安装与启动流程。

### 1. 使用的系统与工具
- 包管理器：npm（配合 package-lock.json 锁定版本）
- 工作区编排：顶层 star-park/package.json 中的 install:all 脚本顺序调用各子项目的 npm install
- 构建工具：Vite（pc-admin）、@dcloudio/vite-plugin-uni（miniprogram）、原生 node（server）
- 依赖检查：自定义 Python 脚本 scripts/lint-deps.py 校验内部模块的层间导入关系（非第三方包）

### 2. 关键文件与位置
- star-park/package.json — 顶层工作区入口，定义跨子项目脚本
- star-park/server/package.json — 后端依赖（express、better-sqlite3、cors、dayjs）
- star-park/pc-admin/package.json — PC 前端依赖（vue3、element-plus、echarts、axios）
- star-park/miniprogram/package.json — 小程序依赖（@dcloudio/uni-* 全家桶、pinia、sass）
- scripts/lint-deps.py — 内部模块依赖层级检查器（不扫描 node_modules）

### 3. 架构与约定
- 子项目隔离：每个子项目独立声明 dependencies/devDependencies，无共享 workspace 配置，避免跨包依赖耦合
- 版本策略：使用 ^ 语义化版本范围，由 package-lock.json 精确锁定；部分依赖存在异常命名（如 "2": "^3.0.0"），需人工核查来源
- 层间约束：通过 lint-deps.py 强制禁止前端直接 import 后端代码，仅允许通过 HTTP API 通信，确保前后端解耦
- 跳过目录：脚本显式跳过 node_modules、dist、.qoder、.claude、vendor、data、harness、scripts 等目录

### 4. 开发者应遵循的规则
- 新增第三方依赖时，仅在对应子项目的 package.json 中声明，不得在顶层或跨子项目引用
- 升级依赖后提交更新后的 package-lock.json，确保可重现构建
- 如需引入私有 npm 源，应在子项目 .npmrc 中配置而非全局设置
- 修改内部模块导入前，先运行 python3 scripts/lint-deps.py 验证未违反分层约定
- 谨慎处理异常依赖名（如 "2"），确认其真实来源后再纳入依赖清单