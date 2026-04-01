import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { DragItem } from './DragProvider'

interface DraggableObjectiveItemProps {
  item: DragItem
  isLeaf: boolean // 是否为末端节点（TODO 类型且无子项）
  children?: React.ReactNode
}

export const DraggableObjectiveItem: React.FC<DraggableObjectiveItemProps> = ({
  item,
  isLeaf,
  children,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !isLeaf, // 只有末端节点可拖拽
  })

  // 如果不是末端节点，直接返回 children
  if (!isLeaf) {
    return <>{children}</>
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        relative group/drag flex items-center
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* 拖拽手柄 - 仅末端节点显示，始终可见但悬浮时高亮 */}
      <div
        {...attributes}
        {...listeners}
        className="
          flex-shrink-0 w-6 h-8 flex items-center justify-center
          cursor-grab active:cursor-grabbing
          opacity-40 group-hover/drag:opacity-100
          transition-all duration-150
          hover:bg-gray-200/60 rounded
          -ml-1 mr-1
        "
        title="拖拽到中间面板"
      >
        <GripVertical className="w-4 h-4 text-gray-500" />
      </div>

      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}
