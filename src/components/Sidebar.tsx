import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, Circle, Square, Triangle, Plus, Trash2, CalendarPlus } from 'lucide-react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDndMonitor } from '@dnd-kit/core'
import { SegmentedControl } from './SegmentedControl'
import { useSidebarTheme } from '../contexts/SidebarThemeContext'
import { useDatabase, type ResetLevel, type ReorderPreviewPosition } from '../hooks/useDatabase'
import { DraggableTodoItem } from './dnd/DraggableTodoItem'

// UI 展示用的 ObjectiveItem 接口
interface ObjectiveItemUI {
  id: string
  label: string
  iconType: 'objective' | 'keyresult' | 'todo'
  level: 1 | 2 | 3
  expanded?: boolean
  dbId: string
  hasChildren?: boolean
  color?: string | null
  status?: number
}

const ObjectiveContainerIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 24 24" className="h-[13px] w-[13px]" aria-hidden="true">
    <path
      d="M3.8 7.8c0-1 .8-1.8 1.8-1.8h4.1c.5 0 1 .2 1.4.6l1.1 1.1c.2.2.4.3.7.3h5.6c1 0 1.8.8 1.8 1.8v6.6c0 1-.8 1.8-1.8 1.8H5.6c-1 0-1.8-.8-1.8-1.8V7.8Z"
      fill={color}
    />
    <path
      d="M4.6 9.8c0-.5.4-.9.9-.9h12.9c.5 0 .9.4.9.9v.8H4.6v-.8Zm0 1.9h14.7v4.4c0 .5-.4.9-.9.9H5.5c-.5 0-.9-.4-.9-.9v-4.4Z"
      fill="rgba(255,255,255,0.94)"
    />
  </svg>
)

const TreeToggleTriangle: React.FC<{ expanded: boolean }> = ({ expanded }) => (
  <svg
    viewBox="0 0 12 12"
    className={`h-3 w-3 transition-transform duration-200 ${expanded ? 'rotate-0' : '-rotate-90'}`}
    style={{ transformOrigin: '50% 50%' }}
    aria-hidden="true"
  >
    <path d="M2.2 3.1 6 9 9.8 3.1Z" fill="currentColor" />
  </svg>
)

const SIDEBAR_ROW_LAYOUT = {
  rowVerticalPaddingClass: {
    1: 'py-2.5',
    2: 'py-2',
    3: 'py-2',
  },
  rowGapClass: 'gap-2',
  containerMarginLeft: {
    1: 0,
    2: 18,
    3: 52,
  },
  containerPaddingLeft: {
    1: 10,
    2: 26,
    3: 16,
  },
  textClassName: {
    1: 'font-semibold text-[14px] tracking-[-0.01em]',
    2: 'font-semibold text-[13px]',
    3: 'font-normal text-[13px]',
  },
  textColor: {
    1: '#171c24',
    2: '#3f4956',
    3: '#5f6a78',
  },
  objectiveIcon: {
    filledBackground: '#171c24',
    emptyBackground: '#8f98a8',
    iconColor: '#ffffff',
  },
  activeRowBackground: 'rgba(132, 141, 154, 0.14)',
  hoverRowBackground: 'rgba(132, 141, 154, 0.14)',
  activeRowBorder: 'transparent',
  activeRowShadow: 'none',
} as const

const SIDEBAR_TRACK_LAYOUT = {
  objectiveAxisLeft: 22,
  // 所有树状线都从同一套行内坐标推导，避免靠“试数值”补位置
  krCheckboxCenter:
    SIDEBAR_ROW_LAYOUT.containerMarginLeft[2] +
    SIDEBAR_ROW_LAYOUT.containerPaddingLeft[2] +
    8,
} as const

const SIDEBAR_TREE_LAYOUT = {
  axisLeft: SIDEBAR_TRACK_LAYOUT.objectiveAxisLeft,
  axisColor: '#e7e3dc',
  groupGapClass: 'gap-0',
  contentGapClass: 'gap-0',
  childrenStackGapClass: 'mt-2',
  groupBottomGapClass: 'pb-2',
  nestedTodoGapClass: 'mt-1',
  objectiveAxisTop: 46,
  objectiveAxisBottom: 0,
  toggleOffsetLeft: -10,
  toggleSize: 20,
  toggleGlyphSize: 12,
  toggleLineGapWidth: 8,
  toggleLineGapHeight: 24,
  activeKrInsetLeft: 20,
  activeTodoInsetLeft: 9,
  todoLineLeft: SIDEBAR_TRACK_LAYOUT.krCheckboxCenter,
  todoRowHeight: 42,
  todoLineBottomGap: 10,
  krStackClass: 'space-y-2',
  todoStackClass: 'space-y-2',
} as const

// 颜色配置 - 低饱和不透明底色 + 优雅阴影
export const COLOR_OPTIONS = [
  { key: 'none', label: '默认', bgColor: 'transparent', textColor: '#364152', shadow: 'none' },
  { key: 'graphite', label: '石墨黑', bgColor: '#171c24', textColor: '#171c24', shadow: 'none' },
  { key: 'blue', label: '提醒蓝', bgColor: '#0A84FF', textColor: '#0A84FF', shadow: 'none' },
  { key: 'red', label: '计划红', bgColor: '#FF453A', textColor: '#FF453A', shadow: 'none' },
  { key: 'orange', label: '旗标橙', bgColor: '#FF9F0A', textColor: '#FF9F0A', shadow: 'none' },
  { key: 'green', label: '分配绿', bgColor: '#30D158', textColor: '#30D158', shadow: 'none' },
  { key: 'purple', label: '提醒紫', bgColor: '#BF5AF2', textColor: '#BF5AF2', shadow: 'none' },
  { key: 'teal', label: '湖水青', bgColor: '#40C8E0', textColor: '#40C8E0', shadow: 'none' },
]

interface SidebarProps {
  activeObjective?: string
  onSetActive?: (id: string) => void
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void
  onOpenObjectiveBoard?: (item: { id: string; title: string; color?: string | null }) => void
  refreshTrigger?: number
  shouldScrollToActive?: boolean // 是否自动滚动到选中项（中间面板触发时为 true）
  sliderStyle?: 'bead' | 'pill'
  onOpenWorkspaceThemeMenu?: (position: { x: number; y: number }) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ activeObjective: externalActiveObjective, onSetActive, onAddToDailyTasks, onOpenObjectiveBoard, refreshTrigger, shouldScrollToActive = false, sliderStyle = 'bead', onOpenWorkspaceThemeMenu }) => {
  const [internalActiveObjective, setInternalActiveObjective] = useState<string>('obj-1')
  const [activeSortId, setActiveSortId] = useState<string | null>(null)
  const [overSortId, setOverSortId] = useState<string | null>(null)
  const [previewPosition, setPreviewPosition] = useState<ReorderPreviewPosition>(null)
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)

  // 使用外部或内部的 activeObjective
  const activeObjective = externalActiveObjective ?? internalActiveObjective
  const setActiveObjective = onSetActive ?? setInternalActiveObjective
  const { themeConfig } = useSidebarTheme()
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const navRef = useRef<HTMLElement>(null)
  const lastProcessedIdRef = useRef<string | null>(null)

  // 使用数据库 Hook
  const {
    items,
    loading,
    error,
    editingId,
    toggleExpand,
    updateTitle,
    updateStatus,
    resetExpandedState,
    createSibling,
    createChild,
    deleteItem,
    clearEditingId,
    refresh,
    expandAncestors,
    reorderItems,
    getReorderPreviewTarget,
  } = useDatabase()

  useDndMonitor({
    onDragStart: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      if (activeData?.dragKind === 'sidebar-sort') {
        setActiveSortId(String(event.active.id))
      }
    },
    onDragOver: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      const overData = event.over?.data.current as { dragKind?: string } | undefined
      const translatedRect = event.active.rect.current.translated
      const pointerY = translatedRect ? translatedRect.top + translatedRect.height / 2 : null

      if (activeData?.dragKind === 'sidebar-sort' && overData?.dragKind === 'sidebar-sort') {
        const preview = getReorderPreviewTarget(String(event.active.id), pointerY)
        setOverSortId(preview.overId)
        setPreviewPosition(preview.position)
      } else {
        setOverSortId(null)
        setPreviewPosition(null)
      }
    },
    onDragEnd: (event) => {
      const activeData = event.active.data.current as { dragKind?: string } | undefined
      const overData = event.over?.data.current as { dragKind?: string } | undefined

      setActiveSortId(null)
      setOverSortId(null)
      setPreviewPosition(null)

      if (activeData?.dragKind !== 'sidebar-sort' || overData?.dragKind !== 'sidebar-sort') {
        return
      }

      void reorderItems(String(event.active.id), String(event.over?.id), previewPosition).then((didMove) => {
        if (didMove) {
          const movedId = String(event.active.id)
          setRecentlyMovedId(movedId)
          window.setTimeout(() => {
            setRecentlyMovedId((current) => (current === movedId ? null : current))
          }, 1400)
        }
      })
    },
    onDragCancel: () => {
      setActiveSortId(null)
      setOverSortId(null)
      setPreviewPosition(null)
    },
  })

  // 当外部 activeObjective 变化时，自动展开父级
  useEffect(() => {
    // 避免重复处理同一个 ID，防止无限循环
    if (externalActiveObjective && externalActiveObjective !== lastProcessedIdRef.current && items.length > 0) {
      lastProcessedIdRef.current = externalActiveObjective

      // 展开所有父级节点（使用 setTimeout 避免阻塞渲染）
      setTimeout(() => {
        expandAncestors(externalActiveObjective)
      }, 0)
    }
  }, [externalActiveObjective, items, expandAncestors])

  // 单独的 effect 处理滚动，监听 shouldScrollToActive
  useEffect(() => {
    if (shouldScrollToActive && externalActiveObjective && items.length > 0) {
      setTimeout(() => {
        // 尝试通过 dbId 查找元素
        let element = itemRefs.current.get(externalActiveObjective)

        // 如果没找到，尝试通过 id 查找（兼容两种 ID 格式）
        if (!element) {
          const item = items.find(i => i.dbId === externalActiveObjective || i.id === externalActiveObjective)
          if (item) {
            element = itemRefs.current.get(item.dbId) || itemRefs.current.get(item.id)
          }
        }

        if (element && navRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 400) // 等待展开动画完成
    }
  }, [shouldScrollToActive, externalActiveObjective, items])

  // 当 refreshTrigger 变化时，刷新 Sidebar 数据（用于中间面板勾选后同步左侧状态）
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refresh()
    }
  }, [refreshTrigger, refresh])



  // 更新目标文字
  const handleUpdateLabel = async (dbId: string, newLabel: string) => {
    await updateTitle(dbId, newLabel)
  }

  // 切换展开/收起
  const handleToggleExpand = (id: string) => {
    toggleExpand(id)
  }

  // 判断是否有子项
  const hasChildren = (itemId: string) => {
    const item = items.find((obj) => obj.id === itemId)
    return item?.hasChildren || false
  }

  // 处理进度条切换
  const [sliderPercentage, setSliderPercentage] = useState(0)

  const handleViewModeChange = (mode: string, percentage: number) => {
    const modeMap: Record<string, ResetLevel> = {
      'objectives': 'objectives',
      'key-results': 'keyresults',
      'todos': 'todos',
    }
    const resetLevel = modeMap[mode] || 'objectives'
    resetExpandedState(resetLevel)
    setSliderPercentage(percentage)
  }

  // 根据百分比获取标题文案
  const getBreadcrumbText = () => {
    if (sliderPercentage <= 30) return { text: '目标', range: 'O' }
    if (sliderPercentage <= 70) return { text: '目标 > 关键结果', range: 'O > KR' }
    return { text: '目标 > 关键结果 > 待办', range: 'O > KR > DO' }
  }

  const breadcrumb = getBreadcrumbText()

  // 处理创建同级
  const handleCreateSibling = async (currentId: string) => {
    await createSibling(currentId)
  }

  // 处理创建子级
  const handleCreateChild = async (parentId: string) => {
    await createChild(parentId)
  }

  // 处理删除
  const handleDelete = async (id: string, index: number) => {
    console.log("[DIAG] Sidebar Delete Triggered for item:", id)
    const result = await deleteItem(id)
    console.log("[DIAG] Sidebar Delete result:", result)
    if (result.success) {
      const prevIndex = Math.max(0, index - 1)
      const prevItem = items[prevIndex]
      if (prevItem && prevItem.id !== id) {
        setActiveObjective(prevItem.id)
      }
    }
  }

  // 处理创建一级目标
  const [newObjectiveId, setNewObjectiveId] = useState<string | null>(null)

  const handleCreateObjective = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.database) {
        const newId = crypto.randomUUID()
        await (window as any).electronAPI.database.createItemAtTop({
          id: newId,
          type: 'O',
          parent_id: null,
          title: '',
          content: '',
          status: 0,
        })
        setNewObjectiveId(newId)
        await refresh()
      }
    } catch (err) {
      console.error('[Sidebar] 创建一级目标失败:', err)
    }
  }

  // 处理更新颜色
  const handleUpdateColor = async (dbId: string, colorKey: string) => {
    console.log("[DIAG] Color Change Triggered for item:", dbId, "color:", colorKey)
    const colorOption = COLOR_OPTIONS.find(c => c.key === colorKey)
    if (!colorOption) return

    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.database) {
        await (window as any).electronAPI.database.updateItem(dbId, {
          color: colorKey === 'none' ? null : colorKey
        })
        console.log("[DIAG] Color updated in DB, refreshing...")
        await refresh()
        console.log("[DIAG] Refresh completed")
      }
    } catch (err) {
      console.error('[Sidebar] 更新颜色失败:', err)
    }
  }

  const handleSidebarContextMenu = (e: React.MouseEvent) => {
    if (!onOpenWorkspaceThemeMenu) return
    e.preventDefault()
    onOpenWorkspaceThemeMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <aside
      onContextMenu={handleSidebarContextMenu}
      className="w-full h-full flex flex-col transition-all duration-300"
      style={{
        background: 'transparent',
        color: themeConfig.textColor,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: 'none',
      }}
    >
      {/* 可拖拽的上边栏区域 */}
      <div className="app-drag-region flex-shrink-0 px-3">
        <div className="traffic-light-space" />
        <SegmentedControl
          defaultValue="objectives"
          onChange={handleViewModeChange}
          sliderStyle={sliderStyle}
        />
      </div>

      <nav ref={navRef} className="flex-1 px-4 overflow-y-auto scrollbar-hide hover:scrollbar-show">
        <div className="mt-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              {/* 面包屑标题 - 无动画即时切换 */}
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ 
                  color: themeConfig.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(74, 78, 105, 0.62)',
                }}
              >
                {breadcrumb.text}
              </div>
            </div>
            <button
              onClick={() => handleCreateObjective()}
              className="p-1 rounded hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
              title="添加目标"
            >
              <Plus className="w-4 h-4" style={{ color: themeConfig.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }} />
            </button>
          </div>

          {loading && (
            <div className="px-3 py-4 text-sm opacity-50">加载中...</div>
          )}

          {error && (
            <div className="px-3 py-4 text-sm text-red-500">加载失败: {error}</div>
          )}

          <div className="mt-1">
            <ObjectiveList
              items={items}
              activeObjective={activeObjective}
              editingId={editingId}
              newObjectiveId={newObjectiveId}
              onSetActive={setActiveObjective}
              onUpdateLabel={handleUpdateLabel}
              onToggleExpand={handleToggleExpand}
              onCreateSibling={handleCreateSibling}
              onCreateChild={handleCreateChild}
              onDelete={handleDelete}
              onUpdateColor={handleUpdateColor}
              onClearEditing={clearEditingId}
              onClearNewObjective={() => setNewObjectiveId(null)}
              hasChildren={hasChildren}
              itemRefs={itemRefs}
              onAddToDailyTasks={onAddToDailyTasks}
              onToggleStatus={updateStatus}
              activeSortId={activeSortId}
              overSortId={overSortId}
              previewPosition={previewPosition}
              recentlyMovedId={recentlyMovedId}
              onOpenObjectiveBoard={onOpenObjectiveBoard}
            />
          </div>
        </div>
      </nav>

      {/* 呼吸灯动画样式 */}
      <style>{`
        @keyframes highlight-pulse {
          0%, 100% { background-color: rgba(59, 130, 246, 0.1); }
          50% { background-color: rgba(59, 130, 246, 0.3); }
        }
        .highlight-pulse {
          animation: highlight-pulse 1s ease-in-out 2;
          border-radius: 6px;
        }
        @keyframes moved-card-flash {
          0% {
            box-shadow: 0 0 0 0 rgba(125, 108, 242, 0.0);
            border-color: rgba(125, 108, 242, 0.18);
          }
          30% {
            box-shadow: 0 0 0 5px rgba(125, 108, 242, 0.12);
            border-color: rgba(125, 108, 242, 0.42);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(125, 108, 242, 0.0);
            border-color: rgba(125, 108, 242, 0.18);
          }
        }
        .moved-card-flash {
          animation: moved-card-flash 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
    </aside>
  )
}

// 目标项目组件
interface ObjectiveItemProps {
  item: ObjectiveItemUI
  isActive: boolean
  isEditing: boolean
  isNewObjective?: boolean
  isRecentlyMoved?: boolean
  onClick: () => void
  onUpdateLabel: (newLabel: string) => void
  onToggleExpand?: (id?: string) => void
  onCreateSibling: () => void
  onCreateChild: () => void
  onDelete: () => void
  onUpdateColor: (colorKey: string) => void
  onClearEditing: () => void
  onClearNewObjective?: () => void
  hasChildren?: boolean
  itemRef?: (el: HTMLDivElement | null) => void
  parentObjectiveColor?: string | null
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void
  onToggleStatus?: (dbId: string, newStatus: number) => void
  onOpenObjectiveBoard?: (item: { id: string; title: string; color?: string | null }) => void
  hideKrTriangle?: boolean
}

interface SortableSidebarItemWrapperProps {
  itemId: string
  level: 1 | 2 | 3
  title: string
  iconType: 'objective' | 'keyresult' | 'todo'
  children: React.ReactNode
  activeSortId?: string | null
  overSortId?: string | null
  previewPosition?: ReorderPreviewPosition
}

const SortableSidebarItemWrapper: React.FC<SortableSidebarItemWrapperProps> = ({
  itemId,
  level,
  title,
  iconType,
  children,
  activeSortId,
  overSortId,
  previewPosition,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    data: {
      id: itemId,
      dragKind: 'sidebar-sort',
      level,
      title,
      content: title,
      type: iconType === 'objective' ? 'O' : iconType === 'keyresult' ? 'KR' : 'TODO',
      iconType,
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-sidebar-sort-id={itemId}
      className={`relative ${isDragging ? 'z-20' : ''}`}
      style={{
        transform: isDragging ? CSS.Transform.toString(transform) : undefined,
        transition: transition || 'transform 140ms cubic-bezier(0.22, 0.9, 0.24, 1)',
        opacity: isDragging ? 0.16 : 1,
        boxShadow: isDragging ? '0 10px 18px rgba(15, 23, 42, 0.08)' : undefined,
      }}
    >
      {overSortId === itemId && activeSortId !== itemId && previewPosition && (
        <div
          className={`pointer-events-none absolute left-0 right-0 z-30 px-1 ${
            previewPosition === 'before' ? 'top-0 -translate-y-[10px]' : 'bottom-0 translate-y-[10px]'
          }`}
        >
          <div className="relative flex items-center">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2] shadow-[0_0_10px_rgba(125,108,242,0.18)]" />
            <span className="mx-1 h-[2px] flex-1 rounded-full bg-[#7d6cf2] shadow-[0_0_10px_rgba(125,108,242,0.14)]" />
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#7d6cf2] shadow-[0_0_10px_rgba(125,108,242,0.18)]" />
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({
  item,
  isActive,
  isEditing: isEditingProp,
  isNewObjective,
  isRecentlyMoved = false,
  onClick,
  onUpdateLabel,
  onToggleExpand,
  onCreateSibling,
  onCreateChild,
  onDelete,
  onUpdateColor,
  onClearEditing,
  onClearNewObjective,
  hasChildren,
  itemRef,
  parentObjectiveColor,
  onAddToDailyTasks,
  onToggleStatus,
  onOpenObjectiveBoard,
  hideKrTriangle = false,
}) => {
  const { themeConfig } = useSidebarTheme()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.label)
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const inputRef = React.useRef<HTMLInputElement>(null)

  // 统一处理进入编辑状态的逻辑
  React.useEffect(() => {
    const shouldEdit = isEditingProp || (isNewObjective && item.level === 1)
    if (shouldEdit) {
      setIsEditing(true)
      setEditValue('')
      if (isNewObjective && item.level === 1) {
        onClearNewObjective?.()
      }
    }
  }, [isEditingProp, isNewObjective, item.level, onClearNewObjective])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditValue(item.label)
  }

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdateLabel(editValue.trim())
    }
    setIsEditing(false)
    onClearEditing()
  }

  const handleCancel = () => {
    setEditValue(item.label)
    setIsEditing(false)
    onClearEditing()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      onCreateSibling()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  // 使用 requestAnimationFrame 确保 DOM 就绪后再聚焦
  React.useEffect(() => {
    if (isEditing) {
      const frameId = requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.select()
        }
      })
      return () => cancelAnimationFrame(frameId)
    }
  }, [isEditing])

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand?.(item.id)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenuPos({ x: e.clientX, y: e.clientY })
    setShowContextMenu(true)
  }

  const handleCloseContextMenu = useCallback(() => {
    setShowContextMenu(false)
  }, [])

  React.useEffect(() => {
    if (showContextMenu) {
      const handleClick = () => handleCloseContextMenu()
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [showContextMenu, handleCloseContextMenu])

  const handleCreateChildClick = () => {
    onCreateChild()
    handleCloseContextMenu()
  }

  const handleDeleteClick = () => {
    onDelete()
    handleCloseContextMenu()
  }

  const handleAddToDailyTasksClick = () => {
    if (onAddToDailyTasks && item.iconType === 'todo') {
      // 获取颜色：优先使用 TODO 自己的颜色，否则使用父级 Objective 的颜色
      const colorKey = item.color || parentObjectiveColor
      const colorOption = colorKey ? COLOR_OPTIONS.find(c => c.key === colorKey) : null
      const effectiveColor = colorOption?.textColor || null

      onAddToDailyTasks({
        id: item.dbId,
        title: item.label,
        color: effectiveColor,
        type: 'TODO',
      })
    }
    handleCloseContextMenu()
  }

  const isObjective = item.iconType === 'objective'
  const isKR = item.iconType === 'keyresult'
  const isTodo = item.iconType === 'todo'

  // 判断是否为末端 TODO（可拖拽）
  const isDraggableTodo = isTodo
  const rowTextColor = isObjective
    ? SIDEBAR_ROW_LAYOUT.textColor[1]
    : (SIDEBAR_ROW_LAYOUT.textColor[item.level] || SIDEBAR_ROW_LAYOUT.textColor[3])
  const levelPaddingLeft = (() => {
    const basePadding = SIDEBAR_ROW_LAYOUT.containerPaddingLeft[item.level]
    return basePadding
  })()
  const rowIndentStyle = {
    marginLeft: `${SIDEBAR_ROW_LAYOUT.containerMarginLeft[item.level]}px`,
    paddingLeft: `${levelPaddingLeft}px`,
  }
  const objectiveColorOption = isObjective && item.color
    ? COLOR_OPTIONS.find((colorOption) => colorOption.key === item.color)
    : null
  const objectiveIconTone = {
    backgroundColor: objectiveColorOption && objectiveColorOption.bgColor !== 'transparent'
      ? objectiveColorOption.bgColor
      : hasChildren
        ? SIDEBAR_ROW_LAYOUT.objectiveIcon.filledBackground
        : SIDEBAR_ROW_LAYOUT.objectiveIcon.emptyBackground,
    iconColor: SIDEBAR_ROW_LAYOUT.objectiveIcon.iconColor,
  }
  const rowBackgroundColor = isActive ? SIDEBAR_ROW_LAYOUT.activeRowBackground : undefined
  const hoverBackgroundColor = SIDEBAR_ROW_LAYOUT.hoverRowBackground
  const rowBoxShadow = isActive ? SIDEBAR_ROW_LAYOUT.activeRowShadow : 'none'
  const rowBorderColor = isActive ? SIDEBAR_ROW_LAYOUT.activeRowBorder : 'transparent'
  const rowTextClassName = SIDEBAR_ROW_LAYOUT.textClassName[item.level] || SIDEBAR_ROW_LAYOUT.textClassName[3]
  const rowPaddingClass = SIDEBAR_ROW_LAYOUT.rowVerticalPaddingClass[item.level] || SIDEBAR_ROW_LAYOUT.rowVerticalPaddingClass[3]
  const showInsetActiveContainer = false
  const activeInsetClassName = 'self-stretch rounded-r-macos-sm rounded-l-[10px]'
  const activeInsetStyle = undefined
  const rowBackgroundColorStyle = isActive && (isKR || isTodo || isObjective) ? 'transparent' : rowBackgroundColor
  const shouldRenderInteractiveBackground = isActive || isObjective || isKR || isTodo

  // 渲染内容
  const content = (
    <div
      ref={itemRef}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`
          group relative flex items-center
          ${SIDEBAR_ROW_LAYOUT.rowGapClass} ${rowPaddingClass}
          ${isTodo ? 'rounded-macos-sm' : 'rounded-macos-sm'}
          text-sm cursor-pointer transition-all duration-200
          ${isRecentlyMoved ? 'moved-card-flash' : ''}
          ${isActive ? 'backdrop-blur-sm border' : 'border'}
          ${isDraggableTodo ? 'pr-10' : ''}
        `}
      style={{
        color: themeConfig.textColor,
        boxShadow: rowBoxShadow,
        borderColor: rowBorderColor,
        ...rowIndentStyle,
        backgroundColor: rowBackgroundColorStyle,
      }}
    >
          {shouldRenderInteractiveBackground && (
            <div
              aria-hidden="true"
              className={`
                pointer-events-none absolute inset-y-0 right-0 z-0 rounded-r-macos-sm rounded-l-[10px]
                opacity-0 transition-opacity duration-200 group-hover:opacity-100
                ${isActive ? 'opacity-100' : ''}
              `}
              style={{
                left: `${isKR ? SIDEBAR_TREE_LAYOUT.activeKrInsetLeft : isTodo ? SIDEBAR_TREE_LAYOUT.activeTodoInsetLeft : 0}px`,
                backgroundColor: isActive ? rowBackgroundColor : hoverBackgroundColor,
              }}
            />
          )}
          {isObjective && hasChildren && (
            <div
              className={`relative z-10 flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full transition-opacity ${isObjective ? 'opacity-75 hover:opacity-100' : 'opacity-60 hover:opacity-100'}` }
              style={{ backgroundColor: objectiveIconTone.backgroundColor }}
              onClick={handleExpandClick}
            >
              <ObjectiveContainerIcon color={objectiveIconTone.iconColor} />
            </div>
          )}
          {isObjective && !hasChildren && (
            <div
              className="relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full opacity-55"
              style={{ backgroundColor: objectiveIconTone.backgroundColor }}
            >
              <ObjectiveContainerIcon color={objectiveIconTone.iconColor} />
            </div>
          )}

          {isKR && (
            <div className={`relative z-10 flex min-w-0 flex-1 items-center gap-1.5 ${showInsetActiveContainer ? activeInsetClassName : ''}`} style={activeInsetStyle}>
              {hasChildren && !hideKrTriangle && (
                <div
                  className="relative z-10 flex h-4 w-4 items-center justify-center bg-[rgba(245,245,243,0.98)] opacity-60 transition-opacity hover:opacity-100"
                  onClick={handleExpandClick}
                >
                  <Triangle
                    className={`h-3 w-3 transition-transform duration-200 ${
                      item.expanded ? 'rotate-180' : 'rotate-90'
                    }`}
                    fill="currentColor"
                    strokeWidth={0}
                  />
                </div>
              )}

              <div
                className="flex-shrink-0 cursor-pointer"
                style={{ color: rowTextColor }}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus?.(item.dbId, item.status === 1 ? 0 : 1)
                }}
              >
              {item.status === 1 ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#9ca3af]">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              ) : (
                <Circle className="h-4 w-4" strokeWidth={1.7} />
                )}
              </div>
              {!isEditing ? (
                <span
                  className={`truncate block min-w-0 flex-1 ${rowTextClassName} h-[18px] leading-[18px] ${item.status === 1 ? 'line-through opacity-50' : ''}`}
                  style={{ color: rowTextColor }}
                >
                  {item.label}
                </span>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-full min-w-0 bg-transparent border-none outline-none text-sm p-0 m-0 h-[18px] leading-[18px]"
                  style={{ color: themeConfig.textColor, fontFamily: 'inherit' }}
                />
              )}
            </div>
          )}

          {isTodo && (
            <div className={`relative z-10 flex min-w-0 flex-1 items-center gap-2 ${showInsetActiveContainer ? activeInsetClassName : ''}`} style={activeInsetStyle}>
              <div
                className="flex-shrink-0 cursor-pointer"
                style={{ color: rowTextColor }}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus?.(item.dbId, item.status === 1 ? 0 : 1)
                }}
              >
                {item.status === 1 ? (
                  <Square className="w-3 h-3" fill="currentColor" fillOpacity={0.5} strokeWidth={0} />
                ) : (
                  <Square className="w-3 h-3" strokeWidth={1.35} />
                )}
              </div>
              {!isEditing ? (
                <span
                  className={`truncate block min-w-0 flex-1 ${rowTextClassName} h-[18px] leading-[18px] ${item.status === 1 ? 'line-through opacity-50' : ''}`}
                  style={{ color: rowTextColor }}
                >
                  {item.label}
                </span>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSave}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className="w-full min-w-0 bg-transparent border-none outline-none text-sm p-0 m-0 h-[18px] leading-[18px]"
                  style={{ color: themeConfig.textColor, fontFamily: 'inherit' }}
                />
              )}
            </div>
          )}

          {!isKR && !isTodo && (
          <div className="relative z-10 min-w-0 flex-1">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                className="w-full bg-transparent border-none outline-none text-sm p-0 m-0 h-[18px] leading-[18px]"
                style={{ color: themeConfig.textColor, fontFamily: 'inherit' }}
                placeholder={item.level === 1 && editValue === '' ? '输入新目标...' : ''}
              />
            ) : (
              <span
                className={`truncate block ${rowTextClassName} h-[18px] leading-[18px] ${item.status === 1 ? 'line-through opacity-50' : ''}`}
                style={{ color: rowTextColor }}
              >
                {item.label}
              </span>
            )}
          </div>
          )}

          {isObjective && item.level === 1 && onOpenObjectiveBoard && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenObjectiveBoard({ id: item.dbId, title: item.label, color: item.color ?? null })
              }}
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-[#98a0ad] opacity-0 transition-all duration-200 hover:bg-white/60 hover:text-[#5f6880] group-hover:opacity-100"
              title="打开目标面板"
            >
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </button>
          )}
        </div>
      )

      // 如果是可拖拽的 TODO，用 DraggableTodoItem 包裹
      // 使用父级 Objective 的颜色（如果 TODO 本身没有颜色）
      const colorKey = item.color || parentObjectiveColor
      // 将颜色 key 转换为实际的颜色值
      const colorOption = colorKey ? COLOR_OPTIONS.find(c => c.key === colorKey) : null
      const effectiveColor = colorOption?.textColor || null
      const todoContent = isDraggableTodo ? (
        <DraggableTodoItem id={item.dbId} title={item.label} color={effectiveColor}>
          {content}
        </DraggableTodoItem>
      ) : (
        content
      )

      return (
        <>
          {todoContent}

          {showContextMenu && (
            <div
              className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
              style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
            >
              {isObjective && (
                <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">标记颜色</div>
                  <div className="flex flex-wrap gap-1 px-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.key}
                        onClick={() => {
                          onUpdateColor(color.key)
                          handleCloseContextMenu()
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          item.color === color.key || (!item.color && color.key === 'none')
                            ? 'border-gray-400 scale-110'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                        style={{
                          backgroundColor: color.bgColor === 'transparent' ? '#f3f4f6' : color.bgColor,
                        }}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>
              )}
              {item.iconType !== 'todo' && (
                <button
                  onClick={handleCreateChildClick}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>新建子级</span>
                </button>
              )}
              {item.iconType === 'todo' && onAddToDailyTasks && (
                <button
                  onClick={handleAddToDailyTasksClick}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-2"
                >
                  <CalendarPlus className="w-4 h-4" />
                  <span>加入今日待办</span>
                </button>
              )}
              <button
                onClick={handleDeleteClick}
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

// ObjectiveList 组件
interface ObjectiveListProps {
  items: ObjectiveItemUI[]
  activeObjective: string
  editingId: string | null
  newObjectiveId: string | null
  onSetActive: (id: string) => void
  onUpdateLabel: (dbId: string, newLabel: string) => Promise<void>
  onToggleExpand: (id: string) => void
  onCreateSibling: (id: string) => Promise<void>
  onCreateChild: (id: string) => Promise<void>
  onDelete: (id: string, index: number) => Promise<void>
  onUpdateColor: (dbId: string, colorKey: string) => Promise<void>
  onClearEditing: () => void
  onClearNewObjective: () => void
  hasChildren: (itemId: string) => boolean
  itemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null; type?: 'O' | 'KR' | 'TODO' }) => void
  onToggleStatus?: (dbId: string, newStatus: number) => void
  activeSortId?: string | null
  overSortId?: string | null
  previewPosition?: ReorderPreviewPosition
  recentlyMovedId?: string | null
  onOpenObjectiveBoard?: (item: { id: string; title: string; color?: string | null }) => void
}

const ObjectiveList: React.FC<ObjectiveListProps> = ({
  items,
  activeObjective,
  editingId,
  newObjectiveId,
  onSetActive,
  onUpdateLabel,
  onToggleExpand,
  onCreateSibling,
  onCreateChild,
  onDelete,
  onUpdateColor,
  onClearEditing,
  onClearNewObjective,
  hasChildren,
  itemRefs,
  onAddToDailyTasks,
  onToggleStatus,
  activeSortId,
  overSortId,
  previewPosition,
  recentlyMovedId,
  onOpenObjectiveBoard,
}) => {
  const { themeConfig } = useSidebarTheme()
  const buildObjectiveGroups = (sourceItems: ObjectiveItemUI[]) => {
    const groups: { objective: ObjectiveItemUI; children: ObjectiveItemUI[] }[] = []
    let currentGroup: { objective: ObjectiveItemUI; children: ObjectiveItemUI[] } | null = null

    for (const item of sourceItems) {
      if (item.level === 1) {
        currentGroup = { objective: item, children: [] }
        groups.push(currentGroup)
      } else if (currentGroup && (item.level === 2 || item.level === 3)) {
        currentGroup.children.push(item)
      }
    }

    return groups
  }

  const buildKrGroups = (children: ObjectiveItemUI[]) => {
    const groups: { kr: ObjectiveItemUI; todos: ObjectiveItemUI[] }[] = []
    let currentKR: { kr: ObjectiveItemUI; todos: ObjectiveItemUI[] } | null = null

    for (const child of children) {
      if (child.level === 2) {
        currentKR = { kr: child, todos: [] }
        groups.push(currentKR)
      } else if (currentKR && child.level === 3) {
        currentKR.todos.push(child)
      }
    }

    return groups
  }

  const objectiveGroups = buildObjectiveGroups(items)

  const renderTodoList = (todos: ObjectiveItemUI[], parentColor: string | null, index: number) => (
    <div className={`relative ${SIDEBAR_TREE_LAYOUT.nestedTodoGapClass}`}>
      <div
        className="absolute top-0 bottom-0 w-px"
        style={{
          left: `${SIDEBAR_TREE_LAYOUT.todoLineLeft}px`,
          height: `${Math.max(0, todos.length * SIDEBAR_TREE_LAYOUT.todoRowHeight - SIDEBAR_TREE_LAYOUT.todoLineBottomGap)}px`,
          backgroundColor: SIDEBAR_TREE_LAYOUT.axisColor,
        }}
      />

      <SortableContext items={todos.map((todo) => todo.dbId)} strategy={verticalListSortingStrategy}>
        <div className={SIDEBAR_TREE_LAYOUT.todoStackClass}>
          {todos.map((todo) => (
            <SortableSidebarItemWrapper
              key={todo.id}
              itemId={todo.dbId}
              level={3}
              title={todo.label}
              iconType={todo.iconType}
              activeSortId={activeSortId}
              overSortId={overSortId}
              previewPosition={previewPosition}
            >
              <ObjectiveItem
                item={todo}
                isActive={activeObjective === todo.id}
                isEditing={editingId === todo.id}
                isRecentlyMoved={recentlyMovedId === todo.dbId}
                onClick={() => onSetActive(todo.id)}
                onUpdateLabel={(newLabel) => onUpdateLabel(todo.dbId, newLabel)}
                onToggleExpand={(id) => onToggleExpand(id || todo.id)}
                onCreateSibling={() => onCreateSibling(todo.id)}
                onCreateChild={() => onCreateChild(todo.id)}
                onDelete={() => onDelete(todo.id, index)}
                onUpdateColor={(colorKey) => onUpdateColor(todo.dbId, colorKey)}
                onClearEditing={onClearEditing}
                hasChildren={hasChildren(todo.id)}
                itemRef={(el) => {
                  if (el) itemRefs.current.set(todo.dbId, el)
                }}
                parentObjectiveColor={parentColor}
                onAddToDailyTasks={onAddToDailyTasks}
                onToggleStatus={onToggleStatus}
                onOpenObjectiveBoard={onOpenObjectiveBoard}
              />
            </SortableSidebarItemWrapper>
          ))}
        </div>
      </SortableContext>
    </div>
  )

  const renderKRWithLine = (kr: ObjectiveItemUI, todos: ObjectiveItemUI[], index: number, parentColor: string | null) => {
    const krHasChildren = hasChildren(kr.id)
    const showInlineTodos = krHasChildren && kr.expanded !== false && todos.length > 0

    return (
      <div key={kr.id} className="relative">
        <div className="relative">
          {krHasChildren && (
            <div
              className="pointer-events-none absolute inset-y-0 z-[12] flex items-center"
              style={{ left: `${SIDEBAR_TREE_LAYOUT.axisLeft + SIDEBAR_TREE_LAYOUT.toggleOffsetLeft}px` }}
            >
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: `${SIDEBAR_TREE_LAYOUT.toggleLineGapWidth}px`,
                  height: `${SIDEBAR_TREE_LAYOUT.toggleLineGapHeight}px`,
                  background: themeConfig.background,
                }}
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(kr.id)
                }}
                className="pointer-events-auto relative flex items-center justify-center text-[#818a97] transition-opacity hover:opacity-100"
                style={{
                  width: `${SIDEBAR_TREE_LAYOUT.toggleSize}px`,
                  height: `${SIDEBAR_TREE_LAYOUT.toggleSize}px`,
                }}
              >
                <div
                  style={{
                    width: `${SIDEBAR_TREE_LAYOUT.toggleGlyphSize}px`,
                    height: `${SIDEBAR_TREE_LAYOUT.toggleGlyphSize}px`,
                  }}
                >
                  <TreeToggleTriangle expanded={kr.expanded !== false} />
                </div>
              </button>
            </div>
          )}

          <SortableSidebarItemWrapper
            itemId={kr.dbId}
            level={2}
            title={kr.label}
            iconType={kr.iconType}
            activeSortId={activeSortId}
            overSortId={overSortId}
            previewPosition={previewPosition}
          >
            <ObjectiveItem
              item={kr}
              isActive={activeObjective === kr.id}
              isEditing={editingId === kr.id}
              isRecentlyMoved={recentlyMovedId === kr.dbId}
              onClick={() => onSetActive(kr.id)}
              onUpdateLabel={(newLabel) => onUpdateLabel(kr.dbId, newLabel)}
              onToggleExpand={(id) => onToggleExpand(id || kr.id)}
              onCreateSibling={() => onCreateSibling(kr.id)}
              onCreateChild={() => onCreateChild(kr.id)}
              onDelete={() => onDelete(kr.id, index)}
              onUpdateColor={(colorKey) => onUpdateColor(kr.dbId, colorKey)}
              onClearEditing={onClearEditing}
              hasChildren={krHasChildren}
              itemRef={(el) => {
                if (el) itemRefs.current.set(kr.dbId, el)
              }}
              parentObjectiveColor={parentColor}
              onAddToDailyTasks={onAddToDailyTasks}
              onToggleStatus={onToggleStatus}
              onOpenObjectiveBoard={onOpenObjectiveBoard}
              hideKrTriangle={krHasChildren}
            />
          </SortableSidebarItemWrapper>
        </div>

        {showInlineTodos && renderTodoList(todos, parentColor, index)}
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${SIDEBAR_TREE_LAYOUT.groupGapClass}`}>
      <AnimatePresence mode="popLayout">
        <SortableContext items={objectiveGroups.map((group) => group.objective.dbId)} strategy={verticalListSortingStrategy}>
          {objectiveGroups.map((group, index) => {
            const krGroups = buildKrGroups(group.children)
            const showObjectiveAxis = group.children.length > 0 && index < objectiveGroups.length - 1

            return (
              <SortableSidebarItemWrapper
                key={group.objective.id}
                itemId={group.objective.dbId}
                level={1}
                title={group.objective.label}
                iconType={group.objective.iconType}
                activeSortId={activeSortId}
                overSortId={overSortId}
                previewPosition={previewPosition}
              >
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className={`relative flex flex-col ${SIDEBAR_TREE_LAYOUT.contentGapClass} ${SIDEBAR_TREE_LAYOUT.groupBottomGapClass}`}
                >
                  {showObjectiveAxis && (
                    <div
                      className="pointer-events-none absolute z-0 w-px"
                      style={{
                        left: `${SIDEBAR_TREE_LAYOUT.axisLeft}px`,
                        top: `${SIDEBAR_TREE_LAYOUT.objectiveAxisTop}px`,
                        bottom: `${SIDEBAR_TREE_LAYOUT.objectiveAxisBottom}px`,
                        backgroundColor: SIDEBAR_TREE_LAYOUT.axisColor,
                      }}
                    />
                  )}

                  <ObjectiveItem
                    item={group.objective}
                    isActive={activeObjective === group.objective.id}
                    isEditing={editingId === group.objective.id}
                    isNewObjective={newObjectiveId === group.objective.id}
                    isRecentlyMoved={recentlyMovedId === group.objective.dbId}
                    onClick={() => onSetActive(group.objective.id)}
                    onUpdateLabel={(newLabel) => onUpdateLabel(group.objective.dbId, newLabel)}
                    onToggleExpand={(id) => onToggleExpand(id || group.objective.id)}
                    onCreateSibling={() => onCreateSibling(group.objective.id)}
                    onCreateChild={() => onCreateChild(group.objective.id)}
                    onDelete={() => onDelete(group.objective.id, index)}
                    onUpdateColor={(colorKey) => onUpdateColor(group.objective.dbId, colorKey)}
                    onClearEditing={onClearEditing}
                    onClearNewObjective={onClearNewObjective}
                    hasChildren={hasChildren(group.objective.id)}
                    itemRef={(el) => {
                      if (el) itemRefs.current.set(group.objective.dbId, el)
                    }}
                    onAddToDailyTasks={onAddToDailyTasks}
                    onToggleStatus={onToggleStatus}
                    onOpenObjectiveBoard={onOpenObjectiveBoard}
                  />

                  <div className={`relative z-[1] ${SIDEBAR_TREE_LAYOUT.childrenStackGapClass}`}>
                    <SortableContext items={krGroups.map((krGroup) => krGroup.kr.dbId)} strategy={verticalListSortingStrategy}>
                      <div className={SIDEBAR_TREE_LAYOUT.krStackClass}>
                        {krGroups.map((krGroup) =>
                          renderKRWithLine(krGroup.kr, krGroup.todos, index, group.objective.color || null)
                        )}
                      </div>
                    </SortableContext>
                  </div>
                </motion.div>
              </SortableSidebarItemWrapper>
            )
          })}
        </SortableContext>
      </AnimatePresence>
    </div>
  )
}
