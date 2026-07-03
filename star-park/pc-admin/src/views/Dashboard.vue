<template>
  <div class="page-container fade-in-up">
    <div class="welcome-section">
      <h1 class="welcome-title">⭐ 星星乐园 - 今日学习进度</h1>
      <p class="welcome-date">{{ todayStr }}</p>
    </div>

    <!-- 孩子卡片区域 -->
    <div v-loading="loading" class="cards-row">
      <ChildCard
        v-for="child in children"
        :key="child.id"
        :child="child"
        :color="getChildColor(child.name)"
      />
      <el-empty v-if="!loading && children.length === 0" description="暂无孩子数据" />
    </div>

    <div class="quick-actions card">
      <h3 class="section-title">快捷操作</h3>
      <div class="actions-row">
        <el-button type="primary" size="large" :loading="triggering" @click="handleCheckin">
          <el-icon v-if="!triggering"><Calendar /></el-icon>
          <span>{{ triggering ? '触发中...' : '去打卡' }}</span>
        </el-button>
        <el-button size="large" @click="$router.push('/tasks')">
          <el-icon><List /></el-icon>
          <span>管理任务</span>
        </el-button>
        <el-button size="large" @click="$router.push('/rewards')">
          <el-icon><Present /></el-icon>
          <span>奖励管理</span>
        </el-button>
        <el-button size="large" @click="$router.push('/stats')">
          <el-icon><TrendCharts /></el-icon>
          <span>查看统计</span>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import { getDashboard, triggerQoderWake } from '../api'
import { ElMessage } from 'element-plus'
import ChildCard from '../components/ChildCard.vue'
import { Calendar, List, Present, TrendCharts } from '@element-plus/icons-vue'

const store = useAppStore()
const router = useRouter()
const loading = ref(false)
const triggering = ref(false)
const dashboardData = ref(null)

const children = computed(() => {
  if (dashboardData.value) {
    const data = dashboardData.value
    return Array.isArray(data) ? data : (data.children || [])
  }
  return store.children
})

const todayStr = computed(() => {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

const getChildColor = (name) => {
  const colorMap = {
    '老二': '#FF6B6B',
    '老三': '#4ECDC4',
    '老四': '#FFD93D'
  }
  return colorMap[name] || '#19C8B9'
}

const handleCheckin = async () => {
  triggering.value = true
  try {
    await triggerQoderWake('执行今日打卡任务')
    ElMessage.success('打卡任务已触发，请在 QoderWake 中查看进度')
  } catch (err) {
    ElMessage.warning(`QoderWake 触发失败: ${err.message}，已跳转至打卡页`)
  } finally {
    triggering.value = false
  }
  router.push('/checkin')
}

const fetchDashboard = async () => {
  loading.value = true
  try {
    const data = await getDashboard()
    dashboardData.value = data
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    await store.fetchChildren()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.welcome-section {
  margin-bottom: 24px;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
}

.welcome-date {
  font-size: 14px;
  color: var(--text-light);
  margin-top: 6px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}

/* 孩子卡片区域 */
.cards-row {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.quick-actions {
  background: #fff;
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.actions-row .el-button {
  border-radius: 12px;
  height: 44px;
  padding: 0 24px;
  font-size: 15px;
}

.actions-row .el-button .el-icon {
  margin-right: 6px;
}
</style>