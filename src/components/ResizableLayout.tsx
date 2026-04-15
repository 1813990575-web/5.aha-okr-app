import React, { useState, useRef, useCallback, useEffect } from 'react'

interface PanelConfig {
  id: string
  minWidth: number
  defaultWidth: number
  maxWidth?: number
}

interface ResizableLayoutProps {
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel?: React.ReactNode
  fullWidthPanel?: React.ReactNode
  leftPanelConfig?: Partial<PanelConfig>
  rightPanelConfig?: Partial<PanelConfig>
}

const DEFAULT_LEFT_CONFIG: PanelConfig = {
  id: 'left',
  minWidth: 180,
  defaultWidth: 240,
  maxWidth: 360,
}

const DEFAULT_RIGHT_CONFIG: PanelConfig = {
  id: 'right',
  minWidth: 280,
  defaultWidth: 412,
  maxWidth: 520,
}

const SIDEBAR_PANEL_BG = 'transparent'

// 拖拽把手组件
interface ResizeHandleProps {
  onResize: (delta: number) => void
  direction: 'left' | 'right'
  visibleLine?: boolean
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, direction, visibleLine = false }) => {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startXRef.current = e.clientX
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResize(direction === 'left' ? delta : -delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, onResize, direction])

  return (
    <div
      className="group relative flex-shrink-0 z-10 bg-transparent"
      style={{
        width: visibleLine ? (isDragging ? '12px' : '10px') : (isDragging ? '6px' : '4px'),
        cursor: 'col-resize',
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-full transition-colors duration-200"
        style={{
          width: isDragging ? '2px' : '1px',
          background: isDragging
            ? 'rgba(124, 138, 158, 0.32)'
            : visibleLine
              ? 'rgba(210, 214, 222, 0.9)'
              : 'transparent',
        }}
      />
    </div>
  )
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  fullWidthPanel,
  leftPanelConfig = {},
  rightPanelConfig = {},
}) => {
  const leftConfig = { ...DEFAULT_LEFT_CONFIG, ...leftPanelConfig }
  const rightConfig = { ...DEFAULT_RIGHT_CONFIG, ...rightPanelConfig }
  const hasRightPanel = Boolean(rightPanel) && !fullWidthPanel

  const [leftWidth, setLeftWidth] = useState(leftConfig.defaultWidth)
  const [rightWidth, setRightWidth] = useState(rightConfig.defaultWidth)
  const containerRef = useRef<HTMLDivElement>(null)

  // 调整左侧栏宽度（通过中间卡片左边缘拖拽）
  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((prev) => {
      const newWidth = prev + delta
      const maxWidth = leftConfig.maxWidth || Infinity
      return Math.max(leftConfig.minWidth, Math.min(newWidth, maxWidth))
    })
  }, [leftConfig.minWidth, leftConfig.maxWidth])

  // 调整右侧栏宽度
  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((prev) => {
      const newWidth = prev + delta
      const maxWidth = rightConfig.maxWidth || Infinity
      return Math.max(rightConfig.minWidth, Math.min(newWidth, maxWidth))
    })
  }, [rightConfig.minWidth, rightConfig.maxWidth])

  // 计算中间栏最小宽度
  const minCenterWidth = 400

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
    >
      <div
        className="flex h-full w-full overflow-hidden"
        style={{
          background: '#f5f5f5',
          boxShadow: 'none',
        }}
      >
        {/* 左侧栏 */}
        <div
          className="flex-shrink-0 h-full overflow-hidden"
          style={{ width: leftWidth, background: SIDEBAR_PANEL_BG }}
        >
          {leftPanel}
        </div>

        {/* 左侧与中间面板之间的拖拽带 */}
        <div className="mr-[-5px] flex h-full flex-shrink-0 items-stretch" style={{ background: SIDEBAR_PANEL_BG }}>
          <ResizeHandle onResize={handleLeftResize} direction="left" visibleLine />
        </div>

        {/* 中间 + 右侧区域 */}
        <div
          className="flex flex-1 overflow-hidden"
          style={{ minWidth: hasRightPanel ? minCenterWidth + rightWidth : minCenterWidth }}
        >
          {fullWidthPanel ? (
            <div className="min-w-0 flex-1 overflow-hidden">
              {fullWidthPanel}
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1 overflow-hidden">
                {centerPanel}
              </div>

              {hasRightPanel ? (
                <>
                  <div className="relative flex h-full flex-shrink-0 items-stretch">
                    <ResizeHandle onResize={handleRightResize} direction="right" visibleLine />
                  </div>

                  <div
                    className="relative flex-shrink-0 overflow-hidden"
                    style={{ width: rightWidth }}
                  >
                    {rightPanel}
                  </div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResizableLayout
