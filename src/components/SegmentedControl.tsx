import React, { useState, useCallback, useMemo } from 'react'

interface SegmentedOption {
  id: string
  label: string
}

interface SegmentedControlProps {
  options?: SegmentedOption[]
  defaultValue?: string
  onChange?: (value: string, percentage: number) => void
  sliderStyle?: 'bead' | 'pill'
}

const DEFAULT_OPTIONS: SegmentedOption[] = [
  { id: 'objectives', label: 'Objectives' },
  { id: 'key-results', label: 'Key Results' },
  { id: 'todos', label: 'TODOs' },
]

// 统一缓动函数 - 平滑标准缓动
const SYNC_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const TRANSITION_DURATION = '400ms'

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options = DEFAULT_OPTIONS,
  defaultValue = 'objectives',
  onChange,
  sliderStyle = 'bead',
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    const index = options.findIndex((opt) => opt.id === defaultValue)
    return index >= 0 ? index : 0
  })
  const handleClick = useCallback((index: number) => {
    setActiveIndex(index)
    const newPercentage = (index / (options.length - 1)) * 100
    onChange?.(options[index].id, newPercentage)
  }, [options, onChange])

  // 几何比例 - 根据模式独立调整
  // 圆点视觉尺寸：6px
  const DOT_SIZE = 6
  // 圆点点击热区：40px（保持不变）
  const DOT_HIT_AREA = 40
  
  // Bead 模式：滑轨高度缩减25%，更纤细
  const BEAD_TRACK_HEIGHT = 20
  const BEAD_MARBLE_SIZE = Math.round(BEAD_TRACK_HEIGHT * 1.3)
  
  // Pill 模式：保持原高度
  const PILL_TRACK_HEIGHT = 28
  const PILL_HEIGHT = Math.round(PILL_TRACK_HEIGHT * 0.9)
  
  // 根据模式选择高度
  const TRACK_HEIGHT = sliderStyle === 'bead' ? BEAD_TRACK_HEIGHT : PILL_TRACK_HEIGHT
  const MARBLE_SIZE = sliderStyle === 'bead' ? BEAD_MARBLE_SIZE : 20

  // 圆点位置百分比 - 根据模式独立计算
  // Pill 模式：网格三等分，1/6, 3/6, 5/6 位置 (16.7%, 50%, 83.3%)
  const pillDotPercentages = useMemo(() => {
    return [
      (1/6) * 100,  // 16.7%
      (3/6) * 100,  // 50%
      (5/6) * 100,  // 83.3%
    ]
  }, [])
  
  // Bead 模式：百分比位置（保持不动）
  const beadDotPercentages = useMemo(() => {
    if (options.length === 1) return [50]
    if (options.length === 2) return [25, 75]
    return [10, 50, 90]  // 左、中、右
  }, [options.length])
  
  // 根据模式选择圆点位置百分比
  const dotPercentages = sliderStyle === 'pill' ? pillDotPercentages : beadDotPercentages

  // 珠子目标位置百分比
  const marblePercentage = dotPercentages[activeIndex]

  // 计算旋转角度
  const rotation = useMemo(() => {
    const circumference = Math.PI * MARBLE_SIZE
    // 使用百分比计算旋转
    return ((marblePercentage / 100) * 360) / (circumference / 100)
  }, [marblePercentage, MARBLE_SIZE])

  // Pill 模式：分段生长逻辑，宽度 33.3%, 66.6%, 100%
  const getPillGrowthPercentage = () => {
    if (activeIndex === 0) {
      return (1/3) * 100  // 33.3%
    } else if (activeIndex === 1) {
      return (2/3) * 100  // 66.6%
    } else {
      return 100  // 100%
    }
  }
  
  // Pill 模式生长宽度百分比
  const pillGrowthPercentage = getPillGrowthPercentage()
  // Bead 模式使用原有逻辑
  const beadPercentage = marblePercentage

  // 层级定义
  const Z_INDEX = {
    track: 1,
    fill: 5,
    markers: 10,
    marble: 20,
  }

  return (
    <div className="app-no-drag w-full py-4" style={{ boxSizing: 'border-box' }}>
      {/* 外层容器：宽度100%，与下方内容对齐 */}
      <div
        className="relative w-full"
        style={{
          boxSizing: 'border-box',
          overflow: 'visible',  // 禁用裁切
        }}
      >
        {/* U型槽轨道 - 极浅蓝灰底色 + 外圈白色描边 */}
        <div
          className="relative rounded-full w-full"
          style={{
            height: `${TRACK_HEIGHT}px`,
            background: '#F0F2F5',
            boxShadow: `
              inset 0 3px 6px rgba(0, 0, 0, 0.15),
              inset 0 1px 3px rgba(0, 0, 0, 0.1),
              0 0 0 2px rgba(255, 255, 255, 0.9),
              0 2px 0 rgba(255, 255, 255, 0.95),
              0 -1px 0 rgba(0, 0, 0, 0.05)
            `,
            zIndex: Z_INDEX.track,
            overflow: 'visible',  // 禁用裁切，让珠子完整显示
            boxSizing: 'border-box',
          }}
        >
          {/* 轨道内部深度渐变 */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.5) 100%)',
            }}
          />

          {/* 外边缘亮色描边 */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            }}
          />


        </div>

        {/* 圆点标记 - 激活状态视觉优化 */}
        {options.map((_, index) => {
          const dotPercentage = dotPercentages[index]
          // 判断圆点是否被滑块覆盖
          const isCovered = sliderStyle === 'pill' && pillGrowthPercentage >= dotPercentage
          
          // 材质逻辑：
          // 未激活：半透明灰（轨道预留孔位）
          // 被包裹：深石墨色渐变 + 体积感 + 光晕
          const dotScale = isCovered ? 1.15 : 1
          
          return (
            <div
              key={index}
              className="absolute cursor-pointer"
              style={{
                left: `${dotPercentage}%`,
                top: `${(TRACK_HEIGHT - DOT_HIT_AREA) / 2}px`,
                width: `${DOT_HIT_AREA}px`,
                height: `${DOT_HIT_AREA}px`,
                transform: 'translateX(-50%)',
                zIndex: Z_INDEX.markers,
                boxSizing: 'border-box',
              }}
              onClick={() => handleClick(index)}
            >
              {/* 柔和光晕（仅激活状态） */}
              {isCovered && (
                <div
                  className="absolute rounded-full"
                  style={{
                    left: `${(DOT_HIT_AREA - DOT_SIZE) / 2 - 4}px`,
                    top: `${(DOT_HIT_AREA - DOT_SIZE) / 2 - 4}px`,
                    width: `${DOT_SIZE + 8}px`,
                    height: `${DOT_SIZE + 8}px`,
                    background: 'radial-gradient(circle, rgba(200, 220, 255, 0.4) 0%, transparent 70%)',
                    filter: 'blur(2px)',
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* 圆点视觉元素 */}
              <div
                className="absolute rounded-full transition-all duration-200"
                style={{
                  left: `${(DOT_HIT_AREA - DOT_SIZE) / 2}px`,
                  top: `${(DOT_HIT_AREA - DOT_SIZE) / 2}px`,
                  width: `${DOT_SIZE}px`,
                  height: `${DOT_SIZE}px`,
                  // 深石墨色渐变背景
                  background: isCovered 
                    ? 'linear-gradient(to bottom, #2C2C2E 0%, #000000 100%)'
                    : 'rgba(150, 155, 165, 0.5)',
                  // 0.5px半透明外描边
                  border: '0.5px solid rgba(255, 255, 255, 0.3)',
                  // 体积感：顶部高光 + 底部阴影 + 内凹感
                  boxShadow: isCovered
                    ? `
                      inset 0 1px 0 rgba(255, 255, 255, 0.2),
                      inset 0 -1px 2px rgba(0, 0, 0, 0.5),
                      0 1px 2px rgba(0, 0, 0, 0.3)
                    `
                    : `
                      inset 0 2px 4px rgba(0, 0, 0, 0.3),
                      inset 0 1px 2px rgba(0, 0, 0, 0.2),
                      0 1px 0 rgba(255, 255, 255, 0.5)
                    `,
                  transform: `scale(${dotScale})`,
                  transitionTimingFunction: 'ease-out',
                }}
              />
            </div>
          )
        })}

        {/* 滑块主体 - 根据模式渲染圆珠或药片 */}
        {sliderStyle === 'bead' ? (
          /* 方案A：拟物圆珠模式 - 缩小尺寸，微调光影 */
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${beadPercentage}%`,
              top: `${(TRACK_HEIGHT - MARBLE_SIZE) / 2}px`,
              width: `${MARBLE_SIZE}px`,
              height: `${MARBLE_SIZE}px`,
              transform: 'translateX(-50%)',
              zIndex: Z_INDEX.marble,
              transition: `left ${TRANSITION_DURATION} ${SYNC_EASE}`,
              willChange: 'left',
              filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.17))',
              boxSizing: 'border-box',
            }}
          >
            {/* 接触阴影 - 缩小并柔化 */}
            <div
              className="absolute rounded-full"
              style={{
                left: '50%',
                bottom: '0px',
                transform: 'translateX(-50%)',
                width: '12px',
                height: '4px',
                background: 'rgba(0, 0, 0, 0.2)',
                filter: 'blur(3px)',
                zIndex: -1,
              }}
            />

            {/* 底层：更清透的玻璃体积层，边缘状态减少珍珠感 */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `
                  radial-gradient(circle at 28% 24%, rgba(255, 255, 255, 0.82) 0%, rgba(255,255,255,0.28) 22%, transparent 50%),
                  radial-gradient(circle at 70% 76%, rgba(182, 196, 214, 0.11) 0%, transparent 38%),
                  radial-gradient(circle at 46% 50%, rgba(236, 243, 251, 0.32) 0%, rgba(236,243,251,0.12) 48%, transparent 72%),
                  linear-gradient(145deg, rgba(244, 248, 252, 0.72) 0%, rgba(212, 221, 232, 0.38) 52%, rgba(188, 198, 210, 0.3) 100%)
                `,
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${TRANSITION_DURATION} ${SYNC_EASE}`,
              }}
            />

            {/* 顶层：轮廓和折射层 */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                backdropFilter: 'blur(2.4px)',
                WebkitBackdropFilter: 'blur(2.4px)',
                border: '0.5px solid rgba(255, 255, 255, 0.56)',
                boxShadow: `
                  inset 0 0 0 1px rgba(255, 255, 255, 0.24),
                  inset 0 -1px 2px rgba(132, 145, 162, 0.12),
                  0 1px 6px rgba(150, 158, 170, 0.18),
                  0 2px 8px rgba(0, 0, 0, 0.05)
                `,
              }}
            >
              {/* 主高光 */}
              <div
                className="absolute"
                style={{
                  top: '2px',
                  left: '48%',
                  transform: 'translateX(-50%)',
                  width: '9px',
                  height: '5px',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.78) 62%, transparent 100%)',
                  borderRadius: '50% 50% 50% 50% / 70% 70% 30% 30%',
                  filter: 'blur(0.2px)',
                }}
              />

              {/* 次高光点 */}
              <div
                className="absolute rounded-full"
                style={{
                  top: '4px',
                  left: '5px',
                  width: '2.5px',
                  height: '2.5px',
                  background: 'rgba(255, 255, 255, 0.96)',
                  filter: 'blur(0.15px)',
                }}
              />

              {/* 底部内折射 */}
              <div
                className="absolute"
                style={{
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '11px',
                  height: '5px',
                  background: 'radial-gradient(ellipse at center bottom, rgba(154,168,186,0.14) 0%, rgba(216,224,233,0.16) 42%, transparent 72%)',
                  borderRadius: '50%',
                  filter: 'blur(0.5px)',
                }}
              />

              {/* 中心透亮层 */}
              <div
                className="absolute"
                style={{
                  bottom: '5px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '8px',
                  height: '5px',
                  background: 'radial-gradient(ellipse at center, rgba(244,248,252,0.34) 0%, transparent 66%)',
                  borderRadius: '50%',
                  filter: 'blur(1px)',
                }}
              />

              {/* 右侧折射边缘 */}
              <div
                className="absolute rounded-full"
                style={{
                  top: '50%',
                  right: '1px',
                  transform: 'translateY(-50%)',
                  width: '2px',
                  height: '13px',
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.62) 50%, transparent 100%)',
                  filter: 'blur(0.5px)',
                }}
              />

              <div
                className="absolute rounded-full"
                style={{
                  top: '50%',
                  left: '1px',
                  transform: 'translateY(-50%)',
                  width: '2px',
                  height: '10px',
                  background: 'linear-gradient(to bottom, transparent 0%, rgba(248,250,255,0.34) 50%, transparent 100%)',
                  filter: 'blur(0.7px)',
                }}
              />
            </div>
          </div>
        ) : (
          /* 方案B：阶梯生长式玻璃填充 - 满幅填充，左右顶满 */
          <>
            {/* 玻璃填充层 - 固定左侧起点 (0px)，宽度满幅生长 */}
            <div
              className="absolute pointer-events-none rounded-full"
              style={{
                left: '0px',
                width: `${pillGrowthPercentage}%`,
                height: `${PILL_HEIGHT}px`,
                top: `${(TRACK_HEIGHT - PILL_HEIGHT) / 2}px`,
                zIndex: Z_INDEX.fill,
                transition: `width ${TRANSITION_DURATION} ${SYNC_EASE}`,
                willChange: 'width',
                background: 'rgba(255, 255, 255, 0.35)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '2px solid rgba(255, 255, 255, 0.7)',
                boxSizing: 'border-box',
                boxShadow: `
                  inset 0 2px 4px rgba(255, 255, 255, 0.5),
                  inset 0 -2px 3px rgba(0, 0, 0, 0.03),
                  0 1px 4px rgba(0, 0, 0, 0.05)
                `,
              }}
            />
            {/* 右边缘高光 - 生长点指示 */}
            {pillGrowthPercentage > 5 && (
              <div
                className="absolute pointer-events-none rounded-full"
                style={{
                  left: `calc(${pillGrowthPercentage}% - 4px)`,
                  width: '3px',
                  height: `${PILL_HEIGHT - 4}px`,
                  top: `${(TRACK_HEIGHT - PILL_HEIGHT) / 2 + 2}px`,
                  background: 'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                  zIndex: Z_INDEX.fill + 1,
                  filter: 'blur(1px)',
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SegmentedControl
