import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Check, Trash2, Link2 } from 'lucide-react'
import type { DailyTask } from '../../store/index'

interface TaskItemProps {
  task: DailyTask & { origin?: string | null; color?: string | null }
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdateContent?: (id: string, content: string) => void
  linkedItemTitle?: string | null
  onClick?: () => void
  isHighlighted?: boolean
  isSelected?: boolean
  isLinked?: boolean
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggle,
  onDelete,
  onUpdateContent,
  linkedItemTitle,
  onClick,
  isHighlighted,
  isSelected,
  isLinked,
}) => {
  // 判断是否为 OKR 派生项
  const isOkrDerived = task.origin === 'okr' || task.linkedGoalId

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
        className={`
          group flex items-center gap-3 px-12 py-4 mb-2
          transition-all duration-300 cursor-pointer
          ${task.isDone ? 'opacity-50' : ''}
          ${isHighlighted ? 'bg-blue-50 animate-pulse-highlight' : ''}
          ${isSelected ? 'bg-gray-100' : ''}
        `}
      >
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

        {/* 关联信息 - 放在前面，使用目标颜色，固定显示10个字 */}
        {(linkedItemTitle || task.linkedGoalId) && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link2 className="w-3 h-3 flex-shrink-0" style={{ color: themeColor || '#9CA3AF' }} />
            <span
              className="text-[14px] font-medium whitespace-nowrap"
              style={{ color: themeColor || '#9CA3AF' }}
              title={linkedItemTitle || '已关联目标'}
            >
              {linkedItemTitle
                ? linkedItemTitle.length > 10
                  ? linkedItemTitle.slice(0, 10) + '...'
                  : linkedItemTitle
                : '已关联目标'}
            </span>
          </div>
        )}

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
                  : 'text-gray-600'
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
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
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
