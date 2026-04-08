import React, { useState } from 'react'
import { Sidebar } from '../../components/Sidebar'
import { MainBoard } from '../../components/MainBoard'
import { Timeline } from '../../components/Timeline'
import { ResizableLayout } from '../../components/ResizableLayout'
import { ObjectiveBoard } from '../../components/ObjectiveBoard'
import type { DailyTask } from '../../store/index'

interface OkrWorkspaceProps {
  apiUnavailableMessage: string | null
  activeObjective: string
  shouldScrollToActive: boolean
  sidebarRefreshTrigger: number
  sliderStyle: 'bead' | 'pill'
  workspaceBackground: string
  tasks: DailyTask[]
  selectedDate: Date
  highlightedTaskId: string | null
  highlightedSourceItemIds: string[]
  focusedObjectiveBoard: { id: string; title: string; color?: string | null } | null
  okrViewMode: 'daily' | 'objective-board'
  onSetActiveObjective: (itemId: string, shouldScroll?: boolean) => void
  onAddToDailyTasks: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void | Promise<void>
  onToggleObjectiveBoardMode: (objective?: { id: string; title: string; color?: string | null }) => void
  onOkrItemsChanged: () => void | Promise<void>
  onOpenWorkspaceThemeMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void | Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => void | Promise<void>
  onUpdateTaskContent: (id: string, content: string) => void | Promise<void>
  onMoveTaskToToday: (id: string) => void | Promise<void>
  onReorderTasks: (orderedTaskIds: string[]) => void | Promise<void>
  onExecutionItemsChanged: () => void | Promise<void>
  onUpdateTaskNote: (id: string, note: string) => void | Promise<void>
  isPastDate: boolean
}

export const OkrWorkspace: React.FC<OkrWorkspaceProps> = ({
  apiUnavailableMessage,
  activeObjective,
  shouldScrollToActive,
  sidebarRefreshTrigger,
  sliderStyle,
  workspaceBackground,
  tasks,
  selectedDate,
  highlightedTaskId,
  highlightedSourceItemIds,
  focusedObjectiveBoard,
  okrViewMode,
  onSetActiveObjective,
  onAddToDailyTasks,
  onToggleObjectiveBoardMode,
  onOkrItemsChanged,
  onOpenWorkspaceThemeMenu,
  onDateChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onMoveTaskToToday,
  onReorderTasks,
  onExecutionItemsChanged,
  onUpdateTaskNote,
  isPastDate,
}) => {
  const [selectedTaskNoteTarget, setSelectedTaskNoteTarget] = useState<{ id: string; title: string } | null>(null)
  const selectedTask = tasks.find((task) => task.id === selectedTaskNoteTarget?.id) ?? null

  return (
    <div className="flex h-full flex-col">
      {apiUnavailableMessage ? (
        <div className="mx-4 mt-4 rounded-2xl border border-[#f4c7c3] bg-[#fff5f4] px-4 py-3 text-[13px] text-[#b42318] shadow-[0_12px_32px_rgba(126,32,32,0.08)]">
          {apiUnavailableMessage}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <ResizableLayout
          leftPanel={<Sidebar activeObjective={activeObjective} onSetActive={onSetActiveObjective} onAddToDailyTasks={onAddToDailyTasks} onToggleObjectiveBoardMode={onToggleObjectiveBoardMode} okrViewMode={okrViewMode} refreshTrigger={sidebarRefreshTrigger} shouldScrollToActive={shouldScrollToActive} sliderStyle={sliderStyle} onOpenWorkspaceThemeMenu={onOpenWorkspaceThemeMenu} onOkrItemsChanged={onOkrItemsChanged} />}
          centerPanel={
            <MainBoard
              tasks={tasks}
              selectedDate={selectedDate}
              onDateChange={onDateChange}
              onCreateTask={onCreateTask}
              onToggleTask={onToggleTask}
              onDeleteTask={onDeleteTask}
              onUpdateTaskContent={onUpdateTaskContent}
              onMoveTaskToToday={onMoveTaskToToday}
              onSetActiveObjective={onSetActiveObjective}
              highlightedTaskId={highlightedTaskId}
              highlightedSourceItemIds={highlightedSourceItemIds}
              isPastDate={isPastDate}
              onReorderTasks={onReorderTasks}
              onExecutionItemsChanged={onExecutionItemsChanged}
              onSelectionTitleChange={setSelectedTaskNoteTarget}
              okrRefreshTrigger={sidebarRefreshTrigger}
            />
          }
          rightPanel={
            <Timeline
              selectedId={selectedTaskNoteTarget?.id}
              selectedTitle={selectedTaskNoteTarget?.title}
              selectedNote={selectedTask?.note ?? ''}
              onNoteChange={onUpdateTaskNote}
            />
          }
          fullWidthPanel={
            okrViewMode === 'objective-board' && focusedObjectiveBoard
              ? (
                <div
                  className="h-full w-full bg-white"
                  data-objective-board-id={focusedObjectiveBoard.id}
                  aria-label={focusedObjectiveBoard.title}
                >
                  <ObjectiveBoard
                    objective={focusedObjectiveBoard}
                    onObjectiveChanged={onExecutionItemsChanged}
                    refreshTrigger={sidebarRefreshTrigger}
                  />
                </div>
              )
              : undefined
          }
          workspaceBackground={workspaceBackground}
          leftPanelConfig={{
            minWidth: 180,
            defaultWidth: 240,
            maxWidth: 360,
          }}
          rightPanelConfig={{
            minWidth: 280,
            defaultWidth: 412,
            maxWidth: 520,
          }}
        />
      </div>
    </div>
  )
}

export default OkrWorkspace
