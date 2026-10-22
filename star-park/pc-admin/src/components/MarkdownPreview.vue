<template>
  <div class="md-preview-compact">
    <MdPreview :model-value="content" preview-theme="github" />
  </div>
</template>
<script setup>
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

defineProps({
  content: { type: String, default: '' }
})
</script>
<style scoped>
/* 表格单元格内紧凑渲染：限高滚动，不破坏行布局（PONR-35） */
.md-preview-compact {
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.4;
}
.md-preview-compact :deep(.md-editor-preview-wrapper) {
  padding: 0;
}
.md-preview-compact :deep(.md-editor-preview) {
  font-size: 13px;
  word-break: break-word;
}
.md-preview-compact :deep(.md-editor-preview p) {
  margin: 0 0 4px;
}
.md-preview-compact :deep(.md-editor-preview ul),
.md-preview-compact :deep(.md-editor-preview ol) {
  margin: 0 0 4px;
  padding-left: 20px;
}
.md-preview-compact :deep(.md-editor-preview img) {
  max-width: 100%;
  max-height: 180px;
}
</style>
