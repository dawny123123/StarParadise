<template>
  <view class="task-item" :class="{ 'task-item--done': done, 'task-item--disabled': disabled }">
    <view
      class="task-item__checkbox"
      :class="{ 'task-item__checkbox--checked': done, 'task-item__checkbox--disabled': disabled }"
      @tap="handleToggle"
    >
      <text v-if="done" class="task-item__check-mark">✓</text>
    </view>
    <view class="task-item__info">
      <text class="task-item__name" :class="{ 'task-item__name--done': done }">{{ name }}</text>
      <text v-if="desc" class="task-item__desc">{{ desc }}</text>
    </view>
    <view class="task-item__right">
      <text v-if="disabled && done" class="task-item__done-tag">已完成</text>
      <text class="task-item__reward" :class="{ 'task-item__reward--done': done }">{{ reward }}</text>
    </view>
  </view>
</template>

<script setup>
const props = defineProps({
  name: { type: String, default: '' },
  desc: { type: String, default: '' },
  reward: { type: String, default: '' },
  done: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle'])

const handleToggle = () => {
  if (props.disabled) return
  emit('toggle')
}
</script>

<style lang="scss" scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 28rpx;
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 16rpx;

  &--done {
    opacity: 0.7;
  }

  &--disabled {
    background: #FAFAFA;
  }
}

.task-item__checkbox {
  width: 44rpx;
  height: 44rpx;
  border-radius: 12rpx;
  border: 3rpx solid $border;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;

  &--checked {
    background: $primary;
    border-color: $primary;
  }

  &--disabled {
    opacity: 0.6;
  }
}

.task-item__check-mark {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
}

.task-item__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.task-item__name {
  font-size: 28rpx;
  font-weight: 600;
  color: $text;

  &--done {
    text-decoration: line-through;
    color: $text-light;
  }
}

.task-item__desc {
  font-size: 24rpx;
  color: $text-light;
}

.task-item__right {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}

.task-item__done-tag {
  font-size: 20rpx;
  color: $primary;
  background: $primary-light;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
}

.task-item__reward {
  font-size: 28rpx;
  font-weight: 700;
  color: $primary;

  &--done {
    color: $text-light;
  }
}
</style>
