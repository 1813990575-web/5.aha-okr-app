import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { DragItem } from './DragProvider'

interface DraggableSidebarItemProps {
  item: DragItem
  isLeaf: boolean // 是否为末端节点（TODO 类型）
  children?: React.ReactNode
}

export const DraggableSidebarItem: React.FC<DraggableSidebarItemProps> = ({
  item,
  isLeaf,
  children,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
    disabled: !isLeaf, // 只有末端节点可拖拽
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        relative group
        ${isDragging ? 'opacity-50' : ''}
        ${isLeaf ? 'cursor-grab active:cursor-grabbing' : ''}
      `}
    >
      {/* 拖拽手柄 - 仅末端节点显示 */}
      {isLeaf && (
        <div
          {...attributes}
          {...listeners}
          className="
            absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full
            px-1 py-1 opacity-0 group-hover:opacity-100
            cursor-grab active:cursor-grabbing
            transition-opacity duration-150
          "
          title="拖拽到中间面板"
        >
          <GripVertical className="w-4 h-4 text-gray-400 hover:text-gray-600" />
        </div>
      )}

      {children}
    </div>
  )
}
