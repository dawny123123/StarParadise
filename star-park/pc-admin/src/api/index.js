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

// ========== 任务相关 ==========
export const getTasks = (params) => api.get('/tasks', { params })
export const createTask = (data) => api.post('/tasks', data)
export const updateTask = (id, data) => api.put(`/tasks/${id}`, data)
export const deleteTask = (id) => api.delete(`/tasks/${id}`)

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

export default api
