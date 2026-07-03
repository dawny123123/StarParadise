import { createRouter, createWebHistory } from 'vue-router'
import Layout from '../components/Layout.vue'

const routes = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'),
        meta: { title: '仪表盘', icon: 'DataBoard' }
      },
      {
        path: 'goals',
        name: 'Goals',
        component: () => import('../views/Goals.vue'),
        meta: { title: '目标管理', icon: 'Target' }
      },
      {
        path: 'checkin',
        name: 'Checkin',
        component: () => import('../views/Checkin.vue'),
        meta: { title: '每日打卡', icon: 'Calendar' }
      },
      {
        path: 'tasks',
        name: 'Tasks',
        component: () => import('../views/Tasks.vue'),
        meta: { title: '任务管理', icon: 'List' }
      },
      {
        path: 'balance',
        name: 'Balance',
        component: () => import('../views/Balance.vue'),
        meta: { title: '积分记录', icon: 'Wallet' }
      },
      {
        path: 'rewards',
        name: 'Rewards',
        component: () => import('../views/Rewards.vue'),
        meta: { title: '奖励管理', icon: 'Present' }
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('../views/Stats.vue'),
        meta: { title: '数据统计', icon: 'TrendCharts' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '星星乐园'} - 星星乐园管理后台`
  next()
})

export default router
