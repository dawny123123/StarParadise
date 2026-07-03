<template>
  <aside class="side-nav">
    <div class="side-nav-logo">
      <span class="logo-icon">⭐</span>
      <span class="logo-text">星星乐园</span>
    </div>
    <nav class="side-nav-menu">
      <router-link
        v-for="item in visibleMenuItems"
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.path) }"
      >
        <el-icon :size="20"><component :is="item.icon" /></el-icon>
        <span class="nav-item-text">{{ item.title }}</span>
      </router-link>
    </nav>
    <div class="side-nav-footer">
      <p class="footer-text">星星乐园 v1.0</p>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const menuItems = [
  { path: '/dashboard', title: '仪表盘', icon: 'DataBoard' },
  { path: '/goals', title: '目标管理', icon: 'Aim' },
  { path: '/checkin', title: '每日打卡', icon: 'Calendar' },
  { path: '/tasks', title: '任务管理', icon: 'List' },
  { path: '/balance', title: '积分记录', icon: 'Wallet', hidden: true },
  { path: '/rewards', title: '奖励管理', icon: 'Present' },
  { path: '/stats', title: '数据统计', icon: 'TrendCharts' }
]

const visibleMenuItems = computed(() => {
  return menuItems.filter(item => !item.hidden)
})

const isActive = (path) => {
  return route.path === path
}
</script>

<style scoped>
.side-nav {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--sidebar-width);
  background: #FFFFFF;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.side-nav-logo {
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border-bottom: 1px solid #F0EDE6;
}

.logo-icon {
  font-size: 28px;
  margin-right: 10px;
}

.logo-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary);
  letter-spacing: 1px;
}

.side-nav-menu {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  margin: 2px 8px;
  border-radius: 12px;
  color: var(--text-light);
  font-size: 15px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.nav-item:hover {
  background: #F5F3EE;
  color: var(--text);
}

.nav-item.active {
  background: rgba(25, 200, 185, 0.1);
  color: var(--primary);
  font-weight: 600;
}

.nav-item .el-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.nav-item-text {
  white-space: nowrap;
}

.side-nav-footer {
  padding: 16px 20px;
  border-top: 1px solid #F0EDE6;
}

.footer-text {
  font-size: 12px;
  color: var(--text-light);
  text-align: center;
}
</style>
