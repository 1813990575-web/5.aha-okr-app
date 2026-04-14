import React from 'react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { useDragContext } from './DragProvider'

interface DroppableMainBoardProps {
  children: React.ReactNode
  isOver?: boolean
  dropZoneId?: string
  className?: string
  glassMode?: boolean
}

export const DroppableMainBoard: React.FC<DroppableMainBoardProps> = ({
  children,
  dropZoneId = 'main-board-drop-zone',
  className = '',
  glassMode = false,
}) => {
  const { activeItem } = useDragContext()
  const { over } = useDndContext()
  const { setNodeRef, isOver } = useDroppable({
    id: dropZoneId,
  })

  const overData = over?.data.current as { dragKind?: string } | undefined
  const isOverSortableLane = overData?.dragKind === 'mainboard-sort'

  const isSidebarDrop =
    !!activeItem &&
    activeItem.dragKind !== 'mainboard-sort' &&
    activeItem.dragKind !== 'execution-child-sort' &&
    activeItem.type !== 'O'

  const shouldShowDropHint = isSidebarDrop && (isOver || isOverSortableLane)

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 h-full flex flex-col overflow-hidden relative
        transition-colors duration-200
        ${glassMode ? 'bg-transparent' : 'bg-white'}
        ${shouldShowDropHint ? 'bg-blue-50/50' : ''}
        ${className}
      `}
      style={glassMode ? {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.72))',
      } : undefined}
    >
      {/* 拖放提示遮罩 */}
      {shouldShowDropHint && (
        <div className="absolute inset-0 bg-blue-100/30 border-2 border-blue-400 border-dashed rounded-lg m-2 pointer-events-none z-10 flex items-center justify-center">
          <span className="text-blue-600 font-medium">释放以添加待办</span>
        </div>
      )}
      {children}
    </div>
  )
}
