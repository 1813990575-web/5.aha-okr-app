import React from 'react'
import { Sidebar } from '../../components/Sidebar'
import { ResizableLayout } from '../../components/ResizableLayout'
import { ObjectiveBoard } from '../../components/ObjectiveBoard'
import type { DailyTask } from '../../store/index'

const EmptyObjectiveBoardState: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(180deg,#ffffff,#f7f8fa)] px-6">
    <div className="max-w-md rounded-[28px] border border-black/[0.06] bg-white/88 px-8 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="typo-card-title-bold tracking-[-0.02em] text-[#232834]">还没有可展示的分栏目标</div>
      <p className="typo-link mt-3 text-[#67707d]">
        先在左侧创建一个 Objective，或选择一个现有目标，再点击右上角的分栏图标进入梳理页面。
      </p>
    </div>
  </div>
)

interface OkrWorkspaceProps {
  apiUnavailableMessage: string | null
  activeObjective: string
  shouldScrollToActive: boolean
  sidebarRefreshTrigger: number
  sliderStyle: 'bead' | 'pill'
  tasks: DailyTask[]
  selectedDate: Date
  focusedObjectiveBoard: { id: string; title: string; color?: string | null } | null
  onSetActiveObjective: (itemId: string, shouldScroll?: boolean) => void
  onAddToDailyTasks: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void | Promise<void>
  onSwitchObjectiveBoard: (objective?: { id: string; title: string; color?: string | null }) => void
  onOkrItemsChanged: () => void | Promise<void>
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void | Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onUpdateTaskContent: (id: string, content: string) => void | Promise<void>
  onMoveTaskToToday: (id: string) => void | Promise<void>
  onReorderTasks: (orderedTaskIds: string[]) => void | Promise<void>
  onExecutionItemsChanged: () => void | Promise<void>
  isPastDate: boolean
  dragNotice?: string | null
}

export const OkrWorkspace: React.FC<OkrWorkspaceProps> = ({
  apiUnavailableMessage,
  activeObjective,
  shouldScrollToActive,
  sidebarRefreshTrigger,
  sliderStyle,
  tasks,
  selectedDate,
  focusedObjectiveBoard,
  onSetActiveObjective,
  onAddToDailyTasks,
  onSwitchObjectiveBoard,
  onOkrItemsChanged,
  onDateChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onMoveTaskToToday,
  onReorderTasks,
  onExecutionItemsChanged,
  isPastDate,
  dragNotice,
}) => {
  return (
    <div className="flex h-full flex-col">
      {apiUnavailableMessage ? (
        <div className="mx-4 mt-4 rounded-2xl border border-[#f4c7c3] bg-[#fff5f4] px-4 py-3 text-[14px] text-[#b42318] shadow-[0_12px_32px_rgba(126,32,32,0.08)]">
          {apiUnavailableMessage}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <ResizableLayout
          leftPanel={<Sidebar activeObjective={activeObjective} onSetActive={onSetActiveObjective} onAddToDailyTasks={onAddToDailyTasks} onSwitchObjectiveBoard={onSwitchObjectiveBoard} refreshTrigger={sidebarRefreshTrigger} shouldScrollToActive={shouldScrollToActive} sliderStyle={sliderStyle} onOkrItemsChanged={onOkrItemsChanged} />}
          centerPanel={null}
          fullWidthPanel={
            focusedObjectiveBoard ? (
              <div
                className="h-full w-full bg-white"
                data-objective-board-id={focusedObjectiveBoard.id}
                aria-label={focusedObjectiveBoard.title}
              >
                <ObjectiveBoard
                    objective={focusedObjectiveBoard}
                    tasks={tasks}
                    selectedDate={selectedDate}
                    onDateChange={onDateChange}
                    onCreateTask={onCreateTask}
                    onAddToDailyTasks={onAddToDailyTasks}
                    onToggleTask={onToggleTask}
                    onDeleteTask={onDeleteTask}
                    onUpdateTaskContent={onUpdateTaskContent}
                      onMoveTaskToToday={onMoveTaskToToday}
                      onReorderTasks={onReorderTasks}
                      isPastDate={isPastDate}
                      onObjectiveChanged={onExecutionItemsChanged}
                      onSwitchObjectiveBoard={onSwitchObjectiveBoard}
                      refreshTrigger={sidebarRefreshTrigger}
                      dragNotice={dragNotice}
                />
              </div>
            ) : (
              <EmptyObjectiveBoardState />
            )
          }
          leftPanelConfig={{
            minWidth: 180,
            defaultWidth: 240,
            maxWidth: 360,
          }}
        />
      </div>
    </div>
  )
}

export default OkrWorkspace
