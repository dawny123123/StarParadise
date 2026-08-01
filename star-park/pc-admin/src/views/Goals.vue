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
            <div class="goal-progress">
              <div class="goal-progress-bar">
                <div class="goal-progress-fill" :style="{ width: getProgressPercent(goal) + '%' }"></div>
              </div>
              <span class="goal-progress-text">{{ goal.progress }}/{{ goal.target }}</span>
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
      <div class="filter-tabs">
        <el-tag
          :type="todoFilter === 'all' ? 'primary' : ''"
          :effect="todoFilter === 'all' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setTodoFilter('all')"
        >
          全部 <span class="tab-count">{{ visibleTodos.length }}</span>
        </el-tag>
        <el-tag
          :type="todoFilter === 'pending' ? 'primary' : ''"
          :effect="todoFilter === 'pending' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setTodoFilter('pending')"
        >
          进行中 <span class="tab-count">{{ pendingCount }}</span>
        </el-tag>
        <el-tag
          :type="todoFilter === 'completed' ? 'primary' : ''"
          :effect="todoFilter === 'completed' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setTodoFilter('completed')"
        >
          已完成 <span class="tab-count">{{ completedCount }}</span>
        </el-tag>
      </div>
      <el-table :data="filteredTodos" stripe style="width: 100%" v-loading="tableLoading">
        <el-table-column width="50">
          <template #default="{ row }">
            <el-checkbox
              :model-value="row.completed"
              @change="toggleTodo(row.id)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150">
          <template #default="{ row }">
            <span :class="['todo-title-text', { completed: row.completed }]">{{ row.title }}</span>
          </template>
        </el-table-column>
        <el-table-column label="关联目标" width="120">
          <template #default="{ row }">
            <el-tag v-if="getGoalTitle(row.goalId)" :type="getGoalTagType(row.goalId)" size="small">
              {{ getGoalTitle(row.goalId) }}
            </el-tag>
            <span v-else class="text-muted">选择目标</span>
          </template>
        </el-table-column>
        <el-table-column prop="creator" label="创建人" width="80" />
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">
            <el-tag :type="getPriorityType(row.priority)" size="small">
              {{ getPriorityLabel(row.priority) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="预期积分" width="90" align="center">
          <template #default="{ row }">
            <span class="points-tag">{{ row.expectedPoints || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.description">{{ row.description }}</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="计划日期" width="100">
          <template #default="{ row }">
            <span class="date-text">{{ formatDate(row.plannedDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110" align="center" fixed="right">
          <template #default="{ row }">
            <div class="todo-actions">
              <el-button text size="small" @click="openTodoModal(row)">
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button text size="small" type="danger" @click="deleteTodo(row.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="filteredTodos.length === 0" description="暂无待办事项" />
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
          <el-input-number v-model="todoForm.expectedPoints" :min="0" :max="9999" :precision="0" placeholder="完成时奖励的积分" style="width: 100%" />
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
      </el-table>
      <el-empty v-else description="暂无关联任务" :image-size="60" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { triggerGoalAutoAssociation, addPoints } from '../api'
import { useAppStore } from '../stores/app'

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
  progress: 0,
  target: 1
})

// 待办相关
const todos = ref([])
const todoDialogVisible = ref(false)
const editingTodo = ref(null)
const todoFilter = ref('pending')
const todoForm = reactive({
  title: '',
  goalId: null,
  creator: '晓',
  priority: 'medium',
  expectedPoints: 0,
  plannedDate: '',
  description: ''
})

const todayStr = computed(() => {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

const pendingCount = computed(() => visibleTodos.value.filter(t => !t.completed).length)
const completedCount = computed(() => visibleTodos.value.filter(t => t.completed).length)

// 按孩子过滤：子菜单页面仅展示归属该孩子的目标/待办；全部目标页仅展示未归属孩子的目标，孩子的目标只在各自页面展示
const visibleGoals = computed(() => {
  if (!childName.value) return goals.value.filter(g => !g.childName)
  return goals.value.filter(g => g.childName === childName.value)
})

const visibleTodos = computed(() => {
  if (!childName.value) return todos.value
  return todos.value.filter(t => t.childName === childName.value)
})

const filteredTodos = computed(() => {
  if (todoFilter.value === 'pending') {
    return visibleTodos.value.filter(t => !t.completed)
  } else if (todoFilter.value === 'completed') {
    return visibleTodos.value.filter(t => t.completed)
  }
  return visibleTodos.value
})

// ========== 目标功能 ==========

const getStatusLabel = (status) => {
  const labels = { 'todo': '待办', 'rest': '休憩', 'health': '健康', 'happy': '快乐', 'study': '学习' }
  return labels[status] || status
}

const getProgressPercent = (goal) => {
  if (!goal.target || goal.target === 0) return 0
  return Math.round((goal.progress / goal.target) * 100)
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
    Object.assign(goalForm, { title: goal.title, status: goal.status, progress: goal.progress, target: goal.target })
  } else {
    editingGoal.value = null
    Object.assign(goalForm, { title: '', status: 'todo', progress: 0, target: 1 })
  }
  goalDialogVisible.value = true
}

const saveGoal = () => {
  if (!goalForm.title.trim()) {
    ElMessage.warning('请输入目标名称')
    return
  }
  if (editingGoal.value) {
    const index = goals.value.findIndex(g => g.id === editingGoal.value.id)
    if (index !== -1) {
      goals.value[index] = { ...goals.value[index], ...goalForm }
    }
  } else {
    goals.value.push({
      id: Date.now(),
      ...goalForm,
      // 孩子子页面创建的目标归属该孩子（childId 由 /api/children 按名字匹配）
      childName: childName.value || null,
      childId: currentChildId.value
    })
  }
  saveGoals()
  goalDialogVisible.value = false
  ElMessage.success(editingGoal.value ? '目标已更新' : '目标已添加')
}

const deleteGoal = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除此目标？', '提示', { type: 'warning' })
    goals.value = goals.value.filter(g => g.id !== id)
    // 同时清除待办中的关联
    todos.value.forEach(t => {
      if (t.goalId === id) t.goalId = null
    })
    saveGoals()
    saveTodos()
  } catch {}
}

// ========== 待办功能 ==========

const setTodoFilter = (filter) => {
  todoFilter.value = filter
}

const toggleTodo = async (id) => {
  const todo = todos.value.find(t => t.id === id)
  if (!todo) return

  const nextCompleted = !todo.completed
  todo.completed = nextCompleted
  saveTodos()

  // 根据待办的预期积分值自动汇总到对应孩子的总积分
  const points = parseInt(todo.expectedPoints) || 0
  if (points === 0) return

  // localStorage 缓存的 childId 可能指向已删除的孩子，须用后端当前孩子列表校验，失效时按名字重新匹配
  if (store.children.length === 0) {
    await store.fetchChildren()
  }
  let childId = store.children.some(c => c.id === todo.childId) ? todo.childId : null
  const matchName = todo.childName || childName.value
  if (!childId && matchName) {
    const matched = store.children.find(c => c.name === matchName)
    childId = matched?.id || null
  }
  if (!childId) {
    ElMessage.warning('未找到对应孩子，无法汇总积分')
    return
  }
  // 将校验后的 childId 回写待办，修复旧数据中的失效引用
  if (todo.childId !== childId) {
    todo.childId = childId
    saveTodos()
  }

  try {
    await addPoints({
      child_id: childId,
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

const openTodoModal = (todo = null) => {
  if (todo) {
    editingTodo.value = todo
    Object.assign(todoForm, { title: todo.title, goalId: todo.goalId, creator: todo.creator, priority: todo.priority, expectedPoints: todo.expectedPoints || 0, plannedDate: todo.plannedDate, description: todo.description || '' })
  } else {
    editingTodo.value = null
    Object.assign(todoForm, { title: '', goalId: null, creator: '晓', priority: 'medium', expectedPoints: 0, plannedDate: '', description: '' })
  }
  todoDialogVisible.value = true
}

const saveTodo = () => {
  if (!todoForm.title.trim()) {
    ElMessage.warning('请输入待办名称')
    return
  }
  let savedTodo = null
  if (editingTodo.value) {
    const index = todos.value.findIndex(t => t.id === editingTodo.value.id)
    if (index !== -1) {
      todos.value[index] = { ...todos.value[index], ...todoForm }
      savedTodo = todos.value[index]
    }
  } else {
    savedTodo = {
      id: Date.now(),
      ...todoForm,
      // 孩子子页面创建的待办归属该孩子
      childName: childName.value || null,
      childId: currentChildId.value,
      completed: false
    }
    todos.value.push(savedTodo)
  }
  saveTodos()
  todoDialogVisible.value = false
  ElMessage.success(editingTodo.value ? '待办已更新' : '待办已添加')
  // 未关联目标时，异步触发 QoderWake 自动关联（不阻断保存主流程）
  if (savedTodo && !savedTodo.goalId) {
    triggerGoalAutoAssociation(savedTodo, goals.value)
      .then(() => ElMessage.success('已触发目标自动关联'))
      .catch(() => ElMessage.warning('目标自动关联触发失败，不影响待办保存'))
  }
}

const deleteTodo = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除此待办？', '提示', { type: 'warning' })
    todos.value = todos.value.filter(t => t.id !== id)
    saveTodos()
  } catch {}
}

// ========== 辅助函数 ==========

const getGoalTitle = (goalId) => {
  if (!goalId) return ''
  const goal = goals.value.find(g => g.id === goalId)
  return goal ? goal.title.substring(0, 8) + (goal.title.length > 8 ? '...' : '') : ''
}

const getGoalTagType = (goalId) => {
  if (!goalId) return 'info'
  const goal = goals.value.find(g => g.id === goalId)
  if (!goal) return 'info'
  const typeMap = { 'todo': 'success', 'rest': 'info', 'health': '', 'happy': 'warning', 'study': 'purple' }
  return typeMap[goal.status] || 'info'
}

const getPriorityType = (priority) => {
  const typeMap = { 'high': 'danger', 'medium': 'warning', 'low': 'success' }
  return typeMap[priority] || 'info'
}

const getPriorityLabel = (priority) => {
  const labelMap = { 'high': '高', 'medium': '中', 'low': '低' }
  return labelMap[priority] || priority
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.substring(5)
}

// ========== 数据持久化 ==========

const DATA_KEY_GOALS = 'star-park-pcadmin-goals'
const DATA_KEY_TODOS = 'star-park-pcadmin-todos'

// 从ChildInspire项目导入的完整数据：6个目标 + 56条待办（41已完成+15待完成）
const defaultGoals = [
  { id: 1, title: '北京深度游或探索新地方', status: 'todo', progress: 6, target: 12 },
  { id: 2, title: '解锁一项新技能（不设限）', status: 'rest', progress: 1, target: 5 },
  { id: 3, title: '陪父母', status: 'todo', progress: 1, target: 4 },
  { id: 4, title: '健康饮食运动', status: 'health', progress: 9, target: 15 },
  { id: 5, title: '购物玩乐', status: 'happy', progress: 8, target: 10 },
  { id: 6, title: '学习及思考', status: 'study', progress: 12, target: 20 },
  { id: 7, title: '学习初三的', status: 'study', progress: 0, target: 1, childName: '甜甜' }
]

const defaultTodos = [
  { id: 1, title: '体能结束开放日提前15分钟', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 2, title: '大月上品购物', goalId: 5, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 3, title: '确认驾照有效期', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 4, title: '25年度报销', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 5, title: '解决暖气不热', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 6, title: '洋未来规划', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 7, title: '26元旦party', goalId: 5, creator: '甄甜', priority: 'high', plannedDate: '', completed: true },
  { id: 8, title: '26元旦计划', goalId: 5, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 9, title: '每两周给孩子们上个课', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 10, title: '身份证重新办理', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 11, title: '2025年体检', goalId: 4, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 12, title: '1月底甲状腺复查', goalId: 4, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 13, title: '国图看书', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 14, title: '甄甄生日', goalId: 5, creator: '甄甜', priority: 'high', plannedDate: '', completed: true },
  { id: 15, title: '安排济南差旅', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 16, title: '八大处', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 17, title: '看洋洋、姨', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 18, title: '大兴购物', goalId: 5, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 19, title: '奥森观鸟', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 20, title: '开劳关3季度发票', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 21, title: '地铁高峰期思考', goalId: 6, creator: '甄甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 22, title: '杭州出差安排', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 23, title: '过年买衣服', goalId: 5, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 24, title: '过年安排', goalId: 5, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 25, title: 'stock收尾', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 26, title: '2025年总结', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 27, title: '2026规划', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 28, title: '退税传孩子出生证明', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 29, title: '灵峰的社保', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 30, title: '驾照有效性', goalId: 2, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 31, title: '补牙', goalId: 4, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 32, title: '劳关Q3房租', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 33, title: 'AI技能学习-海报', goalId: 6, creator: '嘉甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 34, title: '每周去一次国图', goalId: 6, creator: '甄甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 35, title: '坚持多走路', goalId: 4, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 36, title: '4月25上午实践', goalId: 1, creator: '甄甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 37, title: '甲状腺+膝盖疼', goalId: 4, creator: '嘉甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 38, title: '3月31日济南交流', goalId: 6, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 39, title: '328国图学习', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 40, title: '学一样技能乒乓球', goalId: 2, creator: '嘉甜', priority: 'medium', plannedDate: '', completed: false },
  { id: 41, title: '全秒近视', goalId: 4, creator: '洋', priority: 'medium', plannedDate: '', completed: false },
  { id: 42, title: '4月份安排', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 43, title: '陪爸妈回浙江', goalId: 3, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 44, title: '4.6～4.10出差安排', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 45, title: '51安排', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 46, title: '0425周末安排', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 47, title: '5月研学安排', goalId: 6, creator: '嘉甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 48, title: '0509阿里日', goalId: 1, creator: '晓', priority: 'medium', plannedDate: '', completed: true },
  { id: 49, title: '530汉', goalId: null, creator: '顶', priority: 'medium', plannedDate: '', completed: false },
  { id: 50, title: '做一套harness工程的激励系统', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 51, title: '大阿姨安排', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 52, title: '协和精神内科', goalId: 4, creator: '甄甜', priority: 'medium', plannedDate: '', completed: false },
  { id: 53, title: '膝盖再看', goalId: 4, creator: '嘉甜', priority: 'medium', plannedDate: '', completed: true },
  { id: 54, title: '嘉甜AI学习任务', goalId: null, creator: '甄甜', priority: 'medium', plannedDate: '', completed: false },
  { id: 55, title: 'AI-沉淀最佳实践', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 56, title: 'ali福利', goalId: null, creator: '晓', priority: 'medium', plannedDate: '', completed: false },
  { id: 57, title: '学习四讲', goalId: 7, creator: '晓', priority: 'medium', expectedPoints: 5, plannedDate: '2026-07-26', completed: false, childName: '甜甜' }
]

const saveGoals = () => {
  localStorage.setItem(DATA_KEY_GOALS, JSON.stringify(goals.value))
}

const saveTodos = () => {
  localStorage.setItem(DATA_KEY_TODOS, JSON.stringify(todos.value))
}

const loadData = () => {
  const savedGoals = localStorage.getItem(DATA_KEY_GOALS)
  const savedTodos = localStorage.getItem(DATA_KEY_TODOS)

  // 合并策略：以本地数据为准，但自动补充默认数据中缺失的条目
  // 防止默认目标/待办因 localStorage 被部分覆盖而"丢失"
  const mergeWithDefault = (saved, defaults) => {
    if (!saved) return [...defaults]
    const parsed = JSON.parse(saved)
    const defaultMap = new Map(defaults.map(item => [item.id, item]))
    const localMap = new Map(parsed.map(item => [item.id, item]))
    return Array.from(defaultMap.values()).map(item => localMap.get(item.id) || item)
  }

  goals.value = mergeWithDefault(savedGoals, defaultGoals)
  todos.value = mergeWithDefault(savedTodos, defaultTodos)

  // 同步回 localStorage，确保缺失的默认数据被补齐
  saveGoals()
  saveTodos()
}

onMounted(() => {
  loadData()
  // 加载孩子列表，完成待办时按名字匹配 child_id 汇总积分
  if (store.children.length === 0) {
    store.fetchChildren()
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
.filter-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-tab {
  cursor: pointer;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--border);
  border-radius: 9px;
  font-size: 11px;
  margin-left: 4px;
}

.todo-title-text {
  font-weight: 500;
}

.todo-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.todo-actions .el-button + .el-button {
  margin-left: 0;
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