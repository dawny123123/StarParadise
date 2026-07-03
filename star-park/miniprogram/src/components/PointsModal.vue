<template>
  <view v-if="visible" class="points-overlay">
    <view class="points-card">
      <view class="points-card__icon">
        <text class="points-card__star">⭐</text>
      </view>
      <text class="points-card__title">特殊积分奖励</text>

      <!-- 孩子选择 -->
      <view class="points-child-select">
        <view
          v-for="child in children"
          :key="child.id"
          class="points-child-tab"
          :class="{ 'points-child-tab--active': selectedChildId === child.id }"
          :style="selectedChildId === child.id ? { backgroundColor: child.color, borderColor: child.color } : {}"
          @tap="selectedChildId = child.id"
        >
          <text class="points-child-tab__text" :class="{ 'points-child-tab__text--active': selectedChildId === child.id }">{{ child.name }}</text>
        </view>
      </view>

      <!-- 分值输入 -->
      <view class="points-input-group">
        <text class="points-input-label">积分分值</text>
        <input
          class="points-input"
          type="number"
          :value="amount"
          @input="amount = $event.detail.value"
          placeholder="请输入积分数值"
        />
      </view>

      <!-- 理由输入 -->
      <view class="points-input-group">
        <text class="points-input-label">奖励理由</text>
        <input
          class="points-input"
          type="text"
          :value="reason"
          @input="reason = $event.detail.value"
          placeholder="请输入奖励原因"
        />
      </view>

      <view class="points-btn-row">
        <view class="points-btn points-btn--cancel" @tap="$emit('close')">
          <text class="points-btn__text">取消</text>
        </view>
        <view class="points-btn points-btn--confirm" @tap="handleSubmit">
          <text class="points-btn__text">确认发放</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'
import { api } from '@/api/index.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  children: { type: Array, default: () => [] },
  defaultChildId: { type: Number, default: null }
})

const emit = defineEmits(['close', 'submitted'])

const selectedChildId = ref(null)
const amount = ref('')
const reason = ref('')

watch(() => props.visible, (val) => {
  if (val) {
    selectedChildId.value = props.defaultChildId
    amount.value = ''
    reason.value = ''
  }
})

const handleSubmit = async () => {
  const num = parseInt(amount.value)
  if (!selectedChildId.value || isNaN(num) || num === 0) {
    uni.showToast({ title: '请输入有效的积分数值', icon: 'none' })
    return
  }

  try {
    const res = await api.addPoints({
      child_id: selectedChildId.value,
      amount: num,
      reason: reason.value || '特殊积分奖励'
    })
    emit('submitted', { childId: selectedChildId.value, newBalance: res.new_balance })
    uni.showToast({ title: `发放成功！+${num}积分`, icon: 'success' })
  } catch (err) {
    console.error('积分发放失败', err)
    uni.showToast({ title: '积分发放失败', icon: 'none' })
  }
}
</script>

<style lang="scss" scoped>
.points-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.points-card {
  width: 560rpx;
  background: #ffffff;
  border-radius: $radius-card;
  padding: 40rpx 32rpx;
  text-align: center;
  animation: popIn 0.3s ease;

  &__icon {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background: $primary-light;
    margin: 0 auto 24rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__star {
    font-size: 48rpx;
    color: $primary;
  }

  &__title {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: $text;
    margin-bottom: 16rpx;
  }
}

.points-child-select {
  display: flex;
  gap: 12rpx;
  margin: 16rpx 0 24rpx;
}

.points-child-tab {
  flex: 1;
  padding: 16rpx 12rpx;
  border-radius: $radius-pill;
  text-align: center;
  background: #ffffff;
  border: 3rpx solid $border;

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

.points-input-group {
  margin-bottom: 20rpx;
}

.points-input-label {
  display: block;
  font-size: 26rpx;
  color: $text-light;
  margin-bottom: 8rpx;
}

.points-input {
  width: 100%;
  height: 80rpx;
  background: #F8F8F8;
  border-radius: $radius-card;
  padding: 0 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

.points-btn-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.points-btn {
  flex: 1;
  padding: 20rpx;
  border-radius: $radius-pill;
  text-align: center;

  &--cancel {
    background: #F5F5F5;

    .points-btn__text {
      color: $text-light;
    }
  }

  &--confirm {
    background: $primary;

    .points-btn__text {
      color: #ffffff;
    }
  }

  &__text {
    font-size: 28rpx;
    font-weight: 600;
  }
}

@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
