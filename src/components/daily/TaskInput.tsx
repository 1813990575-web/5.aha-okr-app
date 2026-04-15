import React, { useState, useRef } from 'react'
import { DAILY_TASK_ROW_BASE_CLASS } from './taskRowStyles'

interface TaskInputProps {
  onSubmit: (content: string) => Promise<void> | void
  disabled?: boolean
}

export const TaskInput: React.FC<TaskInputProps> = ({ onSubmit, disabled }) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || isSubmitting) return

    setIsSubmitting(true)

    try {
      await onSubmit(trimmed)
      // 只有成功后才清空输入框
      setContent('')
    } catch (error) {
      // 保存失败，保留输入框内容，让用户可以重试
      console.error('[TaskInput] 提交失败:', error)
    } finally {
      setIsSubmitting(false)
      // 保持焦点
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className={`
        ${DAILY_TASK_ROW_BASE_CLASS} cursor-text
        bg-[var(--color-surface-soft)] hover:bg-[var(--color-surface-soft-hover)]
        ${disabled || isSubmitting ? 'opacity-50 pointer-events-none' : ''}
      `}
      onClick={() => inputRef.current?.focus()}
    >
      {/* 勾选框占位 - 和任务项一样的样式 */}
      <div className="h-5 w-5 flex-shrink-0 rounded-[4px] border-2 border-[var(--color-border-muted)] bg-transparent" />

      {/* 输入框 */}
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={isSubmitting ? '保存中...' : '添加待办事项...'}
        disabled={disabled || isSubmitting}
        className="
          flex-1 bg-transparent text-[14px] text-[var(--color-ink-secondary)]
          placeholder:text-[var(--color-ink-disabled)]
          focus:outline-none
        "
      />
    </div>
  )
}
