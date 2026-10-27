import { ref, computed } from 'vue'

// 任务关键字搜索（PONR-21）：按任务标题做包含匹配，忽略首尾空格与英文大小写。
// 在给定任务集合内保留命中任务及其祖先任务，保证搜索结果仍按父子层级展示；
// 祖先任务须同在该集合内，避免状态筛选后出现「仅因补齐祖先而展示」的不命中行。
export function useTodoSearch(todos) {
  const keyword = ref('')
  const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())
  const isSearching = computed(() => normalizedKeyword.value !== '')
  const scopeTodos = (list) => {
    const kw = normalizedKeyword.value
    if (!kw) return list
    const byId = new Map(todos.value.map(todo => [todo.id, todo]))
    const keep = new Set(list
      .filter(todo => String(todo.title || '').toLowerCase().includes(kw))
      .map(todo => todo.id))
    const matchedIds = new Set(keep)
    matchedIds.forEach(id => {
      let parentId = byId.get(id)?.parentId
      while (parentId != null && byId.has(parentId) && !keep.has(parentId)) {
        keep.add(parentId)
        parentId = byId.get(parentId).parentId
      }
    })
    return list.filter(todo => keep.has(todo.id))
  }
  return { keyword, isSearching, scopeTodos }
}

// 扁平任务列表 -> 任务树；父任务不在当前集合内时，该任务按顶级行展示
export const buildTodoTree = (flatList) => {
  const map = new Map()
  const tree = []
  flatList.forEach(item => {
    map.set(item.id, { ...item, children: [], hasChildren: false })
  })
  flatList.forEach(item => {
    const node = map.get(item.id)
    if (item.parentId && map.has(item.parentId)) {
      const parent = map.get(item.parentId)
      parent.children.push(node)
      parent.hasChildren = true
    } else {
      tree.push(node)
    }
  })
  return tree
}

// 收集任务节点下的全部后代任务 id（用于父子关系合法性校验）
export const collectDescendantIds = (todo) => {
  const result = new Set()
  const walk = (node) => {
    if (!node?.children?.length) return
    node.children.forEach(child => {
      result.add(child.id)
      walk(child)
    })
  }
  walk(todo)
  return result
}
