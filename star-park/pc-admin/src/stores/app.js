import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getChildren, createChild } from '../api'

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

  // 孩子颜色映射（预设）
  const childColorMap = {
    '甜甜': '#FF6B6B',
    '甄甄': '#4ECDC4',
    '欣甜': '#FFD93D'
  }

  // 颜色池：用于动态分配给新成员
  const colorPool = [
    '#FF6B6B', '#4ECDC4', '#FFD93D', '#A78BFA',
    '#F97316', '#06B6D4', '#EC4899', '#84CC16'
  ]

  // 获取孩子颜色：优先匹配预设映射，否则按索引轮换分配
  const getChildColor = (childName) => {
    if (childColorMap[childName]) return childColorMap[childName]
    const idx = children.value.findIndex(c => c.name === childName)
    if (idx >= 0) return colorPool[idx % colorPool.length]
    return '#19C8B9'
  }

  // 添加新成员
  const addChild = async (data) => {
    await createChild(data)
    await fetchChildren()
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
    colorPool,
    getChildColor,
    fetchChildren,
    setCurrentChild,
    addChild
  }
})
