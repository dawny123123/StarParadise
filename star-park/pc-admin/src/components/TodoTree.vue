<template>
  <div class="todo-tree">
    <div class="filter-tabs">
      <el-tag
        :type="filter === 'all' ? 'primary' : ''"
        :effect="filter === 'all' ? 'dark' : 'plain'"
        class="filter-tab"
        @click="setFilter('all')"
      >
        全部 <span class="tab-count">{{ visibleTodos.length }}</span>
      </el-tag>
      <el-tag
        :type="filter === 'pending' ? 'primary' : ''"
        :effect="filter === 'pending' ? 'dark' : 'plain'"
        class="filter-tab"
        @click="setFilter('pending')"
      >
        进行中 <span class="tab-count">{{ pendingCount }}</span>
      </el-tag>
      <el-tag
        :type="filter === 'completed' ? 'primary' : ''"
        :effect="filter === 'completed' ? 'dark' : 'plain'"
        class="filter-tab"
        @click="setFilter('completed')"
      >
        已完成 <span class="tab-count">{{ completedCount }}</span>
      </el-tag>
    </div>

    <el-table
      :data="treeTodos"
      stripe
      style="width: 100%"
      v-loading="loading"
      row-key="id"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      :row-class-name="rowClassName"
    >
      <el-table-column width="40">
        <template #default="{ row }">
          <span
            class="drag-handle"
            draggable="true"
            title="拖拽此任务到另一行可设置父子关系"
            @dragstart.stop="handleDragStart($event, row)"
            @dragend.stop="handleDragEnd"
          >⠿</span>
        </template>
      </el-table-column>
      <el-table-column width="50">
        <template #default="{ row }">
          <el-checkbox :model-value="row.completed" @change="emit('toggle', row.id)" />
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
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <div
            class="todo-actions"
            :class="{ 'drop-active': draggingTodo && canBeParent(draggingTodo, row) }"
            @dragover.prevent="handleDragOver($event, row)"
            @dragleave.prevent="handleDragLeave"
            @drop.prevent.stop="handleDrop($event, row)"
          >
            <el-button text size="small" title="编辑" @click.stop="emit('edit', row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button
              v-if="!row.parentId"
              text
              size="small"
              title="添加子任务"
              @click.stop="emit('add-child', row)"
            >
              <el-icon><Files /></el-icon>
            </el-button>
            <el-button
              v-if="!row.parentId && row.children?.length === 0"
              text
              size="small"
              title="设为子任务"
              @click.stop="openParentDialog(row)"
            >
              <el-icon><BottomLeft /></el-icon>
            </el-button>
            <el-button
              v-if="row.parentId"
              text
              size="small"
              type="warning"
              title="取消父子关系"
              @click.stop="removeParent(row)"
            >
              <el-icon><TopRight /></el-icon>
            </el-button>
            <el-button text size="small" title="复制" @click.stop="emit('clone', row)">
              <el-icon><DocumentCopy /></el-icon>
            </el-button>
            <el-button text size="small" type="danger" title="删除" @click.stop="emit('delete', row.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-if="treeTodos.length === 0" description="暂无待办事项" />

    <!-- 选择父任务对话框 -->
    <el-dialog v-model="parentDialogVisible" title="设置父任务" width="480px">
      <el-form label-width="90px">
        <el-form-item label="当前任务">
          <el-tag type="info">{{ pendingChildTodo?.title }}</el-tag>
        </el-form-item>
        <el-form-item label="父任务">
          <el-select v-model="selectedParentId" placeholder="选择父任务" clearable style="width: 100%">
            <el-option
              v-for="t in candidateParents"
              :key="t.id"
              :label="t.title"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="parentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmParentFromDialog">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { Edit, Delete, DocumentCopy, Files, BottomLeft, TopRight } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { updateTodo } from '../api'

const props = defineProps({
  todos: { type: Array, default: () => [] },
  goals: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['refresh', 'edit', 'delete', 'clone', 'toggle', 'add-child'])

const filter = ref('pending')
const pendingChildTodo = ref(null)
const parentDialogVisible = ref(false)
const selectedParentId = ref(null)
const draggingTodo = ref(null)

const visibleTodos = computed(() => props.todos)
const pendingCount = computed(() => visibleTodos.value.filter(t => !t.completed).length)
const completedCount = computed(() => visibleTodos.value.filter(t => t.completed).length)

const setFilter = (value) => {
  filter.value = value
}

const buildTodoTree = (flatList) => {
  const map = new Map()
  const tree = []
  flatList.forEach(item => {
    map.set(item.id, { ...item, children: [], hasChildren: false })
  })
  flatList.forEach(item => {
    const node = map.get(item.id)
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)
      parent.children.push(node)
      parent.hasChildren = true
    } else {
      tree.push(node)
    }
  })
  return tree
}

const filteredTodos = computed(() => {
  let list = visibleTodos.value
  if (filter.value === 'pending') {
    list = visibleTodos.value.filter(t => !t.completed)
  } else if (filter.value === 'completed') {
    list = visibleTodos.value.filter(t => t.completed)
  }
  return [...list].sort((a, b) => {
    if (!a.plannedDate && !b.plannedDate) return 0
    if (!a.plannedDate) return 1
    if (!b.plannedDate) return -1
    return a.plannedDate.localeCompare(b.plannedDate)
  })
})

const treeTodos = computed(() => buildTodoTree(filteredTodos.value))

const getGoalTitle = (goalId) => {
  if (!goalId) return ''
  const goal = props.goals.find(g => g.id === goalId)
  return goal ? goal.title.substring(0, 8) + (goal.title.length > 8 ? '...' : '') : ''
}

const getGoalTagType = (goalId) => {
  if (!goalId) return 'info'
  const goal = props.goals.find(g => g.id === goalId)
  if (!goal) return 'info'
  const typeMap = { todo: 'success', rest: 'info', health: '', happy: 'warning', study: 'purple' }
  return typeMap[goal.status] || 'info'
}

const getPriorityType = (priority) => {
  const typeMap = { high: 'danger', medium: 'warning', low: 'success' }
  return typeMap[priority] || 'info'
}

const getPriorityLabel = (priority) => {
  const labelMap = { high: '高', medium: '中', low: '低' }
  return labelMap[priority] || priority
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.substring(5)
}

const descendantIds = (todo) => {
  const result = new Set()
  const walk = (node) => {
    if (!node?.children?.length) return
    node.children.forEach(child => {
      result.add(child.id)
      walk(child)
    })
  }
  walk(todo)
  return result
}

const canBeParent = (childTodo, parentTodo) => {
  if (!childTodo || !parentTodo) return false
  if (childTodo.id === parentTodo.id) return false
  if (parentTodo.parentId) return false
  if (descendantIds(childTodo).has(parentTodo.id)) return false
  return true
}

const doUpdateParent = async (childId, parentId) => {
  try {
    await updateTodo(childId, { parent_id: parentId })
    ElMessage.success(parentId ? '父子关系已设置' : '已取消父子关系')
    emit('refresh')
  } catch (err) {
    ElMessage.error('操作失败')
    console.error(err)
  }
}

const candidateParents = computed(() => {
  if (!pendingChildTodo.value) return []
  return visibleTodos.value.filter(t => canBeParent(pendingChildTodo.value, t))
})

const openParentDialog = (row) => {
  pendingChildTodo.value = row
  selectedParentId.value = row.parentId || null
  parentDialogVisible.value = true
}

const confirmParentFromDialog = () => {
  if (!pendingChildTodo.value) return
  doUpdateParent(pendingChildTodo.value.id, selectedParentId.value)
  parentDialogVisible.value = false
}

const removeParent = async (row) => {
  try {
    await ElMessageBox.confirm('确认取消该任务的父子关系？', '提示', { type: 'warning' })
  } catch {
    return
  }
  doUpdateParent(row.id, null)
}

const rowClassName = ({ row }) => {
  if (draggingTodo.value && canBeParent(draggingTodo.value, row)) {
    return 'droppable-parent'
  }
  return ''
}

const handleDragStart = (event, row) => {
  if (row.children?.length > 0) {
    ElMessage.warning('含有子任务的任务不能拖拽设为子任务')
    event.preventDefault()
    return
  }
  draggingTodo.value = row
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(row.id))
}

const handleDragEnd = () => {
  draggingTodo.value = null
}

const handleDragOver = (event, row) => {
  if (!draggingTodo.value || !canBeParent(draggingTodo.value, row)) {
    event.dataTransfer.dropEffect = 'none'
    return
  }
  event.dataTransfer.dropEffect = 'move'
}

const handleDragLeave = () => {
  // 样式通过 droppable-parent 类控制，无需额外逻辑
}

const handleDrop = (event, row) => {
  if (!draggingTodo.value || !canBeParent(draggingTodo.value, row)) return
  doUpdateParent(draggingTodo.value.id, row.id)
  draggingTodo.value = null
}
</script>

<style scoped>
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

.drag-handle {
  cursor: grab;
  color: var(--text-light);
  user-select: none;
  font-size: 12px;
}

.drag-handle:active {
  cursor: grabbing;
}

.todo-title-text {
  font-weight: 500;
}

.todo-title-text.completed {
  text-decoration: line-through;
  color: var(--text-light);
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

.todo-actions.drop-active {
  background: rgba(64, 158, 255, 0.12);
  border-radius: 4px;
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

:deep(.droppable-parent) {
  background-color: rgba(64, 158, 255, 0.08) !important;
}
</style>
