import React from 'react'
import { ChevronRight, SlidersHorizontal } from 'lucide-react'
import { SidebarThemeSelector } from './SidebarThemeSelector'
import { VersionDisplay } from './VersionDisplay'

interface SettingsWorkspaceProps {
  sliderStyle: 'bead' | 'pill'
  onSliderStyleChange: (style: 'bead' | 'pill') => void
}

export const SettingsWorkspace: React.FC<SettingsWorkspaceProps> = ({
  sliderStyle,
  onSliderStyleChange,
}) => {
  return (
    <section className="flex h-full w-full flex-col bg-[#f7f8fb]">
      <div className="app-drag-region traffic-light-space flex-shrink-0 border-b border-black/[0.04]" />

      <div className="flex flex-1 justify-center overflow-y-auto px-8 py-10">
        <div className="w-full max-w-3xl space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/28">
              Preferences
            </p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.035em] text-[#2f3742]">
              设置
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-black/48">
              先把实验性和账户类信息收纳到这里，让主界面只承担目标梳理和每日执行。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[28px] border border-black/[0.05] bg-white/82 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef1f5] text-[#596274]">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#34404d]">界面实验室</h3>
                  <p className="mt-1 text-xs leading-6 text-black/42">
                    把暂时性的视觉调试项集中管理，避免和主任务区抢焦点。
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-black/[0.05] bg-[#f3f5f8] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#334155]">上方调节器样式</p>
                    <p className="mt-1 text-xs text-black/40">选择更像实体旋钮，或更像进度药丸。</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                    <button
                      type="button"
                      onClick={() => onSliderStyleChange('bead')}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: sliderStyle === 'bead' ? '#e7ebf2' : 'transparent',
                        color: sliderStyle === 'bead' ? '#334155' : 'rgba(51, 65, 85, 0.5)',
                      }}
                    >
                      珠子
                    </button>
                    <button
                      type="button"
                      onClick={() => onSliderStyleChange('pill')}
                      className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: sliderStyle === 'pill' ? '#e7ebf2' : 'transparent',
                        color: sliderStyle === 'pill' ? '#334155' : 'rgba(51, 65, 85, 0.5)',
                      }}
                    >
                      药丸
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/[0.05] bg-[#f3f5f8] p-4">
                <div>
                  <p className="text-sm font-medium text-[#334155]">左侧面板材质</p>
                  <p className="mt-1 text-xs text-black/40">用更克制的背景去承托层级，而不是直接抢视觉中心。</p>
                </div>
                <div className="mt-4">
                  <SidebarThemeSelector />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-black/[0.05] bg-white/82 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.05)] backdrop-blur-xl">
              <h3 className="text-sm font-semibold text-[#34404d]">账户与应用</h3>

              <div className="mt-5 rounded-2xl border border-black/[0.05] bg-[#f3f5f8] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-medium text-white">
                    U
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#334155]">User Name</p>
                    <p className="text-xs text-black/40">user@example.com</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-black/25" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-black/[0.05] bg-[#f3f5f8] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-black/30">
                  Version
                </p>
                <div className="mt-3 text-sm text-[#334155]">
                  <VersionDisplay />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SettingsWorkspace
