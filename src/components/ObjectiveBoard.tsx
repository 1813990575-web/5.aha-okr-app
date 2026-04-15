import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDndMonitor } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUp, CalendarDays, Check, Eye, ImagePlus, MoreHorizontal, Plus, X } from 'lucide-react'
import type { DailyTask, Item } from '../store/index'
import { getObjectiveColorOption } from './Sidebar'
import { TodayFloatingTaskBoard } from './daily/TodayFloatingTaskBoard'
import { TodoThreadPopover, getLatestTodoThreadPreview, subscribeTodoThreadUpdates } from './daily/TodoThreadPopover'

interface ObjectiveBoardProps {
  objective: { id: string; title: string; color?: string | null }
  tasks: DailyTask[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void | Promise<void>
  onAddToDailyTasks: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void | Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onUpdateTaskContent?: (id: string, content: string) => void | Promise<void>
  onMoveTaskToToday?: (id: string) => void | Promise<void>
  onReorderTasks?: (orderedTaskIds: string[]) => void | Promise<void>
  isPastDate?: boolean
  onObjectiveChanged?: () => void | Promise<void>
  onSwitchObjectiveBoard?: (objective: { id: string; title: string; color?: string | null }) => void
  refreshTrigger?: number
  dragNotice?: string | null
}

type EditingTarget =
  | { id: string; kind: 'objective' | 'kr' | 'todo'; value: string }
  | null

interface VisionMessage {
  id: string
  text: string
  createdAt: number
  imageDataUrls: string[]
}

const KR_CORE_BASE_PALETTE = {
  pureWhite: 'var(--color-white)',
  lightGray: 'var(--color-surface-soft)',
  darkSurface: 'var(--color-ink-strong)',
  nearWhite: '#f6f6f6',
  border: '#e2ddd7',
  borderSoft: 'var(--color-border-soft)',
  badgeBg: '#ebe6e1',
  badgeText: '#6b625b',
  bodySoft: 'var(--color-surface-soft)',
  bodyWarm: '#f8f7f5',
} as const

const KR_HEADER_FONT_FAMILY = '"Arial Rounded MT Bold", var(--font-apple)'

const KR_CARD_THEMES = [
  {
    shell: 'border-[#e5e5e5]',
    shellStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.lightGray,
    },
    topStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.darkSurface,
    },
    bodyStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.bodySoft,
    },
    badgeStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.badgeBg,
      color: KR_CORE_BASE_PALETTE.badgeText,
    },
  },
  {
    shell: 'border-[#e5e5e5]',
    shellStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.lightGray,
    },
    topStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.darkSurface,
    },
    bodyStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.bodySoft,
    },
    badgeStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.badgeBg,
      color: KR_CORE_BASE_PALETTE.badgeText,
    },
  },
  {
    shell: 'border-[#e5e5e5]',
    shellStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.lightGray,
    },
    topStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.darkSurface,
    },
    bodyStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.bodySoft,
    },
    badgeStyle: {
      backgroundColor: KR_CORE_BASE_PALETTE.badgeBg,
      color: KR_CORE_BASE_PALETTE.badgeText,
    },
  },
] as const

function getColorHex(colorKey?: string | null): string {
  if (!colorKey) return '#3860BE'
  return getObjectiveColorOption(colorKey)?.textColor || '#3860BE'
}

function sortByOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

const FLOATING_PANEL_SAFE_RIGHT_PADDING = 520
const BOARD_BASE_RIGHT_PADDING = 32
const VISION_PLACEHOLDER = '这里是愿景备注示例：记录你想成为的样子与每天的推进。'
const VISION_INITIAL_MESSAGES: VisionMessage[] = []
const MAX_OBJECTIVE_DEADLINE_DAYS = 999

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('文件读取失败'))
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function formatVisionDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

function normalizeDeadlineInputValue(deadlineAt?: string | null): string {
  if (!deadlineAt) return ''
  const normalized = deadlineAt.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getObjectiveCountdownDays(deadlineAt: string): number {
  const target = new Date(deadlineAt)
  target.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function isObjectiveDeadlineTooFar(deadlineAt: string): boolean {
  return getObjectiveCountdownDays(deadlineAt) > MAX_OBJECTIVE_DEADLINE_DAYS
}

function formatObjectiveDeadline(deadlineAt?: string | null): { countdown: string; date: string; tone: string } | null {
  if (!deadlineAt) return null

  const days = getObjectiveCountdownDays(deadlineAt)
  const target = new Date(deadlineAt)
  if (Number.isNaN(target.getTime())) return null

  const countdown =
    days > 0 ? `剩 ${days} 天` : days === 0 ? '今天截止' : `已逾期 ${Math.abs(days)} 天`

  const date = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(target)
    .replace(/\//g, '.')

  const tone = days < 0 ? 'text-[var(--color-danger-muted)]' : days <= 3 ? 'text-[var(--color-warn)]' : 'text-[#2f3742]'

  return { countdown, date: `截止 ${date}`, tone }
}

export const ObjectiveBoard: React.FC<ObjectiveBoardProps> = ({
  objective,
  tasks,
  selectedDate,
  onDateChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onMoveTaskToToday,
  onReorderTasks,
  isPastDate,
  onObjectiveChanged,
  onSwitchObjectiveBoard,
  refreshTrigger,
  dragNotice,
  onAddToDailyTasks: _onAddToDailyTasks,
}) => {
  void _onAddToDailyTasks
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null)
  const [openKrMenuId, setOpenKrMenuId] = useState<string | null>(null)
  const [boardMenuPosition, setBoardMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeKrSortId, setActiveKrSortId] = useState<string | null>(null)
  const [activeTodoSortId, setActiveTodoSortId] = useState<string | null>(null)
  const [highlightedKrId, setHighlightedKrId] = useState<string | null>(null)
  const [highlightedTodoId, setHighlightedTodoId] = useState<string | null>(null)
  const [highlightedFloatingTaskId, setHighlightedFloatingTaskId] = useState<string | null>(null)
  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false)
  const [isFloatingPanelPrepared, setIsFloatingPanelPrepared] = useState(false)
  const [isFloatingSafeAreaActive, setIsFloatingSafeAreaActive] = useState(false)
  const [isVisionDialogOpen, setIsVisionDialogOpen] = useState(false)
  const [isDeadlineEditorOpen, setIsDeadlineEditorOpen] = useState(false)
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [deadlineError, setDeadlineError] = useState('')
  const [visionMessages, setVisionMessages] = useState<VisionMessage[]>(VISION_INITIAL_MESSAGES)
  const todoHighlightTimerRef = useRef<number | null>(null)
  const floatingTaskHighlightTimerRef = useRef<number | null>(null)
  const boardScrollRef = useRef<HTMLDivElement | null>(null)
  const deadlineEditorRef = useRef<HTMLDivElement | null>(null)
  const krColumnRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const todoItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const pendingBoardFocusRef = useRef<{ type: 'KR' | 'TODO'; id: string } | null>(null)

  const loadItems = useCallback(async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      setError(null)
      const allItems = await window.electronAPI.database.getAllItems()
      setItems(allItems)
    } catch (loadError) {
      console.error('[ObjectiveBoard] 加载分栏数据失败:', loadError)
      setError('加载分栏内容失败')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems, objective.id])

  useEffect(() => {
    if (refreshTrigger === undefined) return
    void loadItems({ showLoading: false })
  }, [refreshTrigger, loadItems])

  const boardObjective = useMemo(
    () => items.find((item) => item.id === objective.id && item.type === 'O') || null,
    [items, objective.id]
  )

  const krColumns = useMemo(() => {
    return sortByOrder(items.filter((item) => item.parent_id === objective.id && item.type === 'KR')).map((kr) => ({
      ...kr,
      todos: sortByOrder(items.filter((item) => item.parent_id === kr.id && item.type === 'TODO')),
    }))
  }, [items, objective.id])

  const latestVisionPreview = useMemo(() => {
    if (visionMessages.length === 0) return VISION_PLACEHOLDER
    const latestMessage = visionMessages.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    )
    const latestText = latestMessage.text.trim()
    if (latestText.length > 0) return latestText
    return latestMessage.imageDataUrls.length > 0 ? '最新愿景记录包含照片' : VISION_PLACEHOLDER
  }, [visionMessages])

  const activeColor = getColorHex(boardObjective?.color ?? objective.color)
  const objectiveDeadlineMeta = useMemo(
    () => formatObjectiveDeadline(boardObjective?.objective_deadline_at ?? null),
    [boardObjective?.objective_deadline_at]
  )

  useEffect(() => {
    setDeadlineDraft(normalizeDeadlineInputValue(boardObjective?.objective_deadline_at ?? null))
    setDeadlineError('')
  }, [boardObjective?.objective_deadline_at])

  const refreshAfterMutation = useCallback(async () => {
    await loadItems({ showLoading: false })
    await onObjectiveChanged?.()
  }, [loadItems, onObjectiveChanged])

  const closeDeadlineEditor = useCallback(() => {
    setIsDeadlineEditorOpen(false)
    setDeadlineDraft(normalizeDeadlineInputValue(boardObjective?.objective_deadline_at ?? null))
    setDeadlineError('')
  }, [boardObjective?.objective_deadline_at])

  const openDeadlineEditor = useCallback(() => {
    setDeadlineDraft(normalizeDeadlineInputValue(boardObjective?.objective_deadline_at ?? null))
    setDeadlineError('')
    setIsDeadlineEditorOpen(true)
  }, [boardObjective?.objective_deadline_at])

  const saveObjectiveDeadline = useCallback(async () => {
    if (!deadlineDraft) return
    if (isObjectiveDeadlineTooFar(deadlineDraft)) {
      setDeadlineError(`截止日期最长只能设置到 ${MAX_OBJECTIVE_DEADLINE_DAYS} 天内`)
      return
    }
    await window.electronAPI.database.updateItem(objective.id, {
      objective_deadline_at: deadlineDraft,
    })
    await refreshAfterMutation()
    setIsDeadlineEditorOpen(false)
    setDeadlineError('')
  }, [deadlineDraft, objective.id, refreshAfterMutation])

  const clearObjectiveDeadline = useCallback(async () => {
    await window.electronAPI.database.updateItem(objective.id, {
      objective_deadline_at: null,
    })
    await refreshAfterMutation()
    setDeadlineDraft('')
    setDeadlineError('')
    setIsDeadlineEditorOpen(false)
  }, [objective.id, refreshAfterMutation])

  const reorderTodos = useCallback(async (activeTodoId: string, overTodoId: string, krId: string) => {
    if (!activeTodoId || !overTodoId || activeTodoId === overTodoId || !krId) return

    const siblings = sortByOrder(items.filter((item) => item.parent_id === krId && item.type === 'TODO'))
    const oldIndex = siblings.findIndex((item) => item.id === activeTodoId)
    const newIndex = siblings.findIndex((item) => item.id === overTodoId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const nextSiblings = [...siblings]
    const [moved] = nextSiblings.splice(oldIndex, 1)
    nextSiblings.splice(newIndex, 0, moved)

    await Promise.all(
      nextSiblings.map((item, index) => window.electronAPI.database.updateItemSortOrder(item.id, index))
    )
    await refreshAfterMutation()
  }, [items, refreshAfterMutation])

  const reorderKrs = useCallback(async (activeKrId: string, overKrId: string) => {
    if (!activeKrId || !overKrId || activeKrId === overKrId) return

    const siblings = sortByOrder(items.filter((item) => item.parent_id === objective.id && item.type === 'KR'))
    const oldIndex = siblings.findIndex((item) => item.id === activeKrId)
    const newIndex = siblings.findIndex((item) => item.id === overKrId)
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    const nextSiblings = [...siblings]
    const [moved] = nextSiblings.splice(oldIndex, 1)
    nextSiblings.splice(newIndex, 0, moved)

    await Promise.all(
      nextSiblings.map((item, index) => window.electronAPI.database.updateItemSortOrder(item.id, index))
    )
    await refreshAfterMutation()
  }, [items, objective.id, refreshAfterMutation])

  const saveTitle = useCallback(async (id: string, value: string) => {
    const nextTitle = value.trim()
    setEditingTarget(null)
    if (!nextTitle) {
      const currentItem = items.find((item) => item.id === id)
      if (currentItem?.type === 'TODO' || currentItem?.type === 'KR') {
        await window.electronAPI.database.deleteItem(id)
        await refreshAfterMutation()
      }
      return
    }
    await window.electronAPI.database.updateItem(id, { title: nextTitle })
    await refreshAfterMutation()
  }, [items, refreshAfterMutation])

  const createKr = useCallback(async () => {
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'KR',
      parent_id: objective.id,
      title: '',
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    await refreshAfterMutation()
    setEditingTarget({ id: newId, kind: 'kr', value: '' })
  }, [objective.id, refreshAfterMutation])

  const createTodo = useCallback(async (krId: string) => {
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'TODO',
      parent_id: krId,
      title: '',
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    await refreshAfterMutation()
    setEditingTarget({ id: newId, kind: 'todo', value: '' })
  }, [refreshAfterMutation])

  const submitTodoAndCreateNext = useCallback(async (todoId: string, krId: string, value: string) => {
    const nextTitle = value.trim()
    await saveTitle(todoId, value)
    if (!nextTitle) return
    await createTodo(krId)
  }, [createTodo, saveTitle])

  const toggleTodo = useCallback(async (todo: Item) => {
    const nextStatus = todo.status === 1 ? 0 : 1
    await window.electronAPI.database.updateItem(todo.id, { status: nextStatus })
    if (window.electronAPI?.dailyTasks?.getAllTasks) {
      const allTasks = await window.electronAPI.dailyTasks.getAllTasks()
      const linkedTasks = allTasks.filter((task: { sourceItemId?: string | null; linkedGoalId?: string | null }) =>
        (task.sourceItemId ?? task.linkedGoalId) === todo.id
      )
      await Promise.all(
        linkedTasks.map((task: { id: string }) => window.electronAPI.dailyTasks.updateTask(task.id, { isDone: nextStatus === 1 }))
      )
    }
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  const deleteItem = useCallback(async (id: string) => {
    setOpenKrMenuId(null)
    const result = await window.electronAPI.database.deleteItem(id)
    const deletedIds = result?.deletedIds || [id]
    if (window.electronAPI?.dailyTasks?.getAllTasks) {
      const allTasks = await window.electronAPI.dailyTasks.getAllTasks()
      const linkedTasks = allTasks.filter((task: { sourceItemId?: string | null; linkedGoalId?: string | null }) =>
        deletedIds.includes((task.sourceItemId ?? task.linkedGoalId) || '')
      )
      await Promise.all(linkedTasks.map((task: { id: string }) => window.electronAPI.dailyTasks.deleteTask(task.id)))
    }
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  useEffect(() => {
    if (!openKrMenuId) return

    const handleClick = () => setOpenKrMenuId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openKrMenuId])

  useEffect(() => {
    if (!boardMenuPosition) return

    const handleClick = () => setBoardMenuPosition(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [boardMenuPosition])

  useEffect(() => {
    if (!isDeadlineEditorOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!deadlineEditorRef.current?.contains(event.target as Node)) {
        closeDeadlineEditor()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDeadlineEditor()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [closeDeadlineEditor, isDeadlineEditorOpen])

  useEffect(() => {
    return () => {
      if (todoHighlightTimerRef.current) {
        window.clearTimeout(todoHighlightTimerRef.current)
      }
      if (floatingTaskHighlightTimerRef.current) {
        window.clearTimeout(floatingTaskHighlightTimerRef.current)
      }
    }
  }, [])

  const scrollBoardElementIntoView = useCallback((element: HTMLElement) => {
    const scrollContainer = boardScrollRef.current
    if (!scrollContainer) return

    const containerRect = scrollContainer.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const safeVisibleRight = containerRect.right - FLOATING_PANEL_SAFE_RIGHT_PADDING - 40
    const safeVisibleLeft = containerRect.left + 36

    const currentScrollLeft = scrollContainer.scrollLeft
    let nextScrollLeft = currentScrollLeft

    if (elementRect.right > safeVisibleRight) {
      nextScrollLeft += elementRect.right - safeVisibleRight
    }

    if (elementRect.left < safeVisibleLeft) {
      nextScrollLeft -= safeVisibleLeft - elementRect.left
    }

    const maxScrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth
    const clampedScrollLeft = Math.max(0, Math.min(nextScrollLeft, Math.max(0, maxScrollLeft)))

    scrollContainer.scrollTo({
      left: clampedScrollLeft,
      behavior: 'smooth',
    })

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    })
  }, [])

  const highlightFloatingTask = useCallback((taskId: string) => {
    setHighlightedFloatingTaskId(taskId)
    if (floatingTaskHighlightTimerRef.current) {
      window.clearTimeout(floatingTaskHighlightTimerRef.current)
    }
    floatingTaskHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedFloatingTaskId((current) => (current === taskId ? null : current))
      floatingTaskHighlightTimerRef.current = null
    }, 1350)

    window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-taskboard-task-id="${taskId}"]`)
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }, [])

  const focusKrInBoard = useCallback((krId: string) => {
    setHighlightedKrId(krId)
    setHighlightedTodoId(null)
    if (todoHighlightTimerRef.current) {
      window.clearTimeout(todoHighlightTimerRef.current)
    }
    todoHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedKrId((current) => (current === krId ? null : current))
      todoHighlightTimerRef.current = null
    }, 1350)

    window.requestAnimationFrame(() => {
      const element = krColumnRefs.current.get(krId)
      if (!element) return
      scrollBoardElementIntoView(element)
    })
  }, [scrollBoardElementIntoView])

  const focusTodoInBoard = useCallback((todoId: string) => {
    setHighlightedKrId(null)
    setHighlightedTodoId(todoId)
    if (todoHighlightTimerRef.current) {
      window.clearTimeout(todoHighlightTimerRef.current)
    }
    todoHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedTodoId((current) => (current === todoId ? null : current))
      todoHighlightTimerRef.current = null
    }, 1350)

    window.requestAnimationFrame(() => {
      const element = todoItemRefs.current.get(todoId)
      if (!element) return
      scrollBoardElementIntoView(element)
    })
  }, [scrollBoardElementIntoView])

  const handleBoardTodoSelect = useCallback((todo: Item) => {
    const linkedTask = tasks.find((task) => (task.sourceItemId ?? task.linkedGoalId) === todo.id)
    if (!linkedTask) return
    highlightFloatingTask(linkedTask.id)
  }, [highlightFloatingTask, tasks])

  const handleBoardKrSelect = useCallback((kr: Item) => {
    const linkedTask = tasks.find((task) => (task.sourceItemId ?? task.linkedGoalId) === kr.id)
    if (!linkedTask) return
    highlightFloatingTask(linkedTask.id)
  }, [highlightFloatingTask, tasks])

  const handleFloatingPanelSetActiveObjective = useCallback((itemId: string) => {
    const targetItem = items.find((item) => item.id === itemId) || null
    if (!targetItem) return

    let targetObjective: Item | null = null
    let pendingFocus: { type: 'KR' | 'TODO'; id: string } | null = null

    if (targetItem.type === 'TODO') {
      const targetKr = items.find((item) => item.id === targetItem.parent_id && item.type === 'KR') || null
      if (!targetKr) return
      targetObjective = items.find((item) => item.id === targetKr.parent_id && item.type === 'O') || null
      pendingFocus = { type: 'TODO', id: targetItem.id }
    } else if (targetItem.type === 'KR') {
      targetObjective = items.find((item) => item.id === targetItem.parent_id && item.type === 'O') || null
      pendingFocus = { type: 'KR', id: targetItem.id }
    } else if (targetItem.type === 'O') {
      targetObjective = targetItem
    }

    if (!targetObjective) return

    pendingBoardFocusRef.current = pendingFocus

    if (targetObjective.id !== objective.id) {
      onSwitchObjectiveBoard?.({
        id: targetObjective.id,
        title: targetObjective.title,
        color: targetObjective.color ?? null,
      })
      return
    }

    if (pendingFocus?.type === 'TODO') {
      focusTodoInBoard(pendingFocus.id)
    } else if (pendingFocus?.type === 'KR') {
      focusKrInBoard(pendingFocus.id)
    }
  }, [focusKrInBoard, focusTodoInBoard, items, objective.id, onSwitchObjectiveBoard])

  useEffect(() => {
    const pendingFocus = pendingBoardFocusRef.current
    if (!pendingFocus) return

    if (pendingFocus.type === 'TODO') {
      const targetTodo = items.find((item) => item.id === pendingFocus.id && item.type === 'TODO') || null
      if (!targetTodo) return

      const targetKr = items.find((item) => item.id === targetTodo.parent_id && item.type === 'KR') || null
      if (!targetKr || targetKr.parent_id !== objective.id) return

      pendingBoardFocusRef.current = null
      focusTodoInBoard(targetTodo.id)
      return
    }

    const targetKr = items.find((item) => item.id === pendingFocus.id && item.type === 'KR') || null
    if (!targetKr || targetKr.parent_id !== objective.id) return

    pendingBoardFocusRef.current = null
    focusKrInBoard(targetKr.id)
  }, [focusKrInBoard, focusTodoInBoard, items, objective.id])

  useEffect(() => {
    if (isFloatingPanelPrepared) return

    const preparePanel = () => setIsFloatingPanelPrepared(true)
    const requestIdle = (window as Window & { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback

    if (requestIdle) {
      const idleId = requestIdle(preparePanel)
      return () => window.cancelIdleCallback?.(idleId)
    }

    const timer = window.setTimeout(preparePanel, 180)
    return () => window.clearTimeout(timer)
  }, [isFloatingPanelPrepared])

  const openFloatingPanel = useCallback(() => {
    setIsFloatingPanelPrepared(true)
    setIsFloatingPanelOpen(true)
  }, [])

  const closeFloatingPanel = useCallback(() => {
    setIsFloatingPanelOpen(false)
    setIsFloatingSafeAreaActive(false)
  }, [])

  useEffect(() => {
    if (!isFloatingPanelOpen) return

    // 让浮窗先完成进场，再补安全区，避免和浮窗显隐同时触发布局动画。
    const timer = window.setTimeout(() => {
      setIsFloatingSafeAreaActive(true)
    }, 90)

    return () => window.clearTimeout(timer)
  }, [isFloatingPanelOpen])

  const boardRightPadding = isFloatingSafeAreaActive ? FLOATING_PANEL_SAFE_RIGHT_PADDING : BOARD_BASE_RIGHT_PADDING

  const openVisionDialog = useCallback(() => {
    setIsVisionDialogOpen(true)
  }, [])

  const closeVisionDialog = useCallback(() => {
    setIsVisionDialogOpen(false)
  }, [])

  const appendVisionMessage = useCallback((payload: { text: string; imageDataUrls: string[] }) => {
    const nextMessage: VisionMessage = {
      id: crypto.randomUUID(),
      text: payload.text,
      createdAt: Date.now(),
      imageDataUrls: payload.imageDataUrls,
    }
    setVisionMessages((prev) => [...prev, nextMessage])
  }, [])

  useDndMonitor({
    onDragStart: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      if (activeData?.dragKind === 'objective-board-kr-sort') {
        setActiveKrSortId(String(event.active.id))
      } else if (activeData?.dragKind === 'objective-board-todo-sort') {
        setActiveTodoSortId(String(event.active.id))
      }
    },
    onDragEnd: (event) => {
      const activeData = event.active.data.current as { dragKind?: string; krId?: string; todoId?: string } | undefined
      const overData = event.over?.data.current as { dragKind?: string; krId?: string; todoId?: string } | undefined

      setActiveKrSortId(null)
      setActiveTodoSortId(null)

      if (
        activeData?.dragKind === 'objective-board-kr-sort' &&
        overData?.dragKind === 'objective-board-kr-sort' &&
        activeData.krId &&
        overData.krId
      ) {
        void reorderKrs(activeData.krId, overData.krId)
        return
      }

      if (
        activeData?.dragKind !== 'objective-board-todo-sort' ||
        overData?.dragKind !== 'objective-board-todo-sort' ||
        !activeData.todoId ||
        !overData?.todoId ||
        !activeData.krId ||
        activeData.krId !== overData.krId
      ) {
        return
      }

      void reorderTodos(activeData.todoId, overData.todoId, activeData.krId)
    },
    onDragCancel: () => {
      setActiveKrSortId(null)
      setActiveTodoSortId(null)
    },
  })

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-gray-400">加载中...</div>
  }

  if (error || !boardObjective) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-red-500">{error || '目标不存在'}</div>
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-[var(--color-ink-primary)]">
      <style>{`
        @keyframes objective-board-linked-pulse {
          0%, 100% {
            background-color: rgba(246,70,93,0.05);
            border-color: rgba(246,70,93,0.34);
          }
          50% {
            background-color: rgba(246,70,93,0.11);
            border-color: rgba(246,70,93,0.48);
          }
        }
        .objective-board-linked-pulse {
          animation: objective-board-linked-pulse 420ms ease-in-out 2;
          will-change: background-color, border-color;
        }
        .objective-board-linked-overlay-pulse {
          animation: objective-board-linked-pulse 420ms ease-in-out 2;
          will-change: background-color;
        }
        @keyframes objective-board-toast-drop {
          0% {
            opacity: 0;
            transform: translate(-50%, -14px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }
        .objective-board-toast-drop {
          animation: objective-board-toast-drop 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
      <div className="traffic-light-space flex-shrink-0" />

      <div className="px-7 pb-8 pt-2">
        <div className="min-w-0">
          <div className="min-w-0">
            {editingTarget?.id === boardObjective.id ? (
              <input
                autoFocus
                value={editingTarget.value}
                onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                onBlur={() => void saveTitle(boardObjective.id, editingTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveTitle(boardObjective.id, editingTarget.value)
                  if (e.key === 'Escape') setEditingTarget(null)
                }}
                className="typo-title-heading w-[520px] max-w-full border-none p-0 tracking-[-0.02em] outline-none"
                style={{ color: activeColor }}
              />
            ) : (
              <button
                type="button"
                onDoubleClick={() => setEditingTarget({ id: boardObjective.id, kind: 'objective', value: boardObjective.title })}
                className="typo-title-heading w-full text-left tracking-[-0.02em]"
                style={{ color: activeColor }}
              >
                {boardObjective.title}
              </button>
            )}
          </div>

          <div className="mt-2 flex max-w-[760px] flex-col gap-1.5">
            <div ref={deadlineEditorRef} className="relative">
              <button
                type="button"
                onClick={openDeadlineEditor}
                className="flex w-full items-start gap-2 rounded-[10px] px-1 py-0.5 text-left text-[14px] leading-[1.55] text-[#6d7482] transition-colors hover:bg-black/[0.03] hover:text-[#575f6f]"
              >
                <CalendarDays className="mt-[2px] h-4 w-4 flex-shrink-0 text-[var(--color-ink-subtle)]" strokeWidth={1.9} />
                <span className="min-w-0 flex-1 truncate">
                  {objectiveDeadlineMeta ? (
                    <>
                      <span className={`font-medium ${objectiveDeadlineMeta.tone}`}>{objectiveDeadlineMeta.countdown}</span>
                      <span className="ml-2 text-[var(--color-ink-disabled)]">{objectiveDeadlineMeta.date}</span>
                    </>
                  ) : (
                    <span className="text-[var(--color-ink-disabled)]">添加截止日期</span>
                  )}
                </span>
              </button>

              {isDeadlineEditorOpen ? (
                <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-[280px] rounded-[14px] border border-black/[0.06] bg-white/95 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                  <div className="text-[12px] font-medium text-[var(--color-ink-tertiary)]">设置截止日期</div>
                  <input
                    autoFocus
                    type="date"
                    value={deadlineDraft}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      setDeadlineDraft(nextValue)
                      if (!nextValue) {
                        setDeadlineError('')
                        return
                      }
                      if (isObjectiveDeadlineTooFar(nextValue)) {
                        setDeadlineError(`截止日期最长只能设置到 ${MAX_OBJECTIVE_DEADLINE_DAYS} 天内`)
                        return
                      }
                      setDeadlineError('')
                    }}
                    className={`mt-2 w-full rounded-[10px] border bg-white px-3 py-2 text-[13px] text-[var(--color-ink-primary)] outline-none focus:border-black/30 ${
                      deadlineError ? 'border-[#f6465d]/40' : 'border-black/[0.08]'
                    }`}
                  />
                  <div className={`mt-2 text-[12px] ${deadlineError ? 'text-[#d14a5f]' : 'text-[var(--color-ink-disabled)]'}`}>
                    {deadlineError || `最多支持 ${MAX_OBJECTIVE_DEADLINE_DAYS} 天，左侧决定是否显示倒计时图标`}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void saveObjectiveDeadline()}
                      disabled={!deadlineDraft || Boolean(deadlineError)}
                      className="rounded-[10px] bg-[var(--color-ink-strong)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => void clearObjectiveDeadline()}
                      className="rounded-[10px] border border-black/[0.08] px-3 py-1.5 text-[12px] font-medium text-[#4c5563] transition-colors hover:bg-black/[0.03]"
                    >
                      清除
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={openVisionDialog}
              className="flex w-full items-start gap-2 rounded-[10px] px-1 py-0.5 text-left text-[14px] leading-[1.55] text-[#6d7482] transition-colors hover:bg-black/[0.03] hover:text-[#575f6f]"
            >
              <Eye className="mt-[2px] h-4 w-4 flex-shrink-0 text-[var(--color-ink-subtle)]" strokeWidth={1.9} />
              <span className="min-w-0 flex-1 truncate">{latestVisionPreview}</span>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={boardScrollRef}
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 pb-8"
        onContextMenu={(e) => {
          e.preventDefault()
          setOpenKrMenuId(null)
          setBoardMenuPosition({ x: e.clientX, y: e.clientY })
        }}
      >
        <SortableContext items={krColumns.map((kr) => `objective-board-kr:${kr.id}`)} strategy={horizontalListSortingStrategy}>
          <div
            className="flex min-h-full w-max gap-4"
            style={{ paddingRight: `${boardRightPadding}px` }}
          >
            {krColumns.map((kr, index) => (
              <SortableKrColumn
                key={kr.id}
                kr={kr}
                columnIndex={index}
                dragColor={activeColor}
                editingTarget={editingTarget}
                isSorting={activeKrSortId === `objective-board-kr:${kr.id}`}
                isHighlighted={highlightedKrId === kr.id}
                openKrMenuId={openKrMenuId}
                activeTodoSortId={activeTodoSortId}
                highlightedTodoId={highlightedTodoId}
                krColumnRef={(element) => {
                  if (element) {
                    krColumnRefs.current.set(kr.id, element)
                  } else {
                    krColumnRefs.current.delete(kr.id)
                  }
                }}
                todoItemRefs={todoItemRefs}
                onSelectKr={handleBoardKrSelect}
                onEditTargetChange={setEditingTarget}
                onSaveTitle={saveTitle}
                onToggleKrMenu={setOpenKrMenuId}
                onDeleteKr={deleteItem}
                onCreateTodo={createTodo}
                onSelectTodo={handleBoardTodoSelect}
                onToggleTodo={toggleTodo}
                onSubmitTodoAndCreateNext={submitTodoAndCreateNext}
              />
            ))}
          </div>
        </SortableContext>
        {boardMenuPosition ? (
          <div
            className="fixed z-30 min-w-[132px] rounded-[12px] border border-black/[0.06] bg-white/95 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl"
            style={{ left: boardMenuPosition.x, top: boardMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                setBoardMenuPosition(null)
                void createKr()
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[14px] font-medium text-[#3a3e45] transition-colors hover:bg-[#f5f6f8]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              添加分栏
            </button>
          </div>
        ) : null}
      </div>

      <VisionDialog
        open={isVisionDialogOpen}
        messages={visionMessages}
        onClose={closeVisionDialog}
        onAppendMessage={appendVisionMessage}
      />

      {isFloatingPanelPrepared ? (
        <div
          className={`fixed inset-y-6 right-6 z-[220] flex w-[460px] max-w-[calc(100vw-36px)] flex-col overflow-hidden rounded-[18px] border transition-[opacity,transform] duration-180 ease-out ${
            isFloatingPanelOpen
              ? 'translate-y-0 opacity-100 pointer-events-auto'
              : 'translate-y-3 opacity-0 pointer-events-none'
          }`}
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,249,251,0.96) 100%)',
            borderColor: 'rgba(215,220,228,0.88)',
            boxShadow: '0 18px 42px rgba(15,23,42,0.14)',
            willChange: 'transform, opacity',
          }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              closeFloatingPanel()
            }}
            className="app-no-drag absolute right-3 top-3 z-[240] flex h-8 w-8 items-center justify-center text-[#7f8793] transition-colors hover:text-[#5f6673]"
            aria-label="关闭面板"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <TodayFloatingTaskBoard
              tasks={tasks}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              onCreateTask={onCreateTask}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onUpdateTaskContent={onUpdateTaskContent}
              onMoveTaskToToday={onMoveTaskToToday}
              onSetActiveObjective={handleFloatingPanelSetActiveObjective}
              isPastDate={isPastDate}
              relationHighlightedTaskId={highlightedFloatingTaskId}
              onReorderTasks={onReorderTasks}
              onExecutionItemsChanged={onObjectiveChanged}
              okrRefreshTrigger={refreshTrigger}
            />
          </div>
          {dragNotice ? (
            <div className="pointer-events-none absolute left-1/2 top-[22%] z-40 -translate-x-1/2 objective-board-toast-drop">
              <div className="rounded-full border border-white/10 bg-[rgba(39,39,41,0.92)] px-4 py-2 text-[14px] font-medium text-white shadow-[0_16px_32px_rgba(15,23,42,0.24)] backdrop-blur-xl">
                {dragNotice}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={openFloatingPanel}
        aria-label={isFloatingPanelOpen ? '关闭今日待办' : '打开今日待办'}
        className={`absolute bottom-10 right-10 z-[210] flex h-[68px] w-[68px] items-center justify-center rounded-full border text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
          isFloatingPanelOpen ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'
        }`}
        style={{
          background: 'var(--color-ink-strong)',
          borderColor: 'rgba(255,255,255,0.88)',
          boxShadow: '0 18px 34px rgba(15,23,42,0.22)',
        }}
      >
        <span className="select-none text-[28px] font-bold leading-none tracking-[-0.04em] text-white">
          今
        </span>
      </button>

    </div>
  )
}

interface VisionDialogProps {
  open: boolean
  messages: VisionMessage[]
  onClose: () => void
  onAppendMessage: (payload: { text: string; imageDataUrls: string[] }) => void
}

const VisionDialog: React.FC<VisionDialogProps> = React.memo(({ open, messages, onClose, onAppendMessage }) => {
  const [draft, setDraft] = useState('')
  const [draftImages, setDraftImages] = useState<string[]>([])
  const [resizeVersion, setResizeVersion] = useState(0)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const canSend = draft.trim().length > 0 || draftImages.length > 0

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const lineHeight = 28
    const minHeight = lineHeight
    const maxHeight = lineHeight * 5

    textarea.style.height = '0px'
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight))
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  const handleImageChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files
    if (!fileList || fileList.length === 0) return

    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (files.length === 0) return

    try {
      const nextImages = await Promise.all(files.map((file) => readFileAsDataUrl(file)))
      setDraftImages((prev) => [...prev, ...nextImages])
    } catch (imageError) {
      console.error('[ObjectiveBoard] 愿景图片读取失败:', imageError)
    } finally {
      event.target.value = ''
    }
  }, [])

  const removeImage = useCallback((indexToDelete: number) => {
    setDraftImages((prev) => prev.filter((_, index) => index !== indexToDelete))
  }, [])

  const handleSubmit = useCallback(() => {
    const text = draft.trim()
    if (!text && draftImages.length === 0) return

    onAppendMessage({
      text,
      imageDataUrls: draftImages,
    })
    setDraft('')
    setDraftImages([])
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      adjustTextareaHeight()
    })
  }, [adjustTextareaHeight, draft, draftImages, onAppendMessage])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
      adjustTextareaHeight()
    })
  }, [adjustTextareaHeight, open])

  useEffect(() => {
    adjustTextareaHeight()
  }, [adjustTextareaHeight, draft])

  useEffect(() => {
    if (!open) return

    let frameId = 0
    const handleResize = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        setResizeVersion((prev) => prev + 1)
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-5">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/[0.22]"
        aria-label="关闭愿景弹窗"
      />
      <section
        className="relative z-10 flex h-[min(780px,calc(100vh-44px))] w-[min(920px,calc(100vw-36px))] flex-col overflow-hidden rounded-[26px] border border-black/[0.08] bg-[#f6f6f5] shadow-[0_28px_54px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
        aria-label="愿景对话"
      >
        <div className="flex items-center justify-between border-b border-black/[0.06] bg-[linear-gradient(180deg,#ffffff,#f8f8f7)] px-6 py-4">
          <div>
            <div className="typo-body-emphasis text-[#262d38]">愿景记录</div>
            <div className="text-[12px] text-[#8a909c]">写给自己的阶段性想法与提醒</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#7c8492] transition-colors hover:bg-black/[0.05]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-6">
          {messages.length === 0 ? (
            <div className="pt-10 text-center text-[14px] text-black/28">先写下第一条愿景记录</div>
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <article key={message.id} className="grid grid-cols-[108px_minmax(0,1fr)] items-start gap-x-3">
                  <div className="flex items-center gap-1.5 pt-1 text-[14px] text-black/32">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#cf9a61] shadow-[0_0_0_1px_rgba(207,154,97,0.14)]" />
                    <span>{formatVisionDateTime(message.createdAt)}</span>
                  </div>
                  <div className="space-y-2 pr-1">
                    {message.text ? <VisionMessageText text={message.text} resizeVersion={resizeVersion} /> : null}
                    {message.imageDataUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {message.imageDataUrls.map((url, imageIndex) => (
                          <div key={`${message.id}-image-${imageIndex}`} className="h-16 w-16 overflow-hidden rounded-[12px] border border-black/[0.08] bg-[#ece8e0]">
                            <img src={url} alt="愿景附件" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-black/[0.06] bg-white px-5 py-4">
          <div className="rounded-[24px] border border-black/[0.08] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onInput={adjustTextareaHeight}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                  event.preventDefault()
                  handleSubmit()
                }
              }}
              rows={1}
              placeholder="现在的想法是..."
              className="w-full resize-none border-none bg-transparent text-[14px] leading-7 text-[#202631] outline-none placeholder:text-black/28"
            />

            {draftImages.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {draftImages.map((url, index) => (
                  <div key={`vision-draft-image-${index}`} className="group relative h-[74px] w-[74px] overflow-hidden rounded-[14px] border border-black/[0.08] bg-[#ece8e0]">
                    <img src={url} alt="待发送附件" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/58 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="移除图片"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] px-3 text-[14px] font-medium text-[#6f7684] transition-colors hover:bg-black/[0.03]"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={1.9} />
                添加照片
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
                  canSend
                    ? 'border-[#8b7663] bg-[#8b7663] text-white hover:bg-[#7f6b59] hover:border-[#7f6b59]'
                    : 'border-[#dfddda] bg-[#e7e5e2] text-white'
                }`}
                aria-label="发送愿景内容"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.4]" />
              </button>
            </div>

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </div>
      </section>
    </div>
  )
})

const VisionMessageText: React.FC<{ text: string; resizeVersion: number }> = ({ text, resizeVersion }) => {
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const measureRef = useRef<HTMLParagraphElement | null>(null)

  const checkOverflow = useCallback(() => {
    const measureEl = measureRef.current
    if (!measureEl) return

    const lineHeight = Number.parseFloat(window.getComputedStyle(measureEl).lineHeight || '24')
    const maxHeight = lineHeight * 4
    const overflow = measureEl.scrollHeight > maxHeight + 1
    setCanExpand(overflow)
    if (!overflow) {
      setExpanded(false)
    }
  }, [])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(checkOverflow)
    return () => window.cancelAnimationFrame(frameId)
  }, [checkOverflow, resizeVersion, text])

  return (
    <div className="relative">
      <p
        className="whitespace-pre-wrap text-[17px] font-semibold leading-[1.5] text-[#232a36]"
        style={!expanded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      <p
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 w-full whitespace-pre-wrap text-[17px] font-semibold leading-[1.5] opacity-0"
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-[14px] font-medium text-[#7c8594] transition-colors hover:text-[#5c6574]"
        >
          {expanded ? '收起' : '展开'}
        </button>
      ) : null}
    </div>
  )
}

interface SortableTodoCardProps {
  krId: string
  todo: Item
  dragColor?: string | null
  editingTarget: EditingTarget
  isSorting: boolean
  isHighlighted: boolean
  todoItemRef?: (element: HTMLDivElement | null) => void
  onSelectTodo?: (todo: Item) => void
  onToggleTodo: (todo: Item) => void | Promise<void>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
  onSubmitTodoAndCreateNext: (todoId: string, krId: string, value: string) => void | Promise<void>
  onEditTargetChange: React.Dispatch<React.SetStateAction<EditingTarget>>
}

interface KrColumnItem extends Item {
  todos: Item[]
}

interface SortableKrColumnProps {
  kr: KrColumnItem
  columnIndex: number
  dragColor?: string | null
  editingTarget: EditingTarget
  isSorting: boolean
  isHighlighted: boolean
  openKrMenuId: string | null
  activeTodoSortId: string | null
  highlightedTodoId: string | null
  krColumnRef?: (element: HTMLDivElement | null) => void
  onSelectKr?: (kr: Item) => void
  todoItemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onSelectTodo?: (todo: Item) => void
  onEditTargetChange: React.Dispatch<React.SetStateAction<EditingTarget>>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
  onToggleKrMenu: React.Dispatch<React.SetStateAction<string | null>>
  onDeleteKr: (id: string) => void | Promise<void>
  onCreateTodo: (krId: string) => void | Promise<void>
  onToggleTodo: (todo: Item) => void | Promise<void>
  onSubmitTodoAndCreateNext: (todoId: string, krId: string, value: string) => void | Promise<void>
}

const SortableKrColumn: React.FC<SortableKrColumnProps> = ({
  kr,
  columnIndex,
  dragColor,
  editingTarget,
  isSorting,
  isHighlighted,
  openKrMenuId,
  activeTodoSortId,
  highlightedTodoId,
  krColumnRef,
  onSelectKr,
  todoItemRefs,
  onSelectTodo,
  onEditTargetChange,
  onSaveTitle,
  onToggleKrMenu,
  onDeleteKr,
  onCreateTodo,
  onToggleTodo,
  onSubmitTodoAndCreateNext,
}) => {
  const sortableId = `objective-board-kr:${kr.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      dragKind: 'objective-board-kr-sort',
      krId: kr.id,
      id: kr.id,
      title: kr.title || '未命名关键结果',
      content: kr.content || kr.title || '未命名关键结果',
      type: 'KR',
      color: dragColor ?? null,
      parentId: kr.parent_id,
      iconType: 'keyresult',
      level: 2,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const cardTheme = KR_CARD_THEMES[columnIndex % KR_CARD_THEMES.length]

  return (
    <div
      ref={(element) => {
        setNodeRef(element)
        krColumnRef?.(element)
      }}
      style={style}
      className={`w-[304px] flex-shrink-0 ${isDragging || isSorting ? 'z-10 opacity-90' : ''}`}
      data-kr-column="true"
      {...attributes}
      {...listeners}
    >
      <article
        onClick={() => onSelectKr?.(kr)}
        className={`relative overflow-hidden rounded-[16px] border p-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${cardTheme.shell} ${
          isDragging || isSorting ? 'shadow-[0_22px_48px_rgba(15,23,42,0.16)]' : ''
        } ${
          isHighlighted
            ? 'objective-board-linked-pulse border-dashed border-[rgba(246,70,93,0.34)]'
            : ''
        }`}
        style={cardTheme.shellStyle}
      >
        {isHighlighted ? (
          <div className="pointer-events-none absolute inset-0 z-0 objective-board-linked-overlay-pulse bg-[rgba(246,70,93,0.05)]" />
        ) : null}
        <div className="px-4 pb-3 pt-3" style={cardTheme.topStyle}>
          <div className="flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
              {editingTarget?.id === kr.id ? (
                <input
                  autoFocus
                  value={editingTarget.value}
                  onChange={(e) => onEditTargetChange({ ...editingTarget, value: e.target.value })}
                  onBlur={() => void onSaveTitle(kr.id, editingTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void onSaveTitle(kr.id, editingTarget.value)
                    if (e.key === 'Escape') onEditTargetChange(null)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="新关键结果"
                  className="w-full border-none bg-transparent p-0 text-[17px] font-bold tracking-[-0.01em] text-white outline-none"
                  style={{ fontFamily: KR_HEADER_FONT_FAMILY }}
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onEditTargetChange({ id: kr.id, kind: 'kr', value: kr.title })
                  }}
                  className="w-full truncate text-left text-[17px] font-bold tracking-[-0.01em] text-white"
                  style={{ fontFamily: KR_HEADER_FONT_FAMILY }}
                >
                  {kr.title}
                </button>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleKrMenu((current) => (current === kr.id ? null : kr.id))
                }}
                className="rounded-md p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" strokeWidth={1.7} />
              </button>
              {openKrMenuId === kr.id ? (
                <div
                  className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[112px] rounded-[12px] border border-black/[0.06] bg-white/95 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => void onDeleteKr(kr.id)}
                    className="w-full rounded-[10px] px-3 py-2 text-left text-[14px] font-medium text-[#c26a64] transition-colors hover:bg-[#fff3f2]"
                  >
                    删除列
                  </button>
                </div>
              ) : null}
            </div>
          </div>

        </div>

        <div className="relative px-4 pb-4 pt-3" style={cardTheme.bodyStyle}>
          <div className="mb-1 flex items-center justify-between pl-1 pr-0.5">
            <span className="text-[12px] font-semibold tracking-[0.01em] text-[#7d8592]">TODO</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void onCreateTodo(kr.id)
              }}
              className="flex h-7 w-7 items-center justify-center text-[#5a6473] transition-colors hover:text-[#3f4856]"
              aria-label="新增待办"
              title="新增待办"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>

          <div className="mt-2">
            <SortableContext items={kr.todos.map((todo) => `objective-board-todo:${todo.id}`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {kr.todos.map((todo) => (
                  <SortableTodoCard
                    key={todo.id}
                    krId={kr.id}
                    todo={todo}
                    dragColor={dragColor}
                    editingTarget={editingTarget}
                    isSorting={activeTodoSortId === `objective-board-todo:${todo.id}`}
                    isHighlighted={highlightedTodoId === todo.id}
                    todoItemRef={(element) => {
                      if (element) {
                        todoItemRefs.current.set(todo.id, element)
                      } else {
                        todoItemRefs.current.delete(todo.id)
                      }
                    }}
                    onSelectTodo={onSelectTodo}
                    onToggleTodo={onToggleTodo}
                    onSaveTitle={onSaveTitle}
                    onSubmitTodoAndCreateNext={onSubmitTodoAndCreateNext}
                    onEditTargetChange={onEditTargetChange}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>
      </article>
    </div>
  )
}

const SortableTodoCard: React.FC<SortableTodoCardProps> = ({
  krId,
  todo,
  dragColor,
  editingTarget,
  isSorting,
  isHighlighted,
  todoItemRef,
  onSelectTodo,
  onToggleTodo,
  onSaveTitle,
  onSubmitTodoAndCreateNext,
  onEditTargetChange,
}) => {
  const [threadPreview, setThreadPreview] = useState('')
  const [isThreadPopoverOpen, setIsThreadPopoverOpen] = useState(false)
  const sortableId = `objective-board-todo:${todo.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      dragKind: 'objective-board-todo-sort',
      krId,
      todoId: todo.id,
      id: todo.id,
      title: todo.title || '未命名待办',
      content: todo.content || todo.title || '未命名待办',
      type: 'TODO',
      color: dragColor ?? null,
      parentId: krId,
      iconType: 'todo',
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    const storageId = `item:${todo.id}`
    const syncPreview = () => setThreadPreview(getLatestTodoThreadPreview(storageId))

    syncPreview()
    return subscribeTodoThreadUpdates(syncPreview)
  }, [todo.id])

  return (
    <div
      ref={setNodeRef}
      data-objective-board-todo-id={todo.id}
      style={style}
      className={`rounded-[12px] ${
        isDragging || isSorting ? 'z-10 opacity-80 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.12)]' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div
        ref={todoItemRef}
        onClick={(event) => {
          event.stopPropagation()
          onSelectTodo?.(todo)
        }}
        className={`group/todo rounded-[10px] px-2.5 py-2 text-left transition-all duration-300 ${
          isThreadPopoverOpen ? 'bg-black/[0.045]' : 'hover:bg-black/[0.035]'
        } ${
          isHighlighted
            ? 'objective-board-linked-pulse border border-dashed border-[rgba(246,70,93,0.34)] bg-[rgba(246,70,93,0.05)]'
            : ''
        }`}
      >
        <div className="grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void onToggleTodo(todo)
            }}
            className={`row-start-1 self-center flex h-4 w-4 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
              todo.status === 1 ? 'border-[#8d9199] bg-[#8d9199]' : 'border-[var(--color-border-muted)] bg-transparent'
            }`}
          >
            {todo.status === 1 ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
          </button>

          <div className="col-start-2 row-start-1 flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              {editingTarget?.id === todo.id ? (
                <input
                  autoFocus
                  value={editingTarget.value}
                  onChange={(e) => onEditTargetChange({ ...editingTarget, value: e.target.value })}
                  onBlur={() => void onSaveTitle(todo.id, editingTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void onSubmitTodoAndCreateNext(todo.id, krId, editingTarget.value)
                    }
                    if (e.key === 'Escape') onEditTargetChange(null)
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  placeholder="添加 TODO"
                  className="w-full border-none bg-transparent p-0 text-[14px] font-medium leading-5 text-[var(--color-ink-secondary)] outline-none"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onEditTargetChange({ id: todo.id, kind: 'todo', value: todo.title })
                  }}
                  className={`w-full text-left text-[14px] font-medium leading-5 focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                    todo.status === 1 ? 'text-[#9a9ea8] line-through' : 'text-[var(--color-ink-secondary)]'
                  }`}
                >
                  {todo.title || '未命名待办'}
                </button>
              )}
            </div>

            <div className="flex h-5 flex-shrink-0 items-center">
              <div
                className={`transition-opacity duration-150 ${
                  isThreadPopoverOpen
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0 group-hover/todo:pointer-events-auto group-hover/todo:opacity-100'
                }`}
              >
                <TodoThreadPopover
                  entityId={todo.id}
                  entityKind="item"
                  title={todo.title || '未命名待办'}
                  onOpenChange={setIsThreadPopoverOpen}
                />
              </div>
            </div>
          </div>

          {threadPreview ? (
            <div className="col-start-2 row-start-2 truncate whitespace-nowrap text-[12px] leading-[1.25] text-[var(--color-ink-muted)]">
              {threadPreview}
            </div>
          ) : todo.content ? (
            <div className="col-start-2 row-start-2 text-[12px] leading-[1.25] text-[var(--color-ink-muted)]">{todo.content}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ObjectiveBoard
