import React, { useEffect, useState } from 'react'

export const Timeline: React.FC = () => {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const timeLabel = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now)

  return (
    <aside className="w-full h-full flex flex-col bg-transparent">
      {/* 可拖拽的上边栏区域 */}
      <div className="app-drag-region traffic-light-space flex-shrink-0 border-b border-black/[0.04]" />

      <div className="flex-1 px-6 pt-4">
        <div className="flex min-h-[84px] items-center justify-center rounded-[20px] border border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.42))] px-6 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_18px_rgba(23,22,19,0.05)] backdrop-blur-[18px]">
          <div className="w-full text-center text-[46px] font-semibold tracking-[0.01em] text-[#2f3844] tabular-nums [font-variant-numeric:tabular-nums] [text-shadow:0_1px_0_rgba(255,255,255,0.45)]">
            {timeLabel}
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Timeline
