import axios from 'axios'
import dayjs from 'dayjs'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// ========== 孩子相关 ==========
export const getChildren = () => api.get('/children')
export const createChild = (data) => api.post('/children', data)

// ========== 任务相关 ==========
export const getTasks = (params) => api.get('/tasks', { params })
export const createTask = (data) => api.post('/tasks', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

// ========== 目标相关 ==========
export const getGoals = (params) => api.get('/goals', { params })
export const createGoal = (data) => api.post('/goals', data)
export const updateGoal = (id, data) => api.put(`/goals/${id}`, data)
export const deleteGoal = (id) => api.delete(`/goals/${id}`)

// ========== 待办相关 ==========
export const getTodos = (params) => api.get('/todos', { params })
export const createTodo = (data) => api.post('/todos', data)
export const updateTodo = (id, data) => api.put(`/todos/${id}`, data)
export const deleteTodo = (id) => api.delete(`/todos/${id}`)
export const uploadTodoFile = (formData) => api.post('/todos/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const uploadTodoFiles = (formData) => api.post('/todos/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// ========== 打卡相关 ==========
export const getCheckins = (params) => api.get('/checkins', { params })
export const createCheckin = (data) => api.post('/checkins', data)
export const autoCheckinAll = (data = {}) => api.post('/checkins/auto-checkin-all', data)

// ========== 奖励相关 ==========
export const getRewards = (params) => api.get('/rewards', { params })
export const createReward = (data) => api.post('/rewards', data)
export const updateReward = (id, data) => api.put(`/rewards/${id}`, data)
export const deleteReward = (id) => api.delete(`/rewards/${id}`)
export const redeemReward = (id) => api.post(`/rewards/${id}/redeem`)

// ========== 统计相关 ==========
export const getStats = (childId) => api.get(`/stats/${childId}`)

// ========== 仪表盘 ==========
export const getDashboard = () => api.get('/dashboard')

// ========== 积分/余额相关 ==========
export const getBalance = (childId) => api.get(`/children/${childId}/balance`)
export const getTransactions = (childId, params) => api.get(`/children/${childId}/transactions`, { params })

// ========== 特殊积分相关 ==========
export const getPoints = (params) => api.get('/points', { params })
export const addPoints = (data) => api.post('/points', data)

// ========== 红花相关 ==========
export const getFlowers = (params) => api.get('/flowers', { params })
export const addFlowers = (data) => api.post('/flowers', data)

// ========== QoderWake 自动化触发 ==========
export const triggerQoderWake = async (prompt = '') => {
  const url = import.meta.env.VITE_QODERWAKE_INVOKE_URL
  const pat = import.meta.env.VITE_QODERWAKE_PAT
  if (!url || !pat) {
    throw new Error('QoderWake 配置缺失，请检查 .env 文件')
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QoderWake 调用失败 (${res.status}): ${text}`)
  }
  return res.json()
}

// ========== QoderWake 目标自动关联触发 ==========
// 任务（待办）未关联目标时触发自动化任务，为其匹配最合适的目标
export const triggerGoalAutoAssociation = async (todo, goals = []) => {
  const url = import.meta.env.VITE_QODERWAKE_GOAL_ASSOC_URL
  const pat = import.meta.env.VITE_QODERWAKE_PAT
  if (!url || !pat) {
    throw new Error('QoderWake 目标关联配置缺失，请检查 .env 文件')
  }
  const goalList = goals.map(g => `- id: ${g.id}, 名称: ${g.title}`).join('\n')
  const prompt = [
    '目标管理：以下任务录入时未关联任何目标，请为该任务自动匹配并关联最合适的目标。',
    `任务标题: ${todo.title}`,
    `任务 id: ${todo.id}`,
    '当前已存在的目标列表:',
    goalList || '（暂无目标）'
  ].join('\n')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      wakeSessionUniqueId: `star-park-goal-assoc-${todo.id}`
    })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QoderWake 目标关联触发失败 (${res.status}): ${text}`)
  }
  return res.json()
}

// ========== 最佳实践 ==========
export const getBestPractices = (params) => api.get('/best-practices', { params })
export const createBestPractice = (data) => api.post('/best-practices', data)
export const updateBestPractice = (id, data) => api.put(`/best-practices/${id}`, data)
export const deleteBestPractice = (id) => api.delete(`/best-practices/${id}`)
export const uploadBestPracticeFile = (formData) => api.post('/best-practices/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

// ========== 需求自主交付（Qoder Forward 模版，经后端代理）==========
export const getForwardDeliveryConfig = () => api.get('/forward-delivery/config')
export const getForwardDeliveries = () => api.get('/forward-delivery')
export const createForwardDelivery = (data) => api.post('/forward-delivery', data, { timeout: 60000 })
export const getForwardDelivery = (id) => api.get(`/forward-delivery/${id}`, { timeout: 30000 })

export default api
