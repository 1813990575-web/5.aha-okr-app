import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, MoreHorizontal, Plus, Share, List } from 'lucide-react'
import type { DailyTask, Item } from '../store/index'
import { COLOR_OPTIONS } from './Sidebar'
import { useDragContext, type DragItem } from './dnd/DragProvider'

interface ObjectiveBoardProps {
  objective: { id: string; title: string; color?: string | null }
  tasks: DailyTask[]
  onCreateTask: (content: string) => void | Promise<void>
  onAddToDailyTasks: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void | Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onUpdateTaskContent?: (id: string, content: string) => void | Promise<void>
  onUpdateTaskNote?: (id: string, note: string) => void | Promise<void>
  onObjectiveChanged?: () => void | Promise<void>
  refreshTrigger?: number
}

type EditingTarget =
  | { id: string; kind: 'objective' | 'kr' | 'todo'; value: string }
  | null

type BottomSheetSnap = 'closed' | 'half' | 'high'
type BottomSheetThemeId = 'paper' | 'panel-gray' | 'mist-blue' | 'sage' | 'dusty-rose' | 'ink-dark'
type BottomSheetDragState = {
  startY: number
  startTranslateY: number
}

const BOTTOM_SHEET_SNAP_TRANSLATES: Record<BottomSheetSnap, number> = {
  closed: 1,
  half: 0.46,
  high: 0.06,
}

const BOTTOM_SHEET_THEMES: Record<
  BottomSheetThemeId,
  {
    label: string
    panelClassName: string
    handleClassName: string
    handleBarClassName: string
    menuSwatchClassName: string
  }
> = {
  paper: {
    label: '纸白',
    panelClassName:
      'border-t border-black/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(250,251,252,0.995))] shadow-[0_-4px_14px_rgba(15,23,42,0.04),0_-1px_0_rgba(255,255,255,0.72)]',
    handleClassName:
      'border border-b-0 border-black/[0.05] bg-[linear-gradient(180deg,rgba(248,249,251,1),rgba(242,244,247,0.98))] text-[#7a808b] shadow-[0_-2px_8px_rgba(15,23,42,0.035)] hover:bg-[linear-gradient(180deg,rgba(246,247,250,1),rgba(239,241,245,1))]',
    handleBarClassName: 'bg-[#c9ced8]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#ffffff,#eef2f6)] border-black/[0.06]',
  },
  'panel-gray': {
    label: '右栏灰',
    panelClassName:
      'border-t border-black/[0.04] bg-[linear-gradient(180deg,rgba(241,243,246,0.985),rgba(233,236,240,0.995))] shadow-[0_-4px_14px_rgba(15,23,42,0.04),0_-1px_0_rgba(255,255,255,0.58)]',
    handleClassName:
      'border border-b-0 border-black/[0.05] bg-[linear-gradient(180deg,rgba(237,240,244,1),rgba(228,232,237,0.98))] text-[#6e7580] shadow-[0_-2px_8px_rgba(15,23,42,0.03)] hover:bg-[linear-gradient(180deg,rgba(234,238,242,1),rgba(225,229,234,1))]',
    handleBarClassName: 'bg-[#b9c0cb]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#edf0f4,#dfe4ea)] border-black/[0.06]',
  },
  'mist-blue': {
    label: '雾蓝灰',
    panelClassName:
      'border-t border-[#aebccc]/25 bg-[linear-gradient(180deg,rgba(231,238,245,0.985),rgba(219,229,239,0.995))] shadow-[0_-4px_14px_rgba(44,71,102,0.07),0_-1px_0_rgba(255,255,255,0.5)]',
    handleClassName:
      'border border-b-0 border-[#aebccc]/30 bg-[linear-gradient(180deg,rgba(226,234,242,1),rgba(213,224,236,0.98))] text-[#607086] shadow-[0_-2px_8px_rgba(44,71,102,0.045)] hover:bg-[linear-gradient(180deg,rgba(223,232,241,1),rgba(209,220,233,1))]',
    handleBarClassName: 'bg-[#9eafc2]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#dbe6ef,#bfcedd)] border-[#aebccc]/35',
  },
  sage: {
    label: '鼠尾草',
    panelClassName:
      'border-t border-[#b4c0b2]/28 bg-[linear-gradient(180deg,rgba(232,238,231,0.985),rgba(222,230,220,0.995))] shadow-[0_-4px_14px_rgba(62,82,55,0.06),0_-1px_0_rgba(255,255,255,0.5)]',
    handleClassName:
      'border border-b-0 border-[#b4c0b2]/34 bg-[linear-gradient(180deg,rgba(227,234,225,1),rgba(216,225,213,0.98))] text-[#667462] shadow-[0_-2px_8px_rgba(62,82,55,0.04)] hover:bg-[linear-gradient(180deg,rgba(223,231,221,1),rgba(211,221,209,1))]',
    handleBarClassName: 'bg-[#a8b5a6]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#dfe7de,#c8d3c6)] border-[#b4c0b2]/35',
  },
  'dusty-rose': {
    label: '灰玫瑰',
    panelClassName:
      'border-t border-[#ccb5bd]/26 bg-[linear-gradient(180deg,rgba(243,232,236,0.985),rgba(237,223,228,0.995))] shadow-[0_-4px_14px_rgba(109,61,74,0.06),0_-1px_0_rgba(255,255,255,0.5)]',
    handleClassName:
      'border border-b-0 border-[#ccb5bd]/32 bg-[linear-gradient(180deg,rgba(240,228,233,1),rgba(232,217,223,0.98))] text-[#866673] shadow-[0_-2px_8px_rgba(109,61,74,0.04)] hover:bg-[linear-gradient(180deg,rgba(237,225,230,1),rgba(229,214,220,1))]',
    handleBarClassName: 'bg-[#c3a8b1]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#f0e2e7,#dcc6cd)] border-[#ccb5bd]/35',
  },
  'ink-dark': {
    label: '暗黑',
    panelClassName:
      'border-t border-white/[0.06] bg-[linear-gradient(180deg,rgba(45,50,59,0.985),rgba(34,38,46,0.995))] shadow-[0_-8px_24px_rgba(0,0,0,0.28),0_-1px_0_rgba(255,255,255,0.04)]',
    handleClassName:
      'border border-b-0 border-white/[0.08] bg-[linear-gradient(180deg,rgba(60,66,77,1),rgba(45,50,58,0.98))] text-[#c6ccd6] shadow-[0_-2px_10px_rgba(0,0,0,0.18)] hover:bg-[linear-gradient(180deg,rgba(64,70,82,1),rgba(48,54,63,1))]',
    handleBarClassName: 'bg-[#8f98a7]',
    menuSwatchClassName: 'bg-[linear-gradient(180deg,#434a56,#252a32)] border-white/[0.08]',
  },
}

const GRAPHITE_FOCUS_RING_ON_LIGHT =
  'transition-all duration-150 focus-within:ring-2 focus-within:ring-[#2b2f36]/62 focus-within:ring-offset-1 focus-within:ring-offset-white focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_0_0_1px_rgba(43,47,54,0.11),0_0_0_4px_rgba(43,47,54,0.12)]'

const GRAPHITE_FOCUS_RING_ON_WHITE =
  'transition-all duration-150 focus-within:ring-2 focus-within:ring-[#2b2f36]/56 focus-within:ring-offset-1 focus-within:ring-offset-[#f5f6f8] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_0_0_1px_rgba(43,47,54,0.10),0_0_0_4px_rgba(43,47,54,0.10)]'

function getColorHex(colorKey?: string | null): string {
  if (!colorKey) return '#ff5a4f'
  return COLOR_OPTIONS.find((option) => option.key === colorKey)?.textColor || '#ff5a4f'
}

function sortByOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

export const ObjectiveBoard: React.FC<ObjectiveBoardProps> = ({
  objective,
  tasks,
  onCreateTask,
  onAddToDailyTasks,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onUpdateTaskNote,
  onObjectiveChanged,
  refreshTrigger,
}) => {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null)
  const [newTodoByKr, setNewTodoByKr] = useState<Record<string, string>>({})
  const [openKrMenuId, setOpenKrMenuId] = useState<string | null>(null)
  const [boardMenuPosition, setBoardMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [bottomSheetSnap, setBottomSheetSnap] = useState<BottomSheetSnap>('closed')
  const [bottomSheetTheme, setBottomSheetTheme] = useState<BottomSheetThemeId>('paper')
  const [bottomSheetThemeMenuPosition, setBottomSheetThemeMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const [activeKrSortId, setActiveKrSortId] = useState<string | null>(null)
  const [activeTodoSortId, setActiveTodoSortId] = useState<string | null>(null)
  const [bottomSheetDraft, setBottomSheetDraft] = useState('')
  const [selectedBottomSheetTaskId, setSelectedBottomSheetTaskId] = useState<string | null>(null)
  const [selectedBottomSheetNoteDraft, setSelectedBottomSheetNoteDraft] = useState('')
  const [isCreatingBottomSheetTask, setIsCreatingBottomSheetTask] = useState(false)
  const [bottomSheetOkDropFlash, setBottomSheetOkDropFlash] = useState(false)
  const [bottomSheetDragTranslate, setBottomSheetDragTranslate] = useState<number | null>(null)
  const [isBottomSheetDragging, setIsBottomSheetDragging] = useState(false)
  const bottomSheetInputRef = useRef<HTMLInputElement>(null)
  const bottomSheetNoteSaveTimerRef = useRef<number | null>(null)
  const bottomSheetPanelRef = useRef<HTMLDivElement>(null)
  const bottomSheetDragStateRef = useRef<BottomSheetDragState | null>(null)
  const newTodoInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const pendingTodoFocusKrIdRef = useRef<string | null>(null)
  const { activeItem } = useDragContext()

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

  const completedTodoCount = useMemo(
    () => krColumns.flatMap((kr) => kr.todos).filter((todo) => todo.status === 1).length,
    [krColumns]
  )

  const totalTodoCount = useMemo(
    () => krColumns.reduce((sum, kr) => sum + kr.todos.length, 0),
    [krColumns]
  )

  const activeColor = getColorHex(boardObjective?.color ?? objective.color)
  const activeBottomSheetTheme = BOTTOM_SHEET_THEMES[bottomSheetTheme]
  const manualTasks = useMemo(
    () => [...tasks].filter((task) => (task.entryType ?? (task.linkedGoalId ? 'todo' : 'manual')) === 'manual').sort((a, b) => a.sort_order - b.sort_order),
    [tasks]
  )
  const okrTasks = useMemo(
    () => [...tasks].filter((task) => (task.entryType ?? (task.linkedGoalId ? 'todo' : 'manual')) !== 'manual').sort((a, b) => a.sort_order - b.sort_order),
    [tasks]
  )
  const bottomSheetTasks = useMemo(
    () => [...manualTasks, ...okrTasks],
    [manualTasks, okrTasks]
  )
  const selectedBottomSheetTask = useMemo(
    () => bottomSheetTasks.find((task) => task.id === selectedBottomSheetTaskId) ?? null,
    [bottomSheetTasks, selectedBottomSheetTaskId]
  )
  const bottomSheetOkrDrop = useDroppable({ id: 'objective-board-okr-drop-zone' })
  const isBottomSheetExternalDrop =
    !!activeItem &&
    activeItem.dragKind !== 'mainboard-sort' &&
    activeItem.dragKind !== 'execution-child-sort' &&
    activeItem.type !== 'O'
  const isBottomSheetOkrDropActive = isBottomSheetExternalDrop && bottomSheetOkrDrop.isOver

  const refreshAfterMutation = useCallback(async () => {
    await loadItems({ showLoading: false })
    await onObjectiveChanged?.()
  }, [loadItems, onObjectiveChanged])

  const createBottomSheetTask = useCallback(async () => {
    const nextValue = bottomSheetDraft.trim()
    if (!nextValue || isCreatingBottomSheetTask) return
    setIsCreatingBottomSheetTask(true)
    try {
      await onCreateTask(nextValue)
      setBottomSheetDraft('')
    } finally {
      setIsCreatingBottomSheetTask(false)
      bottomSheetInputRef.current?.focus()
    }
  }, [bottomSheetDraft, isCreatingBottomSheetTask, onCreateTask])

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
    if (!nextTitle) return
    await window.electronAPI.database.updateItem(id, { title: nextTitle })
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  const createKr = useCallback(async () => {
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'KR',
      parent_id: objective.id,
      title: '新关键结果',
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    await refreshAfterMutation()
    setEditingTarget({ id: newId, kind: 'kr', value: '新关键结果' })
  }, [objective.id, refreshAfterMutation])

  const createTodo = useCallback(async (krId: string) => {
    const title = (newTodoByKr[krId] || '').trim()
    if (!title) return
    pendingTodoFocusKrIdRef.current = krId
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'TODO',
      parent_id: krId,
      title,
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    setNewTodoByKr((current) => ({ ...current, [krId]: '' }))
    await refreshAfterMutation()
  }, [newTodoByKr, refreshAfterMutation])

  useEffect(() => {
    const krId = pendingTodoFocusKrIdRef.current
    if (!krId) return

    const targetInput = newTodoInputRefs.current[krId]
    if (!targetInput) return

    targetInput.focus()
    pendingTodoFocusKrIdRef.current = null
  }, [items])

  useEffect(() => {
    return () => {
      if (bottomSheetNoteSaveTimerRef.current) {
        window.clearTimeout(bottomSheetNoteSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (bottomSheetTasks.length === 0) {
      setSelectedBottomSheetTaskId(null)
      setSelectedBottomSheetNoteDraft('')
      return
    }

    if (!selectedBottomSheetTaskId || !bottomSheetTasks.some((task) => task.id === selectedBottomSheetTaskId)) {
      setSelectedBottomSheetTaskId(bottomSheetTasks[0].id)
    }
  }, [bottomSheetTasks, selectedBottomSheetTaskId])

  useEffect(() => {
    setSelectedBottomSheetNoteDraft(selectedBottomSheetTask?.note ?? '')
  }, [selectedBottomSheetTask?.id, selectedBottomSheetTask?.note])

  const handleBottomSheetTaskSelect = useCallback((taskId: string) => {
    setSelectedBottomSheetTaskId(taskId)
  }, [])

  const handleBottomSheetNoteChange = useCallback((value: string) => {
    setSelectedBottomSheetNoteDraft(value)

    if (!selectedBottomSheetTaskId || !onUpdateTaskNote) return

    if (bottomSheetNoteSaveTimerRef.current) {
      window.clearTimeout(bottomSheetNoteSaveTimerRef.current)
    }

    bottomSheetNoteSaveTimerRef.current = window.setTimeout(() => {
      if (!selectedBottomSheetTaskId || !onUpdateTaskNote) return
      void onUpdateTaskNote(selectedBottomSheetTaskId, value)
    }, 280)
  }, [onUpdateTaskNote, selectedBottomSheetTaskId])

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

  const clearCompletedTodos = useCallback(async () => {
    const completedTodos = krColumns.flatMap((kr) => kr.todos).filter((todo) => todo.status === 1)
    await Promise.all(completedTodos.map((todo) => window.electronAPI.database.deleteItem(todo.id)))
    await refreshAfterMutation()
  }, [krColumns, refreshAfterMutation])

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
    if (!bottomSheetThemeMenuPosition) return

    const handleClick = () => setBottomSheetThemeMenuPosition(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [bottomSheetThemeMenuPosition])

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
      const activeData = event.active.data.current as (Partial<Omit<DragItem, 'dragKind'>> & { dragKind?: string; krId?: string; todoId?: string }) | undefined
      const overData = event.over?.data.current as { dragKind?: string; krId?: string; todoId?: string } | undefined
      const overId = event.over?.id ? String(event.over.id) : null

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
        overId === 'objective-board-okr-drop-zone' &&
        activeData?.id &&
        activeData?.title &&
        activeData?.type &&
        activeData.dragKind !== 'mainboard-sort' &&
        activeData.dragKind !== 'execution-child-sort' &&
        activeData.type !== 'O'
      ) {
        void Promise.resolve(onAddToDailyTasks({
          id: activeData.id,
          title: activeData.title,
          color: activeData.color ?? null,
          type: activeData.type,
        })).then(() => {
          setBottomSheetOkDropFlash(true)
          window.setTimeout(() => setBottomSheetOkDropFlash(false), 1200)
        })
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

  const getSnapTranslatePx = useCallback((snap: BottomSheetSnap) => {
    const panelHeight = bottomSheetPanelRef.current?.offsetHeight ?? 0
    return panelHeight * BOTTOM_SHEET_SNAP_TRANSLATES[snap]
  }, [])

  const resolveNearestBottomSheetSnap = useCallback((translateY: number): BottomSheetSnap => {
    const panelHeight = bottomSheetPanelRef.current?.offsetHeight ?? 0
    if (panelHeight <= 0) return bottomSheetSnap

    const snapEntries = (Object.entries(BOTTOM_SHEET_SNAP_TRANSLATES) as Array<[BottomSheetSnap, number]>)
      .map(([snap, ratio]) => [snap, panelHeight * ratio] as const)

    return snapEntries.reduce((closest, current) => (
      Math.abs(current[1] - translateY) < Math.abs(closest[1] - translateY) ? current : closest
    ))[0]
  }, [bottomSheetSnap])

  const toggleBottomSheet = useCallback(() => {
    setBottomSheetDragTranslate(null)
    setBottomSheetSnap((current) => (current === 'closed' ? 'half' : 'closed'))
  }, [])

  const startBottomSheetDrag = useCallback((clientY: number) => {
    const startTranslateY = bottomSheetDragTranslate ?? getSnapTranslatePx(bottomSheetSnap)
    bottomSheetDragStateRef.current = { startY: clientY, startTranslateY }
    setIsBottomSheetDragging(true)
    setBottomSheetDragTranslate(startTranslateY)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomSheetDragTranslate, bottomSheetSnap, getSnapTranslatePx])

  useEffect(() => {
    if (!isBottomSheetDragging) return

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = bottomSheetDragStateRef.current
      const panelHeight = bottomSheetPanelRef.current?.offsetHeight ?? 0
      if (!dragState || panelHeight <= 0) return

      const highTranslate = panelHeight * BOTTOM_SHEET_SNAP_TRANSLATES.high
      const closedTranslate = panelHeight * BOTTOM_SHEET_SNAP_TRANSLATES.closed
      const nextTranslate = dragState.startTranslateY + (event.clientY - dragState.startY)
      const clampedTranslate = Math.min(closedTranslate, Math.max(highTranslate, nextTranslate))
      setBottomSheetDragTranslate(clampedTranslate)
    }

    const finishDrag = () => {
      const panelHeight = bottomSheetPanelRef.current?.offsetHeight ?? 0
      const currentTranslate = bottomSheetDragTranslate ?? (panelHeight * BOTTOM_SHEET_SNAP_TRANSLATES[bottomSheetSnap])
      const nextSnap = resolveNearestBottomSheetSnap(currentTranslate)
      setBottomSheetSnap(nextSnap)
      setBottomSheetDragTranslate(null)
      setIsBottomSheetDragging(false)
      bottomSheetDragStateRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', finishDrag)
    document.addEventListener('pointercancel', finishDrag)

    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', finishDrag)
      document.removeEventListener('pointercancel', finishDrag)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [bottomSheetDragTranslate, bottomSheetSnap, isBottomSheetDragging, resolveNearestBottomSheetSnap])

  const handleBottomSheetDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    startBottomSheetDrag(event.clientY)
  }, [startBottomSheetDrag])

  const bottomSheetTransformStyle = useMemo(() => {
    const translateY = bottomSheetDragTranslate ?? getSnapTranslatePx(bottomSheetSnap)
    return {
      transform: `translateY(${translateY}px)`,
    }
  }, [bottomSheetDragTranslate, bottomSheetSnap, getSnapTranslatePx])

  useEffect(() => {
    if (isBottomSheetDragging) return

    const handleResize = () => {
      setBottomSheetDragTranslate(null)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-gray-400">加载中...</div>
  }

  if (error || !boardObjective) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-red-500">{error || '目标不存在'}</div>
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-[#2e3137]">
      <div className="flex items-start justify-between px-7 pb-3 pt-8">
        <div>
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
              className="w-[420px] max-w-full border-none p-0 text-[24px] font-bold leading-none tracking-[-0.03em] text-[#ff5a4f] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingTarget({ id: boardObjective.id, kind: 'objective', value: boardObjective.title })}
              className="text-left text-[24px] font-bold leading-none tracking-[-0.03em] text-[#ff5a4f]"
            >
              {boardObjective.title}
            </button>
          )}
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[#8a8a93]">
            <span>{completedTodoCount} 项完成</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => void clearCompletedTodos()}
              className="text-[#ff6b61] transition-opacity hover:opacity-70"
            >
              清除
            </button>
          </div>
        </div>

        <div className="flex items-start gap-7">
          <div className="flex items-center gap-3 pt-1 text-[#7d8088]">
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <Share className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </button>
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <List className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </button>
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <Plus className="h-[20px] w-[20px]" strokeWidth={1.9} />
            </button>
          </div>

          <div className="min-w-[44px] text-right">
            <div className="text-[54px] font-light leading-[0.9] tracking-[-0.05em]" style={{ color: activeColor }}>
              {totalTodoCount}
            </div>
            <div className="mt-1 text-[13px] font-semibold" style={{ color: activeColor }}>
              显示
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 pb-8"
        onContextMenu={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-kr-column="true"]')) return
          e.preventDefault()
          setOpenKrMenuId(null)
          setBoardMenuPosition({ x: e.clientX, y: e.clientY })
        }}
      >
        <SortableContext items={krColumns.map((kr) => `objective-board-kr:${kr.id}`)} strategy={horizontalListSortingStrategy}>
          <div className="flex min-h-full w-max gap-4 pr-8">
            {krColumns.map((kr) => (
              <SortableKrColumn
                key={kr.id}
                kr={kr}
                dragColor={activeColor}
                editingTarget={editingTarget}
                isSorting={activeKrSortId === `objective-board-kr:${kr.id}`}
                openKrMenuId={openKrMenuId}
                newTodoValue={newTodoByKr[kr.id] || ''}
                activeTodoSortId={activeTodoSortId}
                onEditTargetChange={setEditingTarget}
                onSaveTitle={saveTitle}
                onToggleKrMenu={setOpenKrMenuId}
                onDeleteKr={deleteItem}
                onNewTodoChange={(value) => setNewTodoByKr((current) => ({ ...current, [kr.id]: value }))}
                onCreateTodo={createTodo}
                onToggleTodo={toggleTodo}
                newTodoInputRefs={newTodoInputRefs}
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
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#3a3e45] transition-colors hover:bg-[#f5f6f8]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              添加分栏
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          bottomSheetSnap === 'high' ? 'bg-white/10 opacity-100' : 'bg-transparent opacity-0'
        }`}
      />

      <div
        ref={bottomSheetPanelRef}
        className={`absolute inset-x-0 bottom-0 z-30 flex h-[88%] min-h-[320px] transform-gpu flex-col will-change-transform ${activeBottomSheetTheme.panelClassName} ${
          isBottomSheetDragging
            ? 'transition-none'
            : 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
        }`}
        style={bottomSheetTransformStyle}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setBoardMenuPosition(null)
          setBottomSheetThemeMenuPosition({ x: e.clientX, y: e.clientY })
        }}
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={handleBottomSheetDragPointerDown}
          className="absolute inset-x-0 top-0 z-10 h-4 -translate-y-1/2 cursor-row-resize"
        />

        <div
          className={`group absolute left-1/2 top-0 flex h-[38px] w-[196px] -translate-x-1/2 -translate-y-full items-center justify-center rounded-t-[24px] transition-colors ${activeBottomSheetTheme.handleClassName}`}
        >
          <button
            type="button"
            onClick={toggleBottomSheet}
            aria-label={bottomSheetSnap === 'closed' ? '展开半页面' : '收起半页面'}
            className="flex h-full flex-1 items-center justify-center transition-opacity opacity-95 hover:opacity-100"
          >
            <span className={`h-1.5 w-12 rounded-full ${activeBottomSheetTheme.handleBarClassName}`} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-6 pb-8 pt-6">
          <div className="flex min-h-full w-max gap-4 pr-8">
            <BottomSheetLane
              title="今日待办"
            >
              <BottomSheetInputRow
                inputRef={bottomSheetInputRef}
                value={bottomSheetDraft}
                isBusy={isCreatingBottomSheetTask}
                placeholder="新增今日待办..."
                onFocusRequest={() => bottomSheetInputRef.current?.focus()}
                onChange={setBottomSheetDraft}
                onSubmit={() => void createBottomSheetTask()}
              />

              <div className="space-y-3">
                {manualTasks.map((task) => (
                  <BottomSheetTaskCard
                    key={task.id}
                    task={task}
                    variant="manual"
                    isSelected={selectedBottomSheetTaskId === task.id}
                    onToggle={onToggleTask}
                    onSelect={handleBottomSheetTaskSelect}
                    onDelete={onDeleteTask}
                    onUpdateContent={onUpdateTaskContent}
                  />
                ))}
                {manualTasks.length === 0 ? (
                  <BottomSheetEmptyState text="这里放手动创建的今日待办" />
                ) : null}
              </div>
            </BottomSheetLane>

            <BottomSheetLane
              title="OKR"
            >
              <div
                ref={bottomSheetOkrDrop.setNodeRef}
                className={`rounded-[12px] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-200 ${
                  isBottomSheetOkrDropActive
                    ? 'bg-[rgba(244,245,247,0.96)] shadow-[0_10px_30px_rgba(43,47,54,0.08)] ring-1 ring-[#2b2f36]/28'
                    : bottomSheetOkDropFlash
                      ? 'bg-[rgba(247,248,250,0.98)] ring-1 ring-[#2b2f36]/18'
                      : 'border border-black/[0.05] bg-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 flex-shrink-0 rounded-[4px] border border-[#d3d5db] bg-white" />
                  <div className="text-[15px] font-medium text-[#80838c]">
                    {isBottomSheetOkrDropActive ? '松手后加入 OKR...' : '拖拽 OKR 到这里...'}
                  </div>
                </div>
                <div className="mt-1 pl-6 text-[12px] text-[#a0a7b2]">
                  {isBottomSheetOkrDropActive ? '松手后加入 OKR 执行列' : '拖拽 OKR 事项到这里'}
                </div>
              </div>

              <div className="space-y-3">
                {okrTasks.map((task) => (
                  <BottomSheetTaskCard
                    key={task.id}
                    task={task}
                    variant="okr"
                    isSelected={selectedBottomSheetTaskId === task.id}
                    onToggle={onToggleTask}
                    onSelect={handleBottomSheetTaskSelect}
                    onDelete={onDeleteTask}
                    onUpdateContent={onUpdateTaskContent}
                  />
                ))}
                {okrTasks.length === 0 ? (
                  <BottomSheetEmptyState text="还没有拖入任何 OKR 项" />
                ) : null}
              </div>
            </BottomSheetLane>

            <BottomSheetLane title="便签">
              <BottomSheetStickyNote
                selectedTask={selectedBottomSheetTask}
                note={selectedBottomSheetNoteDraft}
                onChange={handleBottomSheetNoteChange}
              />
            </BottomSheetLane>
          </div>
        </div>
      </div>

      {bottomSheetThemeMenuPosition ? (
        <div
          className="fixed z-40 min-w-[180px] rounded-[14px] border border-black/[0.06] bg-white/96 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.14)] backdrop-blur-xl"
          style={{ left: bottomSheetThemeMenuPosition.x, top: bottomSheetThemeMenuPosition.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b919c]">
            半弹窗颜色
          </div>
          {(
            Object.entries(BOTTOM_SHEET_THEMES) as Array<
              [BottomSheetThemeId, (typeof BOTTOM_SHEET_THEMES)[BottomSheetThemeId]]
            >
          ).map(([themeId, theme]) => (
            <button
              key={themeId}
              type="button"
              onClick={() => {
                setBottomSheetTheme(themeId)
                setBottomSheetThemeMenuPosition(null)
              }}
              className={`flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors ${
                bottomSheetTheme === themeId ? 'bg-[#f3f5f8]' : 'hover:bg-[#f6f7f9]'
              }`}
            >
              <span className={`h-5 w-8 rounded-[8px] border ${theme.menuSwatchClassName}`} />
              <span className="text-[13px] font-medium text-[#394150]">{theme.label}</span>
            </button>
          ))}
        </div>
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
  onToggleTodo: (todo: Item) => void | Promise<void>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
  onEditTargetChange: React.Dispatch<React.SetStateAction<EditingTarget>>
}

interface KrColumnItem extends Item {
  todos: Item[]
}

interface SortableKrColumnProps {
  kr: KrColumnItem
  dragColor?: string | null
  editingTarget: EditingTarget
  isSorting: boolean
  openKrMenuId: string | null
  newTodoValue: string
  activeTodoSortId: string | null
  onEditTargetChange: React.Dispatch<React.SetStateAction<EditingTarget>>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
  onToggleKrMenu: React.Dispatch<React.SetStateAction<string | null>>
  onDeleteKr: (id: string) => void | Promise<void>
  onNewTodoChange: (value: string) => void
  onCreateTodo: (krId: string) => void | Promise<void>
  onToggleTodo: (todo: Item) => void | Promise<void>
  newTodoInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>
}

const SortableKrColumn: React.FC<SortableKrColumnProps> = ({
  kr,
  dragColor,
  editingTarget,
  isSorting,
  openKrMenuId,
  newTodoValue,
  activeTodoSortId,
  onEditTargetChange,
  onSaveTitle,
  onToggleKrMenu,
  onDeleteKr,
  onNewTodoChange,
  onCreateTodo,
  onToggleTodo,
  newTodoInputRefs,
}) => {
  const sortableId = `objective-board-kr:${kr.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      dragKind: 'objective-board-kr-sort',
      krId: kr.id,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-[238px] flex-shrink-0 ${isDragging || isSorting ? 'z-10 opacity-85' : ''}`}
      data-kr-column="true"
      {...attributes}
      {...listeners}
    >
      <div className="mb-3 flex items-center justify-between px-1">
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
            className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.02em] text-[#30333a] outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={(e) => {
              e.stopPropagation()
              onEditTargetChange({ id: kr.id, kind: 'kr', value: kr.title })
            }}
            className="truncate text-left text-[15px] font-semibold tracking-[-0.02em] text-[#30333a]"
          >
            {kr.title}
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleKrMenu((current) => (current === kr.id ? null : kr.id))
            }}
            className="rounded-md p-1 text-[#9a9da6] transition-colors hover:bg-[#f3f4f6]"
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
                className="w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#c26a64] transition-colors hover:bg-[#fff3f2]"
              >
                删除列
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-8">
        <div className="space-y-2">
          <div
            className={`rounded-[12px] bg-[#f1f1f3] px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${GRAPHITE_FOCUS_RING_ON_LIGHT}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 flex-shrink-0 rounded-[4px] border border-[#d3d5db] bg-white" />
              <input
                ref={(node) => {
                  newTodoInputRefs.current[kr.id] = node
                }}
                value={newTodoValue}
                onChange={(e) => onNewTodoChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void onCreateTodo(kr.id)
                  }
                }}
                placeholder="新增待办..."
                className="w-full border-none bg-transparent p-0 text-[15px] font-medium text-[#80838c] caret-[#3b82f6] outline-none placeholder:text-[#a6a8af]"
              />
            </div>
          </div>

          <SortableContext items={kr.todos.map((todo) => `objective-board-todo:${todo.id}`)} strategy={verticalListSortingStrategy}>
            {kr.todos.map((todo) => (
              <SortableTodoCard
                key={todo.id}
                krId={kr.id}
                todo={todo}
                dragColor={dragColor}
                editingTarget={editingTarget}
                isSorting={activeTodoSortId === `objective-board-todo:${todo.id}`}
                onToggleTodo={onToggleTodo}
                onSaveTitle={onSaveTitle}
                onEditTargetChange={onEditTargetChange}
              />
            ))}
          </SortableContext>
        </div>
      </div>
    </div>
  )
}

const SortableTodoCard: React.FC<SortableTodoCardProps> = ({
  krId,
  todo,
  dragColor,
  editingTarget,
  isSorting,
  onToggleTodo,
  onSaveTitle,
  onEditTargetChange,
}) => {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[12px] bg-[#f1f1f3] px-4 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${GRAPHITE_FOCUS_RING_ON_LIGHT} ${
        isDragging || isSorting ? 'z-10 opacity-80 shadow-[0_16px_30px_rgba(15,23,42,0.12)]' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void onToggleTodo(todo)
          }}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
            todo.status === 1 ? 'border-[#8d9199] bg-[#8d9199]' : 'border-[#c8cbd2] bg-white'
          }`}
        >
          {todo.status === 1 ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          {editingTarget?.id === todo.id ? (
            <input
              autoFocus
              value={editingTarget.value}
              onChange={(e) => onEditTargetChange({ ...editingTarget, value: e.target.value })}
              onBlur={() => void onSaveTitle(todo.id, editingTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSaveTitle(todo.id, editingTarget.value)
                if (e.key === 'Escape') onEditTargetChange(null)
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full border-none bg-transparent p-0 text-[14px] font-medium leading-[1.15] text-[#3a3e45] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onEditTargetChange({ id: todo.id, kind: 'todo', value: todo.title })
              }}
              className={`w-full text-left text-[14px] font-medium leading-[1.15] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                todo.status === 1 ? 'text-[#9a9ea8] line-through' : 'text-[#3a3e45]'
              }`}
            >
              {todo.title || '未命名待办'}
            </button>
          )}
          {todo.content ? (
            <div className="mt-1 text-[12px] leading-[1.2] text-[#7b7f89]">{todo.content}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const BottomSheetLane: React.FC<{
  title: string
  children: React.ReactNode
}> = ({ title, children }) => (
  <div className="w-[238px] flex-shrink-0">
    <div className="mb-3 flex items-center justify-between px-1">
      <div className="truncate text-left text-[15px] font-semibold tracking-[-0.02em] text-[#30333a]">
        {title}
      </div>
      <button
        type="button"
        className="rounded-md p-1 text-[#9a9da6] transition-colors hover:bg-[#f3f4f6]"
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.7} />
      </button>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
)

const BottomSheetEmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-[12px] border border-dashed border-[#e4e8ee] bg-[rgba(247,248,250,0.7)] px-4 py-6 text-center text-[13px] text-[#a0a7b1]">
    {text}
  </div>
)

const BottomSheetInputRow: React.FC<{
  inputRef: React.RefObject<HTMLInputElement>
  value: string
  isBusy: boolean
  placeholder: string
  onFocusRequest: () => void
  onChange: (value: string) => void
  onSubmit: () => void
}> = ({ inputRef, value, isBusy, placeholder, onFocusRequest, onChange, onSubmit }) => (
  <div
    className={`rounded-[12px] border border-black/[0.05] bg-white px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${GRAPHITE_FOCUS_RING_ON_WHITE} ${
      isBusy ? 'opacity-70' : ''
    }`}
    onClick={onFocusRequest}
  >
    <div className="flex items-center gap-2">
      <span className="h-4 w-4 flex-shrink-0 rounded-[4px] border border-[#d3d5db] bg-white" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit()
          }
        }}
        onBlur={onSubmit}
        placeholder={isBusy ? '保存中...' : placeholder}
        className="w-full border-none bg-transparent p-0 text-[15px] font-medium text-[#80838c] caret-[#3b82f6] outline-none placeholder:text-[#a6a8af]"
      />
    </div>
  </div>
)

const BottomSheetTaskCard: React.FC<{
  task: DailyTask
  variant: 'manual' | 'okr'
  isSelected?: boolean
  onToggle: (id: string) => void | Promise<void>
  onSelect?: (id: string) => void
  onDelete: (id: string) => void | Promise<void>
  onUpdateContent?: (id: string, content: string) => void | Promise<void>
}> = ({ task, variant, isSelected = false, onToggle, onSelect, onDelete, onUpdateContent }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(task.content)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(task.content)
  }, [task.content, task.id])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const commit = useCallback(async () => {
    const nextValue = draft.trim()
    setIsEditing(false)
    if (!nextValue || nextValue === task.content) return
    await onUpdateContent?.(task.id, nextValue)
  }, [draft, onUpdateContent, task.content, task.id])

  return (
    <div
      onClick={() => onSelect?.(task.id)}
      className={`group rounded-[12px] border bg-white px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-colors hover:bg-[#fcfcfd] ${GRAPHITE_FOCUS_RING_ON_WHITE} ${
        isSelected
          ? 'border-[#2b2f36]/24 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_0_0_1px_rgba(43,47,54,0.08),0_10px_24px_rgba(43,47,54,0.08)]'
          : 'border-black/[0.05]'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onToggle(task.id)}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center border transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
            variant === 'okr' ? 'rounded-full' : 'rounded-[7px]'
          } ${task.isDone ? 'border-[#8d9199] bg-[#8d9199]' : 'border-[#c8cbd2] bg-white'}`}
          style={variant === 'okr' && !task.isDone && task.color ? { borderColor: task.color } : undefined}
        >
          {task.isDone ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void commit()
                }
                if (e.key === 'Escape') {
                  setDraft(task.content)
                  setIsEditing(false)
                }
              }}
              className="w-full border-none bg-transparent p-0 text-[14px] font-medium leading-[1.15] text-[#3a3e45] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => {
                if (onUpdateContent) setIsEditing(true)
              }}
              className={`w-full truncate text-left text-[14px] font-medium leading-[1.15] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                task.isDone ? 'text-[#9aa0aa] line-through' : 'text-[#3a3e45]'
              }`}
            >
              {task.content}
            </button>
          )}
          {variant === 'okr' ? (
            <div className="mt-1 text-[12px] text-[#9ca3ae]">来自 OKR 关联事项</div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void onDelete(task.id)}
          className="rounded-[9px] px-2 py-1 text-[12px] text-[#a0a6af] opacity-0 transition-all hover:bg-white/70 hover:text-[#6a727d] group-hover:opacity-100"
        >
          删除
        </button>
      </div>
    </div>
  )
}

const BottomSheetStickyNote: React.FC<{
  selectedTask: DailyTask | null
  note: string
  onChange: (value: string) => void
}> = ({ selectedTask, note, onChange }) => (
  <div className="rounded-[14px] border border-[#d8c36a]/55 bg-[linear-gradient(180deg,#fff7bd,#f8e68f)] p-4 shadow-[0_14px_24px_rgba(132,101,7,0.10),inset_0_1px_0_rgba(255,255,255,0.8)]">
    <div className="mb-3 min-h-[42px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e7740]">
        Task Note
      </div>
      <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-[1.3] text-[#4d4020]">
        {selectedTask?.content || '选择一条待办'}
      </div>
    </div>

    <div className="h-[238px] rounded-[12px] bg-white/28 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
      <textarea
        value={note}
        onChange={(e) => onChange(e.target.value)}
        disabled={!selectedTask}
        placeholder={selectedTask ? '记录这条待办相关的想法、执行备注或临时提醒...' : '点击左侧任意一条待办，这里会出现对应便签'}
        className="h-full w-full resize-none border-none bg-transparent text-[14px] leading-[1.6] text-[#5a4a23] outline-none placeholder:text-[#a39161] disabled:cursor-default disabled:text-[#8f825e]"
      />
    </div>
  </div>
)

export default ObjectiveBoard
