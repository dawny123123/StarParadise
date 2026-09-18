<template>
  <el-form-item v-if="editable" label="附件">
    <div class="attachment-row">
      <el-upload :http-request="handleUpload" :show-file-list="false" multiple>
        <el-button type="info" plain>
          <el-icon><Upload /></el-icon>
          上传附件
        </el-button>
      </el-upload>
    </div>
    <div v-if="attachments.length > 0" class="file-list">
      <div v-for="(attachment, index) in attachments" :key="index" class="file-item">
        <a :href="fileUrl(attachment)" target="_blank" class="file-link">
          <el-icon><Document /></el-icon>
          {{ fileName(attachment, index) }}
        </a>
        <el-button text size="small" type="danger" @click="removeAttachment(index)">
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>
  </el-form-item>
  <div v-else-if="attachments.length > 0" class="card-attachments">
    <a
      v-for="(attachment, index) in attachments"
      :key="index"
      :href="fileUrl(attachment)"
      target="_blank"
      class="card-attachment-link"
      @click.stop
    >
      <el-icon><Document /></el-icon>
      {{ fileName(attachment, index) }}
    </a>
  </div>
</template>

<script setup>
import { Close, Document, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { uploadGoalFiles } from '../api'

const props = defineProps({
  attachments: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false }
})

const emit = defineEmits(['update:attachments'])

const fileUrl = attachment => attachment.file_url || attachment.fileUrl || ''
const fileName = (attachment, index) => attachment.file_name || attachment.fileName || `附件${index + 1}`

const handleUpload = async ({ file }) => {
  try {
    const formData = new FormData()
    formData.append('files', file)
    const res = await uploadGoalFiles(formData)
    if (!res?.files?.length) {
      ElMessage.error('附件上传失败')
      return
    }
    emit('update:attachments', [...props.attachments, ...res.files])
    ElMessage.success('附件上传成功')
  } catch (err) {
    ElMessage.error('附件上传失败')
    console.error(err)
  }
}

const removeAttachment = index => {
  emit('update:attachments', props.attachments.filter((_attachment, itemIndex) => itemIndex !== index))
}
</script>

<style scoped>
.attachment-row {
  display: flex;
  align-items: center;
}

.file-list {
  margin-top: 8px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
}

.file-link,
.card-attachment-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  overflow-wrap: anywhere;
}

.file-link {
  font-size: 13px;
}

.card-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.card-attachment-link {
  max-width: 100%;
  font-size: 12px;
}

.file-link:hover,
.card-attachment-link:hover {
  text-decoration: underline;
}
</style>
