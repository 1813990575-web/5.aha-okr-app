import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, AtSign, ChevronDown, ChevronLeft, ChevronRight, Hash, Image as ImageIcon, List, ListOrdered, Type, X } from 'lucide-react'
import { useJournalEntries } from '../../hooks/journal/useJournalEntries'
import type { JournalRecord } from './types'

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const YEAR_OPTIONS = [2024, 2025, 2026, 2027]

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildCalendarDays(monthDate: Date) {
  const firstDay = startOfMonth(monthDate)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function formatTimelineTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp)
}

function buildPreviewText(note: string) {
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

interface MiniCalendarPanelProps {
  width: number
  monthLabel: string
  selectedYear: number
  displayMonth: number
  monthDays: Date[]
  selectedDateKey: string
  today: Date
  entriesByDate: Map<string, { imageDataUrl?: string | null }>
  onSelectDate: (dateKey: string) => void
  onPreviousMonth: () => void
  onNextMonth: () => void
  onYearChange: (year: number) => void
}

const MiniCalendarPanel: React.FC<MiniCalendarPanelProps> = ({
  width,
  monthLabel,
  selectedYear,
  displayMonth,
  monthDays,
  selectedDateKey,
  today,
  entriesByDate,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
  onYearChange,
}) => {
  const [showYearMenu, setShowYearMenu] = useState(false)
  const yearMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showYearMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (yearMenuRef.current && !yearMenuRef.current.contains(event.target as Node)) {
        setShowYearMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showYearMenu])

  return (
    <div
      className="relative z-10 flex min-w-0 flex-shrink-0 flex-col gap-5 px-5 py-2"
      style={{ width }}
    >
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onPreviousMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white/78 text-[#4b5461] transition-colors hover:bg-black/[0.04]" aria-label="上个月">
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="relative" ref={yearMenuRef}>
          <div className="flex items-center rounded-[14px] border border-black/[0.08] bg-white/82 shadow-[0_3px_10px_rgba(15,23,42,0.035)]">
            <div className="px-4 py-2 text-center text-[14px] font-semibold tracking-[-0.02em] text-[#202631]">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setShowYearMenu((prev) => !prev)}
              className="inline-flex h-full items-center justify-center px-2.5 text-[#4b5461]"
              aria-label="选择年份"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {showYearMenu && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-20 min-w-[112px] rounded-[14px] border border-black/[0.08] bg-white/96 p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
              {YEAR_OPTIONS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    onYearChange(year)
                    setShowYearMenu(false)
                  }}
                  className={`flex w-full items-center justify-center rounded-[10px] px-3 py-2 text-sm transition-colors ${selectedYear === year ? 'bg-black/[0.06] text-[#202631]' : 'text-[#4b5461] hover:bg-black/[0.04]'}`}
                >
                  {year}年
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" onClick={onNextMonth} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.06] bg-white/78 text-[#4b5461] transition-colors hover:bg-black/[0.04]" aria-label="下个月">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={`${label}-${index}`} className="text-center text-[12px] font-semibold tracking-[0.08em] text-black/34">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((day) => {
          const dateKey = formatDateKey(day)
          const entry = entriesByDate.get(dateKey)
          const isCurrentMonth = day.getMonth() === displayMonth
          const isSelected = dateKey === selectedDateKey
          const isToday = sameDay(day, today)

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className="group relative aspect-square overflow-hidden rounded-[8px] border transition-all"
              style={{
                borderColor: isToday ? '#8b6a4d' : isSelected ? '#c9a27a' : 'rgba(44,52,64,0.04)',
                borderWidth: isToday ? '1.5px' : '1px',
                background: isSelected ? 'rgba(255,255,255,0.96)' : 'rgba(232,226,218,0.82)',
                boxShadow: isToday
                  ? '0 6px 14px rgba(139,106,77,0.16)'
                  : isSelected
                    ? '0 8px 18px rgba(201,162,122,0.14)'
                    : 'none',
                opacity: isCurrentMonth ? 1 : 0.36,
              }}
              aria-label={dateKey}
              title={dateKey}
            >
              {entry?.imageDataUrl ? (
                <img src={entry.imageDataUrl} alt="journal cover" className="absolute inset-0 h-full w-full object-cover" />
              ) : null}

              <div
                className="absolute inset-0"
                style={{
                  background: entry?.imageDataUrl
                    ? 'linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.1))'
                    : isSelected
                      ? 'rgba(255,255,255,0.5)'
                      : 'transparent',
                }}
              />

              {!entry?.imageDataUrl && isCurrentMonth && (
                <span
                  className="absolute inset-0 flex items-center justify-center font-medium"
                  style={{
                    fontSize: 14,
                    lineHeight: '1',
                    color: 'rgba(64,68,76,0.52)',
                    fontFamily: 'var(--font-apple)',
                  }}
                >
                  {day.getDate()}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-1 flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[12px] font-medium tracking-[0.08em] text-black/28">当月回顾</div>
          <div className="text-[12px] text-black/34">{monthLabel}</div>
        </div>

        <div className="min-h-[224px] flex-1 rounded-[24px] bg-transparent" />
      </div>
    </div>
  )
}

export const JournalWorkspace: React.FC = () => {
  const today = new Date()
  const [calendarPanelWidth, setCalendarPanelWidth] = useState(410)
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today))
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(today))
  const { entriesByDate, appendRecord, updateRecord, isLoaded } = useJournalEntries()
  const [editorText, setEditorText] = useState('')
  const [editorImages, setEditorImages] = useState<string[]>([])
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [recentlyUpdatedRecordId, setRecentlyUpdatedRecordId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const focusTimerRef = useRef<number | null>(null)
  const resizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [isComposerExpanded, setIsComposerExpanded] = useState(false)

  const monthDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const monthLabel = `${String(visibleMonth.getFullYear()).slice(-2)} 年 ${visibleMonth.getMonth() + 1} 月`
  const selectedEntry = entriesByDate.get(selectedDateKey)
  const timelineRecords = selectedEntry?.records ?? []
  const canSend = editorText.trim().length > 0 || editorImages.length > 0
  const shouldExpandComposer = isComposerExpanded || canSend
  const isEditingRecord = editingRecordId !== null

  const applyListPrefixToCurrentLine = (mode: 'bullet' | 'ordered') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const value = editorText
    const start = textarea.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextLineBreak = value.indexOf('\n', start)
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak
    const line = value.slice(lineStart, lineEnd)

    const bulletPattern = /^[-•]\s/
    const orderedPattern = /^\d+\.\s/
    const withoutPrefix = line.replace(/^(?:[-•]\s|\d+\.\s)/, '')
    const prefix = mode === 'bullet' ? '• ' : '1. '
    const isSameModeActive = mode === 'bullet' ? bulletPattern.test(line) : orderedPattern.test(line)
    const updatedLine = isSameModeActive ? withoutPrefix : `${prefix}${withoutPrefix}`
    const nextValue = value.slice(0, lineStart) + updatedLine + value.slice(lineEnd)
    setEditorText(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = lineStart + updatedLine.length
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const insertAroundSelection = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = editorText
    const selected = value.slice(start, end)
    const nextValue = value.slice(0, start) + before + selected + after + value.slice(end)
    setEditorText(nextValue)

    requestAnimationFrame(() => {
      textarea.focus()
      const cursorStart = start + before.length
      const cursorEnd = cursorStart + selected.length
      textarea.setSelectionRange(cursorStart, cursorEnd)
    })
  }

  const handlePickImages = () => {
    imageInputRef.current?.click()
  }

  const scheduleComposerFocus = (delay = 0) => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current)
    }

    focusTimerRef.current = window.setTimeout(() => {
      textareaRef.current?.focus()
      focusTimerRef.current = null
    }, delay)
  }

  useEffect(() => {
    return () => {
      if (focusTimerRef.current !== null) {
        window.clearTimeout(focusTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState) return

      const nextWidth = resizeState.startWidth + (event.clientX - resizeState.startX)
      setCalendarPanelWidth(Math.min(520, Math.max(340, nextWidth)))
    }

    const handlePointerUp = () => {
      resizeStateRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [])

  useEffect(() => {
    if (!recentlyUpdatedRecordId) return

    const timer = window.setTimeout(() => {
      setRecentlyUpdatedRecordId(null)
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [recentlyUpdatedRecordId])

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = reject
            reader.readAsDataURL(file)
          })
      )
    )
      .then((results) => {
        setEditorImages((prev) => [...prev, ...results])
      })
      .finally(() => {
        event.target.value = ''
      })
  }

  const removeImageAt = (index: number) => {
    setEditorImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  useEffect(() => {
    if (!shouldExpandComposer || isEditingRecord) return

    const handlePointerDown = (event: MouseEvent) => {
      if (composerRef.current?.contains(event.target as Node)) return
      if (!editorText.trim() && editorImages.length === 0) {
        setIsComposerExpanded(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [editorImages.length, editorText, isEditingRecord, shouldExpandComposer])

  const expandComposer = () => {
    setEditingRecordId(null)
    setIsComposerExpanded(true)
    scheduleComposerFocus(120)
  }

  const startRecordEdit = (record: JournalRecord) => {
    setEditingRecordId(record.id)
    setEditorText(record.note)
    setEditorImages(record.imageDataUrls)
    setIsComposerExpanded(true)
    scheduleComposerFocus(170)
  }

  const resetComposer = () => {
    setEditorText('')
    setEditorImages([])
    setEditingRecordId(null)
    setIsComposerExpanded(false)
  }

  const handleSubmit = async () => {
    if (!canSend) return

    if (editingRecordId) {
      setRecentlyUpdatedRecordId(editingRecordId)
      await updateRecord(selectedDateKey, editingRecordId, {
        note: editorText,
        imageDataUrls: editorImages,
      })
      resetComposer()
      return
    }

    const record: JournalRecord = {
      id: `record-${Date.now()}`,
      dateKey: selectedDateKey,
      note: editorText,
      imageDataUrls: editorImages,
      createdAt: Date.now(),
    }

    await appendRecord(selectedDateKey, record)
    resetComposer()
  }

  const renderToolbar = () => (
    <div className="flex items-center gap-2.5 text-black/10">
      <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="标签">
        <Hash className="h-[21px] w-[21px]" />
      </button>
      <button type="button" onClick={handlePickImages} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="图片">
        <ImageIcon className="h-[21px] w-[21px]" />
      </button>
      <span className="h-5 w-px bg-black/[0.05]" />
      <button type="button" onClick={() => insertAroundSelection('**', '**')} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="加粗">
        <Type className="h-[21px] w-[21px]" />
      </button>
      <button type="button" onClick={() => applyListPrefixToCurrentLine('bullet')} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="无序列表">
        <List className="h-[21px] w-[21px]" />
      </button>
      <button type="button" onClick={() => applyListPrefixToCurrentLine('ordered')} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="有序列表">
        <ListOrdered className="h-[21px] w-[21px]" />
      </button>
      <span className="h-5 w-px bg-black/[0.05]" />
      <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full text-inherit transition-all duration-150 hover:bg-black/[0.03] hover:text-black/40" aria-label="提及">
        <AtSign className="h-[21px] w-[21px]" />
      </button>
    </div>
  )

  const renderEditorImages = (sizeClass: string) => {
    if (editorImages.length === 0) return null

    return (
      <div className="mt-4 flex flex-wrap gap-2.5">
        {editorImages.map((image, index) => (
          <div key={`${image.slice(0, 24)}-${index}`} className={`relative overflow-hidden rounded-[14px] border border-black/[0.08] bg-[#f7f7f5] ${sizeClass}`}>
            <img src={image} alt={`upload-${index}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeImageAt(index)}
              className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/65"
              aria-label="移除图片"
            >
              <span className="text-sm leading-none">×</span>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={handlePickImages}
          className={`inline-flex items-center justify-center rounded-[14px] border border-dashed border-black/[0.12] bg-[#fafaf8] text-[#9a9ca3] transition-colors hover:bg-black/[0.03] ${sizeClass}`}
          aria-label="继续添加图片"
        >
          <span className="text-[28px] leading-none">+</span>
        </button>
      </div>
    )
  }

  return (
    <section className="flex h-full w-full flex-col bg-[linear-gradient(180deg,#f7f6f2,#f2f0eb)]">
      <div className="app-drag-region traffic-light-space flex-shrink-0" />

      <div className="flex flex-1 gap-5 px-5 pb-5 pt-1">
        <MiniCalendarPanel
          width={calendarPanelWidth}
          monthLabel={monthLabel}
          selectedYear={visibleMonth.getFullYear()}
          displayMonth={visibleMonth.getMonth()}
          monthDays={monthDays}
          selectedDateKey={selectedDateKey}
          today={today}
          entriesByDate={entriesByDate}
          onSelectDate={(dateKey) => {
            setSelectedDateKey(dateKey)
            resetComposer()
          }}
          onPreviousMonth={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
          onNextMonth={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          onYearChange={(year) => setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))}
        />

        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整月历宽度"
          onPointerDown={(event) => {
            resizeStateRef.current = {
              startX: event.clientX,
              startWidth: calendarPanelWidth,
            }
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          className="group relative -mx-2 w-4 flex-shrink-0 cursor-col-resize self-stretch bg-transparent p-0"
        >
          <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/[0.07] transition-colors group-hover:bg-[#c9a27a] group-active:bg-[#b78a60]" />
        </button>

        <div className="flex min-w-[380px] flex-[1.02] flex-col rounded-none bg-transparent pl-5 pr-4 pt-0 pb-0 shadow-none">
          {isEditingRecord ? (
            <div
              className="flex h-full flex-col rounded-[28px] border border-black/[0.06] bg-white/70 px-6 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[14px] font-medium tracking-[0.08em] text-black/28">编辑记录</div>
                  <button
                    type="button"
                    onClick={resetComposer}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black/28 transition-colors hover:bg-black/[0.04] hover:text-black/48"
                    aria-label="关闭编辑"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={editorText}
                  onChange={(event) => setEditorText(event.target.value)}
                  placeholder="编辑这条记录..."
                  className="h-[220px] w-full resize-none border-none bg-transparent text-[17px] leading-8 text-[#202631] outline-none"
                />

                {renderEditorImages('h-[84px] w-[84px]')}

                <div className="mt-auto flex items-center justify-between pt-6">
                  {renderToolbar()}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${canSend ? 'border-[#8b7663] bg-[#8b7663] text-white hover:bg-[#7f6b59] hover:border-[#7f6b59]' : 'border-[#dfddda] bg-[#e7e5e2] text-white hover:bg-[#ddd9d4]'}`}
                    aria-label="保存编辑"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.4]" />
                  </button>
                </div>

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageChange}
                />
            </div>
          ) : (
            <div>
                <motion.div
                  ref={composerRef}
                  onClick={() => {
                    if (!shouldExpandComposer) expandComposer()
                  }}
                  initial={false}
                  animate={{
                    paddingTop: shouldExpandComposer ? 16 : 10,
                    paddingBottom: shouldExpandComposer ? 16 : 10,
                    boxShadow: shouldExpandComposer
                      ? '0 14px 30px rgba(15,23,42,0.07)'
                      : '0 8px 24px rgba(15,23,42,0.05)',
                  }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  className="will-change-transform rounded-[26px] border border-black/[0.08] bg-white px-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
                >
                  <div className={`flex items-center gap-3 ${shouldExpandComposer ? 'items-start' : 'min-h-[40px]'}`}>
                    <textarea
                      ref={textareaRef}
                      value={editorText}
                      onFocus={() => setIsComposerExpanded(true)}
                      onChange={(event) => setEditorText(event.target.value)}
                      placeholder="现在的想法是..."
                      className={`w-full resize-none border-none bg-transparent text-[14px] text-[#202631] outline-none placeholder:text-black/28 transition-[height] duration-180 ease-out ${shouldExpandComposer ? 'h-[132px] overflow-y-auto leading-7' : 'h-7 min-h-[28px] overflow-hidden pt-0 leading-7'}`}
                    />

                    <AnimatePresence initial={false}>
                      {!shouldExpandComposer && (
                        <motion.button
                          key="collapsed-send"
                          type="button"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
                          onClick={(event) => {
                            event.stopPropagation()
                            expandComposer()
                          }}
                          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[#dfddda] bg-[#e7e5e2] text-white transition-colors duration-150 hover:bg-[#ddd9d4]"
                          aria-label="展开编辑"
                        >
                          <ArrowUp className="h-4 w-4 stroke-[2.35]" />
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  <div
                    className={`overflow-hidden transition-[max-height,opacity,transform,margin] duration-180 ease-out ${editorImages.length > 0 ? 'mt-4 max-h-[140px] translate-y-0 opacity-100' : 'mt-0 max-h-0 -translate-y-1 opacity-0'}`}
                    aria-hidden={editorImages.length === 0}
                  >
                    {editorImages.length > 0 ? renderEditorImages('h-[72px] w-[72px]') : null}
                  </div>

                  <div
                    className={`overflow-hidden transition-[max-height,opacity,transform,margin] duration-180 ease-out ${shouldExpandComposer ? 'mt-6 max-h-20 translate-y-0 opacity-100' : 'mt-0 max-h-0 -translate-y-1 opacity-0'}`}
                    aria-hidden={!shouldExpandComposer}
                  >
                    <div className="flex items-center justify-between will-change-transform">
                      {renderToolbar()}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          if (!shouldExpandComposer) {
                            expandComposer()
                            return
                          }
                          handleSubmit()
                        }}
                        disabled={shouldExpandComposer && !canSend}
                        className={`inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${canSend ? 'border-[#8b7663] bg-[#8b7663] text-white hover:bg-[#7f6b59] hover:border-[#7f6b59]' : 'border-[#dfddda] bg-[#e7e5e2] text-white hover:bg-[#ddd9d4]'}`}
                        aria-label="发送"
                      >
                        <ArrowUp className="h-4 w-4 stroke-[2.4]" />
                      </button>
                    </div>
                  </div>

                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </motion.div>

                <div className="mt-10 flex min-h-0 flex-1 flex-col px-2">
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    {timelineRecords.length === 0 ? (
                    <div className="pt-8 text-center text-[14px] text-black/22">
                      {isLoaded ? '发送后，这一天的内容会记录在这里' : '正在加载记录...'}
                    </div>
                    ) : (
                      <div className="space-y-5">
                        {timelineRecords.map((record) => {
                          const previewText = buildPreviewText(record.note)
                          const thumbnail = record.imageDataUrls[0]
                          return (
                            <motion.article
                              key={record.id}
                              onDoubleClick={() => startRecordEdit(record)}
                              className="grid cursor-text grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-x-1"
                              initial={false}
                              animate={
                                recentlyUpdatedRecordId === record.id
                                  ? {
                                      backgroundColor: [
                                        'rgba(214,168,112,0)',
                                        'rgba(214,168,112,0.13)',
                                        'rgba(214,168,112,0)',
                                      ],
                                      x: [0, 2, 0],
                                    }
                                  : { backgroundColor: 'rgba(214,168,112,0)', x: 0 }
                              }
                              transition={{
                                duration: recentlyUpdatedRecordId === record.id ? 1.1 : 0.18,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              style={{ borderRadius: 16 }}
                            >
                              <div className="flex items-center gap-1.5 text-[14px] leading-6 text-black/30">
                                <span className="h-2.5 w-2.5 rounded-full bg-[#cf9a61] shadow-[0_0_0_1px_rgba(207,154,97,0.14)]" />
                                <span>{formatTimelineTime(record.createdAt)}</span>
                              </div>
                              <div className="min-w-0">
                                {previewText ? (
                                  <p
                                    className="text-[14px] font-medium leading-6 text-[#202631]"
                                    style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    {previewText}
                                  </p>
                                ) : (
                                  <p className="text-[14px] font-medium leading-6 text-black/26">仅上传了图片</p>
                                )}
                              </div>
                              <div className="flex justify-end">
                                {thumbnail ? (
                                  <div className="h-12 w-12 overflow-hidden rounded-[14px] border border-black/[0.06] bg-[#ece8e0]">
                                    <img src={thumbnail} alt="record cover" className="h-full w-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="h-12 w-12" />
                                )}
                              </div>
                            </motion.article>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default JournalWorkspace
