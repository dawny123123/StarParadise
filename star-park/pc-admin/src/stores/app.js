import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getChildren } from '../api'

export const useAppStore = defineStore('app', () => {
  // 孩子列表
  const children = ref([])
  // 当前选中的孩子ID
  const currentChildId = ref(null)
  // 加载状态
  const loading = ref(false)

  // 当前选中的孩子信息
  const currentChild = computed(() => {
    return children.value.find(c => c.id === currentChildId.value) || null
  })

  // 孩子颜色映射
  const childColors = {
    '老二': '#FF6B6B',
    '老三': '#4ECDC4',
    '老四': '#FFD93D'
  }

  // 获取孩子颜色
  const getChildColor = (childName) => {
    return childColors[childName] || '#19C8B9'
  }

  // 获取孩子列表
  const fetchChildren = async () => {
    loading.value = true
    try {
      const data = await getChildren()
      children.value = Array.isArray(data) ? data : (data.data || [])
      if (children.value.length > 0 && !currentChildId.value) {
        currentChildId.value = children.value[0].id
      }
    } catch (err) {
      console.error('获取孩子列表失败:', err)
    } finally {
      loading.value = false
    }
  }

  // 设置当前孩子
  const setCurrentChild = (id) => {
    currentChildId.value = id
  }

  return {
    children,
    currentChildId,
    currentChild,
    loading,
    childColors,
    getChildColor,
    fetchChildren,
    setCurrentChild
  }
})
