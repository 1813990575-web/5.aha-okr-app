export type ThreadEntityKind = 'task' | 'item'

export interface ThreadMessage {
  id: string
  text: string
  createdAt: number
}

const THREAD_STORAGE_KEY = 'aha-okr-todo-threads'
const THREAD_UPDATE_EVENT = 'aha-okr-todo-threads-updated'

export function getTodoThreadStorageId(entityKind: ThreadEntityKind, entityId: string) {
  return `${entityKind}:${entityId}`
}

export function readTodoThreads(): Record<string, ThreadMessage[]> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(THREAD_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ThreadMessage[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeTodoThreads(nextValue: Record<string, ThreadMessage[]>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THREAD_STORAGE_KEY, JSON.stringify(nextValue))
  window.dispatchEvent(new CustomEvent(THREAD_UPDATE_EVENT))
}

export function getTodoThreadMessages(storageId: string): ThreadMessage[] {
  const threads = readTodoThreads()
  return Array.isArray(threads[storageId]) ? threads[storageId] : []
}

export function getLatestTodoThreadPreview(storageId: string): string {
  const messages = getTodoThreadMessages(storageId)
  const latestMessage = messages[messages.length - 1]
  return latestMessage?.text?.trim() || ''
}

export function subscribeTodoThreadUpdates(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}

  window.addEventListener('storage', callback)
  window.addEventListener('focus', callback)
  window.addEventListener(THREAD_UPDATE_EVENT, callback as EventListener)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener('focus', callback)
    window.removeEventListener(THREAD_UPDATE_EVENT, callback as EventListener)
  }
}

export function saveTodoThreadMessage(storageId: string, text: string, editingMessageId?: string | null) {
  const nextText = text.trim()
  if (!nextText) return getTodoThreadMessages(storageId)

  const currentMessages = getTodoThreadMessages(storageId)
  const now = Date.now()
  let nextMessages: ThreadMessage[]

  if (editingMessageId) {
    const target = currentMessages.find((message) => message.id === editingMessageId)
    if (target) {
      nextMessages = currentMessages.map((message) => (
        message.id === editingMessageId
          ? { ...message, text: nextText, createdAt: now }
          : message
      ))
    } else {
      nextMessages = [
        ...currentMessages,
        { id: `${now}-${Math.random().toString(16).slice(2)}`, text: nextText, createdAt: now },
      ]
    }
  } else {
    nextMessages = [
      ...currentMessages,
      { id: `${now}-${Math.random().toString(16).slice(2)}`, text: nextText, createdAt: now },
    ]
  }

  const nextThreads = readTodoThreads()
  nextThreads[storageId] = nextMessages
  writeTodoThreads(nextThreads)
  return nextMessages
}

export function deleteTodoThreadMessage(storageId: string, messageId: string) {
  const currentMessages = getTodoThreadMessages(storageId)
  const nextMessages = currentMessages.filter((message) => message.id !== messageId)
  const nextThreads = readTodoThreads()
  nextThreads[storageId] = nextMessages
  writeTodoThreads(nextThreads)
  return nextMessages
}
