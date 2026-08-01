<template>
  <aside class="side-nav">
    <div class="side-nav-logo">
      <span class="logo-icon">⭐</span>
      <span class="logo-text">目标</span>
    </div>
    <nav class="side-nav-menu">
      <template v-for="item in visibleMenuItems" :key="item.path">
        <div v-if="item.children" class="nav-group">
          <div
            class="nav-item nav-group-title"
            :class="{ active: isGroupActive(item) }"
            @click="toggleGroup(item.path)"
          >
            <el-icon :size="20"><component :is="item.icon" /></el-icon>
            <span class="nav-item-text">{{ item.title }}</span>
            <el-icon :size="14" class="nav-arrow" :class="{ expanded: isExpanded(item.path) }">
              <ArrowDown />
            </el-icon>
          </div>
          <div v-show="isExpanded(item.path)" class="nav-sub-list">
            <router-link
              v-for="sub in item.children"
              :key="sub.path"
              :to="sub.path"
              class="nav-item nav-sub-item"
              :class="{ active: isActive(sub.path) }"
            >
              <span class="nav-item-text">{{ sub.title }}</span>
            </router-link>
          </div>
        </div>
        <router-link
          v-else
          :to="item.path"
          class="nav-item"
          :class="{ active: isActive(item.path) }"
        >
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
          <span class="nav-item-text">{{ item.title }}</span>
        </router-link>
      </template>
    </nav>
    <div class="side-nav-footer">
      <p class="footer-text">目标 v1.0</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'

const route = useRoute()

const menuItems = [
  { path: '/dashboard', title: '仪表盘', icon: 'DataBoard' },
  {
    path: '/goals',
    title: '目标管理',
    icon: 'Aim',
    children: [
      { path: '/goals', title: '全部目标' },
      { path: '/goals/洋洋', title: '洋洋目标管理' },
      { path: '/goals/甜甜', title: '甜甜目标管理' },
      { path: '/goals/甄甄', title: '甄甄目标管理' },
      { path: '/goals/欣甜', title: '欣甜目标管理' }
    ]
  },
  { path: '/balance', title: '积分记录', icon: 'Wallet', hidden: true },
  { path: '/rewards', title: '奖励管理', icon: 'Present' },
  { path: '/stats', title: '数据统计', icon: 'TrendCharts' }
]

const visibleMenuItems = computed(() => {
  return menuItems.filter(item => !item.hidden)
})

// route.path 中文段会被编码，统一解码后比较
const currentPath = computed(() => decodeURIComponent(route.path))

const isActive = (path) => {
  return currentPath.value === path
}

const isGroupActive = (item) => {
  return item.children.some(sub => isActive(sub.path))
}

const expandedGroups = reactive({})

const isExpanded = (path) => !!expandedGroups[path]

const toggleGroup = (path) => {
  expandedGroups[path] = !expandedGroups[path]
}

// 当前路由命中子菜单时自动展开对应分组
watch(currentPath, (path) => {
  menuItems.forEach(item => {
    if (item.children && item.children.some(sub => sub.path === path)) {
      expandedGroups[item.path] = true
    }
  })
}, { immediate: true })
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

.nav-group-title {
  user-select: none;
}

.nav-item .nav-arrow {
  margin-left: auto;
  margin-right: 0;
  transition: transform 0.2s ease;
}

.nav-item .nav-arrow.expanded {
  transform: rotate(180deg);
}

.nav-sub-item {
  padding: 10px 24px 10px 56px;
  font-size: 14px;
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
