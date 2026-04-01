import React from 'react'

export const Timeline: React.FC = () => {
  return (
    <aside className="w-full h-full bg-white border-l border-macos-gray-200 flex flex-col">
      {/* 可拖拽的上边栏区域 */}
      <div className="app-drag-region traffic-light-space flex-shrink-0" />
      
      {/* 空白的右侧面板内容区 */}
      <div className="flex-1" />
    </aside>
  )
}

export default Timeline
