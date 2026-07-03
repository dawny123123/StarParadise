<template>
  <div class="page-container fade-in-up">
    <div class="page-header">
      <h1 class="page-title">🎁 奖励管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增奖励
      </el-button>
    </div>

    <!-- 孩子筛选 tabs -->
    <div class="child-tabs">
      <el-tag
        v-for="tab in childTabs"
        :key="tab.id"
        :type="activeChildId === tab.id ? 'primary' : ''"
        :effect="activeChildId === tab.id ? 'dark' : 'plain'"
        class="child-tab"
        @click="activeChildId = tab.id"
      >
        {{ tab.name }}
      </el-tag>
      <el-tag
        :type="activeChildId === null ? 'primary' : ''"
        :effect="activeChildId === null ? 'dark' : 'plain'"
        class="child-tab"
        @click="activeChildId = null"
      >
        全部
      </el-tag>
    </div>

    <!-- 奖励卡片网格 -->
    <div v-loading="loading" class="rewards-grid">
      <div
        v-for="reward in filteredRewards"
        :key="reward.id"
        :class="['reward-card', 'card', { 'is-achieved': reward.isAchieved && !reward.redeemedAt, 'is-redeemed': reward.redeemedAt }]"
        :style="getCardStyle(reward)"
      >
        <!-- 已兑换标识 -->
        <div v-if="reward.redeemedAt" class="redeemed-badge">
          <el-tag type="info" size="small">已兑换 {{ formatDate(reward.redeemedAt) }}</el-tag>
        </div>
        <!-- 已达成标识 -->
        <div v-if="reward.isAchieved && !reward.redeemedAt" class="achieved-badge">
          <el-tag type="success" size="small">🎉 已达成</el-tag>
        </div>
        <div class="reward-header">
          <span class="reward-name">{{ reward.name }}</span>
          <div class="header-actions">
            <el-tag size="small" :type="reward.childName === '老四' ? 'warning' : 'primary'">
              {{ reward.childName }}
            </el-tag>
            <el-button type="primary" size="small" text @click="openDialog(reward)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button type="danger" size="small" text @click="handleDelete(reward)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="reward-unit-tag">
          <el-tag size="small" :type="reward.rewardUnit === '星星' ? 'warning' : ''">
            {{ reward.rewardUnit }}
          </el-tag>
        </div>
        <div class="reward-target" v-if="reward.targetAmount">
          <span class="target-label">目标</span>
          <span class="target-value">{{ reward.targetAmount }} {{ reward.rewardUnit }}</span>
        </div>
        <div class="reward-progress" v-if="reward.targetAmount">
          <el-progress
            :percentage="getProgress(reward)"
            :stroke-width="12"
            :color="getProgressColor(reward)"
            :format="(p) => p + '%'"
          />
        </div>
        <div class="reward-current" v-if="reward.currentAmount !== undefined">
          <span class="current-label">已攒</span>
          <span class="current-value" :style="{ color: getProgressColor(reward) }">
            {{ reward.currentAmount || 0 }} {{ reward.rewardUnit }}
          </span>
        </div>
        <div class="reward-desc" v-if="reward.description">
          {{ reward.description }}
        </div>
        <!-- 兑换按钮（仅已达成且未兑换时显示） -->
        <el-button
          v-if="reward.isAchieved && !reward.redeemedAt"
          type="success"
          size="small"
          class="redeem-btn"
          @click="handleRedeem(reward)"
        >
          🎁 确认兑换
        </el-button>
      </div>

      <el-empty v-if="!loading && filteredRewards.length === 0" description="暂无奖励目标" />
    </div>

    <!-- 新增/编辑奖励对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingReward ? '编辑奖励目标' : '新增奖励目标'"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="90px" label-position="right">
        <el-form-item label="所属孩子" required>
          <el-select v-model="form.childId" placeholder="选择孩子" style="width: 100%;" :disabled="!!editingReward">
            <el-option
              v-for="child in children"
              :key="child.id"
              :label="child.name"
              :value="child.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="奖励名称" required>
          <el-input v-model="form.name" placeholder="如：新玩具、游乐园门票" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="奖励描述" />
        </el-form-item>
        <el-form-item label="目标金额" required>
          <el-input-number v-model="form.targetAmount" :min="1" :step="10" />
        </el-form-item>
        <el-form-item label="奖励单位">
          <el-select v-model="form.rewardUnit" style="width: 120px;">
            <el-option label="元" value="元" />
            <el-option label="星星" value="星星" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { getRewards, createReward, updateReward, deleteReward, redeemReward } from '../api'

const store = useAppStore()
const loading = ref(false)
const submitting = ref(false)
const rewards = ref([])
const dialogVisible = ref(false)
const activeChildId = ref(null)
const editingReward = ref(null)

const children = computed(() => store.children)

const childTabs = computed(() => children.value)

const filteredRewards = computed(() => {
  if (activeChildId.value === null) return rewards.value
  return rewards.value.filter(r => r.childId === activeChildId.value)
})

const form = ref({
  childId: '',
  name: '',
  description: '',
  targetAmount: 50,
  rewardUnit: '元'
})

const getChildColor = (name) => {
  const colorMap = {
    '老二': '#FF6B6B',
    '老三': '#4ECDC4',
    '老四': '#FFD93D'
  }
  return colorMap[name] || '#19C8B9'
}

const getCardStyle = (reward) => {
  const color = getChildColor(reward.childName)
  return {
    borderTop: `3px solid ${color}`
  }
}

const getProgress = (reward) => {
  if (!reward.targetAmount) return 0
  const current = reward.currentAmount || 0
  return Math.min(Math.round((current / reward.targetAmount) * 100), 100)
}

const getProgressColor = (reward) => {
  return getChildColor(reward.childName)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

const openDialog = (reward = null) => {
  editingReward.value = reward
  if (reward) {
    form.value = {
      childId: reward.childId,
      name: reward.name,
      description: reward.description || '',
      targetAmount: reward.targetAmount,
      rewardUnit: reward.rewardUnit || '元'
    }
  } else {
    form.value = {
      childId: children.value[0]?.id || '',
      name: '',
      description: '',
      targetAmount: 50,
      rewardUnit: '元'
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.childId || !form.value.targetAmount) {
    ElMessage.warning('请填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = {
      child_id: form.value.childId,
      title: form.value.name,
      target_amount: form.value.targetAmount,
      description: form.value.description,
      reward_unit: form.value.rewardUnit
    }
    if (editingReward.value) {
      await updateReward(editingReward.value.id, payload)
      ElMessage.success('奖励目标更新成功')
    } else {
      await createReward(payload)
      ElMessage.success('奖励目标创建成功')
    }
    dialogVisible.value = false
    await fetchRewards()
  } catch (err) {
    ElMessage.error(editingReward.value ? '更新失败，请重试' : '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (reward) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除奖励"${reward.name}"吗？`,
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteReward(reward.id)
    ElMessage.success('删除成功')
    await fetchRewards()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败，请重试')
    }
  }
}

const handleRedeem = async (reward) => {
  try {
    await ElMessageBox.confirm(
      `确认兑换奖励"${reward.name}"？将扣减${reward.childName}的${reward.currentAmount}${reward.rewardUnit}余额。`,
      '兑换确认',
      {
        confirmButtonText: '确认兑换',
        cancelButtonText: '取消',
        type: 'success'
      }
    )
    await redeemReward(reward.id)
    ElMessage.success('兑换成功！')
    await fetchRewards()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.error || '兑换失败，请重试')
    }
  }
}

const fetchRewards = async () => {
  loading.value = true
  try {
    const data = await getRewards()
    const rawRewards = Array.isArray(data) ? data : (data.data || [])
    const childrenList = children.value
    rewards.value = rawRewards.map(r => {
      const child = childrenList.find(c => c.id === r.child_id)
      return {
        id: r.id,
        name: r.title,
        childId: r.child_id,
        childName: child?.name || '未知',
        targetAmount: r.target_amount,
        currentAmount: r.current_amount,
        rewardUnit: r.reward_unit || '元',
        isAchieved: r.is_achieved,
        redeemedAt: r.redeemed_at,
        description: r.description || ''
      }
    })
  } catch (err) {
    console.error('获取奖励失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.fetchChildren()
  await fetchRewards()
})

watch(() => store.children, (newChildren) => {
  if (newChildren.length > 0 && rewards.value.length > 0) {
    rewards.value = rewards.value.map(r => {
      const child = newChildren.find(c => c.id === r.childId)
      return { ...r, childName: child?.name || '未知' }
    })
  }
}, { deep: true })
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header .page-title {
  margin-bottom: 0;
}

.child-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.child-tab {
  cursor: pointer;
}

.rewards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.reward-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
}

.is-achieved {
  border-color: #67C23A;
  background: linear-gradient(135deg, #f0f9eb 0%, #ffffff 100%);
}

.is-redeemed {
  opacity: 0.6;
  background: #f5f5f5;
}

.redeemed-badge {
  position: absolute;
  top: 12px;
  right: 12px;
}

.achieved-badge {
  margin-bottom: 4px;
}

.reward-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reward-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.reward-unit-tag {
  margin-bottom: 0;
}

.reward-target {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.target-label {
  font-size: 13px;
  color: var(--text-light);
}

.target-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.reward-progress {
  margin: 4px 0;
}

.reward-current {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.current-label {
  font-size: 13px;
  color: var(--text-light);
}

.current-value {
  font-size: 18px;
  font-weight: 700;
}

.reward-desc {
  font-size: 13px;
  color: var(--text-light);
  line-height: 1.5;
}

.redeem-btn {
  width: 100%;
  margin-top: 4px;
}
</style>
