import { useCallback, useEffect, useState } from 'react'
import type { DailyTask } from '../../store/index'
import {
  readFocusSessions,
  subscribeFocusSessions,
  writeFocusSessions,
  type FocusSessionRecord,
} from './focusSessionStore'

export interface FocusAnchorRect {
  top: number
  left: number
  width: number
  height: number
  right?: number
  bottom?: number
}

interface UseTaskBoardFocusSessionsResult {
  focusSessions: Record<string, FocusSessionRecord>
  patchFocusSession: (taskId: string, patch: Partial<FocusSessionRecord>) => void
  removeFocusSession: (taskId: string) => void
  handleStartFocus: (task: DailyTask, anchorRect?: FocusAnchorRect | null) => void
}

export function useTaskBoardFocusSessions(tasks: DailyTask[]): UseTaskBoardFocusSessionsResult {
  const [focusSessions, setFocusSessions] = useState<Record<string, FocusSessionRecord>>(() => readFocusSessions())

  useEffect(() => subscribeFocusSessions(() => setFocusSessions(readFocusSessions())), [])

  useEffect(() => {
    setFocusSessions((current) => {
      let hasChanged = false
      const nextSessions = { ...current }

      tasks.forEach((task) => {
        const currentSession = nextSessions[task.id]
        if (!currentSession) return
        if (currentSession.title === task.content) return

        nextSessions[task.id] = {
          ...currentSession,
          title: task.content,
          updatedAt: Date.now(),
        }
        hasChanged = true
      })

      if (!hasChanged) return current
      writeFocusSessions(nextSessions)
      return nextSessions
    })
  }, [tasks])

  const patchFocusSession = useCallback((taskId: string, patch: Partial<FocusSessionRecord>) => {
    setFocusSessions((current) => {
      const existingSession = current[taskId]
      if (!existingSession) return current

      const nextSessions = {
        ...current,
        [taskId]: {
          ...existingSession,
          ...patch,
          updatedAt: Date.now(),
        },
      }
      writeFocusSessions(nextSessions)
      return nextSessions
    })
  }, [])

  const removeFocusSession = useCallback((taskId: string) => {
    setFocusSessions((current) => {
      if (!current[taskId]) return current
      const nextSessions = { ...current }
      delete nextSessions[taskId]
      writeFocusSessions(nextSessions)
      return nextSessions
    })
  }, [])

  const handleStartFocus = useCallback((task: DailyTask, anchorRect?: FocusAnchorRect | null) => {
    setFocusSessions((current) => {
      const existingSession = current[task.id]
      const panelWidth = 356
      const viewportPadding = 18
      const anchorLeft = anchorRect?.left ?? Math.max(72, window.innerWidth - 470)
      const anchorTop = anchorRect?.top ?? 96
      const anchorRight = anchorRect?.right ?? anchorLeft + (anchorRect?.width ?? 0)
      const nextLeftCandidate = anchorLeft - panelWidth - 18
      const nextLeft = nextLeftCandidate > viewportPadding
        ? nextLeftCandidate
        : Math.min(window.innerWidth - panelWidth - viewportPadding, anchorRight + 18)
      const nextTop = Math.min(window.innerHeight - 520, Math.max(viewportPadding, anchorTop - 20))

      const nextSession: FocusSessionRecord = existingSession
        ? {
            ...existingSession,
            title: task.content,
            panelOpen: true,
            position: existingSession.position ?? { top: nextTop, left: nextLeft },
            updatedAt: Date.now(),
          }
        : {
            taskId: task.id,
            title: task.content,
            accumulatedMs: 0,
            startedAt: Date.now(),
            isRunning: true,
            panelOpen: true,
            position: { top: nextTop, left: nextLeft },
            updatedAt: Date.now(),
          }

      const nextSessions = { ...current, [task.id]: nextSession }
      writeFocusSessions(nextSessions)
      return nextSessions
    })
  }, [])

  return {
    focusSessions,
    patchFocusSession,
    removeFocusSession,
    handleStartFocus,
  }
}
