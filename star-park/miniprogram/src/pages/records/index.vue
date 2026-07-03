<template>
  <view class="page-records">
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
      <!-- 余额卡片 -->
      <view class="balance-card">
        <text class="balance-card__label">{{ activeChild.name }}累计获得</text>
        <text class="balance-card__value">{{ activeChild.balance }}</text>
        <text class="balance-card__sub">本月 {{ activeChild.monthlyEarnings }} · 已用 {{ activeChild.spent }}</text>
      </view>

      <!-- 礼物进度（仅老四显示） -->
      <view v-if="activeChild.giftGoal" class="gift-card">
        <view class="gift-card__icon">
          <text class="gift-card__icon-text">🎁</text>
        </view>
        <view class="gift-card__info">
          <text class="gift-card__name">目标：{{ activeChild.giftGoal.name }} {{ activeChild.giftGoal.price }}</text>
          <view class="gift-card__bar">
            <view class="gift-card__bar-fill" :style="{ width: activeChild.giftGoal.percent + '%' }"></view>
          </view>
          <text class="gift-card__text">已攒 {{ activeChild.giftGoal.saved }} · 还差 {{ activeChild.giftGoal.remaining }}</text>
        </view>
      </view>

      <!-- 简单日历 -->
      <view class="calendar-card">
        <text class="section-title">本月打卡日历</text>
        <view class="calendar-grid">
          <text v-for="day in weekHeaders" :key="day" class="cal-header">{{ day }}</text>
          <view
            v-for="(day, idx) in calendarDays"
            :key="idx"
            class="cal-day"
            :class="{
              'cal-day--empty': !day.day,
              'cal-day--checked': day.checked,
              'cal-day--partial': day.partial,
              'cal-day--today': day.isToday
            }"
          >
            <text v-if="day.day" class="cal-day__text">{{ day.day }}</text>
          </view>
        </view>
      </view>

      <!-- 打卡明细 -->
      <text class="section-title">打卡明细</text>
      <view class="record-list">
        <view v-for="record in records" :key="record.id" class="record-item">
          <view class="record-item__dot" :style="{ backgroundColor: activeChild.color }"></view>
          <view class="record-item__info">
            <text class="record-item__task">{{ record.taskName }}</text>
            <text class="record-item__date">{{ record.date }}</text>
          </view>
          <text class="record-item__amount" :class="record.amount.startsWith('-') ? 'record-item__amount--neg' : ''">
            {{ record.amount }}
          </text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!records.length" class="empty">
        <text class="empty__text">暂无打卡记录</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { api } from '@/api/index.js'

const children = ref([])
const activeChildId = ref(null)
const records = ref([])
const checkedDays = ref([])

const weekHeaders = ['一', '二', '三', '四', '五', '六', '日']

const activeChild = computed(() => {
  return children.value.find(c => c.id === activeChildId.value) || null
})

// 日历计算
const calendarDays = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const today = now.getDate()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // 周一为起始

  const days = []
  for (let i = 0; i < offset; i++) {
    days.push({ day: null, checked: false, partial: false, isToday: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today
    const isChecked = checkedDays.value.includes(d) && d <= today
    days.push({ day: d, checked: isChecked, partial: false, isToday })
  }
  return days
})

const selectChild = (id) => {
  activeChildId.value = id
  loadRecords()
}

const loadRecords = async () => {
  if (!activeChildId.value) return
  try {
    const res = await api.getCheckins({ child_id: activeChildId.value })
    if (res && Array.isArray(res)) {
      const now = new Date()
      const thisMonth = now.getMonth() + 1
      const checkedDates = []
      records.value = res.map(r => ({
        id: r.id,
        taskName: r.task_title || `任务#${r.task_id}`,
        date: r.created_at || '',
        amount: `+${r.reward_earned || 0}元`
      }))
      // 提取有打卡的日期
      res.forEach(r => {
        if (r.checkin_date) {
          const d = new Date(r.checkin_date)
          if (d.getMonth() + 1 === thisMonth) {
            checkedDates.push(d.getDate())
          }
        }
      })
      checkedDays.value = checkedDates
    }
  } catch (err) {
    console.error('加载记录失败', err)
    // 默认数据
    records.value = [
      { id: 1, taskName: '背诵《咏鹅》', date: '今天 08:30', amount: '+1元' },
      { id: 2, taskName: '背诵《静夜思》', date: '昨天 08:15', amount: '+1元' },
      { id: 3, taskName: '背诵《春晓》', date: '前天 09:00', amount: '+1元' },
      { id: 4, taskName: '兑换 小兔毛绒玩偶', date: '5月1日', amount: '-30元' }
    ]
    checkedDays.value = [1, 2, 3, 5, 6, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25]
  }
}

const loadChildren = async () => {
  try {
    const res = await api.getChildren()
    if (res && res.length) {
      children.value = res.map(c => ({
        id: c.id,
        name: c.name,
        color: c.color || ['#FF6B6B', '#4ECDC4', '#FFD93D'][c.id - 1] || '#19C8B9',
        balance: c.balance ? `¥${c.balance}` : '¥0',
        monthlyEarnings: c.monthlyEarnings || '+¥0',
        spent: c.spent || '¥0',
        giftGoal: c.giftGoal || null
      }))
      if (!activeChildId.value && children.value.length) {
        activeChildId.value = children.value[0].id
        loadRecords()
      }
    }
  } catch (err) {
    console.error('加载孩子数据失败', err)
    children.value = [
      { id: 1, name: '老二', color: '#FF6B6B', balance: '¥127', monthlyEarnings: '+¥34', spent: '¥0', giftGoal: null },
      { id: 2, name: '老三', color: '#4ECDC4', balance: '¥58', monthlyEarnings: '+¥18', spent: '¥0', giftGoal: null },
      { id: 3, name: '老四', color: '#FFD93D', balance: '¥45', monthlyEarnings: '+¥12', spent: '¥30', giftGoal: { name: '粉色小书包', price: '¥100', percent: 45, saved: '¥45', remaining: '¥55' } }
    ]
    if (!activeChildId.value) {
      activeChildId.value = 3
      loadRecords()
    }
  }
}

onMounted(() => {
  loadChildren()
})

onShow(() => {
  if (activeChildId.value) loadRecords()
})
</script>

<style lang="scss" scoped>
.page-records {
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

.balance-card {
  background: #ffffff;
  border-radius: $radius-card;
  padding: 32rpx;
  text-align: center;
  box-shadow: $shadow-card;
  margin-bottom: 20rpx;

  &__label {
    display: block;
    font-size: 24rpx;
    color: $text-light;
    margin-bottom: 8rpx;
  }

  &__value {
    display: block;
    font-size: 56rpx;
    font-weight: 800;
    color: $text;
    letter-spacing: -0.02em;
  }

  &__sub {
    display: block;
    font-size: 24rpx;
    color: $text-light;
    margin-top: 8rpx;
  }
}

.gift-card {
  background: #ffffff;
  border-radius: $radius-card;
  padding: 24rpx;
  box-shadow: $shadow-card;
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;

  &__icon {
    width: 72rpx;
    height: 72rpx;
    background: $bg;
    border-radius: $radius-small;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__icon-text {
    font-size: 36rpx;
  }

  &__info {
    flex: 1;
  }

  &__name {
    display: block;
    font-size: 26rpx;
    font-weight: 600;
    color: $text;
    margin-bottom: 10rpx;
  }

  &__bar {
    width: 100%;
    height: 12rpx;
    background: $border;
    border-radius: $radius-pill;
    overflow: hidden;
  }

  &__bar-fill {
    height: 100%;
    background: $primary;
    border-radius: $radius-pill;
  }

  &__text {
    display: block;
    font-size: 22rpx;
    color: $text-light;
    margin-top: 8rpx;
  }
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: $text;
  margin-bottom: 16rpx;
  margin-top: 8rpx;
}

/* 日历 */
.calendar-card {
  background: #ffffff;
  border-radius: $radius-card;
  padding: 24rpx;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6rpx;
}

.cal-header {
  text-align: center;
  font-size: 22rpx;
  color: $text-light;
  font-weight: 600;
  padding-bottom: 8rpx;
}

.cal-day {
  aspect-ratio: 1;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &--empty {
    background: transparent;
  }

  &--checked {
    background: $primary-light;
  }

  &--partial {
    background: #FFF3E0;
  }

  &--today {
    border: 2rpx solid $primary;
  }

  &__text {
    font-size: 22rpx;
    color: $text;
  }

  &--checked &__text {
    color: $primary;
    font-weight: 600;
  }
}

/* 记录列表 */
.record-list {
  margin-bottom: 24rpx;
}

.record-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
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

  &__task {
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

    &--neg {
      color: $text-light;
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
