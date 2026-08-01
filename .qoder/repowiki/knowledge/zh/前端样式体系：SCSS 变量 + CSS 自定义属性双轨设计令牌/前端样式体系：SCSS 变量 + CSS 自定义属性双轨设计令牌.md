---
kind: frontend_style
name: 前端样式体系：SCSS 变量 + CSS 自定义属性双轨设计令牌
category: frontend_style
scope:
    - '**'
source_files:
    - star-park/miniprogram/src/uni.scss
    - star-park/miniprogram/src/App.vue
    - star-park/pc-admin/src/styles/main.css
    - star-park/pc-admin/package.json
    - star-park/miniprogram/package.json
---

## 1. 使用的系统/方法
- **小程序端（UniApp）**：基于 Vue3 + UniApp，使用 SCSS（Sass）编写全局样式变量，通过 `uni.scss` 集中定义设计令牌，组件内使用原生 `<style>` 配合 rpx 单位实现移动端适配。
- **PC 管理端**：基于 Vue3 + Vite + Element Plus，采用 CSS 自定义属性（CSS Variables）作为设计令牌中心，通过 `:root` 声明主题色、字号、圆角、阴影等，并覆盖 Element Plus 组件默认样式以统一品牌色。
- **构建工具**：两端均使用 Vite；小程序端额外依赖 `sass` 编译 SCSS。

## 2. 关键文件与包
- `star-park/miniprogram/src/uni.scss` — 小程序全局 SCSS 变量（主色、背景、文字、圆角、阴影等）
- `star-park/miniprogram/src/App.vue` — 小程序页面级基础样式（page 背景、字体、字号）
- `star-park/pc-admin/src/styles/main.css` — PC 端全局样式与主题变量、Element Plus 覆盖、通用卡片/动画类
- `star-park/pc-admin/package.json` — 依赖 Element Plus、Vue3、Vite
- `star-park/miniprogram/package.json` — 依赖 UniApp、Pinia、Sass

## 3. 架构与约定
- **设计令牌分层**：
  - 小程序端用 SCSS 变量（`$primary`、`$bg`、`$text`、`$radius-*`、`$shadow-card` 等），在 `uni.scss` 中统一定义，便于 Sass 编译期替换。
  - PC 端用 CSS 自定义属性（`--primary`、`--bg`、`--card-bg`、`--border-radius`、`--shadow` 等），在 `:root` 中声明，运行时可动态切换。
- **品牌色一致性**：两端共享同一主色调 `#19C8B9`（青色），小程序端通过 SCSS 变量引用，PC 端通过 CSS 变量并在 Element Plus 按钮、菜单、标签页、开关、复选框、单选框、进度条、输入框焦点等组件上强制覆盖。
- **响应式策略**：小程序端使用 `rpx` 单位自动适配不同屏幕宽度；PC 端通过 `min-width: 1024px` 固定最小宽度，未采用媒体查询断点。
- **组件库集成**：PC 端直接消费 Element Plus 组件，并通过 `.el-*` 选择器覆盖其 CSS 变量（如 `--el-button-bg-color`）以实现主题统一；小程序端未引入 UI 框架，样式手写。
- **通用样式类**：PC 端提供 `.page-container`、`.page-title`、`.card`、`.fade-in-up`、`.check-bounce` 等复用类，减少重复样式。

## 4. 约定与约束
- **颜色与视觉令牌必须从变量引入**：所有页面和组件应通过 `uni.scss`（小程序）或 `:root` CSS 变量（PC）引用颜色和尺寸，禁止硬编码具体色值。
- **Element Plus 主题覆盖规范**：PC 端对 Element Plus 的交互态（hover/active/focus）及选中态样式统一通过 `!important` 覆盖为品牌主色，确保视觉一致性。
- **移动端单位规范**：小程序端统一使用 `rpx` 进行布局与字号设置，保证多设备自适应。
- **全局基础样式集中管理**：小程序的 `page` 基础样式与 PC 的 `html/body/#app` 重置均在入口文件中声明，避免分散。
- **无 Tailwind / CSS-in-JS**：项目未使用原子化 CSS 或 CSS-in-JS 方案，全部采用传统 CSS/SCSS 文件组织方式。