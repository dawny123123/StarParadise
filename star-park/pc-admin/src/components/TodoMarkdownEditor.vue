<template>
  <MdEditor
    :model-value="modelValue"
    :toolbars="toolbars"
    :footers="[]"
    :preview="false"
    placeholder="请输入任务描述，支持 markdown：1. 序号列表、![截图]、**加粗** 等"
    style="height: 260px"
    @update:model-value="emit('update:modelValue', $event)"
    @on-upload-img="handleUploadImg"
  />
</template>
<script setup>
import { MdEditor } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ElMessage } from 'element-plus'
import { uploadTodoFiles } from '../api'

defineProps({
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

// 工具栏聚焦待办描述三类结构化能力：字体 / 序号 / 截图（PONR-35）
const toolbars = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'orderedList', 'unorderedList', '-',
  'image', 'table', '-',
  'revoke', 'next', '=', 'preview'
]

// 截图上传复用待办附件接口（POST /api/todos/upload），插入 markdown 图片语法
const handleUploadImg = async (files, callback) => {
  try {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    const res = await uploadTodoFiles(formData)
    if (res && res.files && res.files.length > 0) {
      callback(res.files.map(f => ({
        url: f.file_url,
        alt: f.file_name || f.file_url.split('/').pop(),
        title: f.file_name || ''
      })))
    } else {
      ElMessage.error('截图上传失败')
    }
  } catch (err) {
    ElMessage.error('截图上传失败')
    console.error(err)
  }
}
</script>
