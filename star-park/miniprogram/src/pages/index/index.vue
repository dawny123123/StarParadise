<template>
  <view class="page-index">
    <!-- 顶部问候 -->
    <view class="greeting">
      <text class="greeting__title">{{ greeting }}</text>
      <text class="greeting__date">{{ dateStr }}</text>
    </view>

    <!-- 孩子卡片列表 -->
    <view class="card-list">
      <ChildCard
        v-for="child in children"
        :key="child.id"
        :name="child.name"
        :avatarText="child.avatarText"
        :color="child.color"
        :taskDesc="child.taskDesc"
        :checkedIn="child.checkedIn"
        :streak="child.streak"
        :balance="child.balance"
        @tap="goToCheckin(child)"
      />
    </view>

    <!-- 底部汇总 -->
    <view class="summary">
      <view class="summary__item">
        <text class="summary__value">{{ maxStreak }}</text>
        <text class="summary__label">最长连续</text>
      </view>
      <view class="summary__item">
        <text class="summary__value">{{ weeklyRate }}</text>
        <text class="summary__label">本周完成</text>
      </view>
      <view class="summary__item">
        <text class="summary__value">{{ totalBalance }}</text>
        <text class="summary__label">总积累</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import ChildCard from '@/components/ChildCard.vue'
import { api } from '@/api/index.js'

const children = ref([])

// 问候语
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了，注意休息'
  if (hour < 12) return '早上好，今天也要加油呀'
  if (hour < 14) return '中午好，休息一下吧'
  if (hour < 18) return '下午好，继续努力'
  return '晚上好，辛苦一天了'
})

// 日期显示
const dateStr = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const w = days[now.getDay()]
  const checkedCount = children.value.filter(c => c.checkedIn).length
  return `${y}年${m}月${d}日 · 周${w} · 已完成 ${checkedCount}/${children.value.length} 个打卡`
})

// 汇总数据
const maxStreak = computed(() => {
  if (!children.value.length) return 0
  return Math.max(...children.value.map(c => c.streak))
})

const weeklyRate = computed(() => {
  // 简单展示，实际从 API 获取
  return '87%'
})

const totalBalance = computed(() => {
  const total = children.value.reduce((sum, c) => {
    const num = parseFloat(c.balance.replace(/[¥,]/g, '')) || 0
    return sum + num
  }, 0)
  return `¥${total}`
})

// 跳转打卡页
const goToCheckin = (child) => {
  uni.switchTab({
    url: '/pages/checkin/index'
  })
}

// 加载数据
const loadDashboard = async () => {
  try {
    const res = await api.getDashboard()
    if (res && res.children) {
      children.value = res.children.map(c => ({
        id: c.id,
        name: c.name,
        avatarText: c.name.replace('老', ''),
        color: c.color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
        taskDesc: c.taskDesc || c.tasks?.map(t => t.name).join(' · ') || '',
        checkedIn: c.checkedIn || false,
        streak: c.streak || 0,
        balance: c.balance ? `¥${c.balance}` : '¥0'
      }))
    }
  } catch (err) {
    console.error('加载仪表盘失败', err)
    // 使用默认数据
    children.value = [
      { id: 1, name: '老二', avatarText: '二', color: '#FF6B6B', taskDesc: '英语10词 · 数学1套 · 语文阅读', checkedIn: true, streak: 15, balance: '¥127' },
      { id: 2, name: '老三', avatarText: '三', color: '#4ECDC4', taskDesc: '练字50字', checkedIn: false, streak: 8, balance: '¥58' },
      { id: 3, name: '老四', avatarText: '四', color: '#FFD93D', taskDesc: '背诗1首', checkedIn: true, streak: 22, balance: '¥45' }
    ]
  }
}

onMounted(() => {
  loadDashboard()
})

onShow(() => {
  loadDashboard()
})
</script>

<style lang="scss" scoped>
.page-index {
  padding: 24rpx;
  min-height: 100vh;
}

.greeting {
  margin-bottom: 32rpx;
  padding: 8rpx 0;

  &__title {
    display: block;
    font-size: 40rpx;
    font-weight: 800;
    color: $text;
    letter-spacing: -0.02em;
  }

  &__date {
    display: block;
    font-size: 26rpx;
    color: $text-light;
    margin-top: 8rpx;
  }
}

.card-list {
  margin-bottom: 24rpx;
}

.summary {
  display: flex;
  gap: 16rpx;

  &__item {
    flex: 1;
    text-align: center;
    padding: 20rpx 12rpx;
    background: #ffffff;
    border-radius: $radius-small;
    box-shadow: $shadow-card;
  }

  &__value {
    display: block;
    font-size: 36rpx;
    font-weight: 800;
    color: $text;
    letter-spacing: -0.02em;
  }

  &__label {
    display: block;
    font-size: 22rpx;
    color: $text-light;
    margin-top: 4rpx;
  }
}
</style>
