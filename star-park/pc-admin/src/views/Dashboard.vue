<template>
  <div class="page-container fade-in-up">
    <div class="welcome-section">
      <div>
        <h1 class="welcome-title">⭐ 目标</h1>
        <p class="welcome-date">{{ todayStr }}</p>
      </div>
      <el-button type="danger" round class="grant-flowers-btn" @click="openFlowersModal">
        🌸 发放红花
      </el-button>
    </div>

    <!-- 孩子卡片区域 -->
    <div v-loading="loading" class="cards-row">
      <ChildCard
        v-for="child in children"
        :key="child.id"
        :child="child"
        :color="getChildColor(child.name)"
      />
      <!-- 添加成员卡片 -->
      <div class="child-card card add-card" @click="showAddDialog = true">
        <div class="add-card-content">
          <el-icon :size="36" color="#C0C4CC"><Plus /></el-icon>
          <span class="add-card-text">添加成员</span>
        </div>
      </div>
      <el-empty v-if="!loading && children.length === 0" description="暂无孩子数据" />
    </div>

    <!-- 添加新成员对话框 -->
    <el-dialog v-model="showAddDialog" title="添加新成员" width="420px" destroy-on-close>
      <el-form :model="addForm" :rules="formRules" ref="formRef" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="addForm.name" placeholder="请输入孩子姓名" />
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="addForm.age" :min="1" :max="99" />
        </el-form-item>
        <el-form-item label="年级" prop="grade">
          <el-input v-model="addForm.grade" placeholder="例如：三年级" />
        </el-form-item>
        <el-form-item label="关注点" prop="focus">
          <el-input v-model="addForm.focus" placeholder="例如：学习习惯" />
        </el-form-item>
        <el-form-item label="颜色" prop="avatar_color">
          <div class="color-picker-row">
            <span
              v-for="c in store.colorPool"
              :key="c"
              class="color-dot"
              :class="{ selected: addForm.avatar_color === c }"
              :style="{ background: c }"
              @click="addForm.avatar_color = c"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAddChild">确认</el-button>
      </template>
    </el-dialog>

    <!-- 发放红花弹窗 -->
    <el-dialog v-model="showFlowersModal" title="发放红花" width="420px" center>
      <div class="points-modal">
        <div class="points-form">
          <div class="form-item">
            <label>选择孩子</label>
            <el-select v-model="flowersChildId" placeholder="请选择孩子" style="width: 100%">
              <el-option
                v-for="child in children"
                :key="child.id"
                :label="child.name"
                :value="child.id"
              />
            </el-select>
          </div>
          <div class="form-item">
            <label>红花数量</label>
            <el-input-number v-model="flowersAmount" :min="1" :max="9999" style="width: 100%" placeholder="输入红花数量" />
          </div>
          <div class="form-item">
            <label>奖励理由</label>
            <el-input v-model="flowersReason" type="textarea" :rows="2" placeholder="输入奖励原因" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showFlowersModal = false">取消</el-button>
        <el-button type="primary" @click="submitFlowers">确认发放</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAppStore } from '../stores/app'
import { getDashboard, addFlowers } from '../api'
import ChildCard from '../components/ChildCard.vue'

const store = useAppStore()
const loading = ref(false)
const dashboardData = ref(null)

// 添加成员相关
const showAddDialog = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const addForm = ref({
  name: '',
  age: null,
  grade: '',
  focus: '',
  avatar_color: '#FF6B6B'
})

// 红花发放相关
const showFlowersModal = ref(false)
const flowersChildId = ref(null)
const flowersAmount = ref(1)
const flowersReason = ref('')

const formRules = {
  name: [{ required: true, message: '请输入孩子姓名', trigger: 'blur' }]
}

const handleAddChild = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    await store.addChild({ ...addForm.value })
    ElMessage.success('添加成员成功')
    showAddDialog.value = false
    addForm.value = { name: '', age: null, grade: '', focus: '', avatar_color: '#FF6B6B' }
    await fetchDashboard()
  } catch (err) {
    const msg = err?.response?.data?.error || '添加失败，请重试'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}

const children = computed(() => {
  if (dashboardData.value) {
    const data = dashboardData.value
    return Array.isArray(data) ? data : (data.children || [])
  }
  return store.children
})

const todayStr = computed(() => {
  return dayjs().format('YYYY年MM月DD日 dddd')
})

const getChildColor = (name) => {
  return store.getChildColor(name)
}

const fetchDashboard = async () => {
  loading.value = true
  try {
    const data = await getDashboard()
    dashboardData.value = data
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    await store.fetchChildren()
  } finally {
    loading.value = false
  }
}

// 打开红花发放弹窗
const openFlowersModal = (childId) => {
  flowersChildId.value = childId || (children.value.length > 0 ? children.value[0].id : null)
  flowersAmount.value = 1
  flowersReason.value = ''
  showFlowersModal.value = true
}

// 提交红花奖励
const submitFlowers = async () => {
  if (!flowersChildId.value || !flowersAmount.value) {
    ElMessage.warning('请填写完整信息')
    return
  }
  try {
    await addFlowers({
      child_id: flowersChildId.value,
      amount: flowersAmount.value,
      reason: flowersReason.value || '特殊红花奖励'
    })
    ElMessage.success(`发放成功！+${flowersAmount.value}红花`)
    showFlowersModal.value = false
    await fetchDashboard()
  } catch (err) {
    ElMessage.error('红花发放失败')
    console.error('红花发放失败:', err)
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.welcome-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.grant-flowers-btn {
  font-weight: 600;
}

/* 孩子卡片区域 */
.cards-row {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

/* 添加成员卡片 */
.add-card {
  min-width: 240px;
  flex: 1;
  border: 2px dashed #DCDFE6;
  border-top: 3px dashed #DCDFE6;
  cursor: pointer;
  transition: all 0.25s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-card:hover {
  border-color: var(--primary);
  background: rgba(25, 200, 185, 0.04);
}

.add-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.add-card-text {
  font-size: 14px;
  color: #C0C4CC;
  font-weight: 500;
}

.add-card:hover .add-card-text {
  color: var(--primary);
}

/* 颜色选择器 */
.color-picker-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid transparent;
  transition: all 0.2s ease;
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-dot.selected {
  border-color: var(--text);
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--text);
}

/* 红花发放弹窗样式（复用 Checkin.vue 积分弹窗结构） */
.points-modal {
  padding: 8px 0;
}

.points-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
</style>
