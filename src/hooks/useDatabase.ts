/**
 * 数据库操作 Hook
 * 采用 "全局预设 + 手动微调" 的 Apple 交互原则
 * 
 * 架构变更：
 * - viewMode 不再是"持续过滤器"，而是"一键重置触发器"
 * - 单一事实来源：expandedIds 百分之百决定目录展开/收起状态
 * - 渲染层只读 expandedIds，不读 viewMode
 * 
 * 新增大纲式交互：
 * - 回车创建同级
 * - 右键创建子级
 * - 自动聚焦新项
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// Item 数据类型
export interface Item {
  id: string
  type: 'O' | 'KR' | 'TODO'
  parent_id: string | null
  title: string
  content: string
  status: number
  sort_order: number
  total_focus_time: number
  color?: string | null
  created_at: string
  updated_at: string
}

// 用于 UI 展示的 ObjectiveItem 类型
export interface ObjectiveItem {
  id: string
  label: string
  iconType: 'objective' | 'keyresult' | 'todo'
  level: 1 | 2 | 3
  expanded?: boolean
  dbId: string
  hasChildren?: boolean
  color?: string | null
  status?: number
}

// 重置级别类型
export type ResetLevel = 'none' | 'objectives' | 'keyresults' | 'todos'

// 本地 fallback 数据
const FALLBACK_DATA: ObjectiveItem[] = [
  { id: 'obj-1', label: '发布 vibe coding 视频', iconType: 'objective', level: 1, expanded: true, dbId: 'obj-1', hasChildren: true },
  { id: 'kr-1-1', label: '完成 3 个应用场景演示', iconType: 'keyresult', level: 2, dbId: 'kr-1-1', hasChildren: true },
  { id: 'todo-1-1-1', label: '应用 1: 待办事项应用', iconType: 'todo', level: 3, dbId: 'todo-1-1-1', hasChildren: false },
  { id: 'todo-1-1-2', label: '应用 2: 天气查询应用', iconType: 'todo', level: 3, dbId: 'todo-1-1-2', hasChildren: false },
  { id: 'todo-1-1-3', label: '应用 3: 笔记管理应用', iconType: 'todo', level: 3, dbId: 'todo-1-1-3', hasChildren: false },
  { id: 'kr-1-2', label: '视频制作完成度达到 100%', iconType: 'keyresult', level: 2, dbId: 'kr-1-2', hasChildren: true },
  { id: 'todo-1-2-1', label: '录制视频素材', iconType: 'todo', level: 3, dbId: 'todo-1-2-1', hasChildren: false },
  { id: 'todo-1-2-2', label: '剪辑和后期制作', iconType: 'todo', level: 3, dbId: 'todo-1-2-2', hasChildren: false },
  { id: 'todo-1-2-3', label: '上传 git', iconType: 'todo', level: 3, dbId: 'todo-1-2-3', hasChildren: false },
  { id: 'kr-1-3', label: '获得 1000 次观看', iconType: 'keyresult', level: 2, dbId: 'kr-1-3', hasChildren: false },
  { id: 'obj-2', label: 'vibe coding 上线', iconType: 'objective', level: 1, expanded: false, dbId: 'obj-2', hasChildren: true },
  { id: 'obj-3', label: '学习新技术栈', iconType: 'objective', level: 1, expanded: false, dbId: 'obj-3', hasChildren: true },
]

function convertToObjectiveItem(
  item: Item,
  level: 1 | 2 | 3,
  expanded?: boolean,
  hasChildren?: boolean
): ObjectiveItem {
  const iconTypeMap: Record<string, 'objective' | 'keyresult' | 'todo'> = {
    'O': 'objective',
    'KR': 'keyresult',
    'TODO': 'todo',
  }

  return {
    id: item.id,
    label: item.title,
    iconType: iconTypeMap[item.type] || 'objective',
    level,
    expanded,
    dbId: item.id,
    hasChildren,
    color: item.color,
    status: item.status,
  }
}

function isElectronAPIAvailable(): boolean {
  return typeof window !== 'undefined' && 
         !!(window as any).electronAPI?.database
}

// 生成 UUID
function generateUUID(): string {
  return crypto.randomUUID()
}

export function useDatabase() {
  // 所有 useState 必须在最前面，保持调用顺序一致
  const [items, setItems] = useState<ObjectiveItem[]>([])
  const [allObjectives, setAllObjectives] = useState<Item[]>([])
  const [krMap, setKrMap] = useState<Map<string, Item[]>>(new Map())
  const [todoMap, setTodoMap] = useState<Map<string, Item[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isElectronAvailable, setIsElectronAvailable] = useState(true)
  
  // ============================================
  // 单一事实来源：expandedIds 百分之百决定展开状态
  // ============================================
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  
  // 当前正在编辑的项 ID（用于自动聚焦新创建的项）
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // 使用 ref 记录数据是否已加载完成
  const isDataLoadedRef = useRef(false)

  // 初始化数据库
  const initDatabase = useCallback(async () => {
    try {
      if (isElectronAPIAvailable()) {
        const result = await (window as any).electronAPI.database.init()
        if (!result.success) {
          setError(result.error || '数据库初始化失败')
          setIsElectronAvailable(false)
        }
      } else {
        setIsElectronAvailable(false)
        setError('数据库 API 不可用')
      }
    } catch (err) {
      console.error('[useDatabase] 初始化失败:', err)
      setIsElectronAvailable(false)
      setError(String(err))
    }
  }, [])

  // 加载基础数据（只加载一次）
  const loadBaseData = useCallback(async () => {
    try {
      if (!isElectronAPIAvailable()) {
        setAllObjectives([
          { id: 'obj-1', type: 'O', parent_id: null, title: '发布 vibe coding 视频', content: '', status: 0, sort_order: 1, total_focus_time: 0, created_at: '', updated_at: '' },
          { id: 'obj-2', type: 'O', parent_id: null, title: 'vibe coding 上线', content: '', status: 0, sort_order: 2, total_focus_time: 0, created_at: '', updated_at: '' },
          { id: 'obj-3', type: 'O', parent_id: null, title: '学习新技术栈', content: '', status: 0, sort_order: 3, total_focus_time: 0, created_at: '', updated_at: '' },
        ])
        setKrMap(new Map())
        setTodoMap(new Map())
        isDataLoadedRef.current = true
        return
      }

      const objectives = await (window as any).electronAPI.database.getObjectives()
      
      // 防止空数据
      if (!objectives || objectives.length === 0) {
        setAllObjectives([])
        setKrMap(new Map())
        setTodoMap(new Map())
        isDataLoadedRef.current = true
        return
      }
      
      setAllObjectives(objectives)
      
      const newKrMap = new Map<string, Item[]>()
      const newTodoMap = new Map<string, Item[]>()

      for (const obj of objectives) {
        const children = await (window as any).electronAPI.database.getChildrenByParentId(obj.id)
        const krs = children.filter((item: Item) => item.type === 'KR')
        newKrMap.set(obj.id, krs)

        for (const kr of krs) {
          const todos = await (window as any).electronAPI.database.getChildrenByParentId(kr.id)
          newTodoMap.set(kr.id, todos.filter((item: Item) => item.type === 'TODO'))
        }
      }
      
      setKrMap(newKrMap)
      setTodoMap(newTodoMap)
      isDataLoadedRef.current = true
    } catch (err) {
      console.error('[useDatabase] 加载基础数据失败:', err)
      setError(String(err))
      isDataLoadedRef.current = true
    }
  }, [])

  // 初始化时加载基础数据
  useEffect(() => {
    initDatabase().then(() => loadBaseData())
  }, [initDatabase, loadBaseData])

  // ============================================
  // 核心变更：根据 expandedIds 构建层级结构
  // 完全移除 viewMode 对渲染的硬编码限制
  // ============================================
  useEffect(() => {
    // 防止空指针：数据未加载完成时使用 fallback
    if (!isDataLoadedRef.current) {
      setItems(FALLBACK_DATA)
      setLoading(false)
      return
    }
    
    // 安全检查：allObjectives 为空时显示 fallback
    if (!allObjectives || allObjectives.length === 0) {
      setItems(FALLBACK_DATA)
      setLoading(false)
      return
    }

    const hierarchy: ObjectiveItem[] = []

    for (const obj of allObjectives) {
      // 空指针检查
      if (!obj || !obj.id) continue
      
      const hasKRChildren = (krMap.get(obj.id)?.length || 0) > 0
      
      // 唯一判定标准：expandedIds.has(obj.id)
      const isObjExpanded = expandedIds.has(obj.id)
      
      hierarchy.push(convertToObjectiveItem(obj, 1, isObjExpanded, hasKRChildren))

      // 只有展开时才渲染子项
      if (isObjExpanded && hasKRChildren) {
        const krs = krMap.get(obj.id) || []
        for (const kr of krs) {
          // 空指针检查
          if (!kr || !kr.id) continue
          
          const hasTodos = (todoMap.get(kr.id)?.length || 0) > 0
          
          // 唯一判定标准：expandedIds.has(kr.id)
          const isKRExpanded = expandedIds.has(kr.id)
          
          hierarchy.push(convertToObjectiveItem(kr, 2, isKRExpanded, hasTodos))

          // 只有 KR 展开时才渲染 TODO
          if (isKRExpanded && hasTodos) {
            const todos = todoMap.get(kr.id) || []
            for (const todo of todos) {
              // 空指针检查
              if (!todo || !todo.id) continue
              hierarchy.push(convertToObjectiveItem(todo, 3, undefined, false))
            }
          }
        }
      }
    }

    setItems(hierarchy)
    setLoading(false)
  }, [expandedIds, allObjectives, krMap, todoMap])

  // ============================================
  // 一键重置功能：进度条点击时调用
  // ============================================
  const resetExpandedState = useCallback((level: ResetLevel) => {
    const newIds = new Set<string>()

    switch (level) {
      case 'objectives':
        // 清空所有展开项，界面回归最简
        // newIds 保持为空
        break

      case 'keyresults':
        // 展开所有 Objectives (type === 'O')
        for (const obj of allObjectives) {
          if (obj && obj.id) {
            newIds.add(obj.id)
          }
        }
        break

      case 'todos':
        // 展开所有 Objectives 和 Key Results
        for (const obj of allObjectives) {
          if (obj && obj.id) {
            newIds.add(obj.id)
          }
        }
        for (const [, krs] of krMap) {
          if (krs && Array.isArray(krs)) {
            for (const kr of krs) {
              if (kr && kr.id) {
                newIds.add(kr.id)
              }
            }
          }
        }
        break

      case 'none':
      default:
        // 不做任何改变
        return
    }

    setExpandedIds(newIds)
  }, [allObjectives, krMap])

  // ============================================
  // 手动交互：增删 expandedIds
  // 优先级最高，不受任何全局状态限制
  // ============================================
  const toggleExpand = useCallback((id: string, forceState?: boolean) => {
    if (!id) return

    setExpandedIds((prev) => {
      const newSet = new Set(prev)
      if (forceState !== undefined) {
        // 强制设置状态
        if (forceState) {
          newSet.add(id)
        } else {
          newSet.delete(id)
        }
      } else {
        // 切换状态
        if (newSet.has(id)) {
          newSet.delete(id)
        } else {
          newSet.add(id)
        }
      }
      return newSet
    })
  }, [])

  // ============================================
  // 大纲式交互：创建同级（带全局重排）
  // ============================================
  const createSibling = useCallback(async (currentId: string): Promise<string | null> => {
    try {
      // 1. 找到当前项的信息
      let currentItem: Item | null = null

      // 在 allObjectives 中查找
      currentItem = allObjectives.find(obj => obj.id === currentId) || null

      // 在 krMap 中查找
      if (!currentItem) {
        for (const [, krs] of krMap) {
          const found = krs.find(kr => kr.id === currentId)
          if (found) {
            currentItem = found
            break
          }
        }
      }

      // 在 todoMap 中查找
      if (!currentItem) {
        for (const [, todos] of todoMap) {
          const found = todos.find(todo => todo.id === currentId)
          if (found) {
            currentItem = found
            break
          }
        }
      }

      if (!currentItem) return null

      // 2. 确定新项的属性
      const newId = generateUUID()
      const newSortOrder = currentItem.sort_order + 1

      // 3. 先执行全局重排：将所有 sort_order >= newSortOrder 的同级项向后移动
      if (isElectronAPIAvailable()) {
        await (window as any).electronAPI.database.shiftSortOrders(
          currentItem.parent_id,
          newSortOrder,
          currentItem.type
        )
      }

      // 4. 创建新项
      if (isElectronAPIAvailable()) {
        await (window as any).electronAPI.database.createItem({
          id: newId,
          type: currentItem.type,
          parent_id: currentItem.parent_id,
          title: '',
          content: '',
          status: 0,
          sort_order: newSortOrder,
        })
      }

      // 5. 重新加载数据
      await loadBaseData()

      // 6. 延迟设置编辑状态，确保组件已挂载
      setTimeout(() => {
        setEditingId(newId)
      }, 50)

      return newId

    } catch (err) {
      console.error('[useDatabase] 创建同级失败:', err)
      return null
    }
  }, [allObjectives, krMap, todoMap, loadBaseData])

  // ============================================
  // 大纲式交互：创建子级
  // ============================================
  const createChild = useCallback(async (parentId: string): Promise<string | null> => {
    try {
      // 1. 找到父项的信息
      let parentItem: Item | null = null

      // 在 allObjectives 中查找
      parentItem = allObjectives.find(obj => obj.id === parentId) || null

      // 在 krMap 中查找
      if (!parentItem) {
        for (const [, krs] of krMap) {
          const found = krs.find(kr => kr.id === parentId)
          if (found) {
            parentItem = found
            break
          }
        }
      }

      if (!parentItem) return null

      // 2. 确定子项的 type
      let childType: 'O' | 'KR' | 'TODO'
      if (parentItem.type === 'O') {
        childType = 'KR'
      } else if (parentItem.type === 'KR') {
        childType = 'TODO'
      } else {
        return null
      }

      // 3. 创建新项
      const newId = generateUUID()

      if (isElectronAPIAvailable()) {
        await (window as any).electronAPI.database.createItem({
          id: newId,
          type: childType,
          parent_id: parentId,
          title: '',
          content: '',
          status: 0,
          sort_order: 0,
        })
      }

      // 4. 强制展开父级
      toggleExpand(parentId, true)

      // 5. 重新加载数据
      await loadBaseData()

      // 6. 延迟设置编辑状态，确保组件已挂载
      setTimeout(() => {
        setEditingId(newId)
      }, 50)

      return newId

    } catch (err) {
      console.error('[useDatabase] 创建子级失败:', err)
      return null
    }
  }, [allObjectives, krMap, toggleExpand, loadBaseData])

  // ============================================
  // 更新标题（双击编辑）
  // ============================================
  const updateTitle = useCallback(async (dbId: string, newTitle: string) => {
    try {
      if (!dbId) return false

      if (!isElectronAPIAvailable()) {
        setItems((prev) =>
          prev.map((item) =>
            item.dbId === dbId ? { ...item, label: newTitle } : item
          )
        )
        return true
      }

      await (window as any).electronAPI.database.updateItem(dbId, { title: newTitle })
      
      // 更新本地状态
      setItems((prev) =>
        prev.map((item) =>
          item.dbId === dbId ? { ...item, label: newTitle } : item
        )
      )
      
      // 同时更新 allObjectives/krMap/todoMap 中的数据
      setAllObjectives((prev) =>
        prev.map((obj) =>
          obj.id === dbId ? { ...obj, title: newTitle } : obj
        )
      )
      
      setKrMap((prev) => {
        const newMap = new Map(prev)
        for (const [key, krs] of newMap) {
          newMap.set(key, krs.map(kr => 
            kr.id === dbId ? { ...kr, title: newTitle } : kr
          ))
        }
        return newMap
      })
      
      setTodoMap((prev) => {
        const newMap = new Map(prev)
        for (const [key, todos] of newMap) {
          newMap.set(key, todos.map(todo => 
            todo.id === dbId ? { ...todo, title: newTitle } : todo
          ))
        }
        return newMap
      })
      
      return true
    } catch (err) {
      console.error('[useDatabase] 更新标题失败:', err)
      return false
    }
  }, [])

  // ============================================
  // 更新状态（勾选/取消勾选）
  // ============================================
  const updateStatus = useCallback(async (dbId: string, newStatus: number) => {
    try {
      if (!dbId) return false

      if (!isElectronAPIAvailable()) {
        // 本地状态更新
        setAllObjectives((prev) =>
          prev.map((obj) =>
            obj.id === dbId ? { ...obj, status: newStatus } : obj
          )
        )
        return true
      }

      await (window as any).electronAPI.database.updateItem(dbId, { status: newStatus })

      // 更新本地状态
      setAllObjectives((prev) =>
        prev.map((obj) =>
          obj.id === dbId ? { ...obj, status: newStatus } : obj
        )
      )

      setKrMap((prev) => {
        const newMap = new Map(prev)
        for (const [key, krs] of newMap) {
          newMap.set(key, krs.map(kr =>
            kr.id === dbId ? { ...kr, status: newStatus } : kr
          ))
        }
        return newMap
      })

      setTodoMap((prev) => {
        const newMap = new Map(prev)
        for (const [key, todos] of newMap) {
          newMap.set(key, todos.map(todo =>
            todo.id === dbId ? { ...todo, status: newStatus } : todo
          ))
        }
        return newMap
      })

      return true
    } catch (err) {
      console.error('[useDatabase] 更新状态失败:', err)
      return false
    }
  }, [])

  // ============================================
  // 清除编辑状态
  // ============================================
  const clearEditingId = useCallback(() => {
    setEditingId(null)
  }, [])

  // ============================================
  // 大纲式交互：删除项（递归删除子项）
  // ============================================
  const deleteItem = useCallback(async (id: string): Promise<{ success: boolean; deletedIds: string[] }> => {
    try {
      let deletedIds: string[] = []

      if (isElectronAPIAvailable()) {
        const result = await (window as any).electronAPI.database.deleteItem(id)
        deletedIds = result.deletedIds || []
      } else {
        deletedIds = [id]
      }

      // 从 expandedIds 中移除所有被删除的 ID
      setExpandedIds((prev) => {
        const newSet = new Set(prev)
        for (const deletedId of deletedIds) {
          newSet.delete(deletedId)
        }
        return newSet
      })

      // 清除编辑状态
      setEditingId((prev) => {
        if (prev && deletedIds.includes(prev)) return null
        return prev
      })

      // 重新加载数据
      await loadBaseData()

      return { success: true, deletedIds }

    } catch (err) {
      console.error('[useDatabase] 删除失败:', err)
      return { success: false, deletedIds: [] }
    }
  }, [loadBaseData])

  // ============================================
  // 查找父级 ID（用于自动展开）
  // ============================================
  const findParentId = useCallback((itemId: string): string | null => {
    // 在 krMap 中查找（找 KR 的父级 Objective）
    for (const [objId, krs] of krMap) {
      if (krs.some(kr => kr.id === itemId)) {
        return objId
      }
    }
    
    // 在 todoMap 中查找（找 TODO 的父级 KR）
    for (const [krId, todos] of todoMap) {
      if (todos.some(todo => todo.id === itemId)) {
        return krId
      }
    }
    
    return null
  }, [krMap, todoMap])

  // ============================================
  // 展开指定项的所有祖先节点
  // ============================================
  const expandAncestors = useCallback((itemId: string) => {
    const parentId = findParentId(itemId)
    if (parentId) {
      // 递归展开父级
      expandAncestors(parentId)
      // 展开当前父级
      toggleExpand(parentId, true)
    }
  }, [findParentId, toggleExpand])

  return {
    items,
    loading,
    error,
    expandedIds,
    editingId,
    isElectronAvailable,
    toggleExpand,
    updateTitle,
    updateStatus,
    resetExpandedState,
    createSibling,
    createChild,
    deleteItem,
    clearEditingId,
    refresh: loadBaseData,
    expandAncestors,
    findParentId,
  }
}
