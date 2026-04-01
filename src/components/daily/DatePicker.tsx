import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  isOpen: boolean
  selectedDate: Date
  onSelect: (date: Date) => void
  onClose: () => void
  hasContentForDate?: (date: Date) => boolean // 判断指定日期是否有内容
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
 * 获取某月的天数
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * 获取某月第一天是星期几 (0=周日, 1=周一, ...)
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const DatePicker: React.FC<DatePickerProps> = ({
  isOpen,
  selectedDate,
  onSelect,
  onClose,
  hasContentForDate,
}) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate))

  // 当选择日期变化时，更新视图日期
  useEffect(() => {
    setViewDate(new Date(selectedDate))
  }, [selectedDate, isOpen])

  if (!isOpen) return null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const today = new Date()
  const todayKey = formatDateKey(today)
  const selectedKey = formatDateKey(selectedDate)

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const handleSelectDay = (day: number) => {
    const newDate = new Date(year, month, day)
    onSelect(newDate)
    onClose()
  }

  // 生成日历格子
  const days: Array<{ day: number | null; isToday: boolean; isSelected: boolean; hasContent: boolean }> = []

  // 空白格子（上月）
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: null, isToday: false, isSelected: false, hasContent: false })
  }

  // 本月日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateKey = formatDateKey(date)
    const isToday = dateKey === todayKey
    const isSelected = dateKey === selectedKey
    const hasContent = hasContentForDate ? hasContentForDate(date) : false
    days.push({
      day,
      isToday,
      isSelected,
      hasContent,
    })
  }

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* 日历弹窗 */}
      <div className="absolute top-14 left-4 z-50 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 w-[280px]">
        {/* 头部：月份导航 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-[14px] font-semibold text-gray-800">
            {MONTHS[month]} {year}
          </span>

          <button
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="text-center text-[11px] font-medium text-gray-400 py-1"
            >
              {weekday}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((item, index) => (
            <div key={index} className="aspect-square">
              {item.day !== null && (
                <button
                  onClick={() => handleSelectDay(item.day as number)}
                  className={`
                    w-full h-full flex flex-col items-center justify-center rounded-lg text-[13px] font-medium
                    transition-all duration-150
                    ${item.isSelected
                      ? 'bg-gray-900 text-white'
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  {/* 日期数字：今天显示红色 */}
                  <span className={`
                    ${item.isSelected
                      ? 'text-white'
                      : item.isToday
                        ? 'text-red-500'
                        : 'text-gray-700'
                    }
                  `}>
                    {item.day}
                  </span>
                  {/* 内容指示点：有内容时显示黑色圆点 */}
                  <span className={`w-1 h-1 rounded-full mt-0.5 ${
                    item.hasContent ? 'bg-gray-800' : ''
                  }`}></span>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 底部：快速选择 */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center">
          <button
            onClick={() => {
              onSelect(new Date())
            }}
            className="text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Go to Today
          </button>
        </div>
      </div>
    </>
  )
}
