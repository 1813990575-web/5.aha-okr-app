import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  X,
} from 'lucide-react'
import { type FocusSessionRecord, formatFocusDuration, getFocusElapsedMs } from './focusSessionStore'
import {
  deleteTodoThreadMessage,
  getTodoThreadMessages,
  getTodoThreadStorageId,
  saveTodoThreadMessage,
  subscribeTodoThreadUpdates,
  type ThreadMessage,
} from './todoThreadStore'

interface TaskFocusPanelProps {
  session: FocusSessionRecord
  onUpdateSession: (taskId: string, patch: Partial<FocusSessionRecord>) => void
  onHidePanel: (taskId: string) => void
  onCompleteSession: (taskId: string) => void
  onAbandonSession: (taskId: string) => void
}

function formatThreadTime(timestamp: number) {
  const target = new Date(timestamp)
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(target)
}

export const TaskFocusPanel: React.FC<TaskFocusPanelProps> = React.memo(({
  session,
  onUpdateSession,
  onHidePanel,
  onCompleteSession,
  onAbandonSession,
}) => {
  const panelHeight = 588
  const collapsedTextareaHeight = 24
  const expandedTextareaMinHeight = 356
  const expandedTextareaMaxHeight = 472
  const collapsedInputShellHeight = 44
  const expandedInputShellPadding = 24
  const composerToggleHeight = 12
  const composerGap = 2
  const composerBottomPadding = 12
  const storageId = getTodoThreadStorageId('task', session.taskId)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollTimerRef = useRef<number | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [composerExpanded, setComposerExpanded] = useState(true)
  const [textareaHeight, setTextareaHeight] = useState(expandedTextareaMinHeight)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isMessageScrolling, setIsMessageScrolling] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setMessages(getTodoThreadMessages(storageId))
    return subscribeTodoThreadUpdates(() => setMessages(getTodoThreadMessages(storageId)))
  }, [storageId])

  useEffect(() => {
    if (!session.isRunning) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session.isRunning])

  useEffect(() => {
    if (!composerExpanded) return
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [composerExpanded])

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    const minHeight = composerExpanded ? expandedTextareaMinHeight : collapsedTextareaHeight
    const maxHeight = composerExpanded ? expandedTextareaMaxHeight : collapsedTextareaHeight
    textarea.style.height = '0px'
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight))
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
    setTextareaHeight(nextHeight)
  }, [
    collapsedTextareaHeight,
    composerExpanded,
    draft,
    expandedTextareaMaxHeight,
    expandedTextareaMinHeight,
  ])

  useEffect(() => {
    if (!dragging) return

    const handlePointerMove = (event: MouseEvent) => {
      const nextLeft = Math.min(
        window.innerWidth - 120,
        Math.max(12, event.clientX - dragOffsetRef.current.x)
      )
      const nextTop = Math.min(
        window.innerHeight - 120,
        Math.max(12, event.clientY - dragOffsetRef.current.y)
      )

      onUpdateSession(session.taskId, { position: { top: nextTop, left: nextLeft } })
    }

    const handlePointerUp = () => setDragging(false)

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [dragging, onUpdateSession, session.taskId])

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
    }
  }, [])

  const canSend = draft.trim().length > 0
  const inputShellHeight = composerExpanded
    ? textareaHeight + expandedInputShellPadding
    : collapsedInputShellHeight
  const composerHeight = composerToggleHeight + composerGap + inputShellHeight + composerBottomPadding
  const messageListBottomPadding = composerHeight + 14
  const elapsedMs = getFocusElapsedMs(session, now)
  const elapsedLabel = formatFocusDuration(elapsedMs)

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button') || target.closest('textarea')) return

    const left = session.position?.left ?? 24
    const top = session.position?.top ?? 24
    dragOffsetRef.current = {
      x: event.clientX - left,
      y: event.clientY - top,
    }
    setDragging(true)
    event.preventDefault()
  }, [session.position?.left, session.position?.top])

  const handleSend = useCallback(() => {
    const nextText = draft.trim()
    if (!nextText) return

    setMessages(saveTodoThreadMessage(storageId, nextText, editingMessageId))
    setDraft('')
    setEditingMessageId(null)
    setComposerExpanded(false)
  }, [draft, editingMessageId, storageId])

  const handleToggleRunning = useCallback(() => {
    if (session.isRunning) {
      onUpdateSession(session.taskId, {
        accumulatedMs: elapsedMs,
        startedAt: null,
        isRunning: false,
      })
      return
    }

    onUpdateSession(session.taskId, {
      accumulatedMs: session.accumulatedMs,
      startedAt: Date.now(),
      isRunning: true,
    })
  }, [elapsedMs, onUpdateSession, session.accumulatedMs, session.isRunning, session.taskId])

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(deleteTodoThreadMessage(storageId, messageId))
    if (editingMessageId === messageId) {
      setEditingMessageId(null)
      setDraft('')
    }
  }, [editingMessageId, storageId])

  const handleComposerKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSend = event.key === 'Enter' && (!composerExpanded || event.metaKey || event.ctrlKey)
    if (!shouldSend) return
    event.preventDefault()
    handleSend()
  }, [composerExpanded, handleSend])

  if (typeof document === 'undefined' || !session.panelOpen) return null

  return createPortal(
    <div
      className="fixed z-[360] w-[356px]"
      style={{
        left: session.position?.left ?? 24,
        top: session.position?.top ?? 24,
        willChange: 'transform, opacity',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <section
        className="relative overflow-hidden rounded-[28px] border border-[#dcb04a]/80 bg-[linear-gradient(180deg,#f8dc7b_0%,#f5d36a_38%,#f9e2a0_100%)] shadow-[0_24px_64px_rgba(120,82,14,0.24)]"
        style={{ height: panelHeight, contain: 'layout paint style' }}
      >
        <div
          className="cursor-grab border-b border-[#cc9b35]/55 px-4 py-3 active:cursor-grabbing"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[24px] font-semibold tracking-[-0.04em] text-[#4d360b]">
                {session.title}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onHidePanel(session.taskId)
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddb056] bg-[#fff4cf]/88 text-[#916524] transition-colors hover:bg-[#fff0bf]"
                aria-label="隐藏专注面板"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        <div className="relative h-[calc(100%-73px)]">
          <div
            className={`focus-panel-scroll absolute inset-0 overflow-y-auto px-4 pb-4 pt-4 ${isMessageScrolling ? 'is-scrolling' : ''}`}
            style={{ paddingBottom: messageListBottomPadding + 166 }}
            onScroll={() => {
              setIsMessageScrolling(true)
              if (scrollTimerRef.current !== null) {
                window.clearTimeout(scrollTimerRef.current)
              }
              scrollTimerRef.current = window.setTimeout(() => {
                setIsMessageScrolling(false)
                scrollTimerRef.current = null
              }, 700)
            }}
          >
            <div className="rounded-[16px] border border-[#403423]/18 bg-[#272729] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(49,38,12,0.18)]">
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex flex-1 items-center gap-2.5">
                  <span
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      session.isRunning ? 'animate-pulse bg-[#F6465D] shadow-[0_0_0_4px_rgba(246,70,93,0.12)]' : 'bg-white/35'
                    }`}
                  />
                  <div className="min-w-0 truncate text-[29px] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums">
                    {elapsedLabel}
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={handleToggleRunning}
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/8 text-white transition-colors hover:bg-white/14"
                    aria-label={session.isRunning ? '暂停专注' : '继续专注'}
                  >
                    {session.isRunning ? <Pause className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Play className="h-3.5 w-3.5" strokeWidth={2.6} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onCompleteSession(session.taskId)}
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/8 text-white transition-colors hover:bg-white/14"
                    aria-label="结束专注"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAbandonSession(session.taskId)}
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-white/8 text-white transition-colors hover:bg-white/14"
                    aria-label="放弃本次专注"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <div className="px-1 text-[13px] font-semibold tracking-[0.04em] text-[#4d360b]">
                笔记区
              </div>
              {messages.map((message) => (
                <div key={message.id} className="group">
                  <article className="rounded-[16px] bg-[#fff4cd] px-4 py-3 text-[14px] leading-6 text-[#5c4518] shadow-[0_10px_22px_rgba(123,88,24,0.08)]">
                    {message.text}
                  </article>
                  <div className="mt-1 flex items-center justify-between px-1">
                    <div className="text-[11px] font-medium text-[#a27b31]">{formatThreadTime(message.createdAt)}</div>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMessageId(message.id)
                          setDraft(message.text)
                          setComposerExpanded(true)
                          window.requestAnimationFrame(() => inputRef.current?.focus())
                        }}
                        className="rounded-full px-2 py-0.5 text-[11px] text-[#8b601d] hover:bg-[#f6dfa0]"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(message.id)}
                        className="rounded-full px-2 py-0.5 text-[11px] text-[#8b601d] hover:bg-[#f6dfa0]"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-0">
            <div className="flex flex-col" style={{ height: composerHeight }}>
              <div className="mb-0 flex h-3 items-center justify-center">
                <button
                  type="button"
                  onClick={() => setComposerExpanded((current) => !current)}
                  className="inline-flex h-6 items-center gap-1 rounded-full border border-[#d0a24a] bg-[#fff4ce] px-2.5 text-[10px] font-medium text-[#6f5319] shadow-[0_2px_8px_rgba(140,102,23,0.12)] transition-colors hover:bg-[#ffefc0]"
                  aria-label={composerExpanded ? '收起笔记输入区' : '展开笔记输入区'}
                >
                  {composerExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronUp className="h-2.5 w-2.5" />}
                  {composerExpanded ? '收起' : '展开'}
                </button>
              </div>

              <div
                className={`relative mt-auto rounded-[22px] border border-[#d6aa55] bg-[#fff7da] shadow-[0_10px_24px_rgba(137,98,19,0.12)] transition-[height] duration-200 ease-out ${
                  composerExpanded ? 'px-3 pb-3 pt-3' : 'px-3 py-2.5'
                }`}
                style={{ height: inputShellHeight }}
              >
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="输入消息或笔记..."
                  className={`w-full resize-none bg-transparent pl-1 pr-12 text-[14px] text-[#5b4417] outline-none placeholder:text-[#bb9551] ${
                    composerExpanded ? 'leading-7' : 'leading-6'
                  }`}
                />

                <div className={`pointer-events-none absolute right-3 flex ${composerExpanded ? 'bottom-3 items-end' : 'inset-y-0 items-center'}`}>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                      canSend ? 'bg-[#2f2617] text-[#fff7df] hover:bg-[#201a10]' : 'bg-[#eadba8] text-[#c4a461]'
                    }`}
                    aria-label="发送专注笔记"
                  >
                    <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>,
    document.body
  )
})

export default TaskFocusPanel
