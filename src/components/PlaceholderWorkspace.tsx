import React from 'react'
import type { WorkspaceId } from '../workspaces/types'

const PLACEHOLDER_COPY: Record<Exclude<WorkspaceId, 'okr' | 'journal'>, { title: string; description: string }> = {
  peopleWorkspace: {
    title: '成员工作区',
    description: '这里先留空，后续可以放团队成员、协作分工与负责人信息，作为一个独立功能继续扩展。',
  },
  knowledgeWorkspace: {
    title: '知识工作区',
    description: '这里先留空，后续可以放方法论、文档沉淀与项目资料，保持为独立 workspace。',
  },
  favoritesWorkspace: {
    title: '收藏工作区',
    description: '这里先留空，后续可以放常用目标、模板或快捷入口，作为独立模块接入。',
  },
  settings: {
    title: '设置工作区',
    description: '这里先留空，后续可以放账户、偏好设置与应用配置。',
  },
}

interface PlaceholderWorkspaceProps {
  section: Exclude<WorkspaceId, 'okr' | 'journal'>
}

export const PlaceholderWorkspace: React.FC<PlaceholderWorkspaceProps> = ({ section }) => {
  const copy = PLACEHOLDER_COPY[section]

  return (
    <section className="flex h-full w-full flex-col bg-[#f7f8fb]">
      <div className="app-drag-region traffic-light-space flex-shrink-0 border-b border-black/[0.04]" />

      <div className="flex flex-1 items-center justify-center p-10">
        <div className="w-full max-w-xl rounded-[28px] border border-black/[0.05] bg-white/72 px-10 py-12 text-center shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/30">
            Coming Soon
          </p>
          <h2 className="mt-5 text-[28px] font-semibold tracking-[-0.03em] text-[#2f3742]">
            {copy.title}
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-black/42">
            {copy.description}
          </p>
        </div>
      </div>
    </section>
  )
}

export default PlaceholderWorkspace
