<template>
  <div class="page-container fade-in-up">
    <div class="page-header">
      <h1 class="page-title">📝 轻眉沉淀 / 最佳实践</h1>
      <div class="header-buttons">
        <ForwardDeliveryDialog :practices="list" @saved="fetchList" />
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon>
          新建实践
        </el-button>
      </div>
    </div>

    <!-- 搜索过滤 -->
    <div class="search-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索实践名称、关键点..."
        clearable
        :prefix-icon="Search"
        style="width: 360px;"
      />
    </div>

    <!-- 卡片网格 -->
    <div v-loading="loading" class="practices-grid">
      <div
        v-for="item in filteredList"
        :key="item.id"
        class="practice-card card"
        @click="openDetail(item)"
      >
        <div class="practice-header">
          <span class="practice-title">{{ item.title }}</span>
          <div class="header-actions">
            <el-button type="primary" size="small" text @click.stop="openDialog(item)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button type="danger" size="small" text @click.stop="handleDelete(item)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <div class="practice-summary" v-if="item.keyPoints">
          {{ item.keyPoints }}
        </div>
        <div class="practice-meta">
          <span class="meta-date">{{ formatDate(item.createdAt) }}</span>
          <el-tag v-if="item.fileName" size="small" type="info">
            <el-icon><Document /></el-icon>
            {{ item.fileName }}
          </el-tag>
        </div>
      </div>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无实践记录" />
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editing ? '编辑实践' : '新建实践'"
      width="720px"
      :close-on-click-modal="false"
      top="3vh"
    >
      <el-form :model="form" label-width="100px" label-position="right">
        <el-form-item label="实践名称" required>
          <el-input v-model="form.title" placeholder="输入实践名称" />
        </el-form-item>
        <el-form-item label="解决问题">
          <MdEditor
            v-model="form.problemDescription"
            style="height: 300px"
            :toolbars-exclude="['github']"
          />
        </el-form-item>
        <el-form-item label="实践关键点">
          <el-input
            v-model="form.keyPoints"
            type="textarea"
            :rows="3"
            placeholder="核心要点总结"
          />
        </el-form-item>
        <el-form-item label="文档上传">
          <el-upload
            :action="uploadUrl"
            :show-file-list="false"
            :on-success="onUploadSuccess"
            :on-error="onUploadError"
            :before-upload="beforeUpload"
          >
            <el-button type="info" plain>
              <el-icon><Upload /></el-icon>
              {{ form.fileName || '选择文件' }}
            </el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="form.notes"
            type="textarea"
            :rows="2"
            placeholder="补充说明（可选）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailItem?.title || ''"
      width="720px"
      top="3vh"
    >
      <div v-if="detailItem" class="detail-content">
        <div class="detail-section" v-if="detailItem.problemDescription">
          <h3 class="detail-label">解决问题</h3>
          <MdPreview :modelValue="detailItem.problemDescription" />
        </div>
        <div class="detail-section" v-if="detailItem.keyPoints">
          <h3 class="detail-label">实践关键点</h3>
          <p class="detail-text">{{ detailItem.keyPoints }}</p>
        </div>
        <div class="detail-section" v-if="detailItem.notes">
          <h3 class="detail-label">备注</h3>
          <p class="detail-text">{{ detailItem.notes }}</p>
        </div>
        <div class="detail-section" v-if="detailItem.fileUrl">
          <h3 class="detail-label">附件</h3>
          <a :href="detailItem.fileUrl" target="_blank" class="file-link">
            <el-icon><Document /></el-icon>
            {{ detailItem.fileName || '下载附件' }}
          </a>
        </div>
        <div class="detail-meta">
          创建于 {{ formatDate(detailItem.createdAt) }}
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete, Search, Upload, Document } from '@element-plus/icons-vue'
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import ForwardDeliveryDialog from '../components/ForwardDeliveryDialog.vue'
import {
  getBestPractices,
  createBestPractice,
  updateBestPractice,
  deleteBestPractice
} from '../api'

const loading = ref(false)
const submitting = ref(false)
const list = ref([])
const dialogVisible = ref(false)
const detailVisible = ref(false)
const editing = ref(null)
const detailItem = ref(null)
const searchKeyword = ref('')

const uploadUrl = '/api/best-practices/upload'

const emptyForm = () => ({
  title: '',
  problemDescription: '',
  keyPoints: '',
  fileUrl: '',
  fileName: '',
  notes: ''
})

const form = ref(emptyForm())

const filteredList = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return list.value
  return list.value.filter(item =>
    item.title.toLowerCase().includes(kw) ||
    (item.keyPoints || '').toLowerCase().includes(kw)
  )
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return dateStr.substring(0, 10)
}

const openDialog = (item = null) => {
  editing.value = item
  if (item) {
    form.value = {
      title: item.title,
      problemDescription: item.problemDescription || '',
      keyPoints: item.keyPoints || '',
      fileUrl: item.fileUrl || '',
      fileName: item.fileName || '',
      notes: item.notes || ''
    }
  } else {
    form.value = emptyForm()
  }
  dialogVisible.value = true
}

const openDetail = (item) => {
  detailItem.value = item
  detailVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.title) {
    ElMessage.warning('请填写实践名称')
    return
  }
  submitting.value = true
  try {
    const payload = {
      title: form.value.title,
      problem_description: form.value.problemDescription,
      key_points: form.value.keyPoints,
      file_url: form.value.fileUrl,
      file_name: form.value.fileName,
      notes: form.value.notes
    }
    if (editing.value) {
      await updateBestPractice(editing.value.id, payload)
      ElMessage.success('实践更新成功')
    } else {
      await createBestPractice(payload)
      ElMessage.success('实践创建成功')
    }
    dialogVisible.value = false
    await fetchList()
  } catch (err) {
    ElMessage.error(editing.value ? '更新失败，请重试' : '创建失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (item) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除实践"${item.title}"吗？`,
      '删除确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteBestPractice(item.id)
    ElMessage.success('删除成功')
    await fetchList()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败，请重试')
    }
  }
}

const beforeUpload = (file) => {
  const maxSize = 10 * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error('文件大小不能超过 10MB')
    return false
  }
  return true
}

const onUploadSuccess = (response) => {
  if (response && response.url) {
    form.value.fileUrl = response.url
    form.value.fileName = response.fileName || response.url.split('/').pop()
    ElMessage.success('文件上传成功')
  }
}

const onUploadError = () => {
  ElMessage.error('文件上传失败')
}

const fetchList = async () => {
  loading.value = true
  try {
    const data = await getBestPractices()
    const raw = Array.isArray(data) ? data : (data.data || [])
    list.value = raw.map(item => ({
      id: item.id,
      title: item.title,
      problemDescription: item.problem_description || '',
      keyPoints: item.key_points || '',
      fileUrl: item.file_url || '',
      fileName: item.file_name || '',
      notes: item.notes || '',
      createdAt: item.created_at || ''
    }))
  } catch (err) {
    console.error('获取最佳实践失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header .page-title {
  margin-bottom: 0;
}

.search-bar {
  margin-bottom: 16px;
}

.practices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.practice-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  border-top: 3px solid var(--primary);
}

.practice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.practice-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.practice-summary {
  font-size: 13px;
  color: var(--text-light);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.practice-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.meta-date {
  font-size: 12px;
  color: var(--text-light);
}

/* 详情对话框 */
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  padding-bottom: 4px;
  border-bottom: 1px solid #F0EDE6;
}

.detail-text {
  font-size: 14px;
  color: var(--text);
  line-height: 1.7;
  white-space: pre-wrap;
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--primary);
  font-size: 14px;
}

.file-link:hover {
  text-decoration: underline;
}

.detail-meta {
  font-size: 12px;
  color: var(--text-light);
  text-align: right;
  padding-top: 8px;
  border-top: 1px solid #F0EDE6;
}

/* 需求自主交付 */
.header-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
