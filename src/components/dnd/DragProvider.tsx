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
  dragKind?: 'sidebar-sort' | 'taskboard-sort' | 'execution-child-sort'
  level?: 1 | 2 | 3
  iconType?: 'objective' | 'keyresult' | 'todo'
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
  onDragEnd?: (item: DragItem, dropZoneId?: string | null) => void
}

export const DragProvider: React.FC<DragProviderProps> = ({ children, onDragEnd }) => {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null)

  // 强制重置 Sensor：去掉所有 activationConstraint 约束
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // 轻微移动后才进入拖拽，避免普通点击/选中被误判成拖拽
      activationConstraint: {
        distance: 6,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const rawItem = active.data.current as Partial<DragItem> | undefined
    const item: DragItem | null = rawItem?.title && rawItem?.type
      ? {
          id: rawItem.id || String(active.id),
          title: rawItem.title,
          content: rawItem.content || rawItem.title,
          type: rawItem.type,
          color: rawItem.color ?? null,
          parentId: rawItem.parentId ?? null,
          dragKind: rawItem.dragKind,
          level: rawItem.level,
          iconType: rawItem.iconType,
        }
      : null

    if (item && item.dragKind !== 'execution-child-sort') {
      setActiveItem(item)
    } else {
      setActiveItem(null)
    }
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    const overData = over?.data.current as { dragKind?: string } | undefined
    const rawItem = active.data.current as Partial<DragItem> | undefined
    const item: DragItem | null = rawItem?.title && rawItem?.type
      ? {
          id: rawItem.id || String(active.id),
          title: rawItem.title,
          content: rawItem.content || rawItem.title,
          type: rawItem.type,
          color: rawItem.color ?? null,
          parentId: rawItem.parentId ?? null,
          dragKind: rawItem.dragKind,
          level: rawItem.level,
          iconType: rawItem.iconType,
        }
      : null
    setActiveItem(null)

    const overId = over?.id ? String(over.id) : null
    const droppedIntoTaskBoard =
      !!over && (
        overId?.includes('task-board-drop-zone') ||
        overId?.includes('floating-cart-drop-zone') ||
        overData?.dragKind === 'taskboard-sort'
      )

    if (droppedIntoTaskBoard && item && item.dragKind !== 'taskboard-sort' && item.dragKind !== 'execution-child-sort') {
      onDragEnd?.({
        ...item,
        dragKind: undefined,
      }, overId)
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
        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            activeItem.dragKind === 'sidebar-sort' ? (
              <div
                className="min-w-[220px] rounded-2xl border border-black/[0.06] bg-white/92 px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  pointerEvents: 'none',
                  transform: 'translateX(12px)',
                }}
              >
                <div className="flex items-center gap-2">
                  {activeItem.iconType === 'todo' ? (
                    <div className="h-4 w-4 rounded-full border border-[#8a919c]" />
                  ) : activeItem.iconType === 'keyresult' ? (
                    <div className="h-0 w-0 border-l-[7px] border-r-[7px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#7c8492] rotate-90" />
                  ) : (
                    <div className="h-4 w-4 text-[#6e7785]">{'>'}</div>
                  )}
                  <span className="truncate text-[14px] font-medium text-[#43505f]">{activeItem.title}</span>
                </div>
              </div>
            ) : (
              <div 
                className="rounded-2xl border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.34))] px-4 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  pointerEvents: 'none',
                  transform: 'translateX(14px)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium text-gray-800">{activeItem.title}</span>
                </div>
              </div>
            )
          ) : null}
        </DragOverlay>
      </DndContext>
    </DragContext.Provider>
  )
}
