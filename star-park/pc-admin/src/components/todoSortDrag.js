import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { reorderTodos } from '../api'

// 任务列表手动拖动排序逻辑（PONR-32）
// 供 TodoTree.vue 使用：按住排序手柄上下拖动，在同级任务内调整展示顺序
// treeTodos: 展示顺序的任务树（computed）；todos: 当前视图的扁平任务列表（computed）；
// onRefresh: 排序成功后的刷新回调
export function useTodoSortDrag({ treeTodos, todos, onRefresh }) {
  const sortingTodo = ref(null)
  // 插入线位置：{ todoId, position: 'before' | 'after' }
  const sortDropTarget = ref(null)

  const treeNodeMap = computed(() => {
    const map = new Map()
    const walk = (nodes) => {
      nodes.forEach(node => {
        map.set(node.id, node)
        if (node.children?.length) walk(node.children)
      })
    }
    walk(treeTodos.value)
    return map
  })

  // 拖动任务在当前过滤视图下的同级任务列表（按展示顺序）
  const scopeSiblings = (todo) => {
    if (!todo.parentId) return treeTodos.value
    const parentNode = treeNodeMap.value.get(todo.parentId)
    return parentNode ? parentNode.children : []
  }

  const resetSortDragState = () => {
    sortingTodo.value = null
    sortDropTarget.value = null
  }

  const handleSortDragStart = (event, row) => {
    sortingTodo.value = row
    sortDropTarget.value = null
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(row.id))
  }

  const handleSortDragEnd = () => {
    resetSortDragState()
  }

  // 从拖放事件定位目标行：DOM 行 -> 行样式类中的 todo-row-{id} -> 树节点
  const resolveSortRow = (event) => {
    const target = event.target
    if (!target || typeof target.closest !== 'function') return null
    const tr = target.closest('tr.el-table__row')
    if (!tr) return null
    const match = String(tr.className || '').match(/todo-row-(\d+)/)
    if (!match) return null
    const node = treeNodeMap.value.get(Number(match[1]))
    return node ? { node, tr } : null
  }

  // 计算排序落点：返回插入位置（移除拖动任务后的索引）与指示线位置，无效或无变化时返回 null
  const computeSortDrop = (event) => {
    const dragged = sortingTodo.value
    if (!dragged) return null
    const resolved = resolveSortRow(event)
    if (!resolved) return null
    const { node, tr } = resolved
    if (node.id === dragged.id || (node.parentId ?? null) !== (dragged.parentId ?? null)) return null
    const siblings = scopeSiblings(dragged)
    const targetIndex = siblings.findIndex(t => t.id === node.id)
    const currentIndex = siblings.findIndex(t => t.id === dragged.id)
    if (targetIndex === -1 || currentIndex === -1) return null
    const rect = tr.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    const withoutIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex
    if (withoutIndex === currentIndex) return null
    // 落在含子任务行的下方时，指示线展示在整个子树之后
    let indicator = { todoId: node.id, position }
    if (position === 'after' && node.children?.length > 0) {
      let last = node
      while (last.children?.length) last = last.children[last.children.length - 1]
      indicator = { todoId: last.id, position: 'after' }
    }
    return { insertIndex: withoutIndex, indicator }
  }

  const handleSortDragOver = (event) => {
    if (!sortingTodo.value) return
    const plan = computeSortDrop(event)
    if (!plan) {
      sortDropTarget.value = null
      event.dataTransfer.dropEffect = 'none'
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    sortDropTarget.value = plan.indicator
  }

  const handleSortDrop = (event) => {
    if (!sortingTodo.value) return
    const dragged = sortingTodo.value
    const plan = computeSortDrop(event)
    resetSortDragState()
    if (!plan) return
    event.preventDefault()
    applySortDrop(dragged, plan.insertIndex)
  }

  // 将拖动任务插入到可见同级的新位置，并与被过滤隐藏的同级任务合并后整体落库
  const applySortDrop = async (dragged, insertIndex) => {
    const visibleSiblings = scopeSiblings(dragged)
    const without = visibleSiblings.filter(t => t.id !== dragged.id)
    if (insertIndex < 0 || insertIndex > without.length) return
    const newVisible = [...without]
    newVisible.splice(insertIndex, 0, dragged)
    const anchorNext = newVisible[insertIndex + 1] || null
    const anchorPrev = newVisible[insertIndex - 1] || null
    const fullOrder = todos.value
      .filter(t => (t.parentId ?? null) === (dragged.parentId ?? null))
      .sort((a, b) => (a.sortOrder ?? a.id) - (b.sortOrder ?? b.id))
    const others = fullOrder.filter(t => t.id !== dragged.id)
    let at = others.length
    if (anchorNext) {
      at = others.findIndex(t => t.id === anchorNext.id)
      if (at < 0) at = others.length
    } else if (anchorPrev) {
      at = others.findIndex(t => t.id === anchorPrev.id) + 1
    }
    others.splice(at, 0, dragged)
    try {
      await reorderTodos(dragged.parentId ?? null, others.map(t => t.id))
      ElMessage.success('任务顺序已更新')
      onRefresh()
    } catch {
      ElMessage.error('排序失败，请重试')
    }
  }

  return {
    sortDropTarget,
    handleSortDragStart,
    handleSortDragEnd,
    handleSortDragOver,
    handleSortDrop
  }
}
