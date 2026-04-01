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
  rightPanel: React.ReactNode
  leftPanelConfig?: Partial<PanelConfig>
  rightPanelConfig?: Partial<PanelConfig>
}

const DEFAULT_LEFT_CONFIG: PanelConfig = {
  id: 'left',
  minWidth: 200,
  defaultWidth: 380,
  maxWidth: 500,
}

const DEFAULT_RIGHT_CONFIG: PanelConfig = {
  id: 'right',
  minWidth: 250,
  defaultWidth: 300,
  maxWidth: 500,
}

// 拖拽把手组件
interface ResizeHandleProps {
  onResize: (delta: number) => void
  direction: 'left' | 'right'
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ onResize, direction }) => {
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
      className="relative flex-shrink-0 z-10 bg-transparent"
      style={{
        width: isDragging ? '2px' : '1px',
        cursor: 'col-resize',
      }}
      onMouseDown={handleMouseDown}
    />
  )
}

export const ResizableLayout: React.FC<ResizableLayoutProps> = ({
  leftPanel,
  centerPanel,
  rightPanel,
  leftPanelConfig = {},
  rightPanelConfig = {},
}) => {
  const leftConfig = { ...DEFAULT_LEFT_CONFIG, ...leftPanelConfig }
  const rightConfig = { ...DEFAULT_RIGHT_CONFIG, ...rightPanelConfig }

  const [leftWidth, setLeftWidth] = useState(leftConfig.defaultWidth)
  const [rightWidth, setRightWidth] = useState(rightConfig.defaultWidth)
  const containerRef = useRef<HTMLDivElement>(null)

  // 调整左侧栏宽度
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
      className="h-full w-full flex overflow-hidden"
    >
      {/* 左侧栏 */}
      <div
        className="flex-shrink-0 h-full overflow-hidden"
        style={{ width: leftWidth }}
      >
        {leftPanel}
      </div>

      {/* 左侧调整把手 */}
      <ResizeHandle onResize={handleLeftResize} direction="left" />

      {/* 中间栏 */}
      <div 
        className="flex-1 h-full overflow-hidden"
        style={{ minWidth: minCenterWidth }}
      >
        {centerPanel}
      </div>

      {/* 右侧调整把手 */}
      <ResizeHandle onResize={handleRightResize} direction="right" />

      {/* 右侧栏 */}
      <div
        className="flex-shrink-0 h-full overflow-hidden"
        style={{ width: rightWidth }}
      >
        {rightPanel}
      </div>
    </div>
  )
}

export default ResizableLayout
