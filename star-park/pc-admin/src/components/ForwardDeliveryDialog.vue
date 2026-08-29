<template>
  <el-button
    type="success"
    :disabled="!configured"
    :title="configured ? '' : '后端未配置 QODER_FORWARD_TOKEN'"
    @click="openDialog"
  >
    <el-icon><Promotion /></el-icon>
    需求自主交付
  </el-button>

  <el-dialog
    v-model="visible"
    title="🚀 需求自主交付"
    width="720px"
    :close-on-click-modal="false"
    top="5vh"
    @closed="stopPolling"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="需求描述将提交给 Qoder「需求自主交付」模版，由云端 Agent 自动完成需求创建、编码、推送与流水线触发。"
      style="margin-bottom: 16px;"
    />

    <el-form v-if="!delivery" :model="form" label-width="100px" label-position="right">
      <el-form-item label="需求描述" required>
        <el-input
          v-model="form.requirement"
          type="textarea"
          :rows="8"
          placeholder="描述要自主交付的需求，越具体越好"
        />
      </el-form-item>
      <el-form-item label="关联实践">
        <el-select
          v-model="form.practiceId"
          clearable
          placeholder="可选：关联一条已沉淀的实践"
          style="width: 100%;"
        >
          <el-option
            v-for="item in practices"
            :key="item.id"
            :label="item.title"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <div v-else class="delivery-run">
      <div class="delivery-row">
        <span class="delivery-label">状态</span>
        <el-tag :type="statusType" size="small">{{ statusText }}</el-tag>
        <span v-if="delivery.stop_reason" class="delivery-hint">
          结束原因：{{ delivery.stop_reason }}
        </span>
      </div>
      <div class="delivery-row">
        <span class="delivery-label">会话</span>
        <code class="delivery-code">{{ delivery.session_id || '—' }}</code>
      </div>
      <div class="delivery-row">
        <span class="delivery-label">需求</span>
        <span class="delivery-text">{{ delivery.requirement }}</span>
      </div>
      <div v-if="delivery.error" class="delivery-section">
        <span class="delivery-label">错误</span>
        <el-alert type="error" :closable="false" :title="delivery.error" />
      </div>
      <div class="delivery-section">
        <span class="delivery-label">Agent 产出</span>
        <MdPreview v-if="delivery.result" :modelValue="delivery.result" />
        <el-empty v-else :image-size="60" description="尚无产出，Agent 仍在运行" />
      </div>
    </div>

    <template #footer>
      <template v-if="!delivery">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="success" :loading="submitting" @click="handleTrigger">
          提交交付
        </el-button>
      </template>
      <template v-else>
        <el-button @click="resetDelivery">再发起一次</el-button>
        <el-button :loading="refreshing" @click="refreshDelivery">刷新状态</el-button>
        <el-button type="primary" :disabled="!delivery.result" @click="saveAsPractice">
          沉淀为实践
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Promotion } from '@element-plus/icons-vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import {
  getForwardDeliveryConfig,
  createForwardDelivery,
  getForwardDelivery,
  createBestPractice
} from '../api'

const props = defineProps({
  practices: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['saved'])

// Forward 会话已结束、无需继续轮询的状态
const TERMINAL_STATUSES = ['completed', 'terminated', 'failed']
const POLL_INTERVAL = 5000

const STATUS_TEXT = {
  pending: '待触发',
  running: '运行中',
  rescheduling: '重新调度',
  canceling: '取消中',
  idle: '空闲',
  completed: '已完成',
  terminated: '已终止',
  failed: '触发失败'
}

const configured = ref(false)
const visible = ref(false)
const submitting = ref(false)
const refreshing = ref(false)
const delivery = ref(null)
const form = ref({ requirement: '', practiceId: null })
let pollTimer = null

const statusText = computed(() => STATUS_TEXT[delivery.value?.status] || delivery.value?.status || '未知')

const statusType = computed(() => {
  const status = delivery.value?.status
  if (status === 'completed') return 'success'
  if (status === 'failed' || status === 'terminated') return 'danger'
  return 'warning'
})

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const resetDelivery = () => {
  stopPolling()
  delivery.value = null
  form.value = { requirement: '', practiceId: null }
}

const openDialog = () => {
  resetDelivery()
  visible.value = true
}

const refreshDelivery = async () => {
  if (!delivery.value?.id) return
  refreshing.value = true
  try {
    delivery.value = await getForwardDelivery(delivery.value.id)
    if (TERMINAL_STATUSES.includes(delivery.value.status)) {
      stopPolling()
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.error || '刷新状态失败')
    stopPolling()
  } finally {
    refreshing.value = false
  }
}

const handleTrigger = async () => {
  const requirement = form.value.requirement.trim()
  if (!requirement) {
    ElMessage.warning('请填写需求描述')
    return
  }
  submitting.value = true
  try {
    delivery.value = await createForwardDelivery({
      requirement,
      practice_id: form.value.practiceId || null
    })
    ElMessage.success('已提交，云端 Agent 开始自主交付')
    stopPolling()
    pollTimer = setInterval(refreshDelivery, POLL_INTERVAL)
  } catch (err) {
    const detail = err.response?.data
    if (detail?.delivery) delivery.value = detail.delivery
    ElMessage.error(detail?.error || '触发失败，请重试')
  } finally {
    submitting.value = false
  }
}

const saveAsPractice = async () => {
  try {
    await createBestPractice({
      title: `自主交付：${delivery.value.requirement.slice(0, 30)}`,
      problem_description: delivery.value.result,
      key_points: delivery.value.requirement,
      notes: `Forward 会话 ${delivery.value.session_id}`
    })
    ElMessage.success('已沉淀为实践')
    visible.value = false
    emit('saved')
  } catch (err) {
    ElMessage.error('沉淀失败，请重试')
  }
}

onMounted(async () => {
  try {
    const config = await getForwardDeliveryConfig()
    configured.value = Boolean(config?.configured)
  } catch (err) {
    configured.value = false
  }
})

onUnmounted(stopPolling)
</script>

<style scoped>
.delivery-run {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.delivery-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.delivery-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delivery-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  flex-shrink: 0;
  min-width: 64px;
}

.delivery-text {
  font-size: 13px;
  color: var(--text-light);
  line-height: 1.6;
  white-space: pre-wrap;
}

.delivery-code {
  font-size: 12px;
  color: var(--text-light);
  background: #F7F5F0;
  padding: 2px 6px;
  border-radius: 4px;
}

.delivery-hint {
  font-size: 12px;
  color: var(--text-light);
}
</style>
