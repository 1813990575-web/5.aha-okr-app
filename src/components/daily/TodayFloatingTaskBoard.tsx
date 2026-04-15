import React from 'react'
import { TaskBoard } from './TaskBoard'
import type { DailyTask } from '../../store/index'

interface TodayFloatingTaskBoardProps {
  tasks: DailyTask[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void | Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onUpdateTaskContent?: (id: string, content: string) => void | Promise<void>
  onMoveTaskToToday?: (id: string) => void | Promise<void>
  onSetActiveObjective?: (itemId: string, shouldScroll?: boolean) => void
  relationHighlightedTaskId?: string | null
  isPastDate?: boolean
  onReorderTasks?: (orderedTaskIds: string[]) => void | Promise<void>
  onExecutionItemsChanged?: () => void | Promise<void>
  okrRefreshTrigger?: number
}

export const TodayFloatingTaskBoard: React.FC<TodayFloatingTaskBoardProps> = (props) => {
  return (
    <TaskBoard
      {...props}
      dndScope="floating-cart"
      dropZoneId="floating-cart-drop-zone"
      className="h-full"
      taskComposerMode="chat-bottom"
      enableHeaderDragRegion={false}
      glassMode
    />
  )
}

export default TodayFloatingTaskBoard
