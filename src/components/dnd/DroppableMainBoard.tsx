import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useDragContext } from './DragProvider'

interface DroppableMainBoardProps {
  children: React.ReactNode
  isOver?: boolean
}

export const DroppableMainBoard: React.FC<DroppableMainBoardProps> = ({
  children,
}) => {
  const { activeItem } = useDragContext()
  const { setNodeRef } = useDroppable({
    id: 'main-board-drop-zone',
  })

  const isSidebarDrop =
    !!activeItem &&
    activeItem.dragKind !== 'mainboard-sort' &&
    activeItem.dragKind !== 'execution-child-sort' &&
    activeItem.type !== 'O'

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 h-full flex flex-col overflow-hidden relative
        bg-white transition-colors duration-200
        ${isSidebarDrop ? 'bg-blue-50/50' : ''}
      `}
    >
      {/* 拖放提示遮罩 */}
      {isSidebarDrop && (
        <div className="absolute inset-0 bg-blue-100/30 border-2 border-blue-400 border-dashed rounded-lg m-2 pointer-events-none z-10 flex items-center justify-center">
          <span className="text-blue-600 font-medium">释放以添加待办</span>
        </div>
      )}
      {children}
    </div>
  )
}
