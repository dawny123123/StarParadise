<template>
  <el-dialog
    :model-value="visible"
    title="设置父任务"
    width="480px"
    @update:model-value="emit('update:visible', $event)"
  >
    <el-form label-width="90px">
      <el-form-item label="当前任务">
        <el-tag type="info">{{ todo?.title }}</el-tag>
      </el-form-item>
      <el-form-item label="父任务">
        <el-select v-model="selectedParentId" placeholder="选择父任务" clearable style="width: 100%">
          <el-option
            v-for="t in candidates"
            :key="t.id"
            :label="t.title"
            :value="t.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确认</el-button>
    </template>
  </el-dialog>
</template>
<script setup>
import { ref, watch } from 'vue'
const props = defineProps({
  visible: { type: Boolean, default: false },
  todo: { type: Object, default: null },
  candidates: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:visible', 'confirm'])
const selectedParentId = ref(null)
watch(() => props.visible, (val) => {
  if (val) selectedParentId.value = props.todo?.parentId || null
})
const handleConfirm = () => {
  emit('confirm', { todo: props.todo, parentId: selectedParentId.value })
  emit('update:visible', false)
}
</script>
