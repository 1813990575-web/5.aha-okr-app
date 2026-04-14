export interface FocusSessionRecord {
  taskId: string
  title: string
  accumulatedMs: number
  startedAt: number | null
  isRunning: boolean
  panelOpen: boolean
  position: { top: number; left: number } | null
  updatedAt: number
}

const FOCUS_SESSION_STORAGE_KEY = 'aha-okr-focus-sessions'
const FOCUS_SESSION_UPDATE_EVENT = 'aha-okr-focus-sessions-updated'

export function readFocusSessions(): Record<string, FocusSessionRecord> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(FOCUS_SESSION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, FocusSessionRecord>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeFocusSessions(nextValue: Record<string, FocusSessionRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(FOCUS_SESSION_STORAGE_KEY, JSON.stringify(nextValue))
  window.dispatchEvent(new CustomEvent(FOCUS_SESSION_UPDATE_EVENT))
}

export function subscribeFocusSessions(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', callback)
  window.addEventListener('focus', callback)
  window.addEventListener(FOCUS_SESSION_UPDATE_EVENT, callback as EventListener)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('focus', callback)
    window.removeEventListener(FOCUS_SESSION_UPDATE_EVENT, callback as EventListener)
  }
}

export function getFocusElapsedMs(session: FocusSessionRecord | null | undefined, now = Date.now()) {
  if (!session) return 0
  if (!session.isRunning || session.startedAt === null) return session.accumulatedMs
  return session.accumulatedMs + Math.max(0, now - session.startedAt)
}

export function formatFocusDuration(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
