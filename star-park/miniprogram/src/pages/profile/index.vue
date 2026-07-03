<template>
  <view class="page-profile">
    <!-- 头部信息 -->
    <view class="profile-header">
      <view class="profile-header__avatar">
        <text class="profile-header__avatar-text">妈</text>
      </view>
      <text class="profile-header__name">妈妈</text>
      <text class="profile-header__desc">管理3个孩子的学习打卡</text>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-card">
      <view class="menu-item" @tap="handleMenu('children')">
        <text class="menu-item__icon">👶</text>
        <text class="menu-item__text">孩子管理</text>
        <text class="menu-item__arrow">›</text>
      </view>
      <view class="menu-item" @tap="handleMenu('tasks')">
        <text class="menu-item__icon">📋</text>
        <text class="menu-item__text">任务规则</text>
        <text class="menu-item__arrow">›</text>
      </view>
      <view class="menu-item" @tap="handleMenu('gifts')">
        <text class="menu-item__icon">🎁</text>
        <text class="menu-item__text">礼物目标设置</text>
        <text class="menu-item__arrow">›</text>
      </view>
      <view class="menu-item" @tap="handleMenu('stats')">
        <text class="menu-item__icon">📊</text>
        <text class="menu-item__text">数据统计</text>
        <text class="menu-item__arrow">›</text>
      </view>
    </view>

    <view class="menu-card">
      <view class="menu-item" @tap="handleMenu('reminder')">
        <text class="menu-item__icon">⏰</text>
        <text class="menu-item__text">提醒设置</text>
        <text class="menu-item__arrow">›</text>
      </view>
      <view class="menu-item" @tap="handleMenu('settings')">
        <text class="menu-item__icon">⚙️</text>
        <text class="menu-item__text">系统设置</text>
        <text class="menu-item__arrow">›</text>
      </view>
    </view>

    <!-- 关于信息 -->
    <view class="about-card">
      <view class="about-card__row">
        <text class="about-card__label">系统名称</text>
        <text class="about-card__value">星星乐园</text>
      </view>
      <view class="about-card__row">
        <text class="about-card__label">版本号</text>
        <text class="about-card__value">v1.0.0</text>
      </view>
      <view class="about-card__row">
        <text class="about-card__label">关于</text>
        <text class="about-card__value">家庭激励管理系统</text>
      </view>
    </view>

    <view class="footer">
      <text class="footer__text">星星乐园 · 让每一天都有收获 ★</text>
    </view>
  </view>
</template>

<script setup>
const handleMenu = (type) => {
  const messages = {
    children: '孩子管理功能开发中',
    tasks: '任务规则功能开发中',
    gifts: '礼物目标设置开发中',
    stats: '数据统计功能开发中',
    reminder: '提醒设置功能开发中',
    settings: '系统设置功能开发中'
  }
  uni.showToast({
    title: messages[type] || '功能开发中',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.page-profile {
  padding: 24rpx;
  min-height: 100vh;
}

.profile-header {
  text-align: center;
  padding: 32rpx;
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;

  &__avatar {
    width: 100rpx;
    height: 100rpx;
    border-radius: 50%;
    background: $primary-light;
    margin: 0 auto 16rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__avatar-text {
    font-size: 40rpx;
    font-weight: 700;
    color: $primary;
  }

  &__name {
    display: block;
    font-size: 34rpx;
    font-weight: 700;
    color: $text;
  }

  &__desc {
    display: block;
    font-size: 24rpx;
    color: $text-light;
    margin-top: 8rpx;
  }
}

.menu-card {
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
  overflow: hidden;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
  border-bottom: 1rpx solid #F5F5F5;

  &:last-child {
    border-bottom: none;
  }

  &__icon {
    font-size: 36rpx;
  }

  &__text {
    flex: 1;
    font-size: 28rpx;
    font-weight: 500;
    color: $text;
  }

  &__arrow {
    font-size: 32rpx;
    color: $text-muted;
  }
}

.about-card {
  background: #ffffff;
  border-radius: $radius-card;
  box-shadow: $shadow-card;
  margin-bottom: 24rpx;
  overflow: hidden;

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx;
    border-bottom: 1rpx solid #F5F5F5;

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-size: 26rpx;
    color: $text-light;
  }

  &__value {
    font-size: 26rpx;
    color: $text;
    font-weight: 500;
  }
}

.footer {
  text-align: center;
  padding: 32rpx 0;

  &__text {
    font-size: 24rpx;
    color: $text-muted;
  }
}
</style>
