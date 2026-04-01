import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'

// 拖拽项类型
export interface DragItem {
  id: string
  type: 'O' | 'KR' | 'TODO'
  title: string
  content: string
  color?: string | null
  parentId?: string | null
}

// Context 类型
interface DragContextType {
  activeItem: DragItem | null
  setActiveItem: (item: DragItem | null) => void
}

const DragContext = createContext<DragContextType | null>(null)

export const useDragContext = () => {
  const context = useContext(DragContext)
  if (!context) {
    throw new Error('useDragContext must be used within DragProvider')
  }
  return context
}

interface DragProviderProps {
  children: React.ReactNode
  onDragEnd?: (item: DragItem) => void
}

export const DragProvider: React.FC<DragProviderProps> = ({ children, onDragEnd }) => {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null)

  // 强制重置 Sensor：去掉所有 activationConstraint 约束
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // 零延迟响应：去掉所有约束
      activationConstraint: undefined,
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // 验证 Context 活性：红色错误 log
    console.error('DND_ACTIVE: Start detected!', event.active.id)
    const { active } = event
    const item = active.data.current as DragItem
    setActiveItem(item)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    console.log('[DragProvider] DragEnd:', event.active.id, 'over:', event.over?.id)
    const { active, over } = event
    setActiveItem(null)

    if (over && over.id === 'main-board-drop-zone') {
      const item = active.data.current as DragItem
      console.log('[DragProvider] 拖入 MainBoard:', item)
      onDragEnd?.(item)
    }
  }, [onDragEnd])

  return (
    <DragContext.Provider value={{ activeItem, setActiveItem }}>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeItem ? (
            <div 
              className="px-4 py-3 bg-white/90 rounded-xl shadow-2xl border border-gray-200"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                pointerEvents: 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-gray-800">{activeItem.title}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragContext.Provider>
  )
}
