<template>
  <div class="page-container fade-in-up">
    <div class="welcome-section">
      <h1 class="welcome-title">🎯 {{ pageTitle }}</h1>
      <p class="welcome-date">{{ todayStr }}</p>
    </div>

    <!-- 年度目标区域 -->
    <div class="goals-section card">
      <div class="section-header">
        <h3 class="section-title">📋 2026年度目标</h3>
        <el-button type="primary" size="small" @click="openGoalModal()">
          <el-icon><Plus /></el-icon>
          添加目标
        </el-button>
      </div>
      <div class="goals-grid">
        <div
          v-for="goal in visibleGoals"
          :key="goal.id"
          :class="['goal-card', `status-${goal.status}`]"
          @click="openGoalTasks(goal)"
          @mouseenter="hoveredGoal = goal.id"
          @mouseleave="hoveredGoal = null"
        >
          <div class="goal-card-content">
            <span :class="['goal-status', goal.status]">{{ getStatusLabel(goal.status) }}</span>
            <div class="goal-title">{{ goal.title }}</div>
            <div class="goal-description" v-if="goal.description">{{ goal.description }}</div>
            <div class="goal-progress">
              <div class="goal-progress-bar">
                <div class="goal-progress-fill" :style="{ width: getProgressPercent(goal) + '%' }"></div>
              </div>
              <span class="goal-progress-text">{{ goalTaskStats(goal.id).completed }}/{{ goalTaskStats(goal.id).total }}</span>
            </div>
          </div>
          <div v-if="hoveredGoal === goal.id" class="goal-actions">
            <el-button text size="small" @click.stop="openGoalModal(goal)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button text size="small" type="danger" @click.stop="deleteGoal(goal.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div v-if="visibleGoals.length === 0" class="empty-text">暂无目标，点击上方按钮添加</div>
      </div>
    </div>

    <!-- 待办任务区域 -->
    <div class="todo-section card">
      <div class="section-header">
        <h3 class="section-title">📝 待办任务 ({{ visibleTodos.length }})</h3>
        <el-button type="primary" size="small" @click="openTodoModal()">
          <el-icon><Plus /></el-icon>
          添加待办
        </el-button>
      </div>
      <TodoTree
        :todos="visibleTodos"
        :goals="visibleGoals"
        :loading="tableLoading"
        @refresh="fetchTodos"
        @edit="openTodoModal"
        @add-child="openTodoModal(null, $event)"
        @delete="deleteTodo"
        @clone="cloneTodo"
        @toggle="toggleTodo"
      />
    </div>

    <!-- 目标弹窗 -->
    <el-dialog v-model="goalDialogVisible" :title="editingGoal ? '编辑目标' : '添加目标'" width="480px">
      <el-form :model="goalForm" label-width="90px">
        <el-form-item label="目标名称" required>
          <el-input v-model="goalForm.title" placeholder="请输入目标名称" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="goalForm.status" style="width: 100%">
            <el-option value="todo" label="待办" />
            <el-option value="rest" label="休憩" />
            <el-option value="health" label="健康" />
            <el-option value="happy" label="快乐" />
            <el-option value="study" label="学习" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="goalForm.description" type="textarea" :rows="3" placeholder="请输入目标描述（可选）" />
        </el-form-item>
        <el-form-item label="进度/目标">
          <div class="progress-input-row">
            <el-input-number v-model="goalForm.progress" :min="0" style="flex: 1" />
            <span class="progress-divider">/</span>
            <el-input-number v-model="goalForm.target" :min="1" style="flex: 1" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="goalDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveGoal">确认</el-button>
      </template>
    </el-dialog>

    <!-- 待办弹窗 -->
    <el-dialog v-model="todoDialogVisible" :title="editingTodo ? '编辑待办' : '添加待办'" width="480px">
      <el-form :model="todoForm" label-width="90px">
        <el-form-item label="父任务">
          <el-select
            v-model="todoForm.parentId"
            placeholder="选择父任务（可选）"
            clearable
            :disabled="editingTodo && todos.some(t => t.parentId === editingTodo.id)"
            style="width: 100%"
          >
            <el-option
              v-for="t in candidateParents"
              :key="t.id"
              :label="t.title"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="待办名称" required>
          <el-input v-model="todoForm.title" placeholder="请输入待办名称" />
        </el-form-item>
        <el-form-item label="关联目标">
          <el-select v-model="todoForm.goalId" placeholder="选择目标（可选）" clearable style="width: 100%">
            <el-option v-for="goal in visibleGoals" :key="goal.id" :label="goal.title" :value="goal.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建人">
          <el-input v-model="todoForm.creator" placeholder="请输入创建人" />
        </el-form-item>
        <el-form-item label="优先级">
          <el-select v-model="todoForm.priority" style="width: 100%">
            <el-option value="high" label="高" />
            <el-option value="medium" label="中" />
            <el-option value="low" label="低" />
          </el-select>
        </el-form-item>
        <el-form-item label="预期积分值">
          <el-input-number v-model="todoForm.expectedPoints" :min="-9999" :max="9999" :precision="0" placeholder="完成时奖励的积分（负数为扣减）" style="width: 100%" />
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker v-model="todoForm.plannedDate" type="date" placeholder="选择日期" style="width: 100%" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="todoForm.description" type="textarea" :rows="3" placeholder="请输入任务描述（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="todoDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTodo">确认</el-button>
      </template>
    </el-dialog>

    <!-- 目标关联任务弹窗 -->
    <el-dialog v-model="goalTasksDialogVisible" :title="`「${viewingGoal?.title || ''}」关联任务`" width="640px">
      <el-table v-if="goalTasks.length > 0" :data="goalTasks" stripe style="width: 100%">
        <el-table-column width="50">
          <template #default="{ row }">
            <el-checkbox
              :model-value="row.completed"
              @change="toggleTodo(row.id)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="160">
          <template #default="{ row }">
            <span :class="['todo-title-text', { completed: row.completed }]">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column label="预期积分" width="90" align="center">
          <template #default="{ row }">
            <span class="points-tag">{{ row.expectedPoints || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="计划日期" width="100">
          <template #default="{ row }">
            <span class="date-text">{{ formatDate(row.plannedDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.completed ? 'success' : 'info'" size="small">
              {{ row.completed ? '已完成' : '进行中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <div class="todo-actions">
              <el-button text size="small" @click="openTodoModal(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button text size="small" @click="cloneTodo(row)">
                <el-icon><DocumentCopy /></el-icon>
              </el-button>
              <el-button text size="small" type="danger" @click="deleteTodo(row.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无关联任务" :image-size="60" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { Plus, Edit, Delete, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  triggerGoalAutoAssociation, addPoints,
  getGoals, createGoal, updateGoal, deleteGoal as deleteGoalApi,
  getTodos, createTodo, updateTodo, deleteTodo as deleteTodoApi
} from '../api'
import { useAppStore } from '../stores/app'
import TodoTree from '../components/TodoTree.vue'

const route = useRoute()
const store = useAppStore()

// 路由参数中的孩子名（如 洋洋/甜甜/甄甄/欣甜），为空表示"全部目标"
const childName = computed(() => route.params.childName || '')
// 通过 /api/children 按名字匹配 child_id（服务不可用时为 null，不影响本地过滤）
const currentChildId = computed(() => {
  const child = store.children.find(c => c.name === childName.value)
  return child ? child.id : null
})

const pageTitle = computed(() => (childName.value ? `${childName.value}目标管理` : '目标管理'))

const loading = ref(false)
const tableLoading = ref(false)
const hoveredGoal = ref(null)

// 目标相关
const goals = ref([])
const goalDialogVisible = ref(false)
const editingGoal = ref(null)
const goalForm = reactive({
  title: '',
  status: 'todo',
  description: '',
  progress: 0,
  target: 1
})

// 待办相关
const todos = ref([])
const todoDialogVisible = ref(false)
const editingTodo = ref(null)
const todoForm = reactive({
  title: '',
  goalId: null,
  creator: '晓',
  priority: 'medium',
  expectedPoints: 0,
  plannedDate: '',
  description: '',
  parentId: null
})

const todayStr = computed(() => {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

// ========== 数据映射与拉取 ==========

// 后端 snake_case ↔ 前端 camelCase 映射
const mapGoalFromApi = (g) => ({
  id: g.id,
  childId: g.child_id,
  childName: store.children.find(c => c.id === g.child_id)?.name || null,
  title: g.title,
  status: g.status,
  description: g.description || '',
  progress: g.progress,
  target: g.target
})

const mapTodoFromApi = (t) => ({
  id: t.id,
  goalId: t.goal_id,
  childId: t.child_id,
  childName: store.children.find(c => c.id === t.child_id)?.name || null,
  title: t.title,
  creator: t.creator,
  priority: t.priority,
  expectedPoints: t.expected_points,
  plannedDate: t.planned_date,
  description: t.description,
  completed: t.completed === 1,
  parentId: t.parent_id ?? null
})

const fetchGoals = async () => {
  loading.value = true
  try {
    const data = await getGoals()
    goals.value = (Array.isArray(data) ? data : []).map(mapGoalFromApi)
  } catch (err) {
    console.error('获取目标失败:', err)
  } finally {
    loading.value = false
  }
}

const fetchTodos = async () => {
  tableLoading.value = true
  try {
    const data = await getTodos()
    todos.value = (Array.isArray(data) ? data : []).map(mapTodoFromApi)
  } catch (err) {
    console.error('获取待办失败:', err)
  } finally {
    tableLoading.value = false
  }
}

// 全部目标页仅展示未归属孩子的目标；子页面展示该孩子的目标
const visibleGoals = computed(() => {
  if (!childName.value) return goals.value.filter(g => !g.childId)
  return goals.value.filter(g => g.childId === currentChildId.value)
})

// 全部目标页仅展示未归属孩子的待办；子页面仅展示该孩子的待办
const visibleTodos = computed(() => {
  if (!childName.value) return todos.value.filter(t => !t.childId)
  return todos.value.filter(t => t.childId === currentChildId.value)
})

// 可作为父任务的候选：根任务，且排除当前编辑任务自身及其子孙任务
const candidateParents = computed(() => {
  const editingId = editingTodo.value?.id
  const descendants = new Set()
  const walk = (id) => {
    todos.value.filter(t => t.parentId === id).forEach(child => {
      descendants.add(child.id)
      walk(child.id)
    })
  }
  if (editingId) walk(editingId)
  return todos.value.filter(t => {
    if (t.parentId) return false
    if (t.id === editingId) return false
    if (descendants.has(t.id)) return false
    // 只显示当前上下文下的任务：同孩子，且与所选目标分类一致
    if (t.childId !== currentChildId.value) return false
    if (todoForm.goalId && t.goalId !== todoForm.goalId) return false
    return true
  })
})

// 切换目标分类后，若已选父任务不在新的候选列表中，则自动清空
watch(() => todoForm.goalId, () => {
  if (todoForm.parentId && !candidateParents.value.some(t => t.id === todoForm.parentId)) {
    todoForm.parentId = null
  }
})

// ========== 目标功能 ==========

const getStatusLabel = (status) => {
  const labels = { 'todo': '待办', 'rest': '休憩', 'health': '健康', 'happy': '快乐', 'study': '学习' }
  return labels[status] || status
}

// 每个目标的实际关系统计（基于 todos 全量数据，不受 childName 筛选影响）
const goalTaskStats = (goalId) => {
  const linked = todos.value.filter(t => t.goalId === goalId)
  const completed = linked.filter(t => t.completed).length
  return { total: linked.length, completed, inProgress: linked.length - completed }
}

const getProgressPercent = (goal) => {
  const stats = goalTaskStats(goal.id)
  if (stats.total === 0) return 0
  return Math.round((stats.completed / stats.total) * 100)
}

// 点击目标卡片展示关联任务
const goalTasksDialogVisible = ref(false)
const viewingGoal = ref(null)

const goalTasks = computed(() => {
  if (!viewingGoal.value) return []
  return todos.value.filter(t => t.goalId === viewingGoal.value.id)
})

const openGoalTasks = (goal) => {
  viewingGoal.value = goal
  goalTasksDialogVisible.value = true
}

const openGoalModal = (goal = null) => {
  if (goal) {
    editingGoal.value = goal
    Object.assign(goalForm, { title: goal.title, status: goal.status, description: goal.description || '', progress: goal.progress, target: goal.target })
  } else {
    editingGoal.value = null
    Object.assign(goalForm, { title: '', status: 'todo', description: '', progress: 0, target: 1 })
  }
  goalDialogVisible.value = true
}

const saveGoal = async () => {
  if (!goalForm.title.trim()) {
    ElMessage.warning('请输入目标名称')
    return
  }
  const payload = {
    title: goalForm.title,
    status: goalForm.status,
    description: goalForm.description || '',
    progress: goalForm.progress,
    target: goalForm.target
  }
  try {
    if (editingGoal.value) {
      await updateGoal(editingGoal.value.id, payload)
      ElMessage.success('目标已更新')
    } else {
      await createGoal({ ...payload, child_id: currentChildId.value })
      ElMessage.success('目标已添加')
    }
    goalDialogVisible.value = false
    await fetchGoals()
  } catch (err) {
    ElMessage.error('保存失败，请重试')
    console.error(err)
  }
}

const deleteGoal = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除此目标？', '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteGoalApi(id)
    ElMessage.success('目标已删除')
    await fetchGoals()
    await fetchTodos()
  } catch (err) {
    ElMessage.error('删除失败')
    console.error(err)
  }
}

// ========== 待办功能 ==========

const toggleTodo = async (id) => {
  const todo = todos.value.find(t => t.id === id)
  if (!todo) return

  const nextCompleted = !todo.completed
  try {
    await updateTodo(id, { completed: nextCompleted ? 1 : 0 })
  } catch (err) {
    ElMessage.error('状态更新失败')
    console.error(err)
    return
  }
  todo.completed = nextCompleted

  // 根据待办的预期积分值自动汇总到对应孩子的总积分
  const points = parseInt(todo.expectedPoints) || 0
  // 全局待办(childId 为 null)不参与积分汇总
  if (points === 0 || !todo.childId) return

  try {
    await addPoints({
      child_id: todo.childId,
      amount: nextCompleted ? points : -points,
      reason: nextCompleted
        ? `完成待办「${todo.title}」获得预期积分`
        : `取消完成待办「${todo.title}」扣减预期积分`
    })
    ElMessage.success(nextCompleted ? `已奖励 ${points} 积分` : `已扣减 ${points} 积分`)
  } catch (err) {
    ElMessage.error('积分汇总失败')
    console.error('积分汇总失败:', err)
  }
}

const openTodoModal = (todo = null, parentTodo = null) => {
  if (todo) {
    editingTodo.value = todo
    Object.assign(todoForm, { title: todo.title, goalId: todo.goalId, creator: todo.creator, priority: todo.priority, expectedPoints: todo.expectedPoints || 0, plannedDate: todo.plannedDate, description: todo.description || '', parentId: todo.parentId || null })
  } else {
    editingTodo.value = null
    Object.assign(todoForm, { title: '', goalId: parentTodo?.goalId || null, creator: '晓', priority: 'medium', expectedPoints: 0, plannedDate: '', description: '', parentId: parentTodo?.id || null })
  }
  todoDialogVisible.value = true
}

const saveTodo = async () => {
  if (!todoForm.title.trim()) {
    ElMessage.warning('请输入待办名称')
    return
  }
  const payload = {
    title: todoForm.title,
    goal_id: todoForm.goalId ?? null,
    creator: todoForm.creator,
    priority: todoForm.priority,
    expected_points: todoForm.expectedPoints || 0,
    planned_date: todoForm.plannedDate || null,
    description: todoForm.description || null,
    parent_id: todoForm.parentId ?? null
  }
  try {
    let savedTodo
    if (editingTodo.value) {
      savedTodo = await updateTodo(editingTodo.value.id, payload)
      ElMessage.success('待办已更新')
    } else {
      savedTodo = await createTodo({ ...payload, child_id: currentChildId.value, completed: 0 })
      ElMessage.success('待办已添加')
    }
    todoDialogVisible.value = false
    await fetchTodos()
    // 未关联目标时，异步触发 QoderWake 自动关联（不阻断保存主流程）
    if (savedTodo && !savedTodo.goal_id) {
      triggerGoalAutoAssociation(mapTodoFromApi(savedTodo), goals.value)
        .then(() => ElMessage.success('已触发目标自动关联'))
        .catch(() => ElMessage.warning('目标自动关联触发失败，不影响待办保存'))
    }
  } catch (err) {
    ElMessage.error('保存失败，请重试')
    console.error(err)
  }
}

const deleteTodo = async (id) => {
  const childCount = todos.value.filter(t => t.parentId === id).length
  const confirmMsg = childCount > 0
    ? `此待办包含 ${childCount} 个子任务，删除后将同时删除所有子任务。确认删除？`
    : '确认删除此待办？'
  try {
    await ElMessageBox.confirm(confirmMsg, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteTodoApi(id)
    ElMessage.success('待办已删除')
    await fetchTodos()
  } catch (err) {
    ElMessage.error('删除失败')
    console.error(err)
  }
}

const cloneTodo = (todo) => {
  Object.assign(todoForm, {
    title: `${todo.title}（复制）`,
    goalId: todo.goalId,
    creator: todo.creator,
    priority: todo.priority,
    expectedPoints: todo.expectedPoints || 0,
    plannedDate: todo.plannedDate,
    description: todo.description || ''
  })
  editingTodo.value = null
  todoDialogVisible.value = true
  ElMessage.info('已填充待办信息，确认后创建副本')
}

// ========== 辅助函数 ==========

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.substring(5)
}

// ========== localStorage 一次性迁移 ==========

const LEGACY_KEY_GOALS = 'star-park-pcadmin-goals'
const LEGACY_KEY_TODOS = 'star-park-pcadmin-todos'
const MIGRATED_FLAG = 'star-park-pcadmin-migrated-v1'

// 将浏览器本地遗留数据一次性导入服务端；原数据保留作备份，仅用标记避免重复导入
// 调用前需先完成 fetchGoals/fetchTodos，以便据服务端现有数据做幂等判断
const migrateLegacyData = async () => {
  if (localStorage.getItem(MIGRATED_FLAG)) return false

  // 服务端已有数据说明其他浏览器或上一次已完成导入；
  // 旧版各浏览器的 localStorage 都存有同一份默认数据，不拦住会导致全量重复导入
  if (goals.value.length > 0 || todos.value.length > 0) {
    localStorage.setItem(MIGRATED_FLAG, '1')
    return false
  }

  let legacyGoals = []
  let legacyTodos = []
  try {
    legacyGoals = JSON.parse(localStorage.getItem(LEGACY_KEY_GOALS) || '[]')
    legacyTodos = JSON.parse(localStorage.getItem(LEGACY_KEY_TODOS) || '[]')
  } catch {
    // 本地数据已损坏，无可迁移内容，直接打标记跳过
    localStorage.setItem(MIGRATED_FLAG, '1')
    return false
  }

  if (legacyGoals.length === 0 && legacyTodos.length === 0) {
    localStorage.setItem(MIGRATED_FLAG, '1')
    return false
  }

  const resolveChildId = (item) => {
    if (item.childName) {
      return store.children.find(c => c.name === item.childName)?.id ?? null
    }
    return null
  }

  try {
    // 先建目标并记录 旧id → 新id 映射，供待办关联转换使用
    const idMap = new Map()
    for (const g of legacyGoals) {
      const created = await createGoal({
        child_id: resolveChildId(g),
        title: g.title,
        status: g.status || 'todo',
        progress: g.progress ?? 0,
        target: g.target ?? 1
      })
      idMap.set(g.id, created.id)
    }
    for (const t of legacyTodos) {
      await createTodo({
        goal_id: t.goalId ? (idMap.get(t.goalId) ?? null) : null,
        child_id: resolveChildId(t),
        title: t.title,
        creator: t.creator || null,
        priority: t.priority || 'medium',
        expected_points: t.expectedPoints ?? 0,
        planned_date: t.plannedDate || null,
        description: t.description || null,
        completed: t.completed ? 1 : 0
      })
    }
    localStorage.setItem(MIGRATED_FLAG, '1')
    ElMessage.success(`本地数据已迁移到服务器（${legacyGoals.length} 个目标，${legacyTodos.length} 条待办）`)
    return true
  } catch (err) {
    // 不写标记，下次进入页面自动重试；原数据保留
    // 若已部分导入，下次会因服务端已有数据而跳过迁移，避免重复；未导入部分仍在 localStorage 备份中
    ElMessage.error('本地数据迁移失败，原数据已保留，请稍后重试')
    console.error('迁移失败:', err)
    return false
  }
}

onMounted(async () => {
  // 先加载孩子列表：迁移时需按名字匹配 child_id，映射时需按 id 反查名字
  if (store.children.length === 0) {
    await store.fetchChildren()
  }
  await fetchGoals()
  await fetchTodos()
  const migrated = await migrateLegacyData()
  if (migrated) {
    await fetchGoals()
    await fetchTodos()
  }
})
</script>

<style scoped>
.welcome-section {
  margin-bottom: 24px;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--text);
}

.welcome-date {
  font-size: 14px;
  color: var(--text-light);
  margin-top: 6px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

/* 目标网格 */
.goals-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.goal-card {
  position: relative;
  background: var(--bg-light);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border-left: 4px solid;
}

.goal-card.status-todo { border-color: #4CAF50; }
.goal-card.status-rest { border-color: #9E9E9E; }
.goal-card.status-health { border-color: #2196F3; }
.goal-card.status-happy { border-color: #FF9800; }
.goal-card.status-study { border-color: #9C27B0; }

.goal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.goal-card-content {
  min-height: 80px;
}

.goal-status {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 8px;
}

.goal-status.todo { background: #E8F5E9; color: #4CAF50; }
.goal-status.rest { background: #F5F5F5; color: #9E9E9E; }
.goal-status.health { background: #E3F2FD; color: #2196F3; }
.goal-status.happy { background: #FFF3E0; color: #FF9800; }
.goal-status.study { background: #F3E5F5; color: #9C27B0; }

.goal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 12px;
}

.goal-description {
  font-size: 12px;
  color: var(--text-light);
  margin-bottom: 12px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.goal-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.goal-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}

.goal-progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}

.status-todo .goal-progress-fill { background: #4CAF50; }
.status-rest .goal-progress-fill { background: #9E9E9E; }
.status-health .goal-progress-fill { background: #2196F3; }
.status-happy .goal-progress-fill { background: #FF9800; }
.status-study .goal-progress-fill { background: #9C27B0; }

.goal-progress-text {
  font-size: 12px;
  color: var(--text-light);
  min-width: 40px;
}

.goal-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 4px;
}

.empty-text {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-light);
  padding: 20px;
}

/* 待办区域 */
.todo-title-text {
  font-weight: 500;
}

.todo-title-text.completed {
  text-decoration: line-through;
  color: var(--text-light);
}

.points-tag {
  color: #FF6B00;
  font-weight: 600;
}

.text-muted {
  color: var(--text-light);
  font-size: 13px;
}

.date-text {
  font-size: 13px;
  color: var(--text-light);
}

.progress-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-divider {
  color: var(--text-light);
}

/* 响应式 */
@media (max-width: 1024px) {
  .goals-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .goals-grid {
    grid-template-columns: 1fr;
  }
}
</style>