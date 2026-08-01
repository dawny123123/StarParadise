<template>
  <div class="page-container fade-in-up">
    <div class="page-header">
      <h1 class="page-title">📝 任务管理</h1>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增任务
      </el-button>
    </div>

    <el-tabs v-model="activeChild" type="card" @tab-change="handleTabChange">
      <el-tab-pane
        v-for="child in children"
        :key="child.id"
        :label="child.name"
        :name="String(child.id)"
      />
    </el-tabs>

    <el-table
      :data="filteredTasks"
      stripe
      style="width: 100%; margin-top: 16px;"
      empty-text="暂无任务"
      v-loading="loading"
    >
      <el-table-column prop="name" label="任务名称" min-width="150" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column prop="rewardAmount" label="奖励金额" width="120" align="center">
        <template #default="{ row }">
          <span class="reward-tag">{{ row.rewardAmount }} {{ row.rewardUnit || '元' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="pointsReward" label="积分奖励" width="100" align="center">
        <template #default="{ row }">
          <span class="points-tag">{{ row.pointsReward || 0 }} 分</span>
        </template>
      </el-table-column>
      <el-table-column label="计划日期" width="120" align="center">
        <template #default="{ row }">
          {{ row.plannedDate || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled !== false ? 'success' : 'info'" size="small">
            {{ row.enabled !== false ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-popconfirm title="确认删除此任务？" @confirm="handleDelete(row.id)">
            <template #reference>
              <el-button link type="danger" size="small">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑任务' : '新增任务'"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-width="90px" label-position="right">
        <el-form-item label="所属孩子" required>
          <el-select v-model="form.childId" placeholder="选择孩子" style="width: 100%;">
            <el-option
              v-for="child in children"
              :key="child.id"
              :label="child.name"
              :value="child.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务名称" required>
          <el-input v-model="form.name" placeholder="请输入任务名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="任务描述" />
        </el-form-item>
        <el-form-item label="奖励金额" required>
          <el-input-number v-model="form.rewardAmount" :min="0" :step="0.5" :precision="1" />
        </el-form-item>
        <el-form-item label="奖励单位">
          <el-select v-model="form.rewardUnit" style="width: 120px;">
            <el-option label="元" value="元" />
            <el-option label="星星" value="星星" />
          </el-select>
        </el-form-item>
        <el-form-item label="积分奖励">
          <el-input-number v-model="form.pointsReward" :min="0" :max="9999" :precision="0" placeholder="完成任务奖励积分" style="width: 160px" />
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker
            v-model="form.plannedDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择计划日期（可选）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.enabled" />
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app'
import { getTasks, createTask, updateTask, deleteTask } from '../api'

const store = useAppStore()
const loading = ref(false)
const submitting = ref(false)
const tasks = ref([])
const activeChild = ref('')
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(null)

const children = computed(() => store.children)

const form = ref({
  childId: '',
  name: '',
  description: '',
  rewardAmount: 1,
  rewardUnit: '元',
  pointsReward: 0,
  plannedDate: null,
  enabled: true
})

const filteredTasks = computed(() => {
  if (!activeChild.value) return tasks.value
  return tasks.value.filter(t => String(t.childId) === String(activeChild.value))
})

const handleTabChange = () => {
  // 切换孩子Tab时不需要额外操作，computed自动过滤
}

const openDialog = (task = null) => {
  if (task) {
    isEdit.value = true
    editingId.value = task.id
    form.value = {
      childId: task.childId,
      name: task.name,
      description: task.description || '',
      rewardAmount: task.rewardAmount,
      rewardUnit: task.rewardUnit || '元',
      pointsReward: task.pointsReward || 0,
      plannedDate: task.plannedDate || null,
      enabled: task.enabled !== false
    }
  } else {
    isEdit.value = false
    editingId.value = null
    form.value = {
      childId: activeChild.value || (children.value[0]?.id ?? ''),
      name: '',
      description: '',
      rewardAmount: 1,
      rewardUnit: '元',
      pointsReward: 0,
      plannedDate: null,
      enabled: true
    }
  }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.childId) {
    ElMessage.warning('请填写必填项')
    return
  }
  submitting.value = true
  try {
    const payload = {
      child_id: form.value.childId,
      title: form.value.name,
      description: form.value.description,
      reward_amount: form.value.rewardAmount,
      reward_unit: form.value.rewardUnit,
      points_reward: form.value.pointsReward || 0,
      planned_date: form.value.plannedDate || null,
      is_active: form.value.enabled ? 1 : 0
    }
    if (isEdit.value) {
      await updateTask(editingId.value, payload)
      ElMessage.success('任务更新成功')
    } else {
      await createTask(payload)
      ElMessage.success('任务创建成功')
    }
    dialogVisible.value = false
    await fetchTasks()
  } catch (err) {
    ElMessage.error('操作失败，请重试')
    console.error(err)
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id) => {
  try {
    await deleteTask(id)
    ElMessage.success('任务已删除')
    await fetchTasks()
  } catch (err) {
    ElMessage.error('删除失败')
    console.error(err)
  }
}

const fetchTasks = async () => {
  loading.value = true
  try {
    const data = await getTasks()
    const list = Array.isArray(data) ? data : (data.data || [])
    tasks.value = list.map(t => ({
      id: t.id,
      childId: t.child_id,
      name: t.title,
      description: t.description,
      rewardAmount: t.reward_amount,
      rewardUnit: t.reward_unit,
      pointsReward: t.points_reward,
      plannedDate: t.planned_date,
      enabled: t.is_active === 1
    }))
  } catch (err) {
    console.error('获取任务失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await store.fetchChildren()
  if (children.value.length > 0) {
    activeChild.value = String(children.value[0].id)
  }
  await fetchTasks()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-header .page-title {
  margin-bottom: 0;
}

.reward-tag {
  color: var(--primary);
  font-weight: 600;
}

.points-tag {
  color: #FF6B00;
  font-weight: 600;
}

:deep(.el-tabs__item) {
  font-size: 15px;
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
