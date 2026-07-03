// H5 模式使用相对路径（通过 vite proxy 转发），小程序模式使用完整 URL
const BASE_URL = typeof window !== 'undefined' ? '/api' : 'http://localhost:3001/api'

/**
 * 通用请求封装
 */
export const request = (options) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(res)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

/**
 * API 接口定义
 */
export const api = {
  // 仪表盘数据
  getDashboard: () => request({ url: '/dashboard' }),

  // 获取孩子列表
  getChildren: () => request({ url: '/children' }),

  // 获取打卡记录
  getCheckins: (params) => request({ url: '/checkins', data: params }),

  // 创建打卡记录
  createCheckin: (data) => request({ url: '/checkins', method: 'POST', data }),

  // 一键自动打卡
  autoCheckinAll: (data = {}) => request({ url: '/checkins/auto-checkin-all', method: 'POST', data }),

  // 获取孩子统计
  getStats: (childId) => request({ url: `/stats/${childId}` }),

  // 获取奖励记录
  getRewards: (params) => request({ url: '/rewards', data: params }),

  // 创建奖励目标
  createReward: (data) => request({ url: '/rewards', method: 'POST', data }),

  // 删除奖励目标
  deleteReward: (id) => request({ url: `/rewards/${id}`, method: 'DELETE' }),

  // 获取孩子任务列表
  getTasks: (childId) => request({ url: `/children/${childId}/tasks` }),

  // 获取孩子余额
  getBalance: (childId) => request({ url: `/children/${childId}/balance` }),

  // 获取积分记录和余额
  getPoints: (childId) => request({ url: '/points', data: { child_id: childId } }),

  // 获取金钱交易记录
  getTransactions: (childId) => request({ url: `/children/${childId}/transactions`, data: { type: 'money' } }),

  // 添加积分奖励
  addPoints: (data) => request({ url: '/points', method: 'POST', data })
}
