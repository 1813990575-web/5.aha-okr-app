import React, { useState } from 'react'
import { useSidebarTheme, SidebarTheme, THEME_CONFIGS } from '../contexts/SidebarThemeContext'

interface SolidColorOption {
  id: SidebarTheme
  name: string
  color: string
}

interface GradientOption {
  id: SidebarTheme
  name: string
  gradient: string
}

const SOLID_COLORS: SolidColorOption[] = [
  { id: 'snow-white', name: '雪白', color: '#FFFFFF' },
  { id: 'morning-mist', name: '晨雾灰', color: '#F5F5F7' },
  { id: 'silver-stone', name: '银石灰', color: '#E8E8ED' },
  { id: 'deep-space', name: '深空灰', color: '#1C1C1E' },
]

const GRADIENTS: GradientOption[] = [
  { 
    id: 'soft-dawn', 
    name: 'Soft Dawn', 
    gradient: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)' 
  },
  { 
    id: 'neutral-paper', 
    name: 'Neutral Paper', 
    gradient: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)' 
  },
]

export const SidebarThemeSelector: React.FC = () => {
  const { currentTheme, setTheme } = useSidebarTheme()
  const [isOpen, setIsOpen] = useState(false)

  const handleThemeClick = (themeId: SidebarTheme) => {
    setTheme(themeId)
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-macos-gray-500 hover:text-macos-gray-700 transition-colors"
      >
        <PaletteIcon className="w-4 h-4" />
        <span>侧边栏样式</span>
      </button>
    )
  }

  return (
    <div className="p-3 bg-white rounded-macos shadow-lg border border-macos-gray-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-macos-gray-700">选择背景</span>
        <button
          onClick={handleClose}
          className="text-xs text-macos-gray-400 hover:text-macos-gray-600"
        >
          完成
        </button>
      </div>
      
      {/* 纯色预设 */}
      <div className="mb-3">
        <div className="text-xs text-macos-gray-400 mb-2">纯色</div>
        <div className="flex gap-2 flex-wrap">
          {SOLID_COLORS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleThemeClick(option.id)}
              className={`
                relative w-8 h-8 rounded-full
                border-2 transition-all duration-200
                ${currentTheme === option.id 
                  ? 'border-blue-500 scale-110 shadow-md' 
                  : 'border-transparent hover:scale-105'
                }
              `}
              style={{ background: option.color }}
              title={option.name}
            >
              {currentTheme === option.id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckIcon className={option.id === 'deep-space' ? 'w-4 h-4 text-white' : 'w-4 h-4 text-blue-500'} />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 模糊渐变预设 */}
      <div className="mb-2">
        <div className="text-xs text-macos-gray-400 mb-2">模糊渐变</div>
        <div className="flex gap-2 flex-wrap">
          {GRADIENTS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleThemeClick(option.id)}
              className={`
                relative w-8 h-8 rounded-full
                border-2 transition-all duration-200
                ${currentTheme === option.id 
                  ? 'border-blue-500 scale-110 shadow-md' 
                  : 'border-transparent hover:scale-105'
                }
              `}
              style={{ background: option.gradient }}
              title={option.name}
            >
              {currentTheme === option.id && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-blue-500" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mt-3 text-xs text-macos-gray-400">
        当前: {[...SOLID_COLORS, ...GRADIENTS].find(o => o.id === currentTheme)?.name}
      </div>
    </div>
  )
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default SidebarThemeSelector
