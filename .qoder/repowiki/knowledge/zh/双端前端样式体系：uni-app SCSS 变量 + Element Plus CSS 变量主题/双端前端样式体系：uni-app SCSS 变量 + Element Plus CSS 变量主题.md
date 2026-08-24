---
kind: frontend_style
name: 双端前端样式体系：uni-app SCSS 变量 + Element Plus CSS 变量主题
slug: frontend_style
category: frontend_style
scope:
    - '**'
---

## 1. 使用的系统与工具

仓库包含两个独立的前端工程，分别承担孩子端（小程序/H5）与家长端（PC 管理后台）的界面呈现：

- **孩子端**：基于 `uni-app`（`@dcloudio/uni-app` 3.x）+ Vue 3 开发，使用 `sass` 编译 `.scss`，通过 `uni.scss` 集中声明全局样式变量。
- **家长端**：基于 `Vue 3` + `Vite` + `Element Plus` 2.x 构建，通过 `src/styles/main.css` 中的 CSS 自定义属性（CSS Variables）覆盖 Element Plus 组件主题色，并定义通用卡片、页面容器等基础样式。

两端均不使用 Tailwind 或 CSS-in-JS 方案，而是采用“设计令牌（design tokens）→ 全局变量 → 组件样式”的传统分层方式。状态管理统一使用 Pinia（`pinia`），路由由 uni-app 内置导航与 `vue-router` 分别管理。

## 2. 关键文件与包

| 文件 | 作用 |
|---|---|
| `star-park/miniprogram/src/uni.scss` | 孩子端全局 SCSS 变量：主色 `$primary`、背景 `$bg`、文字 `$text`、圆角 `$radius-*`、阴影 `$shadow-card`，以及按孩子分配的标识色 `$child-1/2/3` |
| `star-park/pc-admin/src/styles/main.css` | PC 端全局样式：`:root` 中定义 `--primary/--bg/--text/--card-bg` 等 CSS 变量；重置样式；覆盖 Element Plus 按钮、菜单、标签页、开关、进度条、输入框焦点态的主题色；定义 `.page-container`、`.card`、`.fade-in-up`、`.check-bounce` 等通用类 |
| `star-park/miniprogram/package.json` | 依赖 `@dcloudio/uni-app`、`vue`、`pinia`、`sass`，脚本提供 `dev:mp-weixin` / `build:mp-weixin` / `dev:h5` / `build:h5` |
| `star-park/pc-admin/package.json` | 依赖 `element-plus`、`echarts`、`axios`、`dayjs`、`vue-router`、`pinia`，脚本提供 `dev` / `build` / `preview` |
| `star-park/miniprogram/src/pages/index/index.vue` | 示例页面，使用 BEM 风格类名（如 `greeting__title`、`summary__value`）并通过 `lang="scss" scoped` 引用 `$text`、`$radius-small`、`$shadow-card` 等变量 |
| `star-park/pc-admin/src/views/Dashboard.vue` | 示例视图，复用 `.page-container`、`.fade-in-up` 等全局类，并通过 `var(--text)`、`var(--text-light)` 获取颜色 |

## 3. 架构与约定

### 3.1 设计令牌（Design Tokens）

- **孩子端**：所有颜色、圆角、阴影集中在 `uni.scss` 中，以 SCSS 变量形式暴露给各页面 `<style lang="scss" scoped>` 使用。命名遵循语义化前缀：`$primary`（品牌主色）、`$bg`（页面背景）、`$text/$text-light/$text-muted`（文字层级）、`$border`、`$surface`，以及按孩子维度区分的 `$child-1/#FF6B6B`、`$child-2/#4ECDC4`、`$child-3/#FFD93D`。
- **PC 端**：在 `main.css` 的 `:root` 中定义同名语义化的 CSS 变量（`--primary`、`--bg`、`--text`、`--card-bg`、`--sidebar-width`、`--border-radius`、`--shadow`、`--font-family`），并通过 Element Plus 的 CSS 变量覆盖机制（如 `--el-button-bg-color`、`--el-tabs__active-bar`）将组件默认主题统一为项目主色。

### 3.2 组件库与主题定制

- PC 端明确依赖 `element-plus`，并通过 `.el-button--primary`、`.el-menu--horizontal > .el-menu-item.is-active`、`.el-tabs__active-bar`、`.el-switch.is-checked`、`.el-checkbox__input.is-checked`、`.el-radio__input.is-checked`、`.el-progress-bar__inner`、`.el-input__wrapper:focus-within` 等选择器覆盖其内部 CSS 变量，使所有 UI 控件统一使用 `--primary` 色系。
- 未引入任何 UI 框架的孩子端，完全自写样式，通过 `uni.scss` 变量保证多页面视觉一致。

### 3.3 样式组织模式

- **BEM 风格类名**：页面级样式使用 `block__element--modifier` 变体（如 `greeting__title`、`summary__item`、`summary__value`），便于在 uni-app 的 `view`/`text` 结构中定位样式。
- **Scoped 样式**：所有 `.vue` 文件使用 `<style scoped>`（或 `<style lang="scss" scoped>`），避免样式泄漏到全局。
- **全局基础样式**：PC 端通过 `main.css` 提供 `.page-container`、`.card`、`.page-title`、`.fade-in-up`、`.check-bounce` 等可复用的布局与动画类；孩子端无此类全局 CSS 文件，仅依赖 `uni.scss`。
- **响应式策略**：PC 端通过 `html, body { min-width: 1024px }` 固定最小宽度；孩子端使用 `rpx` 单位适配不同屏幕尺寸，符合微信小程序规范。

### 3.4 业务视觉约定

- 品牌主色统一为 `#19C8B9`（青绿色），用于按钮、激活态、进度条、边框高亮等。
- 每个孩子在两端都有专属标识色（`#FF6B6B`、`#4ECDC4`、`#FFD93D`），用于头像、卡片强调、统计数字等，体现“多孩子并行激励”的业务特征。
- 卡片风格统一：白色背景、圆角（PC 端 `--border-radius: 18px`，孩子端 `$radius-card: 16rpx`）、柔和阴影（`$shadow-card` / `--shadow`），hover 时轻微上浮增强交互感。

## 4. 约定与约束

- **变量集中管理**：颜色、圆角、阴影必须从 `uni.scss`（孩子端）或 `:root` CSS 变量（PC 端）引用，禁止在组件内硬编码十六进制颜色值——该约定由 `uni.scss` 与 `main.css` 的设计令牌结构所体现。
- **Element Plus 主题覆盖**：PC 端新增或修改 Element Plus 组件外观时，应通过 `main.css` 中对应 `.el-*` 选择器的 CSS 变量覆盖，而非直接设置内联样式。
- **单位规范**：孩子端使用 `rpx` 进行响应式排版；PC 端使用 `px` 配合 `min-width: 1024px` 的桌面端布局。
- **样式隔离**：所有组件样式必须使用 `scoped`，避免跨页面污染。
- **动画复用**：页面级过渡动画优先复用 `fade-in-up`、`check-bounce` 等全局 keyframes，而非在单个组件内重复定义。

总体而言，该项目的前端样式体系是“双端各自维护一套设计令牌 + PC 端基于 Element Plus 主题覆盖”的组合方案，通过统一的 `#19C8B9` 主色与三组孩子标识色贯穿孩子端小程序与家长端管理后台，形成一致的视觉语言。