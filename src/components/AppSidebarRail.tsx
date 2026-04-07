import React from 'react'
import {
  BarChart3,
  BookOpen,
  Clock3,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react'

export type AppSection =
  | 'today'
  | 'insights'
  | 'people'
  | 'knowledge'
  | 'favorites'
  | 'settings'

interface NavItem {
  id: AppSection
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TOP_NAV_ITEMS: NavItem[] = [
  { id: 'today', label: '今日', icon: Clock3 },
  { id: 'insights', label: '数据', icon: BarChart3 },
  { id: 'people', label: '成员', icon: UserRound },
  { id: 'knowledge', label: '知识', icon: BookOpen },
  { id: 'favorites', label: '收藏', icon: Sparkles },
]

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { id: 'settings', label: '设置', icon: Settings },
]

interface AppSidebarRailProps {
  activeSection: AppSection
  onSelect: (section: AppSection) => void
}

interface RailButtonProps {
  item: NavItem
  isActive: boolean
  onSelect: (section: AppSection) => void
}

const RailButton: React.FC<RailButtonProps> = ({ item, isActive, onSelect }) => {
  const Icon = item.icon

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-label={item.label}
      title={item.label}
      className="app-no-drag group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 hover:bg-black/[0.045]"
      style={{
        color: isActive ? '#3f4854' : 'rgba(63, 72, 84, 0.78)',
      }}
    >
      <span
        className="absolute bottom-[4px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full transition-all duration-200"
        style={{
          background: 'rgba(255, 90, 82, 0.56)',
          transform: isActive ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0.72)',
          opacity: isActive ? 1 : 0,
        }}
      />
      <span
        className="absolute inset-0 rounded-2xl transition-all duration-200"
        style={{
          background: isActive ? 'rgba(255,255,255,0.78)' : 'transparent',
          boxShadow: isActive ? '0 10px 24px rgba(15, 23, 42, 0.08)' : 'none',
        }}
      />
      <Icon className="relative z-10 h-[19px] w-[19px] stroke-[2.1]" />
    </button>
  )
}

export const AppSidebarRail: React.FC<AppSidebarRailProps> = ({ activeSection, onSelect }) => {
  return (
    <aside
      className="app-drag-region flex h-full w-[68px] flex-shrink-0 flex-col items-center border-r border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.38),rgba(255,255,255,0.18))]"
      style={{
        backdropFilter: 'blur(22px) saturate(150%)',
        WebkitBackdropFilter: 'blur(22px) saturate(150%)',
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.62)',
      }}
    >
      <div className="traffic-light-space flex-shrink-0" />

      <div className="flex w-full flex-1 flex-col items-center justify-between pb-4">
        <div className="flex w-full flex-col items-center gap-3 pt-2">
          {TOP_NAV_ITEMS.map((item) => (
            <RailButton
              key={item.id}
              item={item}
              isActive={activeSection === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <div className="flex w-full flex-col items-center">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <RailButton
              key={item.id}
              item={item}
              isActive={activeSection === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

export default AppSidebarRail
