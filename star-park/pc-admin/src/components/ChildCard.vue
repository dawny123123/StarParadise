<template>
  <div class="child-card card" :style="cardStyle">
    <div class="card-header">
      <div class="child-avatar" :style="avatarStyle">
        {{ child.name?.charAt(0) || '?' }}
      </div>
      <div class="child-info">
        <h3 class="child-name">{{ child.name }}</h3>
      </div>
    </div>
    <div class="card-body">
      <div class="stat-row">
        <span class="stat-label">累计余额</span>
        <span class="stat-value balance" :style="{ color: color }">
          {{ child.balance || 0 }} 元
        </span>
      </div>
      <div class="stat-row">
        <span class="stat-label">总积分</span>
        <span class="stat-value points-value" @click="goToBalance" style="cursor: pointer;">
          {{ child.points_balance || 0 }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  child: {
    type: Object,
    default: () => ({})
  },
  color: {
    type: String,
    default: '#19C8B9'
  }
})

const router = useRouter()

const cardStyle = computed(() => ({
  borderTop: `3px solid ${props.color}`
}))

const avatarStyle = computed(() => ({
  backgroundColor: props.color + '20',
  color: props.color
}))

const goToBalance = () => {
  router.push('/balance')
}
</script>

<style scoped>
.child-card {
  min-width: 240px;
  flex: 1;
  border-top: 3px solid var(--primary);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.child-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  margin-right: 12px;
  flex-shrink: 0;
}

.child-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-label {
  font-size: 13px;
  color: var(--text-light);
  flex-shrink: 0;
}

.stat-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}

.stat-value.balance {
  font-size: 18px;
  font-weight: 700;
}

.stat-value.points-value {
  font-size: 16px;
  font-weight: 700;
  color: #FF6B00;
}
</style>
