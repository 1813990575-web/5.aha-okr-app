import { useState, useCallback, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { MainBoard } from './components/MainBoard'
import { Timeline } from './components/Timeline'
import { ResizableLayout } from './components/ResizableLayout'
import { SidebarThemeProvider } from './contexts/SidebarThemeContext'
import { DragProvider, type DragItem } from './components/dnd/DragProvider'
import type { DailyTask } from './store/index'

function App() {
  // 左侧选中状态 - 用于中间面板点击后联动左侧选中
  const [activeObjective, setActiveObjective] = useState<string>('obj-1')

  // 是否自动滚动到选中项（中间面板触发时为 true，左侧内部点击时为 false）
  const [shouldScrollToActive, setShouldScrollToActive] = useState<boolean>(false)

  // 状态提升：dailyTasks 状态从 MainBoard 提升到 App.tsx
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  // 新拖入任务的高亮状态
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null)

  // Sidebar 刷新触发器 - 用于中间面板勾选后刷新左侧状态
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState<number>(0)

  // 加载今日待办数据
  const loadTasks = useCallback(async () => {
    try {
      const dateKey = formatDateKey(selectedDate)
      const dailyTasks = await window.electronAPI.dailyTasks.getTasksByDate(dateKey)
      setTasks(dailyTasks)
    } catch (error) {
      console.error('[App] 加载待办失败:', error)
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

  // 处理加入今日待办 - 从左侧右键菜单添加
  const handleAddToDailyTasks = useCallback(async (item: { id: string; title: string; color?: string | null }) => {
    console.log('[App] 加入今日待办:', item)

    try {
      const dateKey = formatDateKey(selectedDate)

      // 检查今日是否已存在相同的 linkedGoalId
      const alreadyExists = tasks.some(t => t.linkedGoalId === item.id)
      if (alreadyExists) {
        console.log('[App] 今日已存在该任务，跳过:', item.id)
        return
      }

      // 创建新的 dailyTask
      const newTask = await window.electronAPI.dailyTasks.createTask({
        content: item.title,
        isDone: false,
        date: dateKey,
        linkedGoalId: item.id,
        origin: 'okr',
        color: item.color,
      })

      console.log('[App] 任务创建成功:', newTask)

      // 关键：更新状态，触发 UI 重绘（置顶 - unshift）
      setTasks(prev => [newTask, ...prev])

      // 高亮新加入的任务，让用户立即看到
      setHighlightedTaskId(newTask.id)
      // 2秒后取消高亮
      setTimeout(() => setHighlightedTaskId(null), 2000)
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [selectedDate, tasks])

  // 处理拖拽结束 - 将 OKR 项拖入中间面板
  const handleDragEnd = useCallback(async (item: DragItem) => {
    console.log('[App] 拖拽结束:', item)

    try {
      const dateKey = formatDateKey(selectedDate)

      // 检查今日是否已存在相同的 linkedGoalId
      const alreadyExists = tasks.some(t => t.linkedGoalId === item.id)
      if (alreadyExists) {
        console.log('[App] 今日已存在该任务，跳过:', item.id)
        return
      }

      // 创建新的 dailyTask
      const newTask = await window.electronAPI.dailyTasks.createTask({
        content: item.title,
        isDone: false,
        date: dateKey,
        linkedGoalId: item.id,
        origin: 'okr',
        color: item.color,
      })

      console.log('[App] 任务创建成功:', newTask)

      // 关键：更新状态，触发 UI 重绘（置顶 - unshift）
      setTasks(prev => [newTask, ...prev])

      // 高亮新拖入的任务，让用户立即看到
      setHighlightedTaskId(newTask.id)
      // 2秒后取消高亮
      setTimeout(() => setHighlightedTaskId(null), 2000)
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [selectedDate, tasks])

  // 处理手动添加任务
  const handleCreateTask = useCallback(async (content: string) => {
    console.log("[DIAG] App handleCreateTask called with:", content)
    try {
      const dateKey = formatDateKey(selectedDate)
      const newTask = await window.electronAPI.dailyTasks.createTask({
        content,
        isDone: false,
        date: dateKey,
        linkedGoalId: null,
        origin: 'manual',
      })
      console.log("[DIAG] Task created, updating state with:", newTask)
      // 新任务添加到最下方
      setTasks(prev => {
        console.log("[DIAG] setTasks callback called, prev length:", prev.length)
        return [...prev, newTask]
      })
      console.log("[DIAG] setTasks called")
    } catch (error) {
      console.error('[App] 创建任务失败:', error)
    }
  }, [selectedDate])

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

  return (
    <SidebarThemeProvider>
      <DragProvider onDragEnd={handleDragEnd}>
        <ResizableLayout
          leftPanel={<Sidebar activeObjective={activeObjective} onSetActive={handleSetActiveObjective} onAddToDailyTasks={handleAddToDailyTasks} refreshTrigger={sidebarRefreshTrigger} shouldScrollToActive={shouldScrollToActive} />}
          centerPanel={
            <MainBoard
              tasks={tasks}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onCreateTask={handleCreateTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTaskContent={handleUpdateTaskContent}
              onSetActiveObjective={handleSetActiveObjective}
              highlightedTaskId={highlightedTaskId}
            />
          }
          rightPanel={<Timeline />}
          leftPanelConfig={{
            minWidth: 200,
            defaultWidth: 380,
            maxWidth: 500,
          }}
          rightPanelConfig={{
            minWidth: 250,
            defaultWidth: 300,
            maxWidth: 500,
          }}
        />
      </DragProvider>
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
