<template>
  <div class="page-container fade-in-up">
    <div class="welcome-section">
      <h1 class="welcome-title">⭐ 目标</h1>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import { getDashboard } from '../api'
import ChildCard from '../components/ChildCard.vue'

const store = useAppStore()
const loading = ref(false)
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
    '甜甜': '#FF6B6B',
    '甄甄': '#4ECDC4',
    '欣甜': '#FFD93D'
  }
  return colorMap[name] || '#19C8B9'
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

/* 孩子卡片区域 */
.cards-row {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
</style>