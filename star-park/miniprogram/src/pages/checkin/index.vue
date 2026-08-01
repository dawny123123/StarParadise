<template>
  <view class="page-checkin">
    <!-- 孩子选择器 -->
    <view class="child-selector">
      <view
        v-for="child in children"
        :key="child.id"
        class="child-tab"
        :class="{ 'child-tab--active': activeChildId === child.id }"
        :style="activeChildId === child.id ? { backgroundColor: child.color, borderColor: child.color } : {}"
        @tap="selectChild(child)"
      >
        <text class="child-tab__text" :class="{ 'child-tab__text--active': activeChildId === child.id }">{{ child.name }}</text>
      </view>
    </view>

    <!-- 祝贺动画 -->
    <view v-if="showSuccess" class="success-overlay">
      <view class="success-card">
        <view class="success-icon">
          <text class="success-star">★</text>
        </view>
        <text class="success-title">打卡成功！</text>
        <text class="success-reward">获得 {{ lastReward }}</text>
        <text class="success-sub">{{ activeChild?.name }}太棒了，继续加油！</text>
        <view class="success-btn" @tap="showSuccess = false">
          <text class="success-btn__text">好的</text>
        </view>
      </view>
    </view>

    <!-- 积分奖励弹窗 -->
    <PointsModal
      :visible="showPointsModal"
      :children="children"
      :defaultChildId="activeChildId"
      @close="showPointsModal = false"
      @submitted="onPointsSubmitted"
    />

    <!-- 任务列表 -->
    <view v-if="activeChild" class="task-section">
      <text class="section-title">{{ activeChild.name }}的今日任务</text>

      <!-- 积分奖励入口 -->
      <view class="points-entry" @tap="showPointsModal = true">
        <text class="points-entry__icon">⭐</text>
        <text class="points-entry__text">特殊积分奖励</text>
        <text class="points-entry__badge">+积分</text>
        <text class="points-entry__arrow">›</text>
      </view>

      <TaskItem
        v-for="task in activeTasks"
        :key="task.id"
        :name="task.name"
        :desc="task.desc"
        :reward="task.reward"
        :done="task.done"
        :disabled="task.checkedToday"
        @toggle="toggleTask(task)"
      />

      <!-- 打卡按钮 -->
      <view class="submit-area">
        <view
          class="submit-btn"
          :class="{ 'submit-btn--disabled': !canSubmit }"
          @tap="submitCheckin"
        >
          <text class="submit-btn__text">
            {{ allDone ? '今日任务已全部完成' : (canSubmit ? `确认打卡 · 今日获得 ${todayReward}` : '请先完成任务') }}
          </text>
        </view>
        <view
          class="auto-checkin-btn"
          :class="{ 'auto-checkin-btn--loading': autoCheckinLoading }"
          @tap="handleAutoCheckinAll"
        >
          <text class="auto-checkin-btn__text">
            {{ autoCheckinLoading ? '打卡中...' : '一键全部打卡' }}
          </text>
        </view>
      </view>

      <!-- 统计信息 -->
      <view class="stats-card">
        <view class="stats-card__row">
          <view class="stats-card__col">
            <text class="stats-card__label">{{ activeChild.name }}连续打卡</text>
            <text class="stats-card__value">{{ activeChild.streak }}天</text>
          </view>
          <view class="stats-card__col stats-card__col--right">
            <text class="stats-card__label">本月累计</text>
            <text class="stats-card__value">{{ activeChild.monthlyEarnings }}</text>
          </view>
        </view>
        <view class="stats-card__row stats-card__row--points">
          <view class="stats-card__col">
            <text class="stats-card__label">累计余额</text>
            <text class="stats-card__value">{{ activeChild.balance }}</text>
          </view>
          <view class="stats-card__col stats-card__col--right">
            <text class="stats-card__label">总积分</text>
            <text class="stats-card__value stats-card__value--points">{{ activeChild.pointsBalance }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty">
      <text class="empty__text">请选择一个孩子开始打卡</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import TaskItem from '@/components/TaskItem.vue'
import PointsModal from '@/components/PointsModal.vue'
import { api } from '@/api/index.js'

const children = ref([])
const activeChildId = ref(null)
const showSuccess = ref(false)
const lastReward = ref('')
const showPointsModal = ref(false)

const activeChild = computed(() => {
  return children.value.find(c => c.id === activeChildId.value) || null
})

const activeTasks = computed(() => {
  return activeChild.value?.tasks || []
})

const canSubmit = computed(() => {
  return activeTasks.value.some(t => t.done)
})

const allDone = computed(() => {
  return activeTasks.value.length > 0 && activeTasks.value.every(t => t.done)
})

const todayReward = computed(() => {
  const total = activeTasks.value
    .filter(t => t.done)
    .reduce((sum, t) => {
      const num = parseFloat(t.reward.replace(/[^0-9.]/g, '')) || 0
      return sum + num
    }, 0)
  return `${total}元`
})

const selectChild = (child) => {
  activeChildId.value = child.id
}

const toggleTask = (task) => {
  if (task.checkedToday) return
  task.done = !task.done
}

const onPointsSubmitted = ({ childId, newBalance }) => {
  const child = children.value.find(c => c.id === childId)
  if (child && newBalance !== undefined) {
    child.pointsBalance = newBalance
  }
  showPointsModal.value = false
}

const submitCheckin = async () => {
  if (!canSubmit.value || allDone.value) return
  const newDoneTasks = activeTasks.value.filter(t => t.done && !t.checkedToday)
  if (!newDoneTasks.length) {
    uni.showToast({ title: '没有新任务需要打卡', icon: 'none' })
    return
  }
  lastReward.value = todayReward.value

  try {
    const today = new Date().toISOString().split('T')[0]
    for (const task of newDoneTasks) {
      await api.createCheckin({
        child_id: activeChildId.value,
        task_id: task.id,
        checkin_date: today,
        completed: 1
      })
    }
  } catch (err) {
    console.error('打卡提交失败', err)
    uni.showToast({ title: '打卡失败', icon: 'none' })
    return
  }

  newDoneTasks.forEach(t => { t.checkedToday = true })
  showSuccess.value = true
}

// 一键全部打卡
const autoCheckinLoading = ref(false)
const handleAutoCheckinAll = async () => {
  if (autoCheckinLoading.value) return
  autoCheckinLoading.value = true
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await api.autoCheckinAll({ checkin_date: today })
    if (result.created > 0) {
      uni.showToast({ title: `自动打卡完成：新增${result.created}条`, icon: 'none', duration: 3000 })
      await loadData()
    } else {
      uni.showToast({ title: '今日已全部打卡完成', icon: 'none' })
    }
  } catch (err) {
    console.error('自动打卡失败', err)
    uni.showToast({ title: '自动打卡失败', icon: 'none' })
  } finally {
    autoCheckinLoading.value = false
  }
}

const loadData = async () => {
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
        streak: c.streak || 0,
        monthlyEarnings: c.monthlyEarnings || '¥0',
        balance: c.balance || '¥0',
        pointsBalance: c.points_balance || 0,
        tasks: (c.tasks || []).map(t => ({
          id: t.id,
          name: t.name,
          desc: t.desc || t.standard || '',
          reward: t.reward || '+1元',
          done: false,
          checkedToday: false
        }))
      }))
      if (!activeChildId.value && children.value.length) {
        activeChildId.value = children.value[0].id
      }
      await markTodayCheckins()
    }
  } catch (err) {
    console.error('加载孩子数据失败', err)
    children.value = [
      { id: 1, name: '甜甜', color: '#FF6B6B', streak: 15, monthlyEarnings: '¥34', balance: '¥34', pointsBalance: 0,
        tasks: [
          { id: 1, name: '英语背单词10个', desc: '每天10个新词', reward: '+1元', done: false, checkedToday: false },
          { id: 2, name: '数学练习1套', desc: '完成1套练习题', reward: '+2元', done: false, checkedToday: false },
          { id: 3, name: '语文阅读30分钟', desc: '课外阅读', reward: '+1元', done: false, checkedToday: false }
        ] },
      { id: 2, name: '甄甄', color: '#4ECDC4', streak: 8, monthlyEarnings: '¥18', balance: '¥18', pointsBalance: 0,
        tasks: [
          { id: 4, name: '每日练字', desc: '写50个字以上', reward: '+1元', done: false, checkedToday: false },
          { id: 5, name: '朗读课文', desc: '大声朗读1篇课文', reward: '+0.5元', done: false, checkedToday: false }
        ] },
      { id: 3, name: '欣甜', color: '#FFD93D', streak: 22, monthlyEarnings: '¥12', balance: '¥12', pointsBalance: 0,
        tasks: [
          { id: 6, name: '背诵古诗1首', desc: '背诵一首完整古诗', reward: '+1元', done: false, checkedToday: false }
        ] }
    ]
    if (!activeChildId.value) activeChildId.value = 1
  }
}

const markTodayCheckins = async () => {
  if (!activeChildId.value) return
  const today = new Date().toISOString().split('T')[0]
  try {
    const checkins = await api.getCheckins({ child_id: activeChildId.value, date: today })
    if (checkins && Array.isArray(checkins)) {
      const checkedTaskIds = checkins.map(c => c.task_id)
      const child = children.value.find(c => c.id === activeChildId.value)
      if (child) {
        child.tasks.forEach(t => {
          if (checkedTaskIds.includes(t.id)) {
            t.done = true
            t.checkedToday = true
          }
        })
      }
    }
  } catch (err) {
    console.error('获取打卡记录失败', err)
  }
}

onMounted(() => { loadData() })
onShow(() => { loadData() })
</script>

<style lang="scss" scoped>
.page-checkin { padding: 24rpx; min-height: 100vh; }
.child-selector { display: flex; gap: 16rpx; margin-bottom: 32rpx; }
.child-tab {
  flex: 1; padding: 16rpx 12rpx; border-radius: $radius-pill; text-align: center;
  background: #ffffff; border: 3rpx solid $border; box-shadow: $shadow-card;
  &--active { border-color: $primary; }
  &__text { font-size: 26rpx; font-weight: 600; color: $text-light; &--active { color: #ffffff; } }
}
.section-title { display: block; font-size: 30rpx; font-weight: 700; color: $text; margin-bottom: 20rpx; }
.submit-area { margin-top: 24rpx; margin-bottom: 24rpx; }
.submit-btn {
  width: 100%; padding: 24rpx; border-radius: $radius-pill; background: $primary;
  text-align: center; box-shadow: 0 6rpx 0 0 rgba(25, 200, 185, 0.3);
  &--disabled { background: $border; box-shadow: 0 6rpx 0 0 rgba(0, 0, 0, 0.05); }
  &__text { color: #ffffff; font-size: 30rpx; font-weight: 600; }
  &--disabled &__text { color: $text-light; }
}
.auto-checkin-btn {
  width: 100%; padding: 20rpx; border-radius: $radius-pill; margin-top: 16rpx;
  background: #ffffff; border: 2rpx solid $primary; text-align: center;
  &--loading { opacity: 0.6; }
  &__text { color: $primary; font-size: 28rpx; font-weight: 600; }
}
.stats-card {
  background: #ffffff; border-radius: $radius-card; padding: 28rpx; box-shadow: $shadow-card;
  &__row { display: flex; align-items: center; &--points { margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx dashed #F0F0F0; } }
  &__col { flex: 1; &--right { text-align: right; } }
  &__label { display: block; font-size: 24rpx; color: $text-light; margin-bottom: 4rpx; }
  &__value { display: block; font-size: 40rpx; font-weight: 800; color: $text; letter-spacing: -0.02em; &--points { color: #FF6B00; } }
}
.success-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 999;
}
.success-card { width: 560rpx; background: #ffffff; border-radius: $radius-card; padding: 48rpx 40rpx; text-align: center; animation: popIn 0.3s ease; }
.success-icon {
  width: 100rpx; height: 100rpx; border-radius: 50%; background: $primary-light;
  margin: 0 auto 24rpx; display: flex; align-items: center; justify-content: center;
}
.success-star { font-size: 48rpx; color: $primary; }
.success-title { display: block; font-size: 36rpx; font-weight: 700; color: $text; margin-bottom: 12rpx; }
.success-reward { display: block; font-size: 28rpx; font-weight: 600; color: $primary; margin-bottom: 8rpx; }
.success-sub { display: block; font-size: 26rpx; color: $text-light; margin-bottom: 32rpx; }
.success-btn {
  width: 100%; padding: 20rpx; border-radius: $radius-pill; background: $primary; text-align: center;
  &__text { color: #ffffff; font-size: 28rpx; font-weight: 600; }
}
.empty { text-align: center; padding: 80rpx 0; &__text { font-size: 28rpx; color: $text-light; } }
.points-entry {
  display: flex; align-items: center; gap: 12rpx;
  background: linear-gradient(135deg, #FFF7E6 0%, #FFF0D6 100%);
  border: 2rpx solid #FFD700; border-radius: $radius-card; padding: 20rpx 24rpx; margin-bottom: 24rpx;
  &__icon { font-size: 32rpx; }
  &__text { flex: 1; font-size: 28rpx; font-weight: 600; color: #B8860B; }
  &__badge { font-size: 22rpx; font-weight: 600; color: #FF6B00; background: #FFF0D6; padding: 4rpx 12rpx; border-radius: 20rpx; }
  &__arrow { font-size: 28rpx; color: #B8860B; }
}
@keyframes popIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
</style>