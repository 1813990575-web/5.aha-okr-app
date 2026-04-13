import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDndMonitor } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUp, Check, Eye, ImagePlus, MoreHorizontal, Plus, ShoppingCart, X } from 'lucide-react'
import type { DailyTask, Item } from '../store/index'
import { COLOR_OPTIONS } from './Sidebar'
import { MainBoard } from './MainBoard'

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
  onUpdateTaskNote?: (id: string, note: string) => void | Promise<void>
  onMoveTaskToToday?: (id: string) => void | Promise<void>
  onReorderTasks?: (orderedTaskIds: string[]) => void | Promise<void>
  isPastDate?: boolean
  onObjectiveChanged?: () => void | Promise<void>
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

const KR_CARD_THEMES = [
  {
    shell: 'border-[#e4dcff] bg-[#f8f6ff]',
    top: 'bg-[linear-gradient(180deg,#efe9ff,#e8e1ff)]',
    badgeStyle: {
      backgroundColor: 'rgba(130,104,231,0.2)',
      color: '#5a43b8',
    },
  },
  {
    shell: 'border-[#ccead9] bg-[#f2fff8]',
    top: 'bg-[linear-gradient(180deg,#daf4e7,#d1efdf)]',
    badgeStyle: {
      backgroundColor: 'rgba(53,165,109,0.2)',
      color: '#287a52',
    },
  },
  {
    shell: 'border-[#efe7b2] bg-[#fffde9]',
    top: 'bg-[linear-gradient(180deg,#f7f1c4,#f1e9b3)]',
    badgeStyle: {
      backgroundColor: 'rgba(183,154,37,0.22)',
      color: '#7d6712',
    },
  },
] as const

function getColorHex(colorKey?: string | null): string {
  if (!colorKey) return '#ff5a4f'
  return COLOR_OPTIONS.find((option) => option.key === colorKey)?.textColor || '#ff5a4f'
}

function sortByOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

const FLOATING_PANEL_TRANSITION_MS = 260
const FLOATING_PANEL_SAFE_RIGHT_PADDING = 520
const BOARD_BASE_RIGHT_PADDING = 32
const VISION_PLACEHOLDER = '这里是愿景备注示例：记录你想成为的样子与每天的推进。'
const VISION_INITIAL_MESSAGES: VisionMessage[] = []

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
  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false)
  const [isFloatingPanelMounted, setIsFloatingPanelMounted] = useState(false)
  const [isVisionDialogOpen, setIsVisionDialogOpen] = useState(false)
  const [visionMessages, setVisionMessages] = useState<VisionMessage[]>(VISION_INITIAL_MESSAGES)
  const floatingPanelCloseTimerRef = useRef<number | null>(null)

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

  const refreshAfterMutation = useCallback(async () => {
    await loadItems({ showLoading: false })
    await onObjectiveChanged?.()
  }, [loadItems, onObjectiveChanged])

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
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'TODO',
      parent_id: krId,
      title: '新待办',
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    await refreshAfterMutation()
    setEditingTarget({ id: newId, kind: 'todo', value: '新待办' })
  }, [refreshAfterMutation])

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
    return () => {
      if (floatingPanelCloseTimerRef.current) {
        window.clearTimeout(floatingPanelCloseTimerRef.current)
      }
    }
  }, [])

  const openFloatingPanel = useCallback(() => {
    if (floatingPanelCloseTimerRef.current) {
      window.clearTimeout(floatingPanelCloseTimerRef.current)
      floatingPanelCloseTimerRef.current = null
    }
    setIsFloatingPanelMounted(true)
    window.requestAnimationFrame(() => {
      setIsFloatingPanelOpen(true)
    })
  }, [])

  const closeFloatingPanel = useCallback(() => {
    setIsFloatingPanelOpen(false)
    if (floatingPanelCloseTimerRef.current) {
      window.clearTimeout(floatingPanelCloseTimerRef.current)
    }
    floatingPanelCloseTimerRef.current = window.setTimeout(() => {
      setIsFloatingPanelMounted(false)
      floatingPanelCloseTimerRef.current = null
    }, FLOATING_PANEL_TRANSITION_MS)
  }, [])

  const boardRightPadding = isFloatingPanelMounted ? FLOATING_PANEL_SAFE_RIGHT_PADDING : BOARD_BASE_RIGHT_PADDING

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
    <div className="relative flex h-full flex-col overflow-hidden bg-white text-[#2e3137]">
      <div className="traffic-light-space flex-shrink-0" />

      <div className="px-7 pb-8 pt-2">
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
            className="w-[520px] max-w-full border-none p-0 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#1f2530] outline-none"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditingTarget({ id: boardObjective.id, kind: 'objective', value: boardObjective.title })}
            className="w-full text-left text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#1f2530]"
          >
            {boardObjective.title}
          </button>
        )}
        <button
          type="button"
          onClick={openVisionDialog}
          className="mt-2 flex w-full max-w-[760px] items-start gap-2 rounded-[10px] px-1 py-0.5 text-left text-[15px] leading-[1.55] text-[#6d7482] transition-colors hover:bg-black/[0.03] hover:text-[#575f6f]"
        >
          <Eye className="mt-[2px] h-4 w-4 flex-shrink-0 text-[#8a91a0]" strokeWidth={1.9} />
          <span className="min-w-0 flex-1 truncate">{latestVisionPreview}</span>
        </button>
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
          <div
            className="flex min-h-full w-max gap-4 transition-[padding-right] duration-200"
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
                openKrMenuId={openKrMenuId}
                activeTodoSortId={activeTodoSortId}
                onEditTargetChange={setEditingTarget}
                onSaveTitle={saveTitle}
                onToggleKrMenu={setOpenKrMenuId}
                onDeleteKr={deleteItem}
                onCreateTodo={createTodo}
                onToggleTodo={toggleTodo}
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

      <VisionDialog
        open={isVisionDialogOpen}
        messages={visionMessages}
        onClose={closeVisionDialog}
        onAppendMessage={appendVisionMessage}
      />

      {isFloatingPanelMounted ? (
        <div
          className={`fixed inset-y-4 right-4 z-[220] flex w-[460px] max-w-[calc(100vw-28px)] flex-col overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_30px_72px_rgba(15,23,42,0.26)] transition-all duration-300 ${
            isFloatingPanelOpen
              ? 'translate-y-0 scale-100 opacity-100 pointer-events-auto'
              : 'translate-y-8 scale-[0.18] opacity-0 pointer-events-none'
          }`}
          style={{ transformOrigin: 'calc(100% - 20px) calc(100% - 20px)' }}
        >
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={closeFloatingPanel}
            className="app-no-drag absolute right-3 top-3 z-[240] flex h-8 w-8 items-center justify-center rounded-md bg-white/85 text-[#7f8793] shadow-[0_4px_14px_rgba(15,23,42,0.1)] transition-colors hover:bg-white"
            aria-label="关闭面板"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <MainBoard
              tasks={tasks}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              onCreateTask={onCreateTask}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onUpdateTaskContent={onUpdateTaskContent}
              onMoveTaskToToday={onMoveTaskToToday}
              isPastDate={isPastDate}
              onReorderTasks={onReorderTasks}
              onExecutionItemsChanged={onObjectiveChanged}
              okrRefreshTrigger={refreshTrigger}
              dndScope="floating-cart"
              dropZoneId="floating-cart-drop-zone"
              className="h-full bg-white"
              taskComposerMode="chat-bottom"
              enableHeaderDragRegion={false}
            />
          </div>
          {dragNotice ? (
            <div className="pointer-events-none absolute bottom-16 left-1/2 z-40 -translate-x-1/2">
              <div className="rounded-full border border-black/8 bg-white/96 px-4 py-2 text-[13px] font-medium text-[#4c5461] shadow-[0_10px_24px_rgba(15,23,42,0.14)]">
                {dragNotice}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={openFloatingPanel}
        aria-label={isFloatingPanelOpen ? '关闭承载面板' : '打开承载面板'}
        className={`absolute bottom-6 right-6 z-[210] flex h-14 w-14 items-center justify-center rounded-full border border-white/70 bg-[linear-gradient(180deg,#ffffff,#eef2f7)] text-[#3a4352] shadow-[0_14px_28px_rgba(15,23,42,0.16)] transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] ${
          isFloatingPanelMounted ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'
        }`}
      >
        <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={2} />
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
            <div className="text-[15px] font-semibold text-[#262d38]">愿景记录</div>
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
                  <div className="flex items-center gap-1.5 pt-1 text-[13px] text-black/32">
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
              className="w-full resize-none border-none bg-transparent text-[15px] leading-7 text-[#202631] outline-none placeholder:text-black/28"
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
                className="inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] px-3 text-[13px] font-medium text-[#6f7684] transition-colors hover:bg-black/[0.03]"
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
        className="whitespace-pre-wrap text-[16px] font-semibold leading-[1.5] text-[#232a36]"
        style={!expanded ? { display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
      >
        {text}
      </p>
      <p
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 -z-10 w-full whitespace-pre-wrap text-[16px] font-semibold leading-[1.5] opacity-0"
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-[13px] font-medium text-[#7c8594] transition-colors hover:text-[#5c6574]"
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
  onToggleTodo: (todo: Item) => void | Promise<void>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
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
  openKrMenuId: string | null
  activeTodoSortId: string | null
  onEditTargetChange: React.Dispatch<React.SetStateAction<EditingTarget>>
  onSaveTitle: (id: string, value: string) => void | Promise<void>
  onToggleKrMenu: React.Dispatch<React.SetStateAction<string | null>>
  onDeleteKr: (id: string) => void | Promise<void>
  onCreateTodo: (krId: string) => void | Promise<void>
  onToggleTodo: (todo: Item) => void | Promise<void>
}

const SortableKrColumn: React.FC<SortableKrColumnProps> = ({
  kr,
  columnIndex,
  dragColor,
  editingTarget,
  isSorting,
  openKrMenuId,
  activeTodoSortId,
  onEditTargetChange,
  onSaveTitle,
  onToggleKrMenu,
  onDeleteKr,
  onCreateTodo,
  onToggleTodo,
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
      ref={setNodeRef}
      style={style}
      className={`w-[264px] flex-shrink-0 ${isDragging || isSorting ? 'z-10 opacity-90' : ''}`}
      data-kr-column="true"
      {...attributes}
      {...listeners}
    >
      <article
        className={`relative overflow-hidden rounded-[16px] border p-0 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${cardTheme.shell} ${
          isDragging || isSorting ? 'shadow-[0_22px_48px_rgba(15,23,42,0.16)]' : ''
        }`}
      >
        <div className={`px-4 pb-4 pt-4 ${cardTheme.top}`}>
          <div className="mb-3 flex items-center justify-between">
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]"
              style={cardTheme.badgeStyle}
            >
              关键结果
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleKrMenu((current) => (current === kr.id ? null : kr.id))
                }}
                className="rounded-md p-1 text-[#7f8694] transition-colors hover:bg-black/[0.05]"
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
              className="w-full border-none bg-transparent p-0 text-[16px] font-bold tracking-[-0.01em] text-[#1f2530] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onEditTargetChange({ id: kr.id, kind: 'kr', value: kr.title })
              }}
              className="w-full truncate text-left text-[16px] font-bold tracking-[-0.01em] text-[#1f2530]"
            >
              {kr.title}
            </button>
          )}
        </div>

        <div className="relative bg-white/76 px-4 pb-4 pt-3">
          <div className="mb-1 flex items-center justify-between pl-1 pr-0.5">
            <span className="text-[12px] font-semibold tracking-[0.01em] text-[#7d8592]">TODO</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void onCreateTodo(kr.id)
              }}
              className="flex h-7 w-7 items-center justify-center rounded-[8px] border border-black/[0.08] bg-white/70 text-[#5a6473] transition-colors hover:bg-black/[0.045]"
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
                    onToggleTodo={onToggleTodo}
                    onSaveTitle={onSaveTitle}
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
      className={`rounded-[12px] ${
        isDragging || isSorting ? 'z-10 opacity-80 bg-white shadow-[0_16px_30px_rgba(15,23,42,0.12)]' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="group flex items-center gap-2.5 rounded-[10px] px-1 py-2 text-left transition-colors hover:bg-black/[0.035]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void onToggleTodo(todo)
          }}
          className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
            todo.status === 1 ? 'border-[#8d9199] bg-[#8d9199]' : 'border-[#c8cbd2] bg-transparent'
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
              className="w-full border-none bg-transparent p-0 text-[14px] font-medium leading-[1.2] text-[#313744] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={(e) => {
                e.stopPropagation()
                onEditTargetChange({ id: todo.id, kind: 'todo', value: todo.title })
              }}
              className={`w-full text-left text-[14px] font-medium leading-[1.2] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                todo.status === 1 ? 'text-[#9a9ea8] line-through' : 'text-[#313744]'
              }`}
            >
              {todo.title || '未命名待办'}
            </button>
          )}
          {todo.content ? (
            <div className="mt-0.5 text-[12px] leading-[1.25] text-[#7b7f89]">{todo.content}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ObjectiveBoard
