<template>
  <view class="page-wallet">
    <!-- 孩子选择器 -->
    <view class="child-selector">
      <view
        v-for="child in children"
        :key="child.id"
        class="child-tab"
        :class="{ 'child-tab--active': activeChildId === child.id }"
        :style="activeChildId === child.id ? { backgroundColor: child.color, borderColor: child.color } : {}"
        @tap="selectChild(child.id)"
      >
        <text class="child-tab__text" :class="{ 'child-tab__text--active': activeChildId === child.id }">{{ child.name }}</text>
      </view>
    </view>

    <template v-if="activeChild">
      <!-- 余额双卡片 -->
      <view class="balance-row">
        <view class="balance-card balance-card--money">
          <text class="balance-card__icon">¥</text>
          <text class="balance-card__label">金额余额</text>
          <text class="balance-card__value">{{ activeChild.balance }}</text>
        </view>
        <view class="balance-card balance-card--points">
          <text class="balance-card__icon">⭐</text>
          <text class="balance-card__label">积分余额</text>
          <text class="balance-card__value">{{ activeChild.pointsBalance }}</text>
        </view>
      </view>

      <!-- Tab 切换 -->
      <view class="tab-switch">
        <view class="tab-switch__item" :class="{ 'tab-switch__item--active': activeTab === 'transactions' }" @tap="activeTab = 'transactions'">
          <text class="tab-switch__text" :class="{ 'tab-switch__text--active': activeTab === 'transactions' }">交易明细</text>
        </view>
        <view class="tab-switch__item" :class="{ 'tab-switch__item--active': activeTab === 'points' }" @tap="activeTab = 'points'">
          <text class="tab-switch__text" :class="{ 'tab-switch__text--active': activeTab === 'points' }">积分记录</text>
        </view>
      </view>

      <!-- 交易明细列表 -->
      <view v-if="activeTab === 'transactions'" class="detail-list">
        <view v-for="item in transactions" :key="item.id" class="detail-item">
          <view class="detail-item__dot" :style="{ backgroundColor: item.type === 'earn' ? $primary : '#E6A23C' }"></view>
          <view class="detail-item__info">
            <text class="detail-item__desc">{{ item.description }}</text>
            <text class="detail-item__date">{{ formatDate(item.created_at) }}</text>
          </view>
          <text class="detail-item__amount" :class="item.type === 'earn' ? 'detail-item__amount--earn' : 'detail-item__amount--spend'">
            {{ item.type === 'earn' ? '+' : '-' }}¥{{ item.amount }}
          </text>
        </view>
        <view v-if="!transactions.length" class="empty">
          <text class="empty__text">暂无交易记录</text>
        </view>
      </view>

      <!-- 积分记录列表 -->
      <view v-if="activeTab === 'points'" class="detail-list">
        <view v-for="item in pointsRecords" :key="item.id" class="detail-item">
          <view class="detail-item__dot" :style="{ backgroundColor: '#FF6B00' }"></view>
          <view class="detail-item__info">
            <text class="detail-item__desc">{{ item.reason }}</text>
            <text class="detail-item__date">{{ formatDate(item.created_at) }}</text>
          </view>
          <text class="detail-item__amount detail-item__amount--points">
            {{ item.amount > 0 ? '+' : '' }}{{ item.amount }}积分
          </text>
        </view>
        <view v-if="!pointsRecords.length" class="empty">
          <text class="empty__text">暂无积分记录</text>
        </view>
      </view>
    </template>

    <!-- 空状态 -->
    <view v-if="!activeChild" class="empty">
      <text class="empty__text">请选择一个孩子查看钱包</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '@/api/index.js'

const children = ref([])
const activeChildId = ref(null)
const activeTab = ref('transactions')
const transactions = ref([])
const pointsRecords = ref([])

const activeChild = computed(() => {
  return children.value.find(c => c.id === activeChildId.value) || null
})

const selectChild = (id) => {
  activeChildId.value = id
  loadData()
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const loadData = async () => {
  if (!activeChildId.value) return

  // 加载孩子列表
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
        balance: c.balance || '¥0',
        pointsBalance: c.points_balance || 0
      }))
    }
  } catch (err) {
    console.error('加载孩子数据失败', err)
  }

  // 加载交易明细
  try {
    const res = await api.getTransactions(activeChildId.value)
    transactions.value = Array.isArray(res) ? res.slice(0, 50) : []
  } catch (err) {
    console.error('加载交易记录失败', err)
    transactions.value = []
  }

  // 加载积分记录
  try {
    const res = await api.getPoints(activeChildId.value)
    pointsRecords.value = Array.isArray(res?.records) ? res.records.slice(0, 50) : []
  } catch (err) {
    console.error('加载积分记录失败', err)
    pointsRecords.value = []
  }
}

const init = async () => {
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
        balance: c.balance || '¥0',
        pointsBalance: c.points_balance || 0
      }))
      if (!activeChildId.value && children.value.length) {
        activeChildId.value = children.value[0].id
      }
      loadData()
    }
  } catch (err) {
    console.error('初始化钱包数据失败', err)
  }
}

onMounted(() => {
  init()
})

onShow(() => {
  if (activeChildId.value) loadData()
})
</script>

<style lang="scss" scoped>
.page-wallet {
  padding: 24rpx;
  min-height: 100vh;
}

.child-selector {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
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

.balance-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.balance-card {
  flex: 1;
  background: #ffffff;
  border-radius: $radius-card;
  padding: 28rpx 24rpx;
  box-shadow: $shadow-card;
  text-align: center;

  &--money {
    border-top: 4rpx solid $primary;
  }

  &--points {
    border-top: 4rpx solid #FF6B00;
  }

  &__icon {
    display: block;
    font-size: 28rpx;
    margin-bottom: 4rpx;
  }

  &__label {
    display: block;
    font-size: 24rpx;
    color: $text-light;
    margin-bottom: 12rpx;
  }

  &__value {
    display: block;
    font-size: 44rpx;
    font-weight: 800;
    color: $text;
    letter-spacing: -0.02em;
  }
}

.balance-card--points .balance-card__value {
  color: #FF6B00;
}

.tab-switch {
  display: flex;
  gap: 0;
  margin-bottom: 20rpx;
  background: #ffffff;
  border-radius: $radius-pill;
  box-shadow: $shadow-card;
  overflow: hidden;
}

.tab-switch__item {
  flex: 1;
  padding: 16rpx 0;
  text-align: center;
  transition: all 0.2s ease;

  &--active {
    background: $primary;
  }
}

.tab-switch__text {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-light;

  &--active {
    color: #ffffff;
  }
}

.detail-list {
  margin-bottom: 24rpx;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx;
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 12rpx;

  &__dot {
    width: 14rpx;
    height: 14rpx;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
  }

  &__desc {
    display: block;
    font-size: 28rpx;
    font-weight: 500;
    color: $text;
  }

  &__date {
    display: block;
    font-size: 24rpx;
    color: $text-light;
    margin-top: 4rpx;
  }

  &__amount {
    font-size: 28rpx;
    font-weight: 700;
    color: $text;
    flex-shrink: 0;

    &--earn {
      color: $primary;
    }

    &--spend {
      color: #E6A23C;
    }

    &--points {
      color: #FF6B00;
    }
  }
}

.empty {
  text-align: center;
  padding: 60rpx 0;

  &__text {
    font-size: 28rpx;
    color: $text-light;
  }
}
</style>