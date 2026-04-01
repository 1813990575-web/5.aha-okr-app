import React, { createContext, useContext, useState, useCallback } from 'react'

export type SidebarTheme = 
  | 'snow-white'
  | 'morning-mist'
  | 'silver-stone'
  | 'deep-space'
  | 'soft-dawn'
  | 'neutral-paper'

export interface ThemeConfig {
  background: string
  textColor: string
  isDark: boolean
  blur?: boolean
}

const THEME_CONFIGS: Record<SidebarTheme, ThemeConfig> = {
  'snow-white': {
    background: '#FFFFFF',
    textColor: '#1f2937',
    isDark: false,
    blur: false,
  },
  'morning-mist': {
    background: '#F5F5F7',
    textColor: '#1f2937',
    isDark: false,
    blur: false,
  },
  'silver-stone': {
    background: '#E8E8ED',
    textColor: '#1f2937',
    isDark: false,
    blur: false,
  },
  'deep-space': {
    background: '#1C1C1E',
    textColor: '#ffffff',
    isDark: true,
    blur: false,
  },
  'soft-dawn': {
    background: 'linear-gradient(135deg, #e0eafc 0%, #cfdef3 100%)',
    textColor: '#1f2937',
    isDark: false,
    blur: true,
  },
  'neutral-paper': {
    background: 'linear-gradient(120deg, #fdfbfb 0%, #ebedee 100%)',
    textColor: '#1f2937',
    isDark: false,
    blur: true,
  },
}

interface SidebarThemeContextType {
  currentTheme: SidebarTheme
  themeConfig: ThemeConfig
  setTheme: (theme: SidebarTheme) => void
}

const SidebarThemeContext = createContext<SidebarThemeContextType | undefined>(undefined)

export const SidebarThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState<SidebarTheme>('morning-mist')

  const setTheme = useCallback((theme: SidebarTheme) => {
    setCurrentTheme(theme)
  }, [])

  const value: SidebarThemeContextType = {
    currentTheme,
    themeConfig: THEME_CONFIGS[currentTheme],
    setTheme,
  }

  return (
    <SidebarThemeContext.Provider value={value}>
      {children}
    </SidebarThemeContext.Provider>
  )
}

export const useSidebarTheme = (): SidebarThemeContextType => {
  const context = useContext(SidebarThemeContext)
  if (!context) {
    throw new Error('useSidebarTheme must be used within SidebarThemeProvider')
  }
  return context
}

export { THEME_CONFIGS }
export default SidebarThemeContext
