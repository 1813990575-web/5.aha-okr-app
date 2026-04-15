import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, Trash2, CalendarArrowDown, Timer } from 'lucide-react'
import type { DailyTask } from '../../store/index'
import { DAILY_TASK_ROW_BASE_CLASS } from './taskRowStyles'
import { type FocusSessionRecord, formatFocusDuration, getFocusElapsedMs } from './focusSessionStore'

interface TaskItemProps {
  task: DailyTask & { origin?: string | null; color?: string | null }
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdateContent?: (id: string, content: string) => void
  onMoveToToday?: (id: string) => void
  onStartFocus?: (task: DailyTask, anchorRect?: { top: number; left: number; width: number; height: number; right?: number; bottom?: number }) => void
  linkedItemTitle?: string | null
  onClick?: () => void
  isHighlighted?: boolean
  isRelationHighlighted?: boolean
  isSelected?: boolean
  isLinked?: boolean
  isPastDate?: boolean
  isSorting?: boolean
  showSortInsertion?: boolean
  preferDeleteFirst?: boolean
  focusSession?: FocusSessionRecord | null
  onResumeFocus?: (task: DailyTask) => void
  isFocusActive?: boolean
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onDelete,
  onUpdateContent,
  onMoveToToday,
  onStartFocus,
  onClick,
  isHighlighted,
  isRelationHighlighted = false,
  isSelected,
  isLinked,
  isPastDate,
  isSorting = false,
  showSortInsertion = false,
  preferDeleteFirst = false,
  focusSession = null,
  onResumeFocus,
  isFocusActive = false,
}) => {
  // 判断是否为 OKR 派生项
  const isOkrDerived = (task.entryType ?? (task.linkedGoalId ? 'todo' : 'manual')) !== 'manual'
  const deleteLabel = isLinked ? '从执行区移除' : '删除'

  // 获取主题色
  const themeColor = task.color || (isOkrDerived ? '#3860BE' : null)
  const miniTimerState = useMemo(() => {
    if (!focusSession) return null
    return focusSession.isRunning ? 'running' : 'paused'
  }, [focusSession])

  // 右键菜单状态
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [menuAnchorRect, setMenuAnchorRect] = useState<{ top: number; left: number; width: number; height: number; right: number; bottom: number } | null>(null)

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.content)
  const inputRef = useRef<HTMLInputElement>(null)

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuAnchorRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    })
    setShowContextMenu(true)
  }

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false)
  }, [])

  // 处理删除
  const handleDelete = () => {
    onDelete(task.id)
    handleCloseContextMenu()
  }

  // 处理移至今日
  const handleMoveToToday = () => {
    onMoveToToday?.(task.id)
    handleCloseContextMenu()
  }

  const handleStartFocus = () => {
    onStartFocus?.(task, menuAnchorRect ?? undefined)
    handleCloseContextMenu()
  }

  // 处理双击编辑
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    // 如果是关联的 OKR TODO，不允许在中间面板编辑（应该在左侧编辑）
    if (isLinked && onUpdateContent) {
      setIsEditing(true)
      setEditValue(task.content)
    } else if (!isLinked && onUpdateContent) {
      // 原生待办可以编辑
      setIsEditing(true)
      setEditValue(task.content)
    }
  }

  // 保存编辑
  const handleSave = () => {
    if (editValue.trim() && editValue.trim() !== task.content) {
      onUpdateContent?.(task.id, editValue.trim())
    }
    setIsEditing(false)
  }

  // 取消编辑
  const handleCancel = () => {
    setEditValue(task.content)
    setIsEditing(false)
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // 自动聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // 点击其他地方关闭菜单
  useEffect(() => {
    if (showContextMenu) {
      const handleClick = () => handleCloseContextMenu()
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [showContextMenu, handleCloseContextMenu])

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        data-taskboard-task-id={task.id}
        className={`
          ${DAILY_TASK_ROW_BASE_CLASS} cursor-pointer
          ${task.isDone ? 'opacity-50' : ''}
          ${isRelationHighlighted ? 'objective-board-linked-pulse border border-dashed border-[rgba(246,70,93,0.34)] bg-[rgba(246,70,93,0.05)]' : ''}
          ${!isRelationHighlighted && isFocusActive ? 'border-[var(--color-ink-strong)] bg-[var(--color-ink-strong)]' : ''}
          ${!isRelationHighlighted && isHighlighted ? 'bg-blue-50/80 animate-pulse-highlight border-blue-100' : ''}
          ${!isRelationHighlighted && !isFocusActive && isSelected ? 'border-[var(--color-border-soft)] bg-[var(--color-surface-soft-hover)]' : ''}
          ${!isRelationHighlighted && !isFocusActive && !isSelected ? 'hover:bg-[var(--color-surface-canvas)]' : ''}
        `}
        style={{
          boxShadow: isSorting ? 'inset 0 0 0 1px rgba(125,108,242,0.1)' : undefined,
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
        {/* 勾选框 - 方圆美学 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle(task.id)
          }}
          className={`
            flex items-center justify-center transition-all duration-150 flex-shrink-0
            ${isOkrDerived
              ? // OKR 派生项：正圆形，边框颜色继承 KR 的 color
                `w-5 h-5 rounded-full border-2 ${task.isDone
                  ? 'border-[var(--color-ink-strong)] bg-[var(--color-ink-strong)]'
                  : 'bg-white hover:opacity-80'
                }`
              : // 原生待办：圆角矩形
                `w-5 h-5 rounded-[4px] border-2 ${task.isDone
                  ? 'border-[var(--color-ink-strong)] bg-[var(--color-ink-strong)]'
                  : 'border-[var(--color-border-muted)] bg-white hover:border-[var(--color-ink-subtle)]'
                }`
            }
          `}
          style={isOkrDerived && !task.isDone ? { borderColor: themeColor || '#007AFF' } : {}}
        >
          {task.isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
        </button>

        {/* 内容区域 - todo 文字使用灰色，单行显示 */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              onClick={(e) => e.stopPropagation()}
              className="w-full border-none bg-transparent p-0 text-[14px] text-[var(--color-ink-secondary)] outline-none"
              autoFocus
            />
          ) : (
            <p
              className={`
                text-[14px] font-medium transition-all duration-150 truncate whitespace-nowrap overflow-hidden
                ${task.isDone
                  ? 'text-[var(--color-ink-disabled)] line-through'
                  : isFocusActive
                    ? 'text-white'
                    : 'text-[var(--color-ink-secondary)]'
                }
              `}
              title={task.content}
            >
              {task.content}
            </p>
          )}
        </div>

        {focusSession ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onResumeFocus?.(task)
            }}
            className={`ml-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              isFocusActive
                ? 'bg-white text-[var(--color-ink-strong)] hover:bg-white/90'
                : 'bg-white text-[var(--color-ink-strong)] hover:bg-[var(--color-surface-canvas)]'
            }`}
            aria-label="打开专注面板"
          >
            <span
              className={`h-2 w-2 flex-shrink-0 rounded-full ${
                miniTimerState === 'running'
                  ? 'animate-pulse bg-[#F6465D] shadow-[0_0_0_3px_rgba(246,70,93,0.12)]'
                  : 'bg-[var(--color-border-muted)]'
              }`}
            />
            <FocusDurationText session={focusSession} />
          </button>
        ) : null}

      </div>

      {/* 右键菜单 */}
      {showContextMenu && typeof document !== 'undefined' && createPortal((
        <div
          className="fixed z-[280] min-w-[140px] rounded-lg border border-[var(--color-border-soft)] bg-white py-1 shadow-lg"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            onClick={handleStartFocus}
            className="w-full px-4 py-2 text-left text-sm hover:bg-[#fff8e8] text-[#8b601d] flex items-center gap-2"
          >
            <Timer className="w-4 h-4" />
            <span>专注</span>
          </button>
          {preferDeleteFirst && (
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleteLabel}</span>
            </button>
          )}
          {/* 过去的日期显示"移至今日" */}
          {isPastDate && onMoveToToday && (
            <button
              onClick={handleMoveToToday}
              className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-2"
            >
              <CalendarArrowDown className="w-4 h-4" />
              <span>移至今日</span>
            </button>
          )}
          {!preferDeleteFirst && (
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleteLabel}</span>
            </button>
          )}
        </div>
      ), document.body)}
    </>
  )
}

const FocusDurationText: React.FC<{ session: FocusSessionRecord }> = React.memo(({ session }) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session.isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session.isRunning])

  const label = useMemo(() => {
    return formatFocusDuration(getFocusElapsedMs(session, now))
  }, [now, session])

  return <span className="font-semibold">{label}</span>
})
