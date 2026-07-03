<template>
  <view class="child-card" :class="{ 'child-card--done': checkedIn }" @tap="$emit('tap')">
    <view class="child-card__color-bar" :style="{ backgroundColor: color }"></view>
    <view class="child-card__content">
      <view class="child-card__header">
        <view class="child-card__avatar" :style="{ backgroundColor: color }">
          <text class="child-card__avatar-text">{{ avatarText }}</text>
        </view>
        <view class="child-card__info">
          <text class="child-card__name">{{ name }}</text>
          <text class="child-card__task">{{ taskDesc }}</text>
        </view>
        <view class="child-card__badge" :class="checkedIn ? 'child-card__badge--done' : 'child-card__badge--pending'">
          <text class="child-card__badge-text">{{ checkedIn ? '✓ 已打卡' : '待打卡' }}</text>
        </view>
      </view>
      <view class="child-card__stats">
        <view class="child-card__stat">
          <text class="child-card__stat-value">{{ streak }}</text>
          <text class="child-card__stat-label">连续打卡</text>
        </view>
        <view class="child-card__stat">
          <text class="child-card__stat-value">{{ balance }}</text>
          <text class="child-card__stat-label">累计余额</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  name: { type: String, default: '' },
  avatarText: { type: String, default: '' },
  color: { type: String, default: '#19C8B9' },
  taskDesc: { type: String, default: '' },
  checkedIn: { type: Boolean, default: false },
  streak: { type: [Number, String], default: 0 },
  balance: { type: String, default: '¥0' }
})

defineEmits(['tap'])
</script>

<style lang="scss" scoped>
.child-card {
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 20rpx;
  overflow: hidden;

  &--done {
    opacity: 0.9;
  }

  &__color-bar {
    height: 6rpx;
    width: 100%;
  }

  &__content {
    padding: 24rpx;
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  &__avatar {
    width: 72rpx;
    height: 72rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__avatar-text {
    color: #ffffff;
    font-size: 32rpx;
    font-weight: 700;
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }

  &__name {
    font-size: 30rpx;
    font-weight: 600;
    color: $text;
  }

  &__task {
    font-size: 24rpx;
    color: $text-light;
  }

  &__badge {
    padding: 6rpx 16rpx;
    border-radius: $radius-pill;
    flex-shrink: 0;

    &--done {
      background: $primary-light;
    }

    &--pending {
      border: 2rpx dashed $border;
      background: transparent;
    }
  }

  &__badge-text {
    font-size: 22rpx;
    font-weight: 600;
  }

  &__badge--done &__badge-text {
    color: $primary;
  }

  &__badge--pending &__badge-text {
    color: $text-light;
  }

  &__stats {
    display: flex;
    gap: 32rpx;
    margin-top: 20rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #F0F0F0;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }

  &__stat-value {
    font-size: 32rpx;
    font-weight: 800;
    color: $text;
  }

  &__stat-label {
    font-size: 22rpx;
    color: $text-light;
    margin-top: 4rpx;
  }
}
</style>
