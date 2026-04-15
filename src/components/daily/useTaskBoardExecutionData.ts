import { useCallback, useEffect, useState } from 'react'
import { getObjectiveColorOption } from '../Sidebar'
import type { DailyTask, Item } from '../../store/index'

interface UseTaskBoardExecutionDataOptions {
  tasks: DailyTask[]
  okrRefreshTrigger?: number
  onExecutionItemsChanged?: () => void | Promise<void>
  editingSourceItemId: string | null
  setEditingSourceItemId: React.Dispatch<React.SetStateAction<string | null>>
}

interface LinkedItemInfo {
  title: string | null
  color: string | null
}

interface UseTaskBoardExecutionDataResult {
  items: Item[]
  isLoading: boolean
  datesWithTasks: Set<string>
  loadItems: () => Promise<void>
  getLinkedItemInfo: (linkedGoalId: string | null) => LinkedItemInfo
  getItemById: (itemId: string | null | undefined) => Item | null
  getChildrenOf: (parentId: string | null | undefined, type?: Item['type']) => Item[]
  createExecutionChild: (parentItem: Item) => Promise<void>
  updateExecutionItemTitle: (itemId: string, title: string) => Promise<void>
  deleteExecutionItem: (itemId: string) => Promise<void>
  toggleExecutionItemStatus: (item: Item) => Promise<void>
  reorderExecutionChildren: (
    activeItemId: string,
    overItemId: string,
    parentId: string | null | undefined,
    itemType: Item['type']
  ) => Promise<void>
}

export function useTaskBoardExecutionData({
  tasks,
  okrRefreshTrigger,
  onExecutionItemsChanged,
  editingSourceItemId,
  setEditingSourceItemId,
}: UseTaskBoardExecutionDataOptions): UseTaskBoardExecutionDataResult {
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [datesWithTasks, setDatesWithTasks] = useState<Set<string>>(new Set())

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true)
      const allItems = await window.electronAPI.database.getAllItems()
      setItems(allItems)
    } catch {
      // ignore execution data failures
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAllTaskDates = useCallback(async () => {
    try {
      const allTasks = await window.electronAPI.dailyTasks.getAllTasks()
      const datesSet = new Set<string>()
      allTasks.forEach((task: DailyTask) => {
        if (task.date) {
          datesSet.add(task.date)
        }
      })
      setDatesWithTasks(datesSet)
    } catch {
      // ignore date marker failures
    }
  }, [])

  useEffect(() => {
    const runInitialLoad = () => {
      void loadItems()
      void loadAllTaskDates()
    }

    const requestIdle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback
    if (requestIdle) {
      const idleId = requestIdle(runInitialLoad)
      return () => window.cancelIdleCallback?.(idleId)
    }

    const timer = window.setTimeout(runInitialLoad, 120)
    return () => window.clearTimeout(timer)
  }, [loadItems, loadAllTaskDates])

  useEffect(() => {
    if (okrRefreshTrigger === undefined) return
    void loadItems()
  }, [okrRefreshTrigger, loadItems])

  useEffect(() => {
    void loadAllTaskDates()
  }, [tasks, loadAllTaskDates])

  const getLinkedItemInfo = useCallback((linkedGoalId: string | null): LinkedItemInfo => {
    if (!linkedGoalId) return { title: null, color: null }

    const item = items.find((candidate) => candidate.id === linkedGoalId)
    if (!item) return { title: null, color: null }

    const getColorValue = (colorKey: string | null | undefined): string | null => {
      if (!colorKey) return null
      return getObjectiveColorOption(colorKey)?.textColor || null
    }

    if (item.type === 'TODO' && item.parent_id) {
      const parentKr = items.find((candidate) => candidate.id === item.parent_id)
      if (parentKr) {
        if (parentKr.parent_id) {
          const grandparentObjective = items.find((candidate) => candidate.id === parentKr.parent_id)
          if (grandparentObjective) {
            return { title: parentKr.title || null, color: getColorValue(grandparentObjective.color) }
          }
        }
        return { title: parentKr.title || null, color: getColorValue(parentKr.color) }
      }
    }

    if (item.type === 'KR' && item.parent_id) {
      const parentObjective = items.find((candidate) => candidate.id === item.parent_id)
      if (parentObjective) {
        return { title: item.title || null, color: getColorValue(parentObjective.color) }
      }
    }

    return { title: item.title || null, color: getColorValue(item.color) }
  }, [items])

  const getItemById = useCallback((itemId: string | null | undefined) => {
    if (!itemId) return null
    return items.find((item) => item.id === itemId) || null
  }, [items])

  const getChildrenOf = useCallback((parentId: string | null | undefined, type?: Item['type']) => {
    if (!parentId) return []
    return items
      .filter((item) => item.parent_id === parentId && (!type || item.type === type))
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [items])

  const refreshExecutionItems = useCallback(async () => {
    await loadItems()
    await onExecutionItemsChanged?.()
  }, [loadItems, onExecutionItemsChanged])

  const createExecutionChild = useCallback(async (parentItem: Item) => {
    const childType = parentItem.type === 'O' ? 'KR' : parentItem.type === 'KR' ? 'TODO' : null
    if (!childType) return

    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: childType,
      parent_id: parentItem.id,
      title: '',
      content: '',
      status: 0,
      total_focus_time: 0,
    })

    if (parentItem.type !== 'TODO') {
      setEditingSourceItemId(newId)
      await refreshExecutionItems()
    }
  }, [refreshExecutionItems, setEditingSourceItemId])

  const updateExecutionItemTitle = useCallback(async (itemId: string, title: string) => {
    await window.electronAPI.database.updateItem(itemId, { title })
    setEditingSourceItemId(null)
    await refreshExecutionItems()
  }, [refreshExecutionItems, setEditingSourceItemId])

  const deleteExecutionItem = useCallback(async (itemId: string) => {
    await window.electronAPI.database.deleteItem(itemId)
    if (editingSourceItemId === itemId) {
      setEditingSourceItemId(null)
    }
    await refreshExecutionItems()
  }, [editingSourceItemId, refreshExecutionItems, setEditingSourceItemId])

  const toggleExecutionItemStatus = useCallback(async (item: Item) => {
    const nextStatus = item.status === 1 ? 0 : 1
    await window.electronAPI.database.updateItem(item.id, { status: nextStatus })
    await refreshExecutionItems()
  }, [refreshExecutionItems])

  const reorderExecutionChildren = useCallback(async (
    activeItemId: string,
    overItemId: string,
    parentId: string | null | undefined,
    itemType: Item['type']
  ) => {
    if (!parentId || activeItemId === overItemId) return

    const siblings = items
      .filter((item) => item.parent_id === parentId && item.type === itemType)
      .sort((a, b) => a.sort_order - b.sort_order)

    const oldIndex = siblings.findIndex((item) => item.id === activeItemId)
    const newIndex = siblings.findIndex((item) => item.id === overItemId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const nextSiblings = [...siblings]
    const [moved] = nextSiblings.splice(oldIndex, 1)
    nextSiblings.splice(newIndex, 0, moved)

    await Promise.all(
      nextSiblings.map((item, index) =>
        window.electronAPI.database.updateItemSortOrder(item.id, index)
      )
    )
    await refreshExecutionItems()
  }, [items, refreshExecutionItems])

  return {
    items,
    isLoading,
    datesWithTasks,
    loadItems,
    getLinkedItemInfo,
    getItemById,
    getChildrenOf,
    createExecutionChild,
    updateExecutionItemTitle,
    deleteExecutionItem,
    toggleExecutionItemStatus,
    reorderExecutionChildren,
  }
}
