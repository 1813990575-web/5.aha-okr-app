import React, { useState, useRef } from 'react'

interface TaskInputProps {
  onSubmit: (content: string) => Promise<void> | void
  disabled?: boolean
}

export const TaskInput: React.FC<TaskInputProps> = ({ onSubmit, disabled }) => {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 诊断日志：每次渲染时打印当前值
  console.log("[DIAG] Component Re-rendered with value:", content)

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
        group mx-6 mb-1.5 flex items-center gap-3 rounded-2xl border border-transparent px-6 py-3.5
        transition-all duration-300 cursor-text
        hover:bg-[#f7f8fa]
        ${disabled || isSubmitting ? 'opacity-50 pointer-events-none' : ''}
      `}
      onClick={() => inputRef.current?.focus()}
    >
      {/* 勾选框占位 - 和任务项一样的样式 */}
      <div className="w-5 h-5 rounded-[4px] border-2 border-gray-300 bg-white flex-shrink-0" />

      {/* 输入框 */}
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => {
          console.log("[DIAG] Input Triggered:", e.target.value)
          setContent(e.target.value)
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={isSubmitting ? '保存中...' : '添加待办事项...'}
        disabled={disabled || isSubmitting}
        className="
          flex-1 bg-transparent text-[14px] text-[#48515d]
          placeholder:text-[#a4acb7]
          focus:outline-none
        "
      />
    </div>
  )
}
