import React, { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Circle, Triangle, Plus, Trash2, CalendarPlus } from 'lucide-react'
import { SegmentedControl } from './SegmentedControl'
import { SidebarThemeSelector } from './SidebarThemeSelector'
import { VersionDisplay } from './VersionDisplay'
import { useSidebarTheme } from '../contexts/SidebarThemeContext'
import { useDatabase, type ResetLevel } from '../hooks/useDatabase'
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

// 颜色配置 - 低饱和不透明底色 + 优雅阴影
export const COLOR_OPTIONS = [
  { key: 'none', label: '默认', bgColor: 'transparent', textColor: '#1D1D1F', shadow: 'none' },
  { key: 'olive', label: '橄榄绿', bgColor: '#F0F2E8', textColor: '#5A6B3C', shadow: '0 4px 12px rgba(90, 107, 60, 0.15), 0 2px 4px rgba(90, 107, 60, 0.1)' },
  { key: 'ultramarine', label: '群青', bgColor: '#E8E8FC', textColor: '#5C5CB8', shadow: '0 4px 12px rgba(92, 92, 184, 0.15), 0 2px 4px rgba(92, 92, 184, 0.1)' },
  { key: 'blue', label: '蓝色', bgColor: '#E8F0FC', textColor: '#2A5FA7', shadow: '0 4px 12px rgba(42, 95, 167, 0.15), 0 2px 4px rgba(42, 95, 167, 0.1)' },
  { key: 'purple', label: '紫色', bgColor: '#F0E8FC', textColor: '#7C4AC7', shadow: '0 4px 12px rgba(124, 74, 199, 0.15), 0 2px 4px rgba(124, 74, 199, 0.1)' },
  { key: 'brown', label: '棕色', bgColor: '#F5EDE8', textColor: '#6B4B3C', shadow: '0 4px 12px rgba(107, 75, 60, 0.15), 0 2px 4px rgba(107, 75, 60, 0.1)' },
]

interface SidebarProps {
  activeObjective?: string
  onSetActive?: (id: string) => void
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null }) => void
  refreshTrigger?: number
  shouldScrollToActive?: boolean // 是否自动滚动到选中项（中间面板触发时为 true）
}

export const Sidebar: React.FC<SidebarProps> = ({ activeObjective: externalActiveObjective, onSetActive, onAddToDailyTasks, refreshTrigger, shouldScrollToActive = false }) => {
  const [internalActiveObjective, setInternalActiveObjective] = useState<string>('obj-1')

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
  } = useDatabase()

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
  const handleViewModeChange = (mode: string) => {
    const modeMap: Record<string, ResetLevel> = {
      'objectives': 'objectives',
      'key-results': 'keyresults',
      'todos': 'todos',
    }
    const resetLevel = modeMap[mode] || 'objectives'
    resetExpandedState(resetLevel)
  }

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

  return (
    <aside
      className="w-full h-full flex flex-col transition-all duration-300"
      style={{
        background: themeConfig.background,
        color: themeConfig.textColor,
        backdropFilter: themeConfig.blur ? 'blur(40px) saturate(150%)' : 'none',
        WebkitBackdropFilter: themeConfig.blur ? 'blur(40px) saturate(150%)' : 'none',
      }}
    >
      {/* 可拖拽的上边栏区域 */}
      <div className="app-drag-region flex-shrink-0">
        <div className="traffic-light-space" />
        <SegmentedControl
          defaultValue="objectives"
          onChange={handleViewModeChange}
        />
      </div>

      <nav ref={navRef} className="flex-1 px-3 overflow-y-auto scrollbar-hide hover:scrollbar-show">
        <div className="mt-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div
              className="text-xs font-semibold uppercase tracking-wider transition-colors duration-300"
              style={{ color: themeConfig.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
            >
              目标目录
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
            />
          </div>
        </div>
      </nav>

      <div
        className="p-3 border-t transition-colors duration-300"
        style={{ borderColor: themeConfig.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
      >
        <div className="mb-2">
          <SidebarThemeSelector />
        </div>

        <div
          className="flex items-center gap-3 px-2 py-2 rounded-macos-sm cursor-pointer transition-colors"
          style={{ color: themeConfig.textColor }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-medium">U</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">User Name</p>
            <p
              className="text-xs truncate transition-colors duration-300"
              style={{ color: themeConfig.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}
            >
              user@example.com
            </p>
          </div>
          <SettingsIcon
            className="w-4 h-4 transition-colors duration-300"
            style={{ color: themeConfig.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' }}
          />
        </div>

        {/* 版本号 */}
        <div className="mt-2 px-2">
          <VersionDisplay />
        </div>
      </div>

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
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null }) => void
  onToggleStatus?: (dbId: string, newStatus: number) => void
}

const ObjectiveItem: React.FC<ObjectiveItemProps> = ({
  item,
  isActive,
  isEditing: isEditingProp,
  isNewObjective,
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
      })
    }
    handleCloseContextMenu()
  }

  const getBackgroundColor = () => {
    // 选中状态时使用黑底，不应用自定义背景色
    return isActive ? undefined : undefined
  }

  // 容器缩进 - 用于控制容器整体位置
  const getContainerIndentStyle = () => {
    // Level 3 (TODO) 容器左边缘与竖线重合 (竖线在 40px)
    const marginMap = { 1: 0, 2: 0, 3: 40 }
    return { marginLeft: `${marginMap[item.level]}px` }
  }

  // 内容缩进 - 用于控制容器内内容的缩进
  const getIndentStyle = () => {
    // Level 3 (TODO) 减少缩进，让圆圈靠近容器左边
    const indentMap = { 1: 0, 2: 20, 3: 12 }
    return { paddingLeft: `${12 + indentMap[item.level]}px` }
  }

  const getTextStyleClass = () => {
    switch (item.level) {
      case 1: return 'font-semibold text-[14px]'
      case 2: return 'font-semibold text-[14px]'
      case 3: return 'font-semibold text-[13px]'
      default: return 'font-semibold text-[13px]'
    }
  }

  const getTextStyle = () => {
    // 选中状态下使用目标颜色
    if (isActive) {
      if (isObjective && item.color) {
        const colorOption = COLOR_OPTIONS.find(c => c.key === item.color)
        if (colorOption) return { color: colorOption.textColor }
      }
      // KR/TODO 选中时使用父级 Objective 的颜色
      if (parentObjectiveColor) {
        const colorOption = COLOR_OPTIONS.find(c => c.key === parentObjectiveColor)
        if (colorOption) return { color: colorOption.textColor }
      }
    }
    
    // 非选中状态的正常逻辑
    if (isObjective && item.color) {
      const colorOption = COLOR_OPTIONS.find(c => c.key === item.color)
      if (colorOption) return { color: colorOption.textColor }
    }
    const colors: Record<number, string> = {
      1: '#1D1D1F',
      2: '#4A4A4A',
      3: '#8B8B93',  // TODO 颜色更浅
    }
    return { color: colors[item.level] || '#B0B0B5' }
  }

  // 默认浅灰色背景色（用于新建目标）
  const DEFAULT_GRAY_BG = '#F5F5F7'

  const getObjectiveBackgroundColor = () => {
    // 选中状态下也应用 Objective 的彩色背景（作为玻璃质感的底色）
    if (isObjective) {
      if (item.color) {
        const colorOption = COLOR_OPTIONS.find(c => c.key === item.color)
        if (colorOption && colorOption.bgColor !== 'transparent') {
          return colorOption.bgColor
        }
      }
      // 如果没有设置颜色，使用默认浅灰色
        return DEFAULT_GRAY_BG
    }
    return undefined
  }

  // 默认浅灰色阴影
  const DEFAULT_GRAY_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)'

  const getObjectiveShadow = () => {
    if (isObjective) {
      // 选中状态使用阴影（玻璃质感）
      if (isActive) {
        if (item.color) {
          const colorOption = COLOR_OPTIONS.find(c => c.key === item.color)
          if (colorOption && colorOption.shadow !== 'none') {
            return colorOption.shadow
          }
        }
        // 如果没有设置颜色，使用默认浅灰色阴影
        return DEFAULT_GRAY_SHADOW
      }
    }
    return undefined
  }

  // 默认灰色描边颜色（带透明度 - 更低透明度更柔和）
  const DEFAULT_GRAY_BORDER = 'rgba(120, 120, 128, 0.15)'

  // 获取默认状态下的边框颜色（带透明度）- 一级目标默认状态带边框
  const getDefaultBorderColor = () => {
    if (!isActive && isObjective) {
      if (item.color) {
        const colorOption = COLOR_OPTIONS.find(c => c.key === item.color)
        if (colorOption) {
          // 将 hex 颜色转换为 rgba，添加 15% 透明度（更柔和）
          const hex = colorOption.textColor.replace('#', '')
          const r = parseInt(hex.substring(0, 2), 16)
          const g = parseInt(hex.substring(2, 4), 16)
          const b = parseInt(hex.substring(4, 6), 16)
          return `rgba(${r}, ${g}, ${b}, 0.15)`
        }
      }
      // 如果没有设置颜色，使用默认灰色描边
      return DEFAULT_GRAY_BORDER
    }
    return undefined
  }

  const isObjective = item.iconType === 'objective'
  const isKR = item.iconType === 'keyresult'
  const isTodo = item.iconType === 'todo'

  // 判断是否为末端 TODO（可拖拽）
  const isDraggableTodo = isTodo

  // 渲染内容
  const content = (
    <div
      ref={itemRef}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`
          flex items-center gap-2 py-3.5
          ${isTodo ? 'rounded-r-macos-sm' : 'rounded-macos-sm'}
          text-sm cursor-pointer transition-all duration-200
          ${!isActive && isObjective
            ? 'border' // 默认一级目标：1px边框，无玻璃质感
            : isActive && isObjective
              ? 'backdrop-blur-sm shadow-sm border border-white/60' // 选中一级目标：玻璃质感+阴影
              : isActive
                ? 'backdrop-blur-sm border border-white/60'
                : 'hover:bg-white/60 dark:hover:bg-gray-500/25'
          }
          ${isDraggableTodo ? 'pr-10' : ''}
        `}
      style={{
        color: themeConfig.textColor,
        backgroundColor: isActive 
          ? (getObjectiveBackgroundColor() 
              ? getObjectiveBackgroundColor() // Objective 选中时使用其原有颜色
              : 'rgba(255,255,255,0.85)') // 非 Objective 使用更明显的白色底
          : (isObjective && item.color
              ? getObjectiveBackgroundColor() // 一级目标默认状态也使用玻璃质感底色
              : (getObjectiveBackgroundColor() || getBackgroundColor())),
        boxShadow: getObjectiveShadow(),
        borderColor: getDefaultBorderColor(),
        ...getIndentStyle(),
        ...getContainerIndentStyle(),
      }}
    >
          {isObjective && hasChildren && (
            <div
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-60 hover:opacity-100"
              onClick={handleExpandClick}
            >
              {item.expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
          {isObjective && !hasChildren && <div className="flex-shrink-0 w-4" />}

          {isKR && hasChildren && (
            <div
              className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-60 hover:opacity-100"
              onClick={handleExpandClick}
            >
              <Triangle
                className={`w-3 h-3 transition-transform duration-200 ${
                  item.expanded ? 'rotate-180' : 'rotate-90'
                }`}
                fill="currentColor"
                strokeWidth={0}
              />
            </div>
          )}
          {isKR && !hasChildren && (
            <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center opacity-20">
              <Triangle className="w-3 h-3 rotate-90" fill="currentColor" strokeWidth={0} />
            </div>
          )}

          {isTodo && (
            <div
              className="flex-shrink-0 cursor-pointer pl-1"
              style={getTextStyle()}
              onClick={(e) => {
                e.stopPropagation()
                onToggleStatus?.(item.dbId, item.status === 1 ? 0 : 1)
              }}
            >
              {item.status === 1 ? (
                <Circle className="w-3.5 h-3.5" fill="currentColor" strokeWidth={0} />
              ) : (
                <Circle className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </div>
          )}

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
              className="flex-1 bg-transparent border-none outline-none text-sm p-0 m-0 h-[18px] leading-[18px]"
              style={{ color: themeConfig.textColor, fontFamily: 'inherit' }}
              placeholder={item.level === 1 && editValue === '' ? '输入新目标...' : ''}
            />
          ) : (
            <span
              className={`truncate ${getTextStyleClass()} h-[18px] leading-[18px] ${item.status === 1 ? 'line-through opacity-50' : ''}`}
              style={getTextStyle()}
            >
              {item.label}
            </span>
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

function SettingsIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
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
  onAddToDailyTasks?: (item: { id: string; title: string; color?: string | null }) => void
  onToggleStatus?: (dbId: string, newStatus: number) => void
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
}) => {
  const objectiveGroups: { objective: ObjectiveItemUI; children: ObjectiveItemUI[] }[] = []
  let currentGroup: { objective: ObjectiveItemUI; children: ObjectiveItemUI[] } | null = null

  for (const item of items) {
    if (item.level === 1) {
      currentGroup = { objective: item, children: [] }
      objectiveGroups.push(currentGroup)
    } else if (currentGroup && (item.level === 2 || item.level === 3)) {
      currentGroup.children.push(item)
    }
  }

  // 渲染 KR 及其子 TODO，带有层级线
  const renderKRWithLine = (kr: ObjectiveItemUI, todos: ObjectiveItemUI[], index: number, parentColor: string | null) => {
    const hasTodos = todos.length > 0

    return (
      <div key={kr.id} className="relative">
        {/* KR 项 */}
        <ObjectiveItem
          item={kr}
          isActive={activeObjective === kr.id}
          isEditing={editingId === kr.id}
          onClick={() => onSetActive(kr.id)}
          onUpdateLabel={(newLabel) => onUpdateLabel(kr.dbId, newLabel)}
          onToggleExpand={(id) => onToggleExpand(id || kr.id)}
          onCreateSibling={() => onCreateSibling(kr.id)}
          onCreateChild={() => onCreateChild(kr.id)}
          onDelete={() => onDelete(kr.id, index)}
          onUpdateColor={(colorKey) => onUpdateColor(kr.dbId, colorKey)}
          onClearEditing={onClearEditing}
          hasChildren={hasChildren(kr.id)}
          itemRef={(el) => {
            if (el) itemRefs.current.set(kr.dbId, el)
          }}
          parentObjectiveColor={parentColor}
          onAddToDailyTasks={onAddToDailyTasks}
          onToggleStatus={onToggleStatus}
        />

        {/* KR 下方的竖线容器 */}
        {hasTodos && kr.expanded !== false && (
          <div className="relative">
            {/* 细竖线 - 从 KR 下方延伸到所有 TODO 下方 */}
            {/* KR 三角形中心在 40px (32+8)，TODO 容器左边缘也在 40px (12+28)，竖线与容器边缘对齐 */}
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-gray-200"
              style={{ left: '40px', height: `${todos.length * 46}px` }}
            />

            {/* TODO 列表 */}
            {todos.map((todo) => (
              <ObjectiveItem
                key={todo.id}
                item={todo}
                isActive={activeObjective === todo.id}
                isEditing={editingId === todo.id}
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
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence mode="popLayout">
        {objectiveGroups.map((group, index) => (
          <motion.div
            key={group.objective.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex flex-col gap-2"
          >
            <ObjectiveItem
              item={group.objective}
              isActive={activeObjective === group.objective.id}
              isEditing={editingId === group.objective.id}
              isNewObjective={newObjectiveId === group.objective.id}
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
            />

            {/* 将 children 分组为 KR 及其下属的 TODOs */}
            {(() => {
              const krGroups: { kr: ObjectiveItemUI; todos: ObjectiveItemUI[] }[] = []
              let currentKR: { kr: ObjectiveItemUI; todos: ObjectiveItemUI[] } | null = null

              for (const child of group.children) {
                if (child.level === 2) {
                  currentKR = { kr: child, todos: [] }
                  krGroups.push(currentKR)
                } else if (currentKR && child.level === 3) {
                  currentKR.todos.push(child)
                }
              }

              return krGroups.map((krGroup) =>
                renderKRWithLine(krGroup.kr, krGroup.todos, index, group.objective.color || null)
              )
            })()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
