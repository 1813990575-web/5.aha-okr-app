import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JournalEntry, JournalRecord } from '../../components/journal/types'

const STORAGE_KEY = 'aha.journal.entries.v1'

function normalizeRecord(record: Partial<JournalRecord> & { imageDataUrl?: string | null }): JournalRecord {
  const legacyImage = typeof record.imageDataUrl === 'string' ? [record.imageDataUrl] : []
  const imageDataUrls = Array.isArray(record.imageDataUrls)
    ? record.imageDataUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : legacyImage

  return {
    id: String(record.id ?? `record-${Date.now()}`),
    note: typeof record.note === 'string' ? record.note : '',
    imageDataUrls,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : undefined,
  }
}

function normalizeEntry(entry: Partial<JournalEntry>): JournalEntry {
  const records = Array.isArray(entry.records) ? entry.records.map(normalizeRecord) : []
  const leadImage = records[0]?.imageDataUrls[0] ?? null

  return {
    id: String(entry.id ?? `journal-${entry.dateKey ?? Date.now()}`),
    dateKey: String(entry.dateKey ?? ''),
    note: typeof entry.note === 'string' ? entry.note : records[0]?.note ?? '',
    imageDataUrl: typeof entry.imageDataUrl === 'string' ? entry.imageDataUrl : leadImage,
    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : records[0]?.updatedAt ?? records[0]?.createdAt ?? Date.now(),
    records,
  }
}

function safeRead(): JournalEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEntry)
  } catch {
    return []
  }
}

export function useJournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([])

  useEffect(() => {
    setEntries(safeRead())
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  const entriesByDate = useMemo(() => {
    return new Map(entries.map((entry) => [entry.dateKey, entry]))
  }, [entries])

  const appendRecord = useCallback((dateKey: string, record: JournalRecord) => {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.dateKey === dateKey)
      const nextRecords = [...(existing?.records ?? []), record].sort((a, b) => b.createdAt - a.createdAt)
      const nextEntry: JournalEntry = {
        id: existing?.id ?? `journal-${dateKey}`,
        dateKey,
        note: record.note,
        imageDataUrl: record.imageDataUrls[0] ?? existing?.imageDataUrl ?? null,
        updatedAt: record.updatedAt ?? record.createdAt,
        records: nextRecords,
      }

      if (!existing) return [nextEntry, ...prev]
      return prev.map((entry) => (entry.dateKey === dateKey ? nextEntry : entry))
    })
  }, [])

  const updateRecord = useCallback((dateKey: string, recordId: string, patch: { note: string; imageDataUrls: string[] }) => {
    setEntries((prev) => {
      return prev.map((entry) => {
        if (entry.dateKey !== dateKey) return entry

        const nextRecords = entry.records.map((record) =>
          record.id === recordId
            ? {
                ...record,
                note: patch.note,
                imageDataUrls: patch.imageDataUrls,
                updatedAt: Date.now(),
              }
            : record
        )

        const leadRecord = nextRecords[0]
        return {
          ...entry,
          note: leadRecord?.note ?? '',
          imageDataUrl: leadRecord?.imageDataUrls[0] ?? null,
          updatedAt: Date.now(),
          records: nextRecords,
        }
      })
    })
  }, [])

  return {
    entries,
    entriesByDate,
    appendRecord,
    updateRecord,
  }
}
