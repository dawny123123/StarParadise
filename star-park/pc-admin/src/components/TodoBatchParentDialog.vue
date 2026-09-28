<template>
  <div v-if="props.selectedTodos.length > 0" class="batch-toolbar">
    <span>已选择 {{ props.selectedTodos.length }} 项</span>
    <el-button type="primary" size="small" @click="openDialog">批量修改父任务</el-button>
  </div>

  <el-dialog v-model="batchParentDialogVisible" title="批量修改父任务" width="480px">
    <el-form label-width="90px">
      <el-form-item label="已选任务">
        <el-tag type="info">{{ props.selectedTodos.length }} 个任务</el-tag>
      </el-form-item>
      <el-form-item label="父任务">
        <el-select v-model="batchSelectedParentId" placeholder="选择父任务" style="width: 100%">
          <el-option label="无父任务" :value="null" />
          <el-option
            v-for="todo in batchCandidateParents"
            :key="todo.id"
            :label="todo.title"
            :value="todo.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="batchParentDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="confirmBatchParent">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { batchUpdateTodoParent } from '../api'

const props = defineProps({
  todos: { type: Array, default: () => [] },
  selectedTodos: { type: Array, default: () => [] }
})

const emit = defineEmits(['success'])

const batchParentDialogVisible = ref(false)
const batchSelectedParentId = ref(null)

const batchCandidateParents = computed(() => {
  if (props.selectedTodos.length === 0) return []
  const selectedIds = new Set(props.selectedTodos.map(todo => todo.id))
  const childId = props.selectedTodos[0].childId
  return props.todos.filter(todo => {
    return todo.childId === childId
      && todo.parentId == null
      && !selectedIds.has(todo.id)
  })
})

const openDialog = () => {
  if (new Set(props.selectedTodos.map(todo => todo.childId)).size > 1) {
    ElMessage.warning('请选择同一孩子的任务进行批量修改')
    return
  }
  batchSelectedParentId.value = null
  batchParentDialogVisible.value = true
}

const confirmBatchParent = async () => {
  if (props.selectedTodos.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确认批量修改 ${props.selectedTodos.length} 个任务的父任务吗？`,
      '确认批量修改',
      { type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await batchUpdateTodoParent(
      props.selectedTodos.map(todo => todo.id),
      batchSelectedParentId.value
    )
    ElMessage.success('父任务已批量修改')
    batchParentDialogVisible.value = false
    emit('success')
  } catch (err) {
    ElMessage.error(err?.response?.data?.error || err?.response?.data?.message || '批量修改失败')
  }
}
</script>

<style scoped>
.batch-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-light);
}
</style>
