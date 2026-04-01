import React, { useState, useCallback } from 'react'

interface SegmentedOption {
  id: string
  label: string
}

interface SegmentedControlProps {
  options?: SegmentedOption[]
  defaultValue?: string
  onChange?: (value: string) => void
}

const DEFAULT_OPTIONS: SegmentedOption[] = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'key-results', label: 'Key Results' },
  { id: 'todos', label: 'TODOs' },
]

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options = DEFAULT_OPTIONS,
  defaultValue = 'objectives',
  onChange,
}) => {
  // 当前激活的索引（0, 1, 2）
  const [activeIndex, setActiveIndex] = useState(() => {
    const index = options.findIndex((opt) => opt.id === defaultValue)
    return index >= 0 ? index : 0
  })

  const handleClick = useCallback((index: number) => {
    // 进度条逻辑：只能前进或后退，不能跳跃
    // 点击当前位置或之后的位置：前进到该位置
    // 点击之前的位置：后退到该位置
    setActiveIndex(index)
    onChange?.(options[index].id)
  }, [options, onChange])

  // 计算进度条宽度 - 总是从左侧开始
  const progressWidth = ((activeIndex + 1) / options.length) * 100

  return (
    <div className="app-no-drag px-4 py-4">
      <div
        className="relative flex items-center rounded-full w-full"
        style={{
          background: 'rgba(200, 200, 204, 0.6)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: `
            0 4px 24px rgba(0, 0, 0, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.4),
            inset 0 2px 4px rgba(0, 0, 0, 0.06),
            inset 0 4px 8px rgba(0, 0, 0, 0.04)
          `,
          border: '1px solid rgba(255, 255, 255, 0.3)',
          padding: '4px',
          height: '28px',
        }}
      >
        {/* 进度条 - 从左侧生长，边距与容器padding一致 */}
        <div
          className="absolute rounded-full transition-all duration-300 ease-out"
          style={{
            width: `calc(${progressWidth}% - 8px)`,
            left: '4px',
            top: '4px',
            height: 'calc(100% - 8px)',
            background: 'rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(10px) saturate(150%)',
            WebkitBackdropFilter: 'blur(10px) saturate(150%)',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            transform: 'translateZ(0)',
            willChange: 'width',
          }}
        />

        {/* 选项按钮 - 圆点指示器，均匀分布 */}
        {options.map((option, index) => {
          const isActive = index <= activeIndex
          return (
            <button
              key={option.id}
              onClick={() => handleClick(index)}
              className="relative z-10 flex items-center justify-center flex-1 h-full rounded-full transition-all duration-200"
            >
              <div
                className="w-1.5 h-1.5 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: isActive ? '#000000' : '#9ca3af',
                  transform: isActive ? 'scale(1)' : 'scale(0.875)',
                }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SegmentedControl
