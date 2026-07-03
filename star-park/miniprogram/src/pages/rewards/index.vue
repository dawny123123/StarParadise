<template>
  <view class="page-rewards">
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

    <!-- 奖励列表 -->
    <view v-if="activeRewards.length > 0" class="rewards-list">
      <view
        v-for="reward in activeRewards"
        :key="reward.id"
        :class="['reward-item', { 'reward-item--achieved': reward.is_achieved === 1 && !reward.redeemed_at, 'reward-item--redeemed': reward.redeemed_at }]"
      >
        <!-- 已兑换标识 -->
        <view v-if="reward.redeemed_at" class="redeemed-tag">
          <text class="redeemed-tag__text">已兑换 ✓</text>
        </view>
        <!-- 已达成标识 -->
        <view v-if="reward.is_achieved === 1 && !reward.redeemed_at" class="achieved-tag">
          <text class="achieved-tag__text">🎉 已达成！</text>
        </view>

        <view class="reward-item__header">
          <text class="reward-item__name">{{ reward.title }}</text>
          <text class="reward-item__unit">{{ reward.reward_unit }}</text>
        </view>

        <view class="reward-item__progress">
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: getProgressPercent(reward) + '%', backgroundColor: activeChild?.color || '#19C8B9' }"></view>
          </view>
          <text class="progress-text">{{ reward.current_amount || 0 }}/{{ reward.target_amount }} {{ reward.reward_unit }}</text>
        </view>

        <view v-if="reward.description" class="reward-item__desc">
          <text class="reward-item__desc-text">{{ reward.description }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else-if="!loading" class="empty">
      <text class="empty__text">暂无奖励目标</text>
    </view>

    <!-- 统计信息 -->
    <view v-if="activeChild" class="stats-card">
      <view class="stats-card__row">
        <view class="stats-card__col">
          <text class="stats-card__label">进行中</text>
          <text class="stats-card__value">{{ activeRewards.filter(r => r.is_achieved !== 1).length }}</text>
        </view>
        <view class="stats-card__col">
          <text class="stats-card__label">已达成</text>
          <text class="stats-card__value stats-card__value--success">{{ activeRewards.filter(r => r.is_achieved === 1 && !r.redeemed_at).length }}</text>
        </view>
        <view class="stats-card__col stats-card__col--right">
          <text class="stats-card__label">已兑换</text>
          <text class="stats-card__value">{{ activeRewards.filter(r => r.redeemed_at).length }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '@/api/index.js'

const children = ref([])
const activeChildId = ref(null)
const rewards = ref([])
const loading = ref(false)

const activeChild = computed(() => children.value.find(c => c.id === activeChildId.value) || null)

const activeRewards = computed(() => {
  if (!activeChildId.value) return []
  return rewards.value.filter(r => r.child_id === activeChildId.value)
})

const getProgressPercent = (reward) => {
  if (!reward.target_amount) return 0
  const current = reward.current_amount || 0
  return Math.min(Math.round((current / reward.target_amount) * 100), 100)
}

const selectChild = (child) => {
  activeChildId.value = child.id
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.avatar_color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
      }))
      if (!activeChildId.value && children.value.length) {
        activeChildId.value = children.value[0].id
      }
    }
    const rewardsData = await api.getRewards()
    rewards.value = Array.isArray(rewardsData) ? rewardsData : []
  } catch (err) {
    console.error('加载奖励数据失败', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadData())
onShow(() => loadData())
</script>

<style lang="scss" scoped>
.page-rewards {
  padding: 24rpx;
  min-height: 100vh;
}

.child-selector {
  display: flex;
  gap: 16rpx;
  margin-bottom: 32rpx;
}

.child-tab {
  flex: 1;
  padding: 16rpx 12rpx;
  border-radius: $radius-pill;
  text-align: center;
  background: #ffffff;
  border: 3rpx solid $border;
  box-shadow: $shadow-card;

  &--active {
    border-color: $primary;
  }

  &__text {
    font-size: 26rpx;
    font-weight: 600;
    color: $text-light;

    &--active {
      color: #ffffff;
    }
  }
}

.rewards-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.reward-item {
  background: #ffffff;
  border-radius: $radius-card;
  padding: 28rpx;
  box-shadow: $shadow-card;
  border-left: 8rpx solid $border;

  &--achieved {
    border-left-color: #67C23A;
    background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
  }

  &--redeemed {
    border-left-color: $text-muted;
    opacity: 0.7;
    background: #f9f9f9;
  }
}

.achieved-tag {
  margin-bottom: 12rpx;
}

.achieved-tag__text {
  font-size: 26rpx;
  font-weight: 700;
  color: #67C23A;
}

.redeemed-tag {
  margin-bottom: 12rpx;
}

.redeemed-tag__text {
  font-size: 22rpx;
  color: $text-light;
  background: #f0f0f0;
  padding: 4rpx 16rpx;
  border-radius: $radius-pill;
}

.reward-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.reward-item__name {
  font-size: 30rpx;
  font-weight: 700;
  color: $text;
}

.reward-item__unit {
  font-size: 24rpx;
  color: $text-light;
  background: #f5f5f5;
  padding: 4rpx 12rpx;
  border-radius: $radius-pill;
}

.reward-item__progress {
  margin-bottom: 12rpx;
}

.progress-bar {
  width: 100%;
  height: 16rpx;
  background: #f0f0f0;
  border-radius: 8rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}

.progress-fill {
  height: 100%;
  border-radius: 8rpx;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 24rpx;
  color: $text-light;
  display: block;
}

.reward-item__desc {
  margin-top: 8rpx;
}

.reward-item__desc-text {
  font-size: 24rpx;
  color: $text-light;
  line-height: 1.5;
}

.empty {
  text-align: center;
  padding: 80rpx 0;
}

.empty__text {
  font-size: 28rpx;
  color: $text-light;
}

.stats-card {
  background: #ffffff;
  border-radius: $radius-card;
  padding: 28rpx;
  box-shadow: $shadow-card;
  margin-top: 32rpx;
}

.stats-card__row {
  display: flex;
  align-items: center;
}

.stats-card__col {
  flex: 1;
  text-align: center;

  &--right {
    text-align: right;
  }
}

.stats-card__label {
  display: block;
  font-size: 24rpx;
  color: $text-light;
  margin-bottom: 4rpx;
}

.stats-card__value {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  color: $text;
  letter-spacing: -0.02em;

  &--success {
    color: #67C23A;
  }
}
</style>
