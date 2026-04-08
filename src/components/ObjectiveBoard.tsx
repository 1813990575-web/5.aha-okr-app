import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, MoreHorizontal, Plus, Share, List } from 'lucide-react'
import type { Item } from '../store/index'
import { COLOR_OPTIONS } from './Sidebar'

interface ObjectiveBoardProps {
  objective: { id: string; title: string; color?: string | null }
  onObjectiveChanged?: () => void | Promise<void>
  refreshTrigger?: number
}

type EditingTarget =
  | { id: string; kind: 'objective' | 'kr' | 'todo'; value: string }
  | null

function getColorHex(colorKey?: string | null): string {
  if (!colorKey) return '#ff5a4f'
  return COLOR_OPTIONS.find((option) => option.key === colorKey)?.textColor || '#ff5a4f'
}

function sortByOrder<T extends { sort_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order)
}

export const ObjectiveBoard: React.FC<ObjectiveBoardProps> = ({ objective, onObjectiveChanged, refreshTrigger }) => {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null)
  const [newTodoByKr, setNewTodoByKr] = useState<Record<string, string>>({})
  const [openKrMenuId, setOpenKrMenuId] = useState<string | null>(null)
  const [boardMenuPosition, setBoardMenuPosition] = useState<{ x: number; y: number } | null>(null)

  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const allItems = await window.electronAPI.database.getAllItems()
      setItems(allItems)
    } catch (loadError) {
      console.error('[ObjectiveBoard] 加载分栏数据失败:', loadError)
      setError('加载分栏内容失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems, objective.id])

  useEffect(() => {
    if (refreshTrigger === undefined) return
    void loadItems()
  }, [refreshTrigger, loadItems])

  const boardObjective = useMemo(
    () => items.find((item) => item.id === objective.id && item.type === 'O') || null,
    [items, objective.id]
  )

  const krColumns = useMemo(() => {
    return sortByOrder(items.filter((item) => item.parent_id === objective.id && item.type === 'KR')).map((kr) => ({
      ...kr,
      todos: sortByOrder(items.filter((item) => item.parent_id === kr.id && item.type === 'TODO')),
    }))
  }, [items, objective.id])

  const completedTodoCount = useMemo(
    () => krColumns.flatMap((kr) => kr.todos).filter((todo) => todo.status === 1).length,
    [krColumns]
  )

  const totalTodoCount = useMemo(
    () => krColumns.reduce((sum, kr) => sum + kr.todos.length, 0),
    [krColumns]
  )

  const activeColor = getColorHex(boardObjective?.color ?? objective.color)

  const refreshAfterMutation = useCallback(async () => {
    await loadItems()
    await onObjectiveChanged?.()
  }, [loadItems, onObjectiveChanged])

  const saveTitle = useCallback(async (id: string, value: string) => {
    const nextTitle = value.trim()
    setEditingTarget(null)
    if (!nextTitle) return
    await window.electronAPI.database.updateItem(id, { title: nextTitle })
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  const createKr = useCallback(async () => {
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'KR',
      parent_id: objective.id,
      title: '新关键结果',
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    await refreshAfterMutation()
    setEditingTarget({ id: newId, kind: 'kr', value: '新关键结果' })
  }, [objective.id, refreshAfterMutation])

  const createTodo = useCallback(async (krId: string) => {
    const title = (newTodoByKr[krId] || '').trim()
    if (!title) return
    const newId = crypto.randomUUID()
    await window.electronAPI.database.createItemAtTop({
      id: newId,
      type: 'TODO',
      parent_id: krId,
      title,
      content: '',
      status: 0,
      total_focus_time: 0,
    })
    setNewTodoByKr((current) => ({ ...current, [krId]: '' }))
    await refreshAfterMutation()
  }, [newTodoByKr, refreshAfterMutation])

  const toggleTodo = useCallback(async (todo: Item) => {
    const nextStatus = todo.status === 1 ? 0 : 1
    await window.electronAPI.database.updateItem(todo.id, { status: nextStatus })
    if (window.electronAPI?.dailyTasks?.getAllTasks) {
      const allTasks = await window.electronAPI.dailyTasks.getAllTasks()
      const linkedTasks = allTasks.filter((task: { sourceItemId?: string | null; linkedGoalId?: string | null }) =>
        (task.sourceItemId ?? task.linkedGoalId) === todo.id
      )
      await Promise.all(
        linkedTasks.map((task: { id: string }) => window.electronAPI.dailyTasks.updateTask(task.id, { isDone: nextStatus === 1 }))
      )
    }
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  const clearCompletedTodos = useCallback(async () => {
    const completedTodos = krColumns.flatMap((kr) => kr.todos).filter((todo) => todo.status === 1)
    await Promise.all(completedTodos.map((todo) => window.electronAPI.database.deleteItem(todo.id)))
    await refreshAfterMutation()
  }, [krColumns, refreshAfterMutation])

  const deleteItem = useCallback(async (id: string) => {
    setOpenKrMenuId(null)
    const result = await window.electronAPI.database.deleteItem(id)
    const deletedIds = result?.deletedIds || [id]
    if (window.electronAPI?.dailyTasks?.getAllTasks) {
      const allTasks = await window.electronAPI.dailyTasks.getAllTasks()
      const linkedTasks = allTasks.filter((task: { sourceItemId?: string | null; linkedGoalId?: string | null }) =>
        deletedIds.includes((task.sourceItemId ?? task.linkedGoalId) || '')
      )
      await Promise.all(linkedTasks.map((task: { id: string }) => window.electronAPI.dailyTasks.deleteTask(task.id)))
    }
    await refreshAfterMutation()
  }, [refreshAfterMutation])

  useEffect(() => {
    if (!openKrMenuId) return

    const handleClick = () => setOpenKrMenuId(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openKrMenuId])

  useEffect(() => {
    if (!boardMenuPosition) return

    const handleClick = () => setBoardMenuPosition(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [boardMenuPosition])

  if (loading) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-gray-400">加载中...</div>
  }

  if (error || !boardObjective) {
    return <div className="flex h-full items-center justify-center bg-white text-sm text-red-500">{error || '目标不存在'}</div>
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white text-[#2e3137]">
      <div className="flex items-start justify-between px-7 pb-3 pt-8">
        <div>
          {editingTarget?.id === boardObjective.id ? (
            <input
              autoFocus
              value={editingTarget.value}
              onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
              onBlur={() => void saveTitle(boardObjective.id, editingTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveTitle(boardObjective.id, editingTarget.value)
                if (e.key === 'Escape') setEditingTarget(null)
              }}
              className="w-[420px] max-w-full border-none p-0 text-[30px] font-bold leading-none tracking-[-0.03em] text-[#ff5a4f] outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingTarget({ id: boardObjective.id, kind: 'objective', value: boardObjective.title })}
              className="text-left text-[30px] font-bold leading-none tracking-[-0.03em] text-[#ff5a4f]"
            >
              {boardObjective.title}
            </button>
          )}
          <div className="mt-3 flex items-center gap-2 text-[13px] text-[#8a8a93]">
            <span>{completedTodoCount} 项完成</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => void clearCompletedTodos()}
              className="text-[#ff6b61] transition-opacity hover:opacity-70"
            >
              清除
            </button>
          </div>
        </div>

        <div className="flex items-start gap-7">
          <div className="flex items-center gap-3 pt-1 text-[#7d8088]">
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <Share className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </button>
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <List className="h-[19px] w-[19px]" strokeWidth={1.9} />
            </button>
            <button type="button" className="rounded-md p-1.5 transition-colors hover:bg-[#f4f4f6]">
              <Plus className="h-[20px] w-[20px]" strokeWidth={1.9} />
            </button>
          </div>

          <div className="min-w-[44px] text-right">
            <div className="text-[54px] font-light leading-[0.9] tracking-[-0.05em]" style={{ color: activeColor }}>
              {totalTodoCount}
            </div>
            <div className="mt-1 text-[13px] font-semibold" style={{ color: activeColor }}>
              显示
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-x-auto overflow-y-auto px-6 pb-8"
        onContextMenu={(e) => {
          const target = e.target as HTMLElement
          if (target.closest('[data-kr-column="true"]')) return
          e.preventDefault()
          setOpenKrMenuId(null)
          setBoardMenuPosition({ x: e.clientX, y: e.clientY })
        }}
      >
        <div className="flex min-h-full w-max gap-4 pr-8">
          {krColumns.map((kr) => (
            <div key={kr.id} className="w-[238px] flex-shrink-0" data-kr-column="true">
              <div className="mb-3 flex items-center justify-between px-1">
                {editingTarget?.id === kr.id ? (
                  <input
                    autoFocus
                    value={editingTarget.value}
                    onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                    onBlur={() => void saveTitle(kr.id, editingTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveTitle(kr.id, editingTarget.value)
                      if (e.key === 'Escape') setEditingTarget(null)
                    }}
                    className="w-full border-none bg-transparent p-0 text-[18px] font-bold tracking-[-0.02em] text-[#30333a] outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => setEditingTarget({ id: kr.id, kind: 'kr', value: kr.title })}
                    className="truncate text-left text-[18px] font-bold tracking-[-0.02em] text-[#30333a]"
                  >
                    {kr.title}
                  </button>
                )}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenKrMenuId((current) => (current === kr.id ? null : kr.id))
                    }}
                    className="rounded-md p-1 text-[#9a9da6] transition-colors hover:bg-[#f3f4f6]"
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.7} />
                  </button>
                  {openKrMenuId === kr.id ? (
                    <div
                      className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[112px] rounded-[12px] border border-black/[0.06] bg-white/95 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void deleteItem(kr.id)}
                        className="w-full rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#c26a64] transition-colors hover:bg-[#fff3f2]"
                      >
                        删除列
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  {kr.todos.map((todo) => (
                    <div
                      key={todo.id}
                      className="rounded-[14px] bg-[#f1f1f3] px-4 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                    >
                      <div className="flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => void toggleTodo(todo)}
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                            todo.status === 1 ? 'border-[#8d9199] bg-[#8d9199]' : 'border-[#c8cbd2] bg-white'
                          }`}
                        >
                          {todo.status === 1 ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                        </button>

                        <div className="min-w-0 flex-1">
                          {editingTarget?.id === todo.id ? (
                            <input
                              autoFocus
                              value={editingTarget.value}
                              onChange={(e) => setEditingTarget({ ...editingTarget, value: e.target.value })}
                              onBlur={() => void saveTitle(todo.id, editingTarget.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveTitle(todo.id, editingTarget.value)
                                if (e.key === 'Escape') setEditingTarget(null)
                              }}
                              className="w-full border-none bg-transparent p-0 text-[16px] font-semibold leading-[1.15] text-[#3a3e45] outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              onDoubleClick={() => setEditingTarget({ id: todo.id, kind: 'todo', value: todo.title })}
                              className={`w-full text-left text-[16px] font-semibold leading-[1.15] ${
                                todo.status === 1 ? 'text-[#9a9ea8] line-through' : 'text-[#3a3e45]'
                              }`}
                            >
                              {todo.title || '未命名待办'}
                            </button>
                          )}
                          {todo.content ? (
                            <div className="mt-1 text-[12px] leading-[1.2] text-[#7b7f89]">{todo.content}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-[14px] bg-[#f1f1f3] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                    <div className="flex items-center gap-2.5">
                      <span className="h-5 w-5 flex-shrink-0 rounded-full border border-[#d3d5db] bg-white" />
                      <input
                        value={newTodoByKr[kr.id] || ''}
                        onChange={(e) => setNewTodoByKr((current) => ({ ...current, [kr.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void createTodo(kr.id)
                          }
                        }}
                        placeholder="新增待办..."
                        className="w-full border-none bg-transparent p-0 text-[15px] font-medium text-[#80838c] outline-none placeholder:text-[#a6a8af]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {boardMenuPosition ? (
          <div
            className="fixed z-30 min-w-[132px] rounded-[12px] border border-black/[0.06] bg-white/95 p-1 shadow-[0_12px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl"
            style={{ left: boardMenuPosition.x, top: boardMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={() => {
                setBoardMenuPosition(null)
                void createKr()
              }}
              className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-[#3a3e45] transition-colors hover:bg-[#f5f6f8]"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              添加分栏
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ObjectiveBoard
