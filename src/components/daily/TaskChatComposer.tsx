import React, { useState, useRef } from 'react'
import { ArrowUp } from 'lucide-react'

interface TaskChatComposerProps {
  onSubmit: (content: string) => Promise<void> | void
  disabled?: boolean
}

export const TaskChatComposer: React.FC<TaskChatComposerProps> = ({ onSubmit, disabled }) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const canSend = content.trim().length > 0 && !isSubmitting && !disabled

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSubmitting || disabled) return

    setIsSubmitting(true)
    try {
      await onSubmit(trimmed)
      setContent('')
    } catch (error) {
      console.error('[TaskChatComposer] 提交失败:', error)
    } finally {
      setIsSubmitting(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="rounded-[14px] border border-black/[0.08] bg-white px-3 py-2 shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleSubmit()
            }
          }}
          placeholder={isSubmitting ? '发送中...' : '输入今日待办...'}
          disabled={disabled || isSubmitting}
          className="flex-1 bg-transparent px-1 text-[14px] text-[#4a5360] placeholder:text-[#a4acb7] outline-none"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSend}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            canSend ? 'bg-[#dcdfe5] text-[#7b8390] hover:bg-[#cfd4dc]' : 'bg-[#eceef2] text-[#b9bfc9]'
          }`}
          aria-label="发送待办"
        >
          <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}

export default TaskChatComposer
