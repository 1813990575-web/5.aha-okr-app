import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUp, ChevronDown, ChevronUp, FileText, MessageCircleMore, Pencil, Pin, Trash2, X } from 'lucide-react'
import {
  deleteTodoThreadMessage,
  getTodoThreadMessages,
  getTodoThreadStorageId,
  saveTodoThreadMessage,
  type ThreadEntityKind,
  type ThreadMessage,
} from './todoThreadStore'

export { getLatestTodoThreadPreview, readTodoThreads, subscribeTodoThreadUpdates } from './todoThreadStore'

interface TodoThreadPopoverProps {
  entityId: string
  entityKind: ThreadEntityKind
  title: string
  onOpenChange?: (open: boolean) => void
}

function formatTime(timestamp: number) {
  const target = new Date(timestamp)
  const now = new Date()
  const isSameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()

  if (isSameDay) {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(target)
  }

  return `${target.getFullYear()}/${target.getMonth() + 1}/${target.getDate()}`
}

export const TodoThreadPopover: React.FC<TodoThreadPopoverProps> = ({
  entityId,
  entityKind,
  title,
  onOpenChange,
}) => {
  const popoverHeight = 456
  const headerHeight = 68
  const collapsedTextareaHeight = 24
  const expandedTextareaMinHeight = 340
  const expandedTextareaMaxHeight = 440
  const collapsedInputShellHeight = 44
  const expandedInputShellPadding = 24
  const composerToggleHeight = 32
  const composerGap = 2
  const composerBottomPadding = 12
  const storageId = getTodoThreadStorageId(entityKind, entityId)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [composerExpanded, setComposerExpanded] = useState(false)
  const [textareaHeight, setTextareaHeight] = useState(collapsedTextareaHeight)
  const [pinned, setPinned] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

  useEffect(() => {
    setMessages(getTodoThreadMessages(storageId))
  }, [storageId])

  const hasMessages = messages.length > 0
  const canSend = draft.trim().length > 0
  const inputShellHeight = composerExpanded
    ? textareaHeight + expandedInputShellPadding
    : collapsedInputShellHeight
  const composerHeight = composerToggleHeight + composerGap + inputShellHeight + composerBottomPadding
  const messageListBottomPadding = composerHeight + 12

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const popoverWidth = 320
    const gutter = 14
    const preferredLeft = rect.right + 12
    const maxLeft = window.innerWidth - popoverWidth - gutter
    const left = preferredLeft > maxLeft ? Math.max(gutter, rect.left - popoverWidth - 12) : preferredLeft
    const top = Math.min(window.innerHeight - 360, Math.max(gutter, rect.top - 18))
    setPosition({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open || pinned) return
    updatePosition()
  }, [open, pinned, updatePosition])

  useEffect(() => {
    if (!open || pinned) return

    const handleWindowChange = () => updatePosition()
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)
    return () => {
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [open, pinned, updatePosition])

  useEffect(() => {
    if (!open) return
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [composerExpanded, open])

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
    open,
  ])

  useEffect(() => {
    return () => clearCloseTimer()
  }, [clearCloseTimer])

  useEffect(() => {
    onOpenChange?.(open)
  }, [onOpenChange, open])

  const openPopover = useCallback(() => {
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer])

  const handleDragStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!pinned || event.button !== 0) return

    const target = event.target as HTMLElement
    if (target.closest('button')) return

    dragOffsetRef.current = {
      x: event.clientX - position.left,
      y: event.clientY - position.top,
    }
    setDragging(true)
    event.preventDefault()
  }, [pinned, position.left, position.top])

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
      setPosition({ top: nextTop, left: nextLeft })
    }

    const handlePointerUp = () => setDragging(false)

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [dragging])

  const handleSend = useCallback(() => {
    const nextText = draft.trim()
    if (!nextText) return

    setMessages(saveTodoThreadMessage(storageId, nextText, editingMessageId))
    setDraft('')
    setEditingMessageId(null)
    setComposerExpanded(false)
  }, [draft, editingMessageId, storageId])

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(deleteTodoThreadMessage(storageId, messageId))

    if (editingMessageId === messageId) {
      setEditingMessageId(null)
      setDraft('')
    }
  }, [editingMessageId, storageId])

  const handleEditMessage = useCallback((message: ThreadMessage) => {
    setEditingMessageId(message.id)
    setDraft(message.text)
    setComposerExpanded(true)
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleComposerKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const shouldSend =
      event.key === 'Enter' && (!composerExpanded || event.metaKey || event.ctrlKey)

    if (!shouldSend) return
    event.preventDefault()
    handleSend()
  }, [composerExpanded, handleSend])

  const emptyHint = useMemo(() => '未添加备注', [])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          if (open) {
            setOpen(false)
          } else {
            openPopover()
          }
        }}
        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors duration-200 ${
          hasMessages
            ? 'text-[var(--color-ink-strong)]'
            : 'text-[var(--color-ink-disabled)] hover:text-[var(--color-ink-tertiary)]'
        }`}
        aria-label="打开待办消息浮窗"
      >
        <MessageCircleMore className="h-[13px] w-[13px]" strokeWidth={1.95} />
      </button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[320] w-[320px]"
              style={{ top: position.top, left: position.left }}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onMouseMove={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              <section
                className={`relative overflow-hidden border shadow-[0_28px_60px_rgba(15,23,42,0.16)] ${
                  pinned
                    ? 'rounded-[14px] border-[#d8bf72] bg-[#f6dc86]'
                    : 'rounded-[24px] border-black/[0.08] bg-white/96 backdrop-blur-xl'
                }`}
                style={{ height: popoverHeight }}
              >
                <div
                  className={`px-4 py-3 ${pinned ? 'cursor-grab border-b border-[#d7bf77] bg-[#f2d272] active:cursor-grabbing' : 'border-b border-black/[0.06]'}`}
                  onMouseDown={handleDragStart}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className={`truncate text-[20px] font-semibold tracking-[-0.03em] ${pinned ? 'text-[#5f4916]' : 'text-[var(--color-ink-primary)]'}`}>{title}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          clearCloseTimer()
                          setPinned((current) => !current)
                        }}
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                          pinned
                            ? 'border-[#bb5b45] bg-[#ffe4c8] text-[#bb4f37]'
                            : 'border-[var(--color-border-soft)] bg-white text-[var(--color-ink-disabled)] hover:text-[var(--color-ink-tertiary)]'
                        }`}
                        aria-label={pinned ? '取消固定浮窗' : '固定浮窗'}
                      >
                        <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          clearCloseTimer()
                          setOpen(false)
                        }}
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                          pinned
                            ? 'border-[#cfb86f] bg-[#f7e6ab] text-[#8c7132] hover:text-[#6d551f]'
                            : 'border-[var(--color-border-soft)] bg-white text-[var(--color-ink-disabled)] hover:text-[var(--color-ink-tertiary)]'
                        }`}
                        aria-label="关闭浮窗"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="relative" style={{ height: popoverHeight - headerHeight }}>
                  <div
                    className="absolute inset-0 overflow-y-auto px-4 py-4"
                    style={{ paddingBottom: messageListBottomPadding }}
                  >
                    {messages.length === 0 ? (
                      <div
                        className={`flex h-full items-center justify-center text-[13px] leading-6 ${
                          pinned ? 'text-[#9b8044]' : 'text-[var(--color-ink-disabled)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 opacity-70" strokeWidth={1.8} />
                          <span className="tracking-[0.01em]">{emptyHint}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div key={message.id} className="group">
                            <article
                              className={`px-4 py-3 ${
                                pinned ? 'rounded-[12px] bg-[#f8e8ab]' : 'rounded-[18px] bg-[#848E9C]'
                              }`}
                            >
                              <div className={`text-[14px] leading-6 ${pinned ? 'text-[#5d491c]' : 'text-[#f8fafc]'}`}>{message.text}</div>
                            </article>
                            <div className="mt-1 flex items-center gap-2 px-1">
                              <div className={`text-[11px] font-medium ${pinned ? 'text-[#a78946]' : 'text-[var(--color-ink-subtle)]'}`}>
                                {formatTime(message.createdAt)}
                              </div>
                              <div className="ml-0.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                                    pinned ? 'text-[#9b8044] hover:bg-[#efd88f] hover:text-[#6f5319]' : 'text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-soft-pressed)] hover:text-[var(--color-ink-tertiary)]'
                                  }`}
                                  aria-label="删除消息"
                                >
                                  <Trash2 className="h-3 w-3" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditMessage(message)}
                                  className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                                    pinned ? 'text-[#9b8044] hover:bg-[#efd88f] hover:text-[#6f5319]' : 'text-[var(--color-ink-subtle)] hover:bg-[var(--color-surface-soft-pressed)] hover:text-[var(--color-ink-tertiary)]'
                                  }`}
                                  aria-label="编辑消息"
                                >
                                  <Pencil className="h-3 w-3" strokeWidth={2} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-3 pt-1">
                    <div
                      className="flex flex-col transition-[height] duration-200 ease-out"
                      style={{ height: composerHeight }}
                    >
                      <div className="mb-0.5 flex h-8 items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setComposerExpanded((current) => !current)}
                          className={`inline-flex h-8 items-center gap-1 rounded-full border px-3.5 text-[11px] font-medium transition-colors ${
                            pinned
                              ? 'border-[#cfb567] bg-[#f7e6a5] text-[#6f5925] shadow-[0_1px_0_rgba(255,255,255,0.35)] hover:bg-[#f4de90]'
                              : 'border-[var(--color-border-soft)] bg-white text-[var(--color-ink-tertiary)] shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:bg-[var(--color-surface-canvas)] hover:text-[var(--color-ink-primary)]'
                          }`}
                          aria-label={composerExpanded ? '收起输入区' : '展开输入区'}
                        >
                          {composerExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                          {composerExpanded ? '收起' : '展开'}
                        </button>
                      </div>

                      <div
                        className={`relative mt-auto border transition-[height] duration-200 ease-out ${
                          pinned
                            ? 'rounded-[12px] border-[#cfb567] bg-[#f9eab4] shadow-[0_8px_18px_rgba(135,104,25,0.12)]'
                            : 'rounded-[18px] border-[var(--color-border-soft)] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.04)]'
                        } ${
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
                          className={`w-full resize-none bg-transparent pl-1 pr-12 text-[14px] outline-none ${
                            pinned ? 'text-[#5d491c] placeholder:text-[#b79c59]' : 'text-[var(--color-ink-secondary)] placeholder:text-[var(--color-ink-disabled)]'
                          } ${
                            composerExpanded ? 'leading-7' : 'leading-6'
                          }`}
                        />

                        <div
                          className={`pointer-events-none absolute right-3 flex ${
                            composerExpanded ? 'bottom-3 items-end' : 'inset-y-0 items-center'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={handleSend}
                            disabled={!canSend}
                            className={`pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                              pinned
                                ? canSend
                                  ? 'bg-[#6f5319] text-[#fff8dd] hover:bg-[#5c4311]'
                                  : 'bg-[#ead89a] text-[#bea55a]'
                                : canSend
                                  ? 'bg-[var(--color-ink-strong)] text-white hover:bg-[var(--color-ink-primary)]'
                                  : 'bg-[var(--color-surface-soft-pressed)] text-[var(--color-ink-disabled)]'
                            }`}
                            aria-label="发送消息"
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
        : null}
    </>
  )
}

export default TodoThreadPopover
