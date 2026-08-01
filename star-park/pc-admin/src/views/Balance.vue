<template>
  <div class="page-container fade-in-up">
    <h1 class="page-title">💰 积分记录</h1>

    <div class="child-selector">
      <el-radio-group v-model="selectedChildId" @change="fetchBalanceData">
        <el-radio-button
          v-for="child in children"
          :key="child.id"
          :value="child.id"
        >
          {{ child.name }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <div v-loading="loading">
      <!-- 余额展示 -->
      <div class="balance-display card" :style="balanceStyle">
        <div class="balance-label">当前余额</div>
        <div class="balance-amount">
          {{ balance }} <span class="balance-unit">元</span>
        </div>
      </div>

      <!-- 交易流水 -->
      <div class="transactions-section">
        <h3 class="section-title">交易流水</h3>
        <el-table :data="transactions" stripe style="width: 100%;" empty-text="暂无记录">
          <el-table-column label="时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.type === 'earn' ? 'success' : 'warning'" size="small">
                {{ row.type === 'earn' ? '收入' : '支出' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120" align="center">
            <template #default="{ row }">
              <span :class="row.type === 'earn' ? 'amount-earn' : 'amount-spend'">
                {{ row.type === 'earn' ? '+' : '-' }}{{ row.amount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useAppStore } from '../stores/app'
import { getBalance, getTransactions } from '../api'

const store = useAppStore()
const loading = ref(false)
const selectedChildId = ref(null)
const balance = ref(0)
const transactions = ref([])

const children = computed(() => store.children)

const balanceStyle = computed(() => {
  const child = children.value.find(c => c.id === selectedChildId.value)
  const colorMap = {
    '甜甜': '#FF6B6B',
    '甄甄': '#4ECDC4',
    '欣甜': '#FFD93D'
  }
  const color = child ? (colorMap[child.name] || '#19C8B9') : '#19C8B9'
  return {
    background: `linear-gradient(135deg, ${color}15, ${color}05)`,
    borderTop: `3px solid ${color}`
  }
})

const formatTime = (time) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

const fetchBalanceData = async () => {
  if (!selectedChildId.value) return
  loading.value = true
  try {
    const [balanceRes, transactionsRes] = await Promise.all([
      getBalance(selectedChildId.value),
      getTransactions(selectedChildId.value)
    ])
    const bData = balanceRes
    balance.value = typeof bData === 'number' ? bData : (bData?.balance || 0)
    const tData = transactionsRes
    transactions.value = Array.isArray(tData) ? tData : (tData?.data || [])
  } catch (err) {
    console.error('获取积分数据失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.fetchChildren()
  if (children.value.length > 0) {
    selectedChildId.value = children.value[0].id
    await fetchBalanceData()
  }
})
</script>

<style scoped>
.child-selector {
  margin-bottom: 24px;
}

.balance-display {
  text-align: center;
  padding: 32px 20px;
  margin-bottom: 24px;
}

.balance-label {
  font-size: 14px;
  color: var(--text-light);
  margin-bottom: 8px;
}

.balance-amount {
  font-size: 42px;
  font-weight: 700;
  color: var(--primary);
}

.balance-unit {
  font-size: 18px;
  font-weight: 400;
  color: var(--text-light);
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 16px;
}

.amount-earn {
  color: #67C23A;
  font-weight: 600;
}

.amount-spend {
  color: #E6A23C;
  font-weight: 600;
}

:deep(.el-table) {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-table th.el-table__cell) {
  background: #FAFAF5;
  color: var(--text);
  font-weight: 600;
}
</style>
