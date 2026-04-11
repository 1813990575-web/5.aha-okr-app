import { useState, useCallback, useEffect } from 'react'
import { SidebarThemeProvider } from './contexts/SidebarThemeContext'
import { DragProvider, type DragItem } from './components/dnd/DragProvider'
import { AppSidebarRail } from './components/AppSidebarRail'
import { PlaceholderWorkspace } from './components/PlaceholderWorkspace'
import { SettingsWorkspace } from './components/SettingsWorkspace'
import type { DailyTask } from './store/index'
import type { WorkspaceId } from './workspaces/types'
import { JournalWorkspace } from './workspaces/journal/JournalWorkspace'
import { OkrWorkspace } from './workspaces/okr/OkrWorkspace'

const WORKSPACE_THEME_PRESETS = [
  { id: 'milk-white', label: '奶白灰', background: 'linear-gradient(180deg,#fbfbfa,#f5f5f3)' },
  { id: 'mist-blue', label: '冷灰蓝', background: 'linear-gradient(180deg,#eff2f5,#e9edf2)' },
  { id: 'moon-gray', label: '月光灰', background: 'linear-gradient(180deg,#eef0f2,#e6e8ec)' },
  { id: 'graphite-mist', label: '石墨雾灰', background: 'linear-gradient(180deg,#e8eaee,#dde1e7)' },
  { id: 'soft-concrete', label: '浅混凝土', background: 'linear-gradient(180deg,#e7e8e6,#dddfdc)' },
  { id: 'periwinkle', label: '长春花灰紫', background: 'linear-gradient(180deg,#b2b8ea,#939cdd)' },
  { id: 'soft-lilac', label: '雾紫', background: 'linear-gradient(180deg,#d7cdf7,#beb1ef)' },
  { id: 'dusty-cobalt', label: '钴蓝灰', background: 'linear-gradient(180deg,#4f79e8,#3d61bf)' },
  { id: 'muted-mustard', label: '芥末灰黄', background: 'linear-gradient(180deg,#f3c55b,#e0ae3b)' },
  { id: 'powder-pink', label: '灰粉', background: 'linear-gradient(180deg,#efb4c9,#de94af)' },
  { id: 'dusty-coral', label: '灰珊瑚', background: 'linear-gradient(180deg,#ef7864,#df6252)' },
  { id: 'midnight-slate', label: '深夜石板', background: 'linear-gradient(180deg,#2c313d,#20242d)' },
  { id: 'graphite-night', label: '石墨夜', background: 'linear-gradient(180deg,#3a3f49,#2a2e36)' },
  { id: 'ink-blue-black', label: '墨蓝黑', background: 'linear-gradient(180deg,#243041,#1a2330)' },
  { id: 'plum-night', label: '夜梅紫', background: 'linear-gradient(180deg,#433a52,#2f283a)' },
  { id: 'forest-night', label: '深林夜绿', background: 'linear-gradient(180deg,#223830,#172721)' },
] as const

function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('okr')
  const [sliderStyle, setSliderStyle] = useState<'bead' | 'pill'>('bead')
  const [workspaceThemeId, setWorkspaceThemeId] = useState<(typeof WORKSPACE_THEME_PRESETS)[number]['id']>('milk-white')
  const [workspaceThemeMenu, setWorkspaceThemeMenu] = useState<{ x: number; y: number } | null>(null)
  const [okrViewMode, setOkrViewMode] = useState<'daily' | 'objective-board'>('daily')
  const [focusedObjectiveBoard, setFocusedObjectiveBoard] = useState<{ id: string; title: string; color?: string | null } | null>(null)

  // 左侧选中状态 - 用于中间面板点击后联动左侧选中
  const [activeObjective, setActiveObjective] = useState<string>('obj-1')

  // 是否自动滚动到选中项（中间面板触发时为 true，左侧内部点击时为 false）
  const [shouldScrollToActive, setShouldScrollToActive] = useState<boolean>(false)

  // 状态提升：dailyTasks 状态从 MainBoard 提升到 App.tsx
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 新拖入任务的高亮状态
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)
  const [highlightedSourceItemIds, setHighlightedSourceItemIds] = useState<string[]>([])
  const [dragNotice, setDragNotice] = useState<string | null>(null)
  const [apiUnavailableMessage, setApiUnavailableMessage] = useState<string | null>(null)
  // Sidebar 刷新触发器 - 用于中间面板勾选后刷新左侧状态
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState<number>(0)

  // 加载今日待办数据
  const loadTasks = useCallback(async () => {
    if (!window.electronAPI?.dailyTasks?.getTasksByDate) {
      setApiUnavailableMessage('数据库 API 不可用，请关闭开发版后重新打开正式安装包。')
      setTasks([])
      return
    }

    try {
      const dateKey = formatDateKey(selectedDate)
      const dailyTasks = await window.electronAPI.dailyTasks.getTasksByDate(dateKey)
      setTasks(dailyTasks)
      setApiUnavailableMessage(null)
    } catch (error) {
      console.error('[App] 加载待办失败:', error)
      setApiUnavailableMessage('加载失败: 数据库 API 不可用')
    }
  }, [selectedDate])

  // 初始加载和日期变化时重新加载
  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // 处理选中请求 - 点击中间面板任务时切换左侧选中态（需要滚动）
  const handleSetActiveObjective = useCallback((itemId: string, shouldScroll: boolean = false) => {
    setActiveObjective(itemId)
    setShouldScrollToActive(shouldScroll)
  }, [])

  const handleExecutionItemsChanged = useCallback(async () => {
    setSidebarRefreshTrigger(prev => prev + 1)
    await loadTasks()
  }, [loadTasks])

  const handleOkrItemsChanged = useCallback(() => {
    setSidebarRefreshTrigger(prev => prev + 1)
  }, [])

  const handleToggleObjectiveBoardMode = useCallback((objective?: { id: string; title: string; color?: string | null }) => {
    setOkrViewMode((currentMode) => {
      if (currentMode === 'objective-board') {
        if (objective) {
          setActiveObjective(objective.id)
          setShouldScrollToActive(false)
          setFocusedObjectiveBoard(objective)
          return 'objective-board'
        }
        return 'daily'
      }

      if (objective) {
        setActiveObjective(objective.id)
        setShouldScrollToActive(false)
        setFocusedObjectiveBoard(objective)
      }

      return 'objective-board'
    })
  }, [])

  const showTaskFeedback = useCallback((taskId: string, notice?: string, sourceItemIds?: Array<string | null | undefined>) => {
    setHighlightedTaskId(taskId)
    window.setTimeout(() => setHighlightedTaskId(null), 2200)
    const normalizedSourceIds = Array.from(new Set((sourceItemIds || []).filter(Boolean) as string[]))
    if (normalizedSourceIds.length > 0) {
      setHighlightedSourceItemIds(normalizedSourceIds)
      window.setTimeout(() => {
        setHighlightedSourceItemIds((current) =>
          current.some((id) => normalizedSourceIds.includes(id)) ? [] : current
        )
      }, 2200)
    }

    window.requestAnimationFrame(() => {
      const element = document.querySelector(`[data-mainboard-task-id="${taskId}"]`)
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })

    if (notice) {
      setDragNotice(notice)
      window.setTimeout(() => setDragNotice(null), 2200)
    }
  }, [])

  const createLinkedExecutionEntry = useCallback(async (
    item: { id: string; title: string; color?: string | null; type?: DragItem['type'] },
    source: 'menu' | 'drag'
  ) => {
    if (okrViewMode === 'daily' && item.type === 'O') {
      setDragNotice('当前执行区最高只接受关键结果，请改为拖入关键结果')
      window.setTimeout(() => setDragNotice(null), 2200)
      return
    }

    const allItems = await window.electronAPI.database.getAllItems()
    const getDescendantIds = (rootId: string): string[] => {
      const descendants: string[] = []
      const stack = [rootId]

      while (stack.length > 0) {
        const currentId = stack.pop()!
        const children = allItems.filter((candidate: { id: string; parent_id: string | null }) => candidate.parent_id === currentId)
        for (const child of children) {
          descendants.push(child.id)
          stack.push(child.id)
        }
      }

      return descendants
    }

    const getAncestorIds = (leafId: string): string[] => {
      const ancestors: string[] = []
      let current = allItems.find((candidate: { id: string }) => candidate.id === leafId)
      while (current?.parent_id) {
        ancestors.push(current.parent_id)
        current = allItems.find((candidate: { id: string }) => candidate.id === current?.parent_id)
      }
      return ancestors
    }

    const sourceItemId = item.id
    const existingTask = tasks.find(
      (task) => (task.sourceItemId ?? task.linkedGoalId) === sourceItemId
    )
    if (existingTask) {
      showTaskFeedback(existingTask.id, '您已加入了代办，不需要重复拖动', [sourceItemId])
      return
    }

    const ancestorIds = getAncestorIds(sourceItemId)
    const existingAncestorTask = tasks.find((task) => {
      const taskSourceId = task.sourceItemId ?? task.linkedGoalId
      return !!taskSourceId && ancestorIds.includes(taskSourceId)
    })
    if (existingAncestorTask) {
      showTaskFeedback(existingAncestorTask.id, '相关内容已在更高层级卡片中展示', [sourceItemId])
      return
    }

    const descendantIds = getDescendantIds(sourceItemId)
    const descendantTasks = tasks.filter((task) => {
      const taskSourceId = task.sourceItemId ?? task.linkedGoalId
      return !!taskSourceId && descendantIds.includes(taskSourceId)
    })

    const dateKey = formatDateKey(selectedDate)
    const topSortOrder =
      tasks.length > 0
        ? Math.min(...tasks.map((task) => task.sort_order ?? 0)) - 1
        : 0

    const entryTypeMap: Record<NonNullable<DragItem['type']>, NonNullable<DailyTask['entryType']>> = {
      O: 'objective',
      KR: 'kr',
      TODO: 'todo',
    }

    const newTask = await window.electronAPI.dailyTasks.createTask({
      content: item.title,
      note: '',
      isDone: false,
      date: dateKey,
      sort_order: topSortOrder,
      linkedGoalId: sourceItemId,
      sourceItemId,
      entryType: item.type ? entryTypeMap[item.type] : 'todo',
      origin: 'okr',
      color: item.color,
    })

    if (descendantTasks.length > 0) {
      await Promise.all(
        descendantTasks.map((task) => window.electronAPI.dailyTasks.deleteTask(task.id))
      )
    }

    console.log(`[App] ${source === 'drag' ? '拖拽' : '菜单'}创建执行项成功:`, newTask)
    setTasks(prev => {
      const descendantTaskIds = new Set(descendantTasks.map((task) => task.id))
      return [newTask, ...prev.filter((task) => !descendantTaskIds.has(task.id))]
    })
    showTaskFeedback(
      newTask.id,
      descendantTasks.length > 0 ? '目标相关内容已合并至目标卡片' : undefined,
      descendantTasks.length > 0
        ? descendantTasks.map((task) => task.sourceItemId ?? task.linkedGoalId)
        : []
    )
  }, [okrViewMode, selectedDate, showTaskFeedback, tasks])

  // 处理加入今日待办 - 从左侧右键菜单添加
  const handleAddToDailyTasks = useCallback(async (item: { id: string; title: string; color?: string | null; type?: DragItem['type'] }) => {
    console.log('[App] 加入今日待办:', item)

    try {
      await createLinkedExecutionEntry(item, 'menu')
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [createLinkedExecutionEntry])

  // 处理拖拽结束 - 将 OKR 项拖入中间面板
  const handleDragEnd = useCallback(async (item: DragItem, _dropZoneId?: string | null) => {
    console.log('[App] 拖拽结束:', item)

    try {
      await createLinkedExecutionEntry(item, 'drag')
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [createLinkedExecutionEntry])

  // 处理手动添加任务
  const handleCreateTask = useCallback(async (content: string) => {
    console.log("[DIAG] App handleCreateTask called with:", content)
    try {
      const dateKey = formatDateKey(selectedDate)
      const topSortOrder =
        tasks.length > 0
          ? Math.min(...tasks.map((task) => task.sort_order ?? 0)) - 1
          : 0
      const newTask = await window.electronAPI.dailyTasks.createTask({
        content,
        note: '',
        isDone: false,
        date: dateKey,
        sort_order: topSortOrder,
        linkedGoalId: null,
        sourceItemId: null,
        entryType: 'manual',
        origin: 'manual',
      })
      console.log("[DIAG] Task created, updating state with:", newTask)
      // 新任务添加到最上方
      setTasks(prev => {
        console.log("[DIAG] setTasks callback called, prev length:", prev.length)
        return [newTask, ...prev]
      })
      console.log("[DIAG] setTasks called")
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [selectedDate, tasks])

  const handleReorderTasks = useCallback(async (orderedTaskIds: string[]) => {
    try {
      const taskMap = new Map(tasks.map((task) => [task.id, task]))
      const reorderedTasks = orderedTaskIds
        .map((id, index) => {
          const task = taskMap.get(id)
          return task ? { ...task, sort_order: index } : null
        })
        .filter(Boolean) as DailyTask[]

      setTasks(reorderedTasks)

      await Promise.all(
        reorderedTasks.map((task, index) =>
          window.electronAPI.dailyTasks.updateTask(task.id, { sort_order: index })
        )
      )

    } catch (error) {
      console.error('[App] 重排中间待办失败:', error)
      await loadTasks()
    }
  }, [tasks, loadTasks])

  // 处理切换任务状态
  const handleToggleTask = useCallback(async (id: string) => {
    try {
      const updatedTask = await window.electronAPI.dailyTasks.toggleTaskStatus(id)
      if (updatedTask) {
        setTasks(prev => prev.map(task => (task.id === id ? updatedTask : task)))

        // 同步更新左侧对应 TODO 的 status（如果是 OKR 派生任务）
        if (updatedTask.linkedGoalId && window.electronAPI?.database?.updateItem) {
          try {
            await window.electronAPI.database.updateItem(updatedTask.linkedGoalId, {
              status: updatedTask.isDone ? 1 : 0
            })
            // 触发 Sidebar 刷新以显示更新后的状态
            setSidebarRefreshTrigger(prev => prev + 1)
          } catch (err) {
            console.error('[App] 同步更新左侧状态失败:', err)
          }
        }
      }
    } catch (error) {
      console.error('[App] 切换状态失败:', error)
    }
  }, [])

  // 处理删除任务
  const handleDeleteTask = useCallback(async (id: string) => {
    console.log("[DIAG] App handleDeleteTask called for id:", id)
    try {
      await window.electronAPI.dailyTasks.deleteTask(id)
      console.log("[DIAG] Task deleted from DB, updating state")
      setTasks(prev => {
        console.log("[DIAG] setTasks filter callback, prev length:", prev.length)
        return prev.filter(task => task.id !== id)
      })
      console.log("[DIAG] setTasks called for delete")
    } catch (error) {
      console.error('[App] 删除任务失败:', error)
    }
  }, [])

  // 处理更新任务内容（双击重命名）
  const handleUpdateTaskContent = useCallback(async (id: string, content: string) => {
    try {
      await window.electronAPI.dailyTasks.updateTask(id, { content })
      setTasks(prev => prev.map(task =>
        task.id === id ? { ...task, content } : task
      ))
    } catch (error) {
      console.error('[App] 更新任务内容失败:', error)
    }
  }, [])

  // 处理移至今日 - 将过去日期的任务移动到今天的日期
  const handleMoveTaskToToday = useCallback(async (id: string) => {
    console.log('[DIAG] App handleMoveTaskToToday called for id:', id)
    try {
      const todayKey = formatDateKey(new Date())
      await window.electronAPI.dailyTasks.updateTask(id, { date: todayKey })
      // 从当前列表移除（因为日期已改变）
      setTasks(prev => prev.filter(task => task.id !== id))
      console.log('[DIAG] Task moved to today:', id)
    } catch (error) {
      console.error('[App] 移至今日失败:', error)
    }
  }, [])

  const handleUpdateTaskNote = useCallback(async (id: string, note: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, note } : task)))
    try {
      await window.electronAPI.dailyTasks.updateTask(id, { note })
    } catch (error) {
      console.error('[App] 更新任务笔记失败:', error)
      await loadTasks()
    }
  }, [loadTasks])

  // 判断当前选中的日期是否为过去的日期
  const isPastDate = useCallback(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selected = new Date(selectedDate)
    selected.setHours(0, 0, 0, 0)
    return selected < today
  }, [selectedDate])

  const isOkrWorkspace = activeWorkspace === 'okr'
  const isJournalWorkspace = activeWorkspace === 'journal'
  const isSettingsWorkspace = activeWorkspace === 'settings'
  const isPlaceholderWorkspace = !isOkrWorkspace && !isJournalWorkspace && !isSettingsWorkspace
  const workspaceBackground =
    WORKSPACE_THEME_PRESETS.find((preset) => preset.id === workspaceThemeId)?.background ??
    WORKSPACE_THEME_PRESETS[0].background

  useEffect(() => {
    if (!workspaceThemeMenu) return

    const handleClose = () => setWorkspaceThemeMenu(null)
    document.addEventListener('click', handleClose)
    return () => document.removeEventListener('click', handleClose)
  }, [workspaceThemeMenu])

  return (
    <SidebarThemeProvider>
      <DragProvider onDragEnd={handleDragEnd}>
        <div className="h-full w-full bg-transparent">
          <div className="flex h-full w-full overflow-hidden">
            <AppSidebarRail activeSection={activeWorkspace} onSelect={setActiveWorkspace} />

            <div className="min-w-0 flex-1">
              {isSettingsWorkspace ? (
                <SettingsWorkspace
                  sliderStyle={sliderStyle}
                  onSliderStyleChange={setSliderStyle}
                />
              ) : isJournalWorkspace ? (
                <JournalWorkspace />
              ) : isPlaceholderWorkspace ? (
                <PlaceholderWorkspace section={activeWorkspace} />
              ) : (
                <OkrWorkspace
                  apiUnavailableMessage={apiUnavailableMessage}
                  activeObjective={activeObjective}
                  shouldScrollToActive={shouldScrollToActive}
                  sidebarRefreshTrigger={sidebarRefreshTrigger}
                  sliderStyle={sliderStyle}
                  workspaceBackground={workspaceBackground}
                  tasks={tasks}
                  selectedDate={selectedDate}
                  highlightedTaskId={highlightedTaskId}
                  highlightedSourceItemIds={highlightedSourceItemIds}
                  focusedObjectiveBoard={focusedObjectiveBoard}
                  okrViewMode={okrViewMode}
                  onSetActiveObjective={handleSetActiveObjective}
                  onAddToDailyTasks={handleAddToDailyTasks}
                  onToggleObjectiveBoardMode={handleToggleObjectiveBoardMode}
                  onOkrItemsChanged={handleOkrItemsChanged}
                  onOpenWorkspaceThemeMenu={setWorkspaceThemeMenu}
                  onDateChange={setSelectedDate}
                  onCreateTask={handleCreateTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTaskContent={handleUpdateTaskContent}
                  onMoveTaskToToday={handleMoveTaskToToday}
                  onReorderTasks={handleReorderTasks}
                  onExecutionItemsChanged={handleExecutionItemsChanged}
                  onUpdateTaskNote={handleUpdateTaskNote}
                  isPastDate={isPastDate()}
                />
              )}
            </div>
          </div>
          {workspaceThemeMenu && isOkrWorkspace && (
            <div
              className="fixed z-[100] max-h-[420px] min-w-[196px] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white/92 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-xl"
              style={{ left: workspaceThemeMenu.x, top: workspaceThemeMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/32">
                工作台底色
              </div>
              {WORKSPACE_THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setWorkspaceThemeId(preset.id)
                    setWorkspaceThemeMenu(null)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-black/[0.04]"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-black/10"
                    style={{ background: preset.background }}
                  />
                  <span className="text-sm text-[#3f4754]">{preset.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DragProvider>
      {dragNotice && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[120] -translate-x-1/2">
          <div className="rounded-full border border-black/8 bg-white/92 px-4 py-2 text-[13px] font-medium text-[#4c5461] shadow-[0_12px_28px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            {dragNotice}
          </div>
        </div>
      )}
    </SidebarThemeProvider>
  )
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default App
