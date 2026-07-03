<template>
  <div class="page-container fade-in-up">
    <h1 class="page-title">📅 每日打卡</h1>

    <div class="date-picker-row">
      <el-date-picker
        v-model="selectedDate"
        type="date"
        placeholder="选择日期"
        format="YYYY-MM-DD"
        value-format="YYYY-MM-DD"
        :clearable="false"
        @change="fetchCheckinData"
      />
      <el-button
        type="success"
        :loading="autoCheckinLoading"
        @click="handleAutoCheckinAll"
      >
        {{ autoCheckinLoading ? '打卡中...' : '一键全部打卡' }}
      </el-button>
    </div>

    <div v-loading="loading">
      <div
        v-for="child in children"
        :key="child.id"
        class="child-checkin-section"
      >
        <div class="child-header" :style="{ borderLeftColor: getChildColor(child.name) }">
          <span class="child-name">{{ child.name }}</span>
          <span class="child-grade">{{ child.grade }}</span>
        </div>

        <div class="tasks-list">
          <!-- 特殊积分奖励入口 -->
          <div class="points-entry" @click="openPointsModal(child.id)">
            <span class="points-entry__icon">⭐</span>
            <span class="points-entry__text">特殊积分奖励</span>
            <span class="points-entry__badge">+积分</span>
            <span class="points-entry__arrow">›</span>
          </div>

          <div
            v-for="task in getChildTasks(child.id)"
            :key="task.id"
            class="task-item card"
            :class="{ checked: isTaskChecked(task.id) }"
          >
            <div class="task-info">
              <div class="task-name">{{ task.name }}</div>
              <div class="task-desc" v-if="task.description">{{ task.description }}</div>
              <div class="task-reward">
                奖励: <span class="reward-amount">{{ task.rewardAmount }}</span>
                {{ task.rewardUnit || '元' }}
              </div>
            </div>
            <div class="task-action">
              <template v-if="isTaskChecked(task.id)">
                <div class="checked-badge check-bounce">
                  <el-icon :size="24"><CircleCheck /></el-icon>
                </div>
                <span class="checked-text">+{{ getCheckinReward(task.id) }}{{ task.rewardUnit || '元' }}</span>
              </template>
              <template v-else>
                <el-button
                  type="primary"
                  round
                  :disabled="isPastDate"
                  @click="handleCheckin(child.id, task)"
                >
                  完成打卡
                </el-button>
              </template>
            </div>
          </div>

          <el-empty
            v-if="getChildTasks(child.id).length === 0"
            description="暂无任务"
            :image-size="60"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- 积分奖励弹窗 -->
  <el-dialog v-model="showPointsModal" title="特殊积分奖励" width="420px" center>
    <div class="points-modal">
      <div class="points-form">
        <div class="form-item">
          <label>选择孩子</label>
          <el-select v-model="pointsChildId" placeholder="请选择孩子" style="width: 100%">
            <el-option
              v-for="child in children"
              :key="child.id"
              :label="child.name"
              :value="child.id"
            />
          </el-select>
        </div>
        <div class="form-item">
          <label>积分分值</label>
          <el-input-number v-model="pointsAmount" :min="1" :max="9999" style="width: 100%" placeholder="输入积分数值" />
        </div>
        <div class="form-item">
          <label>奖励理由</label>
          <el-input v-model="pointsReason" type="textarea" :rows="2" placeholder="输入奖励原因" />
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="showPointsModal = false">取消</el-button>
      <el-button type="primary" @click="submitPoints">确认发放</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { getTasks, getCheckins, createCheckin, autoCheckinAll, getPoints, addPoints } from '../api'

const store = useAppStore()
const loading = ref(false)
const selectedDate = ref(dayjs().format('YYYY-MM-DD'))
const tasks = ref([])
const checkins = ref([])

// 积分相关
const showPointsModal = ref(false)
const pointsChildId = ref(null)
const pointsAmount = ref(1)
const pointsReason = ref('')

const children = computed(() => store.children)

const isPastDate = computed(() => {
  return dayjs(selectedDate.value).isBefore(dayjs(), 'day')
})

const getChildColor = (name) => {
  const colorMap = {
    '老二': '#FF6B6B',
    '老三': '#4ECDC4',
    '老四': '#FFD93D'
  }
  return colorMap[name] || '#19C8B9'
}

const getChildTasks = (childId) => {
  return tasks.value.filter(t => t.childId === childId && t.enabled !== false)
}

const isTaskChecked = (taskId) => {
  return checkins.value.some(c => c.taskId === taskId)
}

const getCheckinReward = (taskId) => {
  const checkin = checkins.value.find(c => c.taskId === taskId)
  return checkin?.rewardAmount || 0
}

const fetchCheckinData = async () => {
  loading.value = true
  try {
    const [tasksRes, checkinsRes] = await Promise.all([
      getTasks(),
      getCheckins({ date: selectedDate.value })
    ])

    // 映射任务数据：snake_case -> camelCase
    const tasksList = Array.isArray(tasksRes) ? tasksRes : (tasksRes.data || [])
    tasks.value = tasksList.map(t => ({
      id: t.id,
      childId: t.child_id,
      name: t.title,
      description: t.description,
      rewardAmount: t.reward_amount,
      rewardUnit: t.reward_unit,
      enabled: t.is_active === 1
    }))

    // 映射打卡数据：snake_case -> camelCase
    const checkinsList = Array.isArray(checkinsRes) ? checkinsRes : (checkinsRes.data || [])
    checkins.value = checkinsList.map(c => ({
      id: c.id,
      childId: c.child_id,
      taskId: c.task_id,
      checkinDate: c.checkin_date,
      completed: c.completed,
      rewardAmount: c.reward_earned
    }))
  } catch (err) {
    console.error('获取打卡数据失败:', err)
  } finally {
    loading.value = false
  }
}

const handleCheckin = async (childId, task) => {
  try {
    await createCheckin({
      child_id: childId,
      task_id: task.id,
      checkin_date: selectedDate.value,
      completed: 1
    })
    ElMessage.success({
      message: `打卡成功！获得 ${task.rewardAmount}${task.rewardUnit || '元'}`,
      duration: 2000,
      showClose: true
    })
    // 重新获取数据以更新状态
    await fetchCheckinData()
  } catch (err) {
    ElMessage.error('打卡失败，请重试')
    console.error('打卡失败:', err)
  }
}

// 一键全部打卡
const autoCheckinLoading = ref(false)
const handleAutoCheckinAll = async () => {
  autoCheckinLoading.value = true
  try {
    const result = await autoCheckinAll({ checkin_date: selectedDate.value })
    if (result.created > 0) {
      ElMessage.success({
        message: result.message,
        duration: 3000,
        showClose: true
      })
    } else {
      ElMessage.info('所有任务今日已全部打卡完成')
    }
    await fetchCheckinData()
  } catch (err) {
    ElMessage.error('自动打卡失败，请重试')
    console.error('自动打卡失败:', err)
  } finally {
    autoCheckinLoading.value = false
  }
}

onMounted(async () => {
  await store.fetchChildren()
  await fetchCheckinData()
})

// 打开积分弹窗
const openPointsModal = (childId) => {
  pointsChildId.value = childId || (children.value.length > 0 ? children.value[0].id : null)
  pointsAmount.value = 1
  pointsReason.value = ''
  showPointsModal.value = true
}

// 提交积分奖励
const submitPoints = async () => {
  if (!pointsChildId.value || !pointsAmount.value) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await addPoints({
      child_id: pointsChildId.value,
      amount: pointsAmount.value,
      reason: pointsReason.value || '特殊积分奖励'
    })
    ElMessage.success(`发放成功！+${pointsAmount.value}积分`)
    showPointsModal.value = false
  } catch (err) {
    ElMessage.error('积分发放失败')
    console.error('积分发放失败:', err)
  }
}
</script>

<style scoped>
.date-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.child-checkin-section {
  margin-bottom: 24px;
}

.child-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #fff;
  border-radius: 12px;
  border-left: 4px solid var(--primary);
  margin-bottom: 12px;
  box-shadow: var(--shadow);
}

.child-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.child-grade {
  font-size: 13px;
  color: var(--text-light);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  transition: all 0.3s ease;
}

.task-item.checked {
  background: #F0FDF9;
  border: 1px solid #D1FAE5;
}

.task-info {
  flex: 1;
}

.task-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}

.task-desc {
  font-size: 13px;
  color: var(--text-light);
  margin-bottom: 4px;
}

.task-reward {
  font-size: 13px;
  color: var(--text-light);
}

.reward-amount {
  color: var(--primary);
  font-weight: 600;
}

.task-action {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.checked-badge {
  color: var(--primary);
  display: flex;
  align-items: center;
}

.checked-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

/* 特殊积分奖励入口 */
.points-entry {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #FFF7E6 0%, #FFF0D6 100%);
  border: 2px solid #FFD700;
  border-radius: 12px;
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.points-entry:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
}

.points-entry__icon {
  font-size: 24px;
}

.points-entry__text {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: #B8860B;
}

.points-entry__badge {
  font-size: 13px;
  font-weight: 600;
  color: #FF6B00;
  background: #FFF0D6;
  padding: 4px 12px;
  border-radius: 20px;
}

.points-entry__arrow {
  font-size: 20px;
  color: #B8860B;
}

/* 积分弹窗样式 */
.points-modal {
  padding: 8px 0;
}

.points-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
</style>
