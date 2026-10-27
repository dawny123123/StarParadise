<template>
  <div class="todo-tree" @dragover="handleSortDragOver" @drop="handleSortDrop">
    <div class="filter-bar">
      <div class="filter-tabs">
        <el-tag
          :type="filter === 'all' ? 'primary' : ''"
          :effect="filter === 'all' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setFilter('all')"
        >
          全部 <span class="tab-count">{{ allSearched.length }}</span>
        </el-tag>
        <el-tag
          :type="filter === 'pending' ? 'primary' : ''"
          :effect="filter === 'pending' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setFilter('pending')"
        >
          进行中 <span class="tab-count">{{ pendingSearched.length }}</span>
        </el-tag>
        <el-tag
          :type="filter === 'completed' ? 'primary' : ''"
          :effect="filter === 'completed' ? 'dark' : 'plain'"
          class="filter-tab"
          @click="setFilter('completed')"
        >
          已完成 <span class="tab-count">{{ completedSearched.length }}</span>
        </el-tag>
      </div>
      <el-input
        v-model="keyword"
        class="todo-search"
        placeholder="搜索任务名称"
        clearable
        :prefix-icon="Search"
      />
    </div>
    <TodoBatchParentDialog
      :todos="props.todos"
      :selected-todos="selectedTodos"
      @success="handleBatchParentSuccess"
    />
    <el-table
      ref="todoTable"
      :data="treeTodos"
      stripe
      style="width: 100%"
      v-loading="loading"
      row-key="id"
      :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
      :row-class-name="rowClassName"
      :empty-text="emptyText"
      @selection-change="handleSelectionChange"
      @sort-change="handleSortChange"
    >
      <el-table-column type="selection" width="44" :selectable="isBulkSelectable" />
      <el-table-column width="56">
        <template #default="{ row }">
          <span class="handle-group">
            <span
              class="drag-handle"
              draggable="true"
              title="拖拽此任务到另一行可设置父子关系"
              @dragstart.stop="handleDragStart($event, row)"
              @dragend.stop="handleDragEnd"
            >⠿</span>
            <span
              class="sort-handle" :class="{ 'sort-handle-disabled': sortOrder !== '' }"
              :draggable="sortOrder === ''"
              :title="sortOrder === '' ? '按住此处上下拖动可调整任务顺序' : '计划日期排序激活时不可拖动排序，点击计划日期列头取消排序后恢复'"
              @dragstart.stop="handleSortDragStart($event, row)"
              @dragend.stop="handleSortDragEnd"
            >⇅</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column width="50">
        <template #default="{ row }">
          <el-checkbox :model-value="row.completed" @change="emit('toggle', row.id)" />
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="150">
        <template #default="{ row }">
          <span :class="['todo-title-text', { completed: row.completed, 'todo-child-title': isChildTodo(row) }]">
            <el-tag v-if="isParentTodo(row)" class="todo-role-tag" size="small" effect="dark">父任务</el-tag>
            <span :class="{ 'todo-parent-title': isParentTodo(row) }">{{ row.title }}</span>
          </span>
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
      <el-table-column label="描述" min-width="180">
        <template #default="{ row }">
          <div class="todo-description-cell">
            <MarkdownPreview v-if="row.description" :content="row.description" />
            <span v-else class="text-muted">-</span>
            <div v-if="row.attachments && row.attachments.length > 0" class="todo-attachments">
              <a
                v-for="(att, idx) in row.attachments"
                :key="idx"
                :href="att.fileUrl"
                target="_blank"
                class="todo-attach-link"
                :title="att.fileName || ('附件' + (idx + 1))"
                @click.stop
              >
                <el-icon><Document /></el-icon>
                <span class="todo-attach-name">{{ att.fileName || ('附件' + (idx + 1)) }}</span>
              </a>
            </div>
            <div v-else-if="row.fileUrl" class="todo-attachments">
              <a :href="row.fileUrl" target="_blank" class="todo-attach-link" :title="row.fileName || '查看附件'" @click.stop>
                <el-icon><Document /></el-icon>
                <span class="todo-attach-name">{{ row.fileName || '附件' }}</span>
              </a>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="plannedDate" label="计划日期" width="110" sortable="custom">
        <template #default="{ row }">
          <span class="date-text">{{ formatDate(row.plannedDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <div
            class="todo-actions"
            :class="{ 'drop-active': draggingTodo && canBeParent(draggingTodo, row) }"
            @dragover="handleDragOver($event, row)"
            @drop.prevent="handleDrop($event, row)"
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
    <!-- 选择父任务对话框 -->
    <TodoParentDialog
      :visible="parentDialogVisible"
      :todo="pendingChildTodo"
      :candidates="candidateParents"
      @confirm="confirmParentFromDialog"
    />
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { Edit, Delete, DocumentCopy, Files, BottomLeft, TopRight, Document, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { updateTodo } from '../api'
import TodoBatchParentDialog from './TodoBatchParentDialog.vue'
import TodoParentDialog from './TodoParentDialog.vue'
import MarkdownPreview from './MarkdownPreview.vue'
import { useTodoSortDrag, useTodoSortMode } from './todoSortDrag'
import { useTodoSearch, buildTodoTree, collectDescendantIds } from './todoSearch'
const props = defineProps({
  todos: { type: Array, default: () => [] },
  goals: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
})
const emit = defineEmits(['refresh', 'edit', 'delete', 'clone', 'toggle', 'add-child'])
const filter = ref('pending')
const todoTable = ref(null)
const selectedTodos = ref([])
const pendingChildTodo = ref(null)
const parentDialogVisible = ref(false)
const draggingTodo = ref(null)
const { sortOrder, sortTodos } = useTodoSortMode()
const visibleTodos = computed(() => props.todos)
// 关键字搜索（PONR-21）：各状态视图内保留命中任务及其祖先，计数与展示保持一致
const { keyword, isSearching, scopeTodos } = useTodoSearch(visibleTodos)
const statusTodos = (status) => {
  const list = visibleTodos.value
  const byStatus = status === 'pending' ? list.filter(t => !t.completed)
    : status === 'completed' ? list.filter(t => t.completed) : list
  return scopeTodos(byStatus)
}
const allSearched = computed(() => statusTodos('all'))
const pendingSearched = computed(() => statusTodos('pending'))
const completedSearched = computed(() => statusTodos('completed'))
const emptyText = computed(() => {
  if (!isSearching.value) return '暂无待办事项'
  return allSearched.value.length > 0 ? '当前筛选下没有匹配的任务' : '未找到匹配的任务'
})
const setFilter = (value) => {
  filter.value = value
}
// 计划日期列头排序（PONR-37）：sort-change 在升序/降序/取消（order 为 null）间切换
const handleSortChange = ({ order }) => {
  sortOrder.value = order || ''
}
// 排序（PONR-37）：计划日期列头升/降序仅影响展示，未排序时保持自定义拖拽顺序（PONR-32）
const filteredTodos = computed(() => sortTodos(statusTodos(filter.value)))
const treeTodos = computed(() => buildTodoTree(filteredTodos.value))
// 手动排序拖动（PONR-32）：同级任务上下拖动重新排序
const { sortDropTarget, handleSortDragStart, handleSortDragEnd, handleSortDragOver, handleSortDrop } = useTodoSortDrag({
  treeTodos,
  todos: computed(() => props.todos),
  onRefresh: () => emit('refresh')
})
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
const canBeParent = (childTodo, parentTodo) => {
  if (!childTodo || !parentTodo) return false
  if (childTodo.id === parentTodo.id) return false
  if (parentTodo.parentId) return false
  if (collectDescendantIds(childTodo).has(parentTodo.id)) return false
  return true
}
const hasDirectChildren = (todo) => props.todos.some(item => item.parentId === todo.id)
const isParentTodo = (row) => !row.parentId && row.children?.length > 0
const isChildTodo = (row) => Boolean(row.parentId)
const isBulkSelectable = (row) => !hasDirectChildren(row)
const handleSelectionChange = (rows) => {
  selectedTodos.value = rows
}
const doUpdateParent = async (childId, parentId) => {
  try {
    await updateTodo(childId, { parent_id: parentId })
    ElMessage.success(parentId ? '父子关系已设置' : '已取消父子关系')
    emit('refresh')
  } catch {
    ElMessage.error('操作失败')
  }
}
const candidateParents = computed(() => {
  if (!pendingChildTodo.value) return []
  return visibleTodos.value.filter(t => canBeParent(pendingChildTodo.value, t))
})
const handleBatchParentSuccess = () => {
  todoTable.value?.clearSelection()
  selectedTodos.value = []
  emit('refresh')
}
const openParentDialog = (row) => {
  pendingChildTodo.value = row
  parentDialogVisible.value = true
}
const confirmParentFromDialog = ({ todo, parentId }) => {
  if (todo) doUpdateParent(todo.id, parentId)
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
  const classes = [`todo-row-${row.id}`]
  if (draggingTodo.value && canBeParent(draggingTodo.value, row)) {
    classes.push('droppable-parent')
  }
  if (sortDropTarget.value && sortDropTarget.value.todoId === row.id) {
    classes.push(sortDropTarget.value.position === 'before' ? 'drop-before' : 'drop-after')
  }
  return classes.join(' ')
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
  // 排序拖动进行中时让事件冒泡给容器统一处理
  if (!draggingTodo.value) return
  event.preventDefault()
  event.dataTransfer.dropEffect = canBeParent(draggingTodo.value, row) ? 'move' : 'none'
}
const handleDrop = (event, row) => {
  if (!draggingTodo.value || !canBeParent(draggingTodo.value, row)) return
  doUpdateParent(draggingTodo.value.id, row.id)
  draggingTodo.value = null
}
</script>
<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filter-tabs {
  display: flex;
  gap: 8px;
}
.todo-search {
  width: 240px;
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
.handle-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sort-handle {
  cursor: grab;
  color: var(--text-light);
  user-select: none;
  font-size: 12px;
}
.sort-handle:active {
  cursor: grabbing;
}
.sort-handle-disabled { cursor: not-allowed; opacity: 0.4; }
.todo-title-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.todo-title-text.completed {
  text-decoration: line-through;
  color: var(--text-light);
}
.todo-parent-title {
  font-weight: 700;
}
.todo-child-title {
  color: var(--primary, #409eff);
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
.todo-description-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.todo-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.todo-attach-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  vertical-align: middle;
  font-size: 13px;
}
.todo-attach-link:hover {
  color: var(--primary-dark, #0d8a9c);
}
.todo-attach-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.droppable-parent) {
  background-color: rgba(64, 158, 255, 0.08) !important;
}
:deep(tr.drop-before > td.el-table__cell) {
  box-shadow: inset 0 2px 0 0 var(--primary, #409eff);
}
:deep(tr.drop-after > td.el-table__cell) {
  box-shadow: inset 0 -2px 0 0 var(--primary, #409eff);
}
</style>
