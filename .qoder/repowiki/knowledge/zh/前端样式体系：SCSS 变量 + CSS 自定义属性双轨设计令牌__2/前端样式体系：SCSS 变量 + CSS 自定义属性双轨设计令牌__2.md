---
kind: frontend_style
name: 前端样式体系：SCSS 变量 + CSS 自定义属性双轨设计令牌
category: frontend_style
scope:
    - '**'
source_files:
    - star-park/miniprogram/src/uni.scss
    - star-park/pc-admin/src/styles/main.css
    - star-park/miniprogram/src/components/ChildCard.vue
    - star-park/miniprogram/src/pages/index/index.vue
    - star-park/pc-admin/src/views/Dashboard.vue
    - star-park/pc-admin/src/components/Layout.vue
---

## 1. 系统概览
本仓库包含两个独立的前端应用，各自维护一套风格系统，但通过统一的色彩与圆角等视觉语义保持跨端一致。
- 小程序端（UniApp + Vue3）：使用 SCSS 全局变量集中管理主题色、字号、圆角、阴影等设计令牌，组件内以 lang="scss" scoped 编写样式。
- PC 管理后台（Vue3 + Vite + Element Plus）：使用 CSS 自定义属性（:root 变量）作为主题层，并通过覆盖 Element Plus 的 CSS 变量实现品牌化；组件样式采用 <style scoped> 原生 CSS。

两套方案均不依赖 Tailwind、CSS Modules、styled-components 等原子/JS-in-CSS 方案，而是以“集中式变量 + 局部 scoped 样式”的传统模式组织。