import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'

interface DraggableTodoItemProps {
  id: string
  title: string
  color?: string | null
  children: React.ReactNode
}

export const DraggableTodoItem: React.FC<DraggableTodoItemProps> = ({
  id,
  title,
  color,
  children,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: id,
    data: {
      id,
      type: 'TODO',
      title,
      color,
    },
  })

  return (
    <div
      ref={setNodeRef}
      className={`
        relative group
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      {/* 子元素内容 */}
      {children}

      {/* 拖拽手柄 - 只绑定 listeners/attributes，不绑定 setNodeRef */}
      <div
        {...attributes}
        {...listeners}
        className="
          absolute right-3 top-1/2 -translate-y-1/2 z-10
          w-8 h-8 flex items-center justify-center
          cursor-grab active:cursor-grabbing
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          rounded hover:bg-gray-200/50
        "
        style={{
          pointerEvents: 'auto',
        }}
        title="拖拽到中间面板"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  )
}
