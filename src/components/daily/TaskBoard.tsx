import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDndMonitor } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarHeader } from './CalendarHeader'
import { DatePicker } from './DatePicker'
import { TaskInput } from './TaskInput'
import { TaskChatComposer } from './TaskChatComposer'
import { TaskItem } from './TaskItem'
import { TaskFocusPanel } from './TaskFocusPanel'
import { DroppableTaskBoard } from '../dnd/DroppableTaskBoard'
import { Check, ChevronDown, Triangle } from 'lucide-react'
import type { DailyTask, Item } from '../../store/index'
import type { FocusSessionRecord } from './focusSessionStore'
import { useTaskBoardFocusSessions } from './useTaskBoardFocusSessions'
import { useTaskBoardExecutionData } from './useTaskBoardExecutionData'

interface TaskBoardProps {
  tasks: DailyTask[]
  selectedDate: Date
  onDateChange: (date: Date) => void
  onCreateTask: (content: string) => void
  onToggleTask: (id: string) => void
  onDeleteTask: (id: string) => void
  onUpdateTaskContent?: (id: string, content: string) => void
  onMoveTaskToToday?: (id: string) => void
  onSetActiveObjective?: (itemId: string, shouldScroll?: boolean) => void
  relationHighlightedTaskId?: string | null
  highlightedSourceItemIds?: string[]
  isPastDate?: boolean
  onReorderTasks?: (orderedTaskIds: string[]) => void | Promise<void>
  onExecutionItemsChanged?: () => void | Promise<void>
  okrRefreshTrigger?: number
  dndScope?: string
  dropZoneId?: string
  className?: string
  taskComposerMode?: 'inline' | 'chat-bottom'
  enableHeaderDragRegion?: boolean
  glassMode?: boolean
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  selectedDate,
  onDateChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTaskContent,
  onMoveTaskToToday,
  onSetActiveObjective,
  relationHighlightedTaskId,
  highlightedSourceItemIds,
  isPastDate,
  onReorderTasks,
  onExecutionItemsChanged,
  okrRefreshTrigger,
  dndScope = 'main',
  dropZoneId = 'task-board-drop-zone',
  className = '',
  taskComposerMode = 'inline',
  enableHeaderDragRegion = true,
  glassMode = false,
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedExecutionItemId, setSelectedExecutionItemId] = useState<string | null>(null)
  const [activeSortTaskId, setActiveSortTaskId] = useState<string | null>(null)
  const [overSortTaskId, setOverSortTaskId] = useState<string | null>(null)
  const [activeChildSortId, setActiveChildSortId] = useState<string | null>(null)
  const [editingSourceItemId, setEditingSourceItemId] = useState<string | null>(null)
  const [collapsedExecutionKrIds, setCollapsedExecutionKrIds] = useState<Set<string>>(new Set())
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimerRef = useRef<number | null>(null)
  const useChatBottomComposer = taskComposerMode === 'chat-bottom'
  const getTaskSortableId = useCallback((taskId: string) => `${dndScope}-task:${taskId}`, [dndScope])
  const parseScopedId = useCallback((scopedId: string, prefix: string) => {
    return scopedId.startsWith(prefix) ? scopedId.slice(prefix.length) : null
  }, [])
  const {
    focusSessions,
    patchFocusSession,
    removeFocusSession,
    handleStartFocus,
  } = useTaskBoardFocusSessions(tasks)
  const {
    items,
    isLoading,
    datesWithTasks,
    getLinkedItemInfo,
    getItemById,
    getChildrenOf,
    createExecutionChild,
    updateExecutionItemTitle,
    deleteExecutionItem,
    toggleExecutionItemStatus,
    reorderExecutionChildren,
  } = useTaskBoardExecutionData({
    tasks,
    okrRefreshTrigger,
    onExecutionItemsChanged,
    editingSourceItemId,
    setEditingSourceItemId,
  })

  // 处理创建待办
  const handleCreateTask = async (content: string) => {
    try {
      setErrorMessage(null)
      await onCreateTask(content)
    } catch (error: any) {
      console.error('[TaskBoard] 创建待办失败:', error)
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
      removeFocusSession(id)
    } catch (error: any) {
      console.error('删除待办失败:', error)
      setErrorMessage('删除失败')
      setTimeout(() => setErrorMessage(null), 3000)
    }
  }

  const toggleExecutionKrCollapsed = useCallback((itemId: string) => {
    setCollapsedExecutionKrIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }, [])

  // 处理点击任务项 - 联动左侧选中态（需要滚动）
  const handleTaskClick = (task: DailyTask) => {
    setSelectedTaskId(task.id)
    setSelectedExecutionItemId(null)
    if (!onSetActiveObjective) return

    // 优先使用已建立的关联 ID；如果是手动任务没有关联，则按标题匹配现有 TODO 做联动
    let targetItemId = task.sourceItemId ?? task.linkedGoalId ?? null
    if (!targetItemId) {
      const normalizedContent = task.content.trim()
      if (normalizedContent) {
        const matchedTodo = items.find(
          (item) => item.type === 'TODO' && item.title.trim() === normalizedContent
        )
        targetItemId = matchedTodo?.id ?? null
      }
    }

    if (targetItemId) {
      onSetActiveObjective(targetItemId, true) // true 表示需要滚动
    }
  }

  const handleHideFocusPanel = useCallback((taskId: string) => {
    patchFocusSession(taskId, { panelOpen: false })
  }, [patchFocusSession])

  useDndMonitor({
    onDragStart: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      if (activeData?.dragKind === 'taskboard-sort' && String(event.active.id).startsWith(`${dndScope}-task:`)) {
        setActiveSortTaskId(String(event.active.id))
      } else if (activeData?.dragKind === 'execution-child-sort' && String(event.active.id).startsWith(`${dndScope}-execution:`)) {
        setActiveChildSortId(String(event.active.id))
      }
    },
    onDragOver: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      const overData = event.over?.data.current as { dragKind?: string } | undefined
      if (
        activeData?.dragKind === 'taskboard-sort' &&
        overData?.dragKind === 'taskboard-sort' &&
        String(event.active.id).startsWith(`${dndScope}-task:`) &&
        String(event.over?.id).startsWith(`${dndScope}-task:`)
      ) {
        setOverSortTaskId(String(event.over?.id))
      } else {
        setOverSortTaskId(null)
      }
    },
    onDragEnd: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      const overData = event.over?.data.current as { dragKind?: string } | undefined
      const activeId = String(event.active.id)
      const overId = event.over ? String(event.over.id) : null

      setActiveSortTaskId(null)
      setOverSortTaskId(null)
      setActiveChildSortId(null)

      if (
        activeData?.dragKind === 'execution-child-sort' &&
        overData?.dragKind === 'execution-child-sort' &&
        overId &&
        activeId !== overId &&
        activeId.startsWith(`${dndScope}-execution:`) &&
        overId.startsWith(`${dndScope}-execution:`)
      ) {
        const activeItemId = String((event.active.data.current as { itemId?: string }).itemId || '')
        const overItemId = String((event.over?.data.current as { itemId?: string }).itemId || '')
        const parentId = (event.active.data.current as { parentId?: string | null }).parentId
        const itemType = (event.active.data.current as { itemType?: Item['type'] }).itemType
        const overParentId = (event.over?.data.current as { parentId?: string | null }).parentId
        const overItemType = (event.over?.data.current as { itemType?: Item['type'] }).itemType

        if (activeItemId && overItemId && parentId && parentId === overParentId && itemType && itemType === overItemType) {
          void reorderExecutionChildren(activeItemId, overItemId, parentId, itemType)
        }
        return
      }

      if (activeData?.dragKind !== 'taskboard-sort' || overData?.dragKind !== 'taskboard-sort' || !overId || activeId === overId) {
        return
      }

      const currentIds = tasks.map((task) => getTaskSortableId(task.id))
      const oldIndex = currentIds.indexOf(activeId)
      const newIndex = currentIds.indexOf(overId)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const nextIds = [...currentIds]
      const [moved] = nextIds.splice(oldIndex, 1)
      nextIds.splice(newIndex, 0, moved)
      void onReorderTasks?.(
        nextIds
          .map((id) => parseScopedId(id, `${dndScope}-task:`))
          .filter(Boolean) as string[]
      )
    },
    onDragCancel: () => {
      setActiveSortTaskId(null)
      setOverSortTaskId(null)
      setActiveChildSortId(null)
    },
  })

  return (
    <>
    <DroppableTaskBoard dropZoneId={dropZoneId} className={className} glassMode={glassMode}>
      {/* 日历 Header */}
      <CalendarHeader
        selectedDate={selectedDate}
        onDateChange={onDateChange}
        onOpenDatePicker={() => setIsDatePickerOpen(true)}
        datesWithTasks={datesWithTasks}
        enableWindowDragRegion={enableHeaderDragRegion}
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
          <p className="text-[14px] text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* 待办列表 */}
      <div
        className={`flex-1 overflow-y-auto ${isScrolling ? 'scrollbar-active' : 'scrollbar-idle'}`}
        onScroll={() => {
          setIsScrolling(true)
          if (scrollTimerRef.current) {
            window.clearTimeout(scrollTimerRef.current)
          }
          scrollTimerRef.current = window.setTimeout(() => {
            setIsScrolling(false)
          }, 700)
        }}
      >
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-[14px]">
            加载中...
          </div>
        ) : (
          <div className={`px-6 pt-6 ${useChatBottomComposer ? 'pb-20' : 'pb-10'}`}>
            {(() => {
              const renderExecutionTask = (task: DailyTask, laneMode: boolean) => {
                const sourceItemId = task.sourceItemId ?? task.linkedGoalId
                const { title, color } = getLinkedItemInfo(sourceItemId)
                const entryType = task.entryType ?? (sourceItemId ? 'todo' : 'manual')
                const displayContent = sourceItemId
                  ? (items.find(i => i.id === sourceItemId)?.title || task.content)
                  : task.content
                const displayColor = sourceItemId ? color : task.color
                const taskWithColor = {
                  ...task,
                  entryType,
                  sourceItemId,
                  linkedGoalId: sourceItemId,
                  color: displayColor,
                  content: displayContent,
                }

                return (
                  <ExecutionEntry
                    task={taskWithColor}
                    linkedItemTitle={title}
                    sourceItem={getItemById(sourceItemId)}
                    getChildrenOf={getChildrenOf}
                    editingSourceItemId={editingSourceItemId}
                    setEditingSourceItemId={setEditingSourceItemId}
                    onCreateExecutionChild={createExecutionChild}
                    onUpdateExecutionItemTitle={updateExecutionItemTitle}
                    onDeleteExecutionItem={deleteExecutionItem}
                    onToggleExecutionItemStatus={toggleExecutionItemStatus}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onUpdateContent={onUpdateTaskContent}
                    onMoveToToday={onMoveTaskToToday}
                    onClick={() => handleTaskClick(taskWithColor)}
                    isHighlighted={false}
                    isRelationHighlighted={relationHighlightedTaskId === task.id}
                    highlightedSourceItemIds={highlightedSourceItemIds}
                    isSelected={selectedTaskId === task.id}
                    isPastDate={isPastDate}
                    isSorting={activeSortTaskId === getTaskSortableId(task.id)}
                    showSortInsertion={overSortTaskId === getTaskSortableId(task.id) && activeSortTaskId !== getTaskSortableId(task.id)}
                    activeChildSortId={activeChildSortId}
                    onStartFocus={handleStartFocus}
                    onResumeFocus={(task) => handleStartFocus(task)}
                    focusSession={focusSessions[task.id] ?? null}
                    isFocusActive={Boolean(focusSessions[task.id])}
                    laneMode={laneMode}
                    collapsedExecutionKrIds={collapsedExecutionKrIds}
                    onToggleExecutionKrCollapsed={toggleExecutionKrCollapsed}
                    selectedExecutionItemId={selectedExecutionItemId}
                    onSelectExecutionItem={(item) => {
                      setSelectedExecutionItemId(item.id)
                    }}
                    dndScope={dndScope}
                    preferDeleteFirst={useChatBottomComposer}
                  />
                )
              }

              return (
                <>
                  <div>
                    {!useChatBottomComposer ? (
                      <div className="pb-2 pt-1">
                        <TaskInput onSubmit={handleCreateTask} disabled={isLoading} />
                      </div>
                    ) : null}
                    <SortableContext items={tasks.map((task) => getTaskSortableId(task.id))} strategy={verticalListSortingStrategy}>
                      <div className="space-y-1">
                        {tasks.map((task) => (
                        <SortableTaskRow key={task.id} sortableId={getTaskSortableId(task.id)} taskId={task.id} title={task.content}>
                          {renderExecutionTask(task, false)}
                        </SortableTaskRow>
                      ))}
                      </div>
                    </SortableContext>
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {useChatBottomComposer ? (
        <div className={`${glassMode ? 'border-t border-white/55 bg-white/56 backdrop-blur-[12px]' : 'border-t border-black/[0.08] bg-white/58 backdrop-blur-[10px]'} p-4`}>
          <TaskChatComposer onSubmit={handleCreateTask} disabled={isLoading} />
        </div>
      ) : null}
    </DroppableTaskBoard>

    {Object.values(focusSessions)
      .filter((session) => session.panelOpen)
      .map((session) => (
        <TaskFocusPanel
          key={session.taskId}
          session={session}
          onUpdateSession={patchFocusSession}
          onHidePanel={handleHideFocusPanel}
          onCompleteSession={removeFocusSession}
          onAbandonSession={removeFocusSession}
        />
      ))}
    </>
  )
}

export default TaskBoard

const ExecutionEntry: React.FC<{
  task: DailyTask
  linkedItemTitle?: string | null
  sourceItem?: Item | null
  getChildrenOf: (parentId: string | null | undefined, type?: Item['type']) => Item[]
  editingSourceItemId: string | null
  setEditingSourceItemId: React.Dispatch<React.SetStateAction<string | null>>
  onCreateExecutionChild: (parentItem: Item) => Promise<void>
  onUpdateExecutionItemTitle: (itemId: string, title: string) => Promise<void>
  onDeleteExecutionItem: (itemId: string) => Promise<void>
  onToggleExecutionItemStatus: (item: Item) => Promise<void>
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdateContent?: (id: string, content: string) => void
  onMoveToToday?: (id: string) => void
  onStartFocus?: (task: DailyTask, anchorRect?: { top: number; left: number; width: number; height: number; right?: number; bottom?: number } | null) => void
  onResumeFocus?: (task: DailyTask) => void
  onClick?: () => void
  isHighlighted?: boolean
  isRelationHighlighted?: boolean
  highlightedSourceItemIds?: string[]
  isSelected?: boolean
  isPastDate?: boolean
  isSorting?: boolean
  showSortInsertion?: boolean
  activeChildSortId?: string | null
  focusDurationLabel?: string | null
  focusState?: 'running' | 'paused' | null
  focusSession?: FocusSessionRecord | null
  isFocusActive?: boolean
  laneMode?: boolean
  collapsedExecutionKrIds: Set<string>
  onToggleExecutionKrCollapsed: (itemId: string) => void
  selectedExecutionItemId: string | null
  onSelectExecutionItem: (item: Item) => void
  dndScope?: string
  preferDeleteFirst?: boolean
}> = ({
  task,
  linkedItemTitle,
  sourceItem,
  getChildrenOf,
  editingSourceItemId,
  setEditingSourceItemId,
  onCreateExecutionChild,
  onUpdateExecutionItemTitle,
  onDeleteExecutionItem,
  onToggleExecutionItemStatus,
  onToggle,
  onDelete,
  onUpdateContent,
  onMoveToToday,
  onStartFocus,
  onResumeFocus,
  onClick,
  isHighlighted,
  isRelationHighlighted,
  highlightedSourceItemIds = [],
  isSelected,
  isPastDate,
  isSorting,
  showSortInsertion,
  activeChildSortId,
  focusSession,
  isFocusActive = false,
  laneMode = false,
  collapsedExecutionKrIds,
  onToggleExecutionKrCollapsed,
  selectedExecutionItemId,
  onSelectExecutionItem,
  dndScope = 'main',
  preferDeleteFirst = false,
}) => {
  const entryType = task.entryType ?? 'manual'
  const isManual = entryType === 'manual'

  if (entryType === 'objective' && sourceItem) {
    const krItems = getChildrenOf(sourceItem.id, 'KR')

    return (
      <ObjectiveExecutionSection
        task={task}
        sourceItem={sourceItem}
        krItems={krItems}
        getChildrenOf={getChildrenOf}
        editingSourceItemId={editingSourceItemId}
        setEditingSourceItemId={setEditingSourceItemId}
        onCreateExecutionChild={onCreateExecutionChild}
        onUpdateExecutionItemTitle={onUpdateExecutionItemTitle}
        onDeleteExecutionItem={onDeleteExecutionItem}
        onToggleExecutionItemStatus={onToggleExecutionItemStatus}
        onDeleteTask={onDelete}
        onClick={onClick}
        isHighlighted={isHighlighted}
        highlightedSourceItemIds={highlightedSourceItemIds}
        isSorting={isSorting}
        showSortInsertion={showSortInsertion}
        activeChildSortId={activeChildSortId}
        laneMode={laneMode}
        selectedExecutionItemId={selectedExecutionItemId}
        onSelectExecutionItem={onSelectExecutionItem}
        dndScope={dndScope}
        preferDeleteFirst={preferDeleteFirst}
      />
    )
  }

  if (entryType === 'kr' && sourceItem) {
    return (
      <KRExecutionColumn
        task={task}
        item={sourceItem}
        todoItems={getChildrenOf(sourceItem.id, 'TODO')}
        editingSourceItemId={editingSourceItemId}
        setEditingSourceItemId={setEditingSourceItemId}
        onCreateExecutionChild={onCreateExecutionChild}
        onUpdateExecutionItemTitle={onUpdateExecutionItemTitle}
        onDeleteExecutionItem={onDeleteExecutionItem}
        onToggleExecutionItemStatus={onToggleExecutionItemStatus}
        onDeleteTask={onDelete}
        onClick={onClick}
        isHighlighted={isHighlighted}
        highlightedSourceItemIds={highlightedSourceItemIds}
        isSorting={isSorting}
        showSortInsertion={showSortInsertion}
        activeChildSortId={activeChildSortId}
        isSelected={isSelected}
        isCollapsed={collapsedExecutionKrIds.has(sourceItem.id)}
        onToggleCollapsed={() => onToggleExecutionKrCollapsed(sourceItem.id)}
        selectedExecutionItemId={selectedExecutionItemId}
        onSelectExecutionItem={onSelectExecutionItem}
        dndScope={dndScope}
        preferDeleteFirst={preferDeleteFirst}
      />
    )
  }

  return (
    <TaskItem
      task={task}
      onToggle={onToggle}
      onDelete={onDelete}
      onUpdateContent={onUpdateContent}
      onMoveToToday={onMoveToToday}
      onStartFocus={onStartFocus}
      onResumeFocus={onResumeFocus}
      linkedItemTitle={isManual ? null : linkedItemTitle}
      onClick={onClick}
      isHighlighted={isHighlighted}
      isRelationHighlighted={isRelationHighlighted}
      isSelected={isSelected}
      isLinked={!isManual}
      isPastDate={isPastDate}
      isSorting={isSorting}
      showSortInsertion={showSortInsertion}
      preferDeleteFirst={preferDeleteFirst}
      focusSession={focusSession}
      isFocusActive={isFocusActive}
    />
  )
}

const ObjectiveExecutionSection: React.FC<{
  task: DailyTask
  sourceItem: Item
  krItems: Item[]
  getChildrenOf: (parentId: string | null | undefined, type?: Item['type']) => Item[]
  editingSourceItemId: string | null
  setEditingSourceItemId: React.Dispatch<React.SetStateAction<string | null>>
  onCreateExecutionChild: (parentItem: Item) => Promise<void>
  onUpdateExecutionItemTitle: (itemId: string, title: string) => Promise<void>
  onDeleteExecutionItem: (itemId: string) => Promise<void>
  onToggleExecutionItemStatus: (item: Item) => Promise<void>
  onDeleteTask: (id: string) => void
  onClick?: () => void
  isHighlighted?: boolean
  highlightedSourceItemIds?: string[]
  isSelected?: boolean
  isSorting?: boolean
  showSortInsertion?: boolean
  activeChildSortId?: string | null
  laneMode?: boolean
  selectedExecutionItemId: string | null
  onSelectExecutionItem: (item: Item) => void
  dndScope?: string
  preferDeleteFirst?: boolean
}> = ({
  task,
  sourceItem,
  krItems,
  getChildrenOf,
  editingSourceItemId,
  setEditingSourceItemId,
  onCreateExecutionChild,
  onUpdateExecutionItemTitle,
  onDeleteExecutionItem,
  onToggleExecutionItemStatus,
  onDeleteTask,
  onClick,
  isHighlighted,
  highlightedSourceItemIds = [],
  isSelected,
  isSorting,
  showSortInsertion,
  activeChildSortId,
  laneMode = false,
  selectedExecutionItemId,
  onSelectExecutionItem,
  dndScope = 'main',
  preferDeleteFirst = false,
}) => {
  void onCreateExecutionChild
  void onDeleteTask
  const { open, position, handleContextMenu, closeMenu } = useExecutionContextMenu()

  return (
    <div
      data-taskboard-task-id={task.id}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`relative transition-all duration-300 ${laneMode ? '' : 'mx-6 mb-3'} ${isHighlighted ? 'animate-pulse-highlight' : ''}`}
    >
      {showSortInsertion && (
        <div className="pointer-events-none absolute left-4 right-4 top-0 z-20 -translate-y-1/2">
          <div className="relative flex items-center">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2]" />
            <span className="mx-1 h-[2px] flex-1 rounded-full bg-[#7d6cf2]" />
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2]" />
          </div>
        </div>
      )}

      <div
        className={`rounded-[18px] px-0 py-2 ${isSelected ? 'ring-1 ring-[#d8cdfc]/70 ring-offset-2 ring-offset-transparent' : ''}`}
        style={{
          boxShadow: isSorting ? '0 0 0 1px rgba(125,108,242,0.08)' : 'none',
        }}
      >
        <div className="mb-2 flex items-center gap-2 px-6">
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#7f8896]" strokeWidth={2.2} />
          <div className={`truncate text-[14px] font-semibold text-[#4d5767] ${task.isDone ? 'line-through opacity-55' : ''}`}>
            {sourceItem.title || task.content || '未命名目标'}
          </div>
        </div>

        <SortableContext items={krItems.map((kr) => `${dndScope}-execution:${kr.id}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 pl-6">
            {krItems.map((kr) => (
              <SortableExecutionColumn
                key={kr.id}
                item={kr}
                parentId={sourceItem.id}
                dndScope={dndScope}
                className="w-full"
              >
                <KRExecutionColumn
                  task={task}
                  item={kr}
                  todoItems={getChildrenOf(kr.id, 'TODO')}
                  editingSourceItemId={editingSourceItemId}
                  setEditingSourceItemId={setEditingSourceItemId}
                  onCreateExecutionChild={onCreateExecutionChild}
                  onUpdateExecutionItemTitle={onUpdateExecutionItemTitle}
                  onDeleteExecutionItem={onDeleteExecutionItem}
                  onToggleExecutionItemStatus={onToggleExecutionItemStatus}
                  onDeleteTask={onDeleteTask}
                  highlightedSourceItemIds={highlightedSourceItemIds}
                  activeChildSortId={activeChildSortId}
                  isRowHighlighted={highlightedSourceItemIds.includes(kr.id)}
                  isChildColumn
                  selectedExecutionItemId={selectedExecutionItemId}
                  onSelectExecutionItem={onSelectExecutionItem}
                />
              </SortableExecutionColumn>
            ))}

            {krItems.length === 0 && (
              <div className="px-14">
                <ExecutionCardEmpty text="这个目标下还没有关键结果" compact minimal />
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      <ExecutionContextMenu
        open={open}
        position={position}
        actions={
          preferDeleteFirst
            ? [
                {
                  label: '从执行区移除',
                  danger: true,
                  onSelect: () => {
                    closeMenu()
                    onDeleteTask(task.id)
                  },
                },
                {
                  label: '新增关键结果',
                  onSelect: () => {
                    closeMenu()
                    void onCreateExecutionChild(sourceItem)
                  },
                },
              ]
            : [
                {
                  label: '新增关键结果',
                  onSelect: () => {
                    closeMenu()
                    void onCreateExecutionChild(sourceItem)
                  },
                },
                {
                  label: '从执行区移除',
                  danger: true,
                  onSelect: () => {
                    closeMenu()
                    onDeleteTask(task.id)
                  },
                },
              ]
        }
      />
    </div>
  )
}

const KRExecutionColumn: React.FC<{
  task: DailyTask
  item: Item
  todoItems: Item[]
  editingSourceItemId: string | null
  setEditingSourceItemId: React.Dispatch<React.SetStateAction<string | null>>
  onCreateExecutionChild: (parentItem: Item) => Promise<void>
  onUpdateExecutionItemTitle: (itemId: string, title: string) => Promise<void>
  onDeleteExecutionItem: (itemId: string) => Promise<void>
  onToggleExecutionItemStatus: (item: Item) => Promise<void>
  onDeleteTask: (id: string) => void
  onClick?: () => void
  isHighlighted?: boolean
  highlightedSourceItemIds?: string[]
  isSorting?: boolean
  showSortInsertion?: boolean
  activeChildSortId?: string | null
  isChildColumn?: boolean
  isRowHighlighted?: boolean
  isSelected?: boolean
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
  selectedExecutionItemId?: string | null
  onSelectExecutionItem?: (item: Item) => void
  dndScope?: string
  preferDeleteFirst?: boolean
}> = ({
  task,
  item,
  todoItems,
  editingSourceItemId,
  setEditingSourceItemId,
  onCreateExecutionChild,
  onUpdateExecutionItemTitle,
  onDeleteExecutionItem,
  onToggleExecutionItemStatus,
  onDeleteTask,
  onClick,
  isHighlighted,
  highlightedSourceItemIds = [],
  isSorting,
  showSortInsertion,
  activeChildSortId,
  isChildColumn = false,
  isRowHighlighted = false,
  isCollapsed = false,
  onToggleCollapsed,
  selectedExecutionItemId,
  onSelectExecutionItem,
  dndScope = 'main',
  preferDeleteFirst = false,
}) => {
  void onCreateExecutionChild
  void onDeleteTask
  const { open, position, handleContextMenu, closeMenu } = useExecutionContextMenu()

  return (
    <div
      data-taskboard-task-id={task.id}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={`
        group relative mx-2 mb-1.5 rounded-[14px] transition-all duration-300
        ${isCollapsed ? 'py-0' : 'py-2'}
        ${isRowHighlighted ? 'bg-[#f8f5ff]' : 'hover:bg-[#f3f5f7]'}
        ${isHighlighted ? 'animate-pulse-highlight' : ''}
      `}
      style={{
        boxShadow: isSorting
          ? '0 0 0 1px rgba(125,108,242,0.08)'
          : 'none',
      }}
    >
      {showSortInsertion && (
        <div className="pointer-events-none absolute left-4 right-4 top-0 z-20 -translate-y-1/2">
          <div className="relative flex items-center">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2]" />
            <span className="mx-1 h-[2px] flex-1 rounded-full bg-[#7d6cf2]" />
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2]" />
          </div>
        </div>
      )}

      <div
        className={`flex gap-3 rounded-[10px] px-3 transition-colors duration-200 bg-transparent ${
          isCollapsed ? 'mb-0 items-center py-3.5 pr-14' : 'mb-1.5 items-start py-1'
        }`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleCollapsed?.()
          }}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors ${isCollapsed ? '' : 'mt-[1px]'}`}
          style={{ color: task.color || '#8a93a0' }}
          aria-label={isCollapsed ? '展开关键结果' : '收起关键结果'}
        >
          <Triangle
            className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? 'rotate-90' : 'rotate-180'}`}
            fill="currentColor"
            strokeWidth={0}
          />
        </button>

        <div className="min-w-0 flex-1">
          {isChildColumn ? (
            <EditableExecutionTitle
              item={item}
              isEditing={editingSourceItemId === item.id}
              onStartEdit={() => setEditingSourceItemId(item.id)}
              onSave={onUpdateExecutionItemTitle}
              isDone={item.status === 1}
            />
          ) : (
            <div className={`truncate pt-[1px] text-[14px] font-medium ${task.isDone ? 'text-gray-400 line-through' : 'text-[#4d5767]'}`}>
              {task.content}
            </div>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="space-y-2 pl-[58px]">
          <SortableContext items={todoItems.map((todo) => `${dndScope}-execution:${todo.id}`)} strategy={verticalListSortingStrategy}>
            {todoItems.map((todo) => (
              <SortableExecutionRow
                key={todo.id}
                item={todo}
                parentId={item.id}
                dndScope={dndScope}
                color={task.color}
                isEditing={editingSourceItemId === todo.id}
                isHighlighted={highlightedSourceItemIds.includes(todo.id)}
                isSelected={selectedExecutionItemId === todo.id}
                isSorting={activeChildSortId === `${dndScope}-execution:${todo.id}`}
                onClick={() => onSelectExecutionItem?.(todo)}
                onStartEdit={() => setEditingSourceItemId(todo.id)}
                onSave={onUpdateExecutionItemTitle}
                onDelete={onDeleteExecutionItem}
                onToggle={onToggleExecutionItemStatus}
              />
            ))}
          </SortableContext>

          {todoItems.length === 0 && (
            <ExecutionCardEmpty text="还没有待办" compact minimal />
          )}
        </div>
      )}

      {isRowHighlighted && (
        <div className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-[#d8cdfc]" />
      )}

      <ExecutionContextMenu
        open={open}
        position={position}
        actions={
          preferDeleteFirst && !isChildColumn
            ? [
                {
                  label: '从执行区移除',
                  danger: true,
                  onSelect: () => {
                    closeMenu()
                    onDeleteTask(task.id)
                  },
                },
                {
                  label: '编辑',
                  onSelect: () => {
                    closeMenu()
                    setEditingSourceItemId(item.id)
                  },
                },
                {
                  label: '新增待办',
                  onSelect: () => {
                    closeMenu()
                    void onCreateExecutionChild(item)
                  },
                },
              ]
            : [
                {
                  label: '编辑',
                  onSelect: () => {
                    closeMenu()
                    setEditingSourceItemId(item.id)
                  },
                },
                {
                  label: '新增待办',
                  onSelect: () => {
                    closeMenu()
                    void onCreateExecutionChild(item)
                  },
                },
                {
                  label: isChildColumn ? '删除关键结果' : '从执行区移除',
                  danger: true,
                  onSelect: () => {
                    closeMenu()
                    if (isChildColumn) {
                      void onDeleteExecutionItem(item.id)
                    } else {
                      onDeleteTask(task.id)
                    }
                  },
                },
              ]
        }
      />
    </div>
  )
}

const EditableExecutionTitle: React.FC<{
  item: Item
  isEditing: boolean
  isDone?: boolean
  onStartEdit: () => void
  onSave: (itemId: string, title: string) => Promise<void>
}> = ({ item, isEditing, isDone = false, onStartEdit, onSave }) => {
  const [value, setValue] = useState(item.title)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(item.title)
  }, [item.id, item.title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const commit = useCallback(async () => {
    const nextValue = value.trim()
    await onSave(item.id, nextValue || '未命名')
  }, [item.id, onSave, value])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void commit()
          } else if (event.key === 'Escape') {
            setValue(item.title)
          }
        }}
        className="w-full bg-transparent text-[14px] font-semibold text-[#4d5767] outline-none"
        placeholder="输入关键结果"
      />
    )
  }

  return (
    <div
      onDoubleClick={(event) => {
        event.stopPropagation()
        onStartEdit()
      }}
      className={`truncate text-[14px] font-semibold text-[#4d5767] ${isDone ? 'line-through opacity-55' : ''}`}
    >
      {item.title || '未命名'}
    </div>
  )
}

const ExecutionCardEmpty: React.FC<{ text: string; compact?: boolean; minimal?: boolean }> = ({ text, compact = false, minimal = false }) => (
  <div className={`${minimal ? 'rounded-none border-0 bg-transparent px-0' : 'rounded-[18px] border border-dashed border-[#ebe5dc] bg-[#fbfaf7] px-4'} text-[12px] text-[#a1a9b6] ${compact ? 'py-2' : 'py-4'}`}>
    {text}
  </div>
)

const CircleCheck: React.FC<{
  done: boolean
  color?: string | null
  size?: 'sm' | 'md'
  shape?: 'circle' | 'square'
}> = ({ done, color, size = 'md', shape = 'circle' }) => {
  const sizeClass = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-5 w-5'
  const isSquare = shape === 'square'
  const doneColor = '#9ca3af'

  return (
    <span
      className={`flex items-center justify-center border-2 bg-white ${isSquare ? 'rounded-[4px]' : 'rounded-full'} ${sizeClass}`}
      style={{
        borderColor: done ? doneColor : isSquare ? '#d1d5db' : color || '#7d6cf2',
        backgroundColor: done ? doneColor : '#ffffff',
      }}
    >
      {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </span>
  )
}

interface ExecutionContextAction {
  label: string
  onSelect: () => void
  danger?: boolean
}

function useExecutionContextMenu() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setPosition({ x: event.clientX, y: event.clientY })
    setOpen(true)
  }, [])

  const closeMenu = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    if (!open) return

    const handleClick = () => setOpen(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  return {
    open,
    position,
    handleContextMenu,
    closeMenu,
  }
}

const ExecutionContextMenu: React.FC<{
  open: boolean
  position: { x: number; y: number }
  actions: ExecutionContextAction[]
}> = ({ open, position, actions }) => {
  if (!open || actions.length === 0) return null

  return createPortal((
    <div
      className="fixed z-[280] min-w-[160px] rounded-xl border border-black/[0.08] bg-white/96 py-1 shadow-[0_16px_36px_rgba(15,23,42,0.16)] backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
      onClick={(event) => event.stopPropagation()}
    >
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => action.onSelect()}
          className={`flex w-full items-center px-4 py-2 text-left text-[14px] transition-colors ${
            action.danger
              ? 'text-[#c84b4b] hover:bg-red-50'
              : 'text-[#4c5461] hover:bg-black/[0.04]'
          }`}
        >
          {action.label}
        </button>
      ))}
    </div>
  ), document.body)
}

const EditableExecutionRow: React.FC<{
  item: Item
  parentId?: string | null
  color?: string | null
  isEditing: boolean
  isHighlighted?: boolean
  isSelected?: boolean
  isSorting?: boolean
  subtitle?: string
  trailingIcon?: React.ReactNode
  onClick?: () => void
  onStartEdit: () => void
  onSave: (itemId: string, title: string) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
  onToggle: (item: Item) => Promise<void>
  dndScope?: string
}> = ({
  item,
  color,
  isEditing,
  isHighlighted = false,
  isSelected = false,
  isSorting = false,
  subtitle,
  trailingIcon,
  onClick,
  onStartEdit,
  onSave,
  onDelete,
  onToggle,
  dndScope,
}) => {
  void dndScope
  const { open, position, handleContextMenu, closeMenu } = useExecutionContextMenu()
  const [value, setValue] = useState(item.title)
  const inputRef = React.useRef<HTMLInputElement>(null)

  useEffect(() => {
    setValue(item.title)
  }, [item.id, item.title])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const commit = useCallback(async () => {
    const nextValue = value.trim()
    await onSave(item.id, nextValue || '未命名')
  }, [item.id, onSave, value])

  return (
    <div
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      onContextMenu={handleContextMenu}
      onDoubleClick={(event) => {
        event.stopPropagation()
        onStartEdit()
      }}
      className={`group/row flex items-center gap-3 rounded-[12px] border px-3 py-2.5 transition-all duration-200 ${
        isHighlighted
          ? 'border-[#d8cdfc] bg-[#f6f1ff]'
          : isSelected
            ? 'border-[#e1e5eb] bg-[#f4f6f8]'
            : 'border-transparent bg-transparent hover:border-[#eaedf2] hover:bg-[#f7f8fa]'
      }`}
      style={{
        opacity: isSorting ? 0.92 : 1,
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          void onToggle(item)
        }}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center"
      >
        <CircleCheck
          done={item.status === 1}
          color={color}
          size={item.type === 'TODO' ? 'sm' : 'md'}
          shape="circle"
        />
      </button>

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void commit()
              } else if (event.key === 'Escape') {
                setValue(item.title)
              }
            }}
            className="w-full bg-transparent text-[14px] font-medium text-[#8a919c] outline-none"
            placeholder={item.type === 'KR' ? '输入关键结果' : '输入待办'}
          />
        ) : (
          <div className={`truncate text-[14px] font-medium ${item.status === 1 ? 'text-gray-400 line-through' : isSelected ? 'text-[#596273]' : 'text-[#8a919c] group-hover/row:text-[#596273]'}`}>
            {item.title || '未命名'}
          </div>
        )}
        {subtitle && !isEditing && (
          <div className="mt-0.5 text-[12px] text-[#8a919c]">{subtitle}</div>
        )}
      </div>

      {trailingIcon}

      <button
        type="button"
        onClick={() => void onDelete(item.id)}
        className="hidden"
      >
        删
      </button>

      <ExecutionContextMenu
        open={open}
        position={position}
        actions={[
          {
            label: '编辑',
            onSelect: () => {
              closeMenu()
              onStartEdit()
            },
          },
          {
            label: '删除',
            danger: true,
            onSelect: () => {
              closeMenu()
              void onDelete(item.id)
            },
          },
        ]}
      />
    </div>
  )
}

const SortableExecutionRow: React.FC<React.ComponentProps<typeof EditableExecutionRow>> = (props) => {
  const dndScope = (props as React.ComponentProps<typeof EditableExecutionRow> & { dndScope?: string }).dndScope ?? 'main'
  const sortableId = `${dndScope}-execution:${props.item.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      dragKind: 'execution-child-sort',
      itemId: props.item.id,
      parentId: props.parentId,
      itemType: props.item.type,
      title: props.item.title || '未命名',
      type: props.item.type,
      content: props.item.title || '未命名',
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: transition || 'transform 140ms cubic-bezier(0.22, 0.9, 0.24, 1)',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <EditableExecutionRow {...props} isSorting={props.isSorting || isDragging} />
    </div>
  )
}

const SortableExecutionColumn: React.FC<{
  item: Item
  parentId?: string | null
  className?: string
  children: React.ReactNode
  dndScope?: string
}> = ({ item, parentId, className, children, dndScope = 'main' }) => {
  const sortableId = `${dndScope}-execution:${item.id}`
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: {
      dragKind: 'execution-child-sort',
      itemId: item.id,
      parentId,
      itemType: item.type,
      title: item.title || '未命名',
      type: item.type,
      content: item.title || '未命名',
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={className}
      style={{
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: transition || 'transform 140ms cubic-bezier(0.22, 0.9, 0.24, 1)',
        opacity: isDragging ? 0.36 : 1,
      }}
    >
      {children}
    </div>
  )
}

const SortableTaskRow: React.FC<{ sortableId: string; taskId: string; title: string; children: React.ReactNode }> = ({ sortableId, taskId, title, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    data: { dragKind: 'taskboard-sort', title, type: 'TODO' },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-taskboard-sort-id={taskId}
      className="relative"
      style={{
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: transition || 'transform 140ms cubic-bezier(0.22, 0.9, 0.24, 1)',
        opacity: isDragging ? 0.22 : 1,
      }}
    >
      {children}
    </div>
  )
}
