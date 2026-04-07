import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface CalendarHeaderProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onOpenDatePicker: () => void
  datesWithTasks?: Set<string> // 所有有任务的日期集合
}

/**
 * 计算指定日期的时间进度
 * - 今天：根据当前时间计算实际进度
 * - 过去日期：100% 进度，0h 剩余
 * - 未来日期：0% 进度，24h 剩余
 */
function getDayProgress(date: Date) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  // 判断是今天、过去还是未来
  const diffTime = targetDate.getTime() - today.getTime()
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) {
    // 过去日期：100% 进度，0h 剩余
    return {
      progress: 100,
      remainingHours: '0.0'
    }
  } else if (diffDays > 0) {
    // 未来日期：0% 进度，24h 剩余
    return {
      progress: 0,
      remainingHours: '24.0'
    }
  } else {
    // 今天：根据当前时间计算实际进度
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    
    const totalMinutes = (endOfDay.getTime() - startOfDay.getTime()) / (1000 * 60)
    const elapsedMinutes = (now.getTime() - startOfDay.getTime()) / (1000 * 60)
    
    const progress = Math.min(100, Math.max(0, (elapsedMinutes / totalMinutes) * 100))
    const remainingHours = Math.max(0, (totalMinutes - elapsedMinutes) / 60)
    
    // 格式化剩余时间：如果是整数则不显示小数点
    const formattedRemainingHours = remainingHours % 1 === 0 
      ? remainingHours.toFixed(0) 
      : remainingHours.toFixed(1)
    
    return {
      progress: Math.round(progress),
      remainingHours: formattedRemainingHours
    }
  }
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化日期为显示文本（如：4月1日 周三）
 */
function formatDetailedDate(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekday = weekdays[date.getDay()]
  return `${month}月${day}日 ${weekday}`
}

/**
 * 获取周历数据（基于基准周，显示7天）
 * @param baseWeekDate 基准周日期（该周的某一天）
 * @param selectedDate 当前选中的日期
 * @param datesWithTasks 所有有任务的日期集合
 */
function getWeekDays(
  baseWeekDate: Date,
  selectedDate: Date,
  datesWithTasks?: Set<string>
): Array<{
  date: Date
  day: number
  weekday: string
  isSelected: boolean
  isToday: boolean
  hasContent: boolean
}> {
  const days = []
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const today = new Date()

  // 计算该周的起始日（周日）
  const startOfWeek = new Date(baseWeekDate)
  const dayOfWeek = startOfWeek.getDay()
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek)

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(date.getDate() + i)
    const isSelected = formatDateKey(date) === formatDateKey(selectedDate)
    const isToday = formatDateKey(date) === formatDateKey(today)
    const dateKey = formatDateKey(date)
    const hasContent = datesWithTasks ? datesWithTasks.has(dateKey) : false
    days.push({
      date,
      day: date.getDate(),
      weekday: weekdays[date.getDay()],
      isSelected,
      isToday,
      hasContent,
    })
  }
  return days
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  selectedDate,
  onDateChange,
  onOpenDatePicker,
  datesWithTasks,
}) => {
  const [dayProgress, setDayProgress] = useState(getDayProgress(selectedDate))

  // 当日期变化时更新进度
  useEffect(() => {
    setDayProgress(getDayProgress(selectedDate))
  }, [selectedDate])

  // 每分钟更新一次时间进度（仅当选择今天时）
  useEffect(() => {
    const interval = setInterval(() => {
      setDayProgress(getDayProgress(selectedDate))
    }, 60000) // 每分钟更新
    return () => clearInterval(interval)
  }, [selectedDate])

  // 基准周状态：用于控制周历显示
  const [baseWeekDate, setBaseWeekDate] = useState<Date>(new Date())

  const handleToday = () => {
    const today = new Date()
    onDateChange(today)
    setBaseWeekDate(today)
  }

  const handleSelectDate = (date: Date) => {
    onDateChange(date)
  }

  const handlePrevWeek = () => {
    const newDate = new Date(baseWeekDate)
    newDate.setDate(newDate.getDate() - 7)
    setBaseWeekDate(newDate)
  }

  const handleNextWeek = () => {
    const newDate = new Date(baseWeekDate)
    newDate.setDate(newDate.getDate() + 7)
    setBaseWeekDate(newDate)
  }

  const isToday = formatDateKey(selectedDate) === formatDateKey(new Date())
  const weekDays = getWeekDays(baseWeekDate, selectedDate, datesWithTasks)

  return (
    <div>
      {/* 上边栏：日期标题居中 + 回到今天 - 可拖拽区域 */}
      <div className="app-drag-region relative flex items-center justify-center px-4 py-3 border-b border-[#eceef2] bg-[#fafbfc]">
        {/* 中间：日期 + 日历按钮 */}
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold text-gray-800">
            {formatDetailedDate(selectedDate)}
          </span>
          {/* 日历按钮 */}
          <button
            onClick={onOpenDatePicker}
            className="app-no-drag p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Calendar className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* 右侧：回到今天 */}
        <div className="absolute right-4">
          {!isToday && (
            <button
              onClick={handleToday}
              className="app-no-drag text-[13px] text-gray-500 hover:text-gray-700 transition-colors"
            >
              回到今天
            </button>
          )}
        </div>
      </div>

      {/* 周历导航 + 进度条 - 共用一个白色底色，增加下方阴影与TODO区分 */}
      <div className="border-b border-[#eceef2] bg-[#fafbfc] shadow-[0_10px_24px_rgba(17,24,39,0.04)]">
        {/* 星期列表 */}
        <div className="flex items-center justify-between px-2 py-3">
          {/* 左箭头 */}
          <button
            onClick={handlePrevWeek}
            className="app-no-drag w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* 星期日期列表 */}
          <div className="flex items-center justify-between flex-1 px-2">
            {weekDays.map((item, index) => (
              <button
                key={index}
                onClick={() => handleSelectDate(item.date)}
                className={`app-no-drag flex flex-col items-center justify-center gap-1 py-2 w-[52px] h-[60px] rounded-xl transition-colors ${
                  item.isSelected
                    ? 'bg-[#eef1f5]'
                    : 'hover:bg-[#f5f7fa]'
                }`}
              >
                {/* 星期 */}
                <span className={`text-[11px] font-semibold ${
                  item.isSelected || item.isToday
                    ? 'text-gray-800'
                    : 'text-gray-400'
                }`}>
                  {item.weekday}
                </span>
                {/* 日期：今天显示红色，其他显示灰色/黑色 */}
                <span className={`text-[14px] font-semibold ${
                  item.isToday
                    ? 'text-red-500'
                    : item.isSelected
                      ? 'text-gray-800'
                      : 'text-gray-600'
                }`}>
                  {item.day}
                </span>
                {/* 内容指示点：恒定占位，通过透明度控制显隐 */}
                <span
                  className={`w-1 h-1 rounded-full flex-shrink-0 mt-0.5 transition-opacity duration-200 ${
                    item.hasContent ? 'bg-gray-400 opacity-100' : 'bg-transparent opacity-0'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* 右箭头 */}
          <button
            onClick={handleNextWeek}
            className="app-no-drag w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 时间统计进度条 - 深岩灰色质感 */}
        <div className="flex items-center gap-2 px-4 py-1.5 pb-3">
          {/* 左侧：已度过百分比 - 灰色字 */}
          <span className="text-[14px] font-bold w-[44px] flex-shrink-0" style={{ color: '#94A3B8' }}>
            {dayProgress.progress}%
          </span>

          {/* 中间：进度条 - 极简灰轨道 + 灰蓝渐变填充 + 呼吸动画 */}
          <div
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{
              background: '#E2E8F0',
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-300 progress-bar-pulse"
              style={{
                width: `${dayProgress.progress}%`,
                background: 'linear-gradient(to right, #718096 0%, #2D3748 100%)',
              }}
            />
          </div>

          {/* 右侧：剩余时间 - 加深字体颜色 */}
          <span className="text-[14px] font-bold w-[52px] text-right flex-shrink-0" style={{ color: '#475569' }}>
            {dayProgress.remainingHours}h
          </span>
        </div>
      </div>

      {/* 进度条呼吸动画样式 */}
      <style>{`
        @keyframes progress-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .progress-bar-pulse {
          animation: progress-pulse 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
