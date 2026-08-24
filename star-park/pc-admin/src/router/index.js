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
        path: 'goals/:childName',
        name: 'ChildGoals',
        component: () => import('../views/Goals.vue'),
        meta: { title: '目标管理', icon: 'Target' }
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
        path: 'best-practices',
        name: 'BestPractices',
        component: () => import('../views/BestPractices.vue'),
        meta: { title: '轻眉沉淀', icon: 'Collection' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const title = to.params.childName ? `${to.params.childName}目标管理` : (to.meta.title || '目标')
  document.title = `${title} - 目标管理后台`
  next()
})

export default router
