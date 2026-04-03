import React, { useState, useEffect, useCallback } from 'react'
import { CalendarHeader } from './daily/CalendarHeader'
import { DatePicker } from './daily/DatePicker'
import { TaskInput } from './daily/TaskInput'
import { TaskItem } from './daily/TaskItem'
import { DroppableMainBoard } from './dnd/DroppableMainBoard'
import { COLOR_OPTIONS } from './Sidebar'
import type { DailyTask, Item } from '../store/index'

interface MainBoardProps {
  tasks: DailyTask[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onUpdateTaskContent?: (id: string, content: string) => void
  onMoveTaskToToday?: (id: string) => void
  onSetActiveObjective?: (itemId: string, shouldScroll?: boolean) => void
  highlightedTaskId?: string | null
  isPastDate?: boolean
}

export const MainBoard: React.FC<MainBoardProps> = ({
  tasks,
  selectedDate,
  onDateChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onMoveTaskToToday,
  onSetActiveObjective,
  highlightedTaskId,
  isPastDate,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [datesWithTasks, setDatesWithTasks] = useState<Set<string>>(new Set())

  // 加载 OKR 数据（用于显示关联项标题）
  const loadItems = useCallback(async () => {
    try {
      const allItems = await window.electronAPI.database.getAllItems()
      setItems(allItems)
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
    }
  }, [])

  // 加载所有任务日期（用于日历圆点标记）
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
    } catch (error) {
      // 静默处理错误
    }
  }, [])

  // 初始加载
  useEffect(() => {
    loadItems()
    loadAllTaskDates()
  }, [loadItems, loadAllTaskDates])

  // 当任务变化时刷新日期集合
  useEffect(() => {
    loadAllTaskDates()
  }, [tasks, loadAllTaskDates])

  // 处理创建待办
  const handleCreateTask = async (content: string) => {
    try {
      setErrorMessage(null)
      await onCreateTask(content)
    } catch (error: any) {
      console.error('[MainBoard] 创建待办失败:', error)
      setErrorMessage('保存失败')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  // 处理切换完成状态
  const handleToggleTask = async (id: string) => {
    try {
      setErrorMessage(null)
      await onToggleTask(id)
    } catch (error: any) {
      console.error('切换状态失败:', error)
      setErrorMessage('更新状态失败')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  // 处理删除待办
  const handleDeleteTask = async (id: string) => {
    try {
      setErrorMessage(null)
      await onDeleteTask(id)
    } catch (error: any) {
      console.error('删除待办失败:', error)
      setErrorMessage('删除失败')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  // 获取关联项标题和颜色 - 找到 TODO 所属的 Objective（祖父级）
  const getLinkedItemInfo = (linkedGoalId: string | null) => {
    if (!linkedGoalId) return { title: null, color: null }

    // 先查找直接关联的项
    const item = items.find(i => i.id === linkedGoalId)
    if (!item) return { title: null, color: null }

    // 辅助函数：获取颜色 key 对应的实际颜色值
    const getColorValue = (colorKey: string | null | undefined): string | null => {
      if (!colorKey) return null
      const colorOption = COLOR_OPTIONS.find(c => c.key === colorKey)
      return colorOption?.textColor || null
    }

    // 如果关联的是 TODO（type === 'TODO'）
    if (item.type === 'TODO' && item.parent_id) {
      const parentKR = items.find(i => i.id === item.parent_id)
      if (parentKR) {
        // 继续找到 KR 的父级 Objective 获取颜色
        if (parentKR.parent_id) {
          const grandparentObjective = items.find(i => i.id === parentKR.parent_id)
          if (grandparentObjective) {
            return { title: parentKR.title || null, color: getColorValue(grandparentObjective.color) }
          }
        }
        return { title: parentKR.title || null, color: getColorValue(parentKR.color) }
      }
    }

    // 如果关联的是 KR，找到它的父级 Objective 获取颜色
    if (item.type === 'KR' && item.parent_id) {
      const parentObjective = items.find(i => i.id === item.parent_id)
      if (parentObjective) {
        return { title: item.title || null, color: getColorValue(parentObjective.color) }
      }
    }

    // 如果关联的是 Objective，直接返回
    return { title: item.title || null, color: getColorValue(item.color) }
  }

  // 处理点击任务项 - 联动左侧选中态（需要滚动）
  const handleTaskClick = (task: DailyTask) => {
    setSelectedTaskId(task.id)
    if (task.linkedGoalId && onSetActiveObjective) {
      onSetActiveObjective(task.linkedGoalId, true) // true 表示需要滚动
    }
  }

  return (
    <DroppableMainBoard>
      {/* 日历 Header */}
      <CalendarHeader
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        datesWithTasks={datesWithTasks}
      />

      {/* 日期选择器 */}
      <DatePicker
        isOpen={isDatePickerOpen}
        selectedDate={selectedDate}
        onSelect={onDateChange}
        onClose={() => setIsDatePickerOpen(false)}
        datesWithTasks={datesWithTasks}
      />

      {/* 错误提示 */}
      {errorMessage && (
        <div className="mx-4 mt-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-[13px] text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* 待办列表 */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-[14px]">
            加载中...
          </div>
        ) : (
          <div className="pt-5">
            {tasks.map(task => {
              const { title, color } = getLinkedItemInfo(task.linkedGoalId)
              // 如果有 linkedGoalId，从左侧获取最新标题和颜色；否则使用 task 的原始值
              const displayContent = task.linkedGoalId
                ? (items.find(i => i.id === task.linkedGoalId)?.title || task.content)
                : task.content
              // 优先使用从左侧获取的最新颜色（实时同步）
              const displayColor = task.linkedGoalId ? color : task.color
              // 合并到 task
              const taskWithColor = { ...task, color: displayColor, content: displayContent }
              return (
                <TaskItem
                  key={task.id}
                  task={taskWithColor}
                  onToggle={handleToggleTask}
                  onDelete={handleDeleteTask}
                  onUpdateContent={onUpdateTaskContent}
                  onMoveToToday={onMoveTaskToToday}
                  linkedItemTitle={title}
                  onClick={() => handleTaskClick(task)}
                  isHighlighted={highlightedTaskId === task.id}
                  isSelected={selectedTaskId === task.id}
                  isLinked={!!task.linkedGoalId}
                  isPastDate={isPastDate}
                />
              )
            })}
            {/* 待办输入区域 - 紧跟在最后一条任务之后 */}
            <TaskInput onSubmit={handleCreateTask} disabled={isLoading} />
          </div>
        )}
      </div>
    </DroppableMainBoard>
  )
}

export default MainBoard
