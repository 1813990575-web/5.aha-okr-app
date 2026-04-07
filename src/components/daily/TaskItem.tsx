import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Check, Trash2, CalendarArrowDown } from 'lucide-react'
import type { DailyTask } from '../../store/index'

interface TaskItemProps {
  task: DailyTask & { origin?: string | null; color?: string | null }
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdateContent?: (id: string, content: string) => void
  onMoveToToday?: (id: string) => void
  linkedItemTitle?: string | null
  onClick?: () => void
  isHighlighted?: boolean
  isSelected?: boolean
  isLinked?: boolean
  isPastDate?: boolean
  isSorting?: boolean
  showSortInsertion?: boolean
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onDelete,
  onUpdateContent,
  onMoveToToday,
  onClick,
  isHighlighted,
  isSelected,
  isLinked,
  isPastDate,
  isSorting = false,
  showSortInsertion = false,
}) => {
  // 判断是否为 OKR 派生项
  const isOkrDerived = (task.entryType ?? (task.linkedGoalId ? 'todo' : 'manual')) !== 'manual'

  // 获取主题色
  const themeColor = task.color || (isOkrDerived ? '#007AFF' : null)

  // 右键菜单状态
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(task.content)
  const inputRef = useRef<HTMLInputElement>(null)

  // 处理右键菜单
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false)
  }, [])

  // 处理删除
  const handleDelete = () => {
    console.log("[DIAG] Delete Triggered for task:", task.id)
    onDelete(task.id)
    handleCloseContextMenu()
  }

  // 处理移至今日
  const handleMoveToToday = () => {
    console.log("[DIAG] Move to Today Triggered for task:", task.id)
    onMoveToToday?.(task.id)
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
        data-mainboard-task-id={task.id}
        className={`
          group relative mx-6 mb-1.5 flex items-center gap-3 rounded-2xl border border-transparent px-6 py-3.5
          transition-all duration-300 cursor-pointer
          ${task.isDone ? 'opacity-50' : ''}
          ${isHighlighted ? 'bg-blue-50/80 animate-pulse-highlight border-blue-100' : ''}
          ${isSelected ? 'bg-[#f3f5f7] border-[#e4e7eb]' : 'hover:bg-[#f7f8fa]'}
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
                  ? 'bg-gray-800 border-gray-800'
                  : 'bg-white hover:opacity-80'
                }`
              : // 原生待办：圆角矩形
                `w-5 h-5 rounded-[4px] border-2 ${task.isDone
                  ? 'bg-gray-800 border-gray-800'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
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
              className="w-full bg-transparent border-none outline-none text-[14px] text-gray-700 p-0"
              autoFocus
            />
          ) : (
            <p
              className={`
                text-[14px] font-medium transition-all duration-150 truncate whitespace-nowrap overflow-hidden
                ${task.isDone
                  ? 'text-gray-400 line-through'
                  : 'text-[#48515d]'
                }
              `}
              title={task.content}
            >
              {task.content}
            </p>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
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
          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除</span>
          </button>
        </div>
      )}
    </>
  )
}
