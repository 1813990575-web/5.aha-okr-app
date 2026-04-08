import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JournalEntry, JournalRecord } from '../../workspaces/journal/types'

const STORAGE_KEY = 'aha.journal.entries.v1'

function normalizeRecord(record: Partial<JournalRecord> & { imageDataUrl?: string | null }): JournalRecord {
  const legacyImage = typeof record.imageDataUrl === 'string' ? [record.imageDataUrl] : []
  const imageDataUrls = Array.isArray(record.imageDataUrls)
    ? record.imageDataUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : legacyImage

  return {
    id: String(record.id ?? `record-${Date.now()}`),
    dateKey: typeof record.dateKey === 'string' ? record.dateKey : '',
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
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    const groupEntries = (records: JournalRecord[]): JournalEntry[] => {
      const grouped = new Map<string, JournalRecord[]>()

      records.forEach((record) => {
        const list = grouped.get(record.dateKey) || []
        list.push(normalizeRecord(record))
        grouped.set(record.dateKey, list)
      })

      return Array.from(grouped.entries())
        .map(([dateKey, groupedRecords]) => {
          const sortedRecords = groupedRecords.sort((a, b) => b.createdAt - a.createdAt)
          const latestRecord = sortedRecords[0]
          const latestRecordWithImage = sortedRecords.find((record) => record.imageDataUrls.length > 0)

          return normalizeEntry({
            id: `journal-${dateKey}`,
            dateKey,
            note: latestRecord?.note ?? '',
            imageDataUrl: latestRecordWithImage?.imageDataUrls[0] ?? null,
            updatedAt: latestRecord?.updatedAt ?? latestRecord?.createdAt ?? Date.now(),
            records: sortedRecords,
          })
        })
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    }

    const loadEntries = async () => {
      if (!window.electronAPI?.journal) {
        if (isMounted) {
          setEntries(safeRead())
          setIsLoaded(true)
        }
        return
      }

      try {
        const existingRecords = (await window.electronAPI.journal.getAllRecords()).map(normalizeRecord)

        if (existingRecords.length > 0) {
          if (isMounted) {
            setEntries(groupEntries(existingRecords))
            setIsLoaded(true)
          }
          return
        }

        const legacyEntries = safeRead()
        const migratedRecords = legacyEntries.flatMap((entry) =>
          (entry.records || []).map((record) =>
            normalizeRecord({
              ...record,
              dateKey: entry.dateKey,
            })
          )
        )

        if (migratedRecords.length > 0) {
          const createdRecords = await Promise.all(
            migratedRecords.map((record) => window.electronAPI.journal.createRecord(record))
          )

          if (isMounted) {
            setEntries(groupEntries(createdRecords.map(normalizeRecord)))
            setIsLoaded(true)
          }
          return
        }

        if (isMounted) {
          setEntries([])
          setIsLoaded(true)
        }
      } catch (error) {
        console.error('[useJournalEntries] 加载失败，回退到 localStorage:', error)
        if (isMounted) {
          setEntries(safeRead())
          setIsLoaded(true)
        }
      }
    }

    loadEntries()

    return () => {
      isMounted = false
    }
  }, [])

  const entriesByDate = useMemo(() => {
    return new Map(entries.map((entry) => [entry.dateKey, entry]))
  }, [entries])

  const appendRecord = useCallback(async (dateKey: string, record: JournalRecord) => {
    const normalized = normalizeRecord({ ...record, dateKey })

    if (window.electronAPI?.journal) {
      const created = normalizeRecord(await window.electronAPI.journal.createRecord(normalized))
      setEntries((prev) => {
        const existing = prev.find((entry) => entry.dateKey === dateKey)
        const nextRecords = [...(existing?.records ?? []), created].sort((a, b) => b.createdAt - a.createdAt)
        const latestImageRecord = nextRecords.find((item) => item.imageDataUrls.length > 0)
        const nextEntry: JournalEntry = {
          id: existing?.id ?? `journal-${dateKey}`,
          dateKey,
          note: nextRecords[0]?.note ?? '',
          imageDataUrl: latestImageRecord?.imageDataUrls[0] ?? null,
          updatedAt: nextRecords[0]?.updatedAt ?? nextRecords[0]?.createdAt ?? Date.now(),
          records: nextRecords,
        }

        if (!existing) return [nextEntry, ...prev]
        return prev.map((entry) => (entry.dateKey === dateKey ? nextEntry : entry))
      })
      return created
    }

    setEntries((prev) => {
      const existing = prev.find((entry) => entry.dateKey === dateKey)
      const nextRecords = [...(existing?.records ?? []), normalized].sort((a, b) => b.createdAt - a.createdAt)
      const latestImageRecord = nextRecords.find((item) => item.imageDataUrls.length > 0)
      const nextEntry: JournalEntry = {
        id: existing?.id ?? `journal-${dateKey}`,
        dateKey,
        note: nextRecords[0]?.note ?? '',
        imageDataUrl: latestImageRecord?.imageDataUrls[0] ?? null,
        updatedAt: nextRecords[0]?.updatedAt ?? nextRecords[0]?.createdAt ?? Date.now(),
        records: nextRecords,
      }

      const nextEntries = !existing
        ? [nextEntry, ...prev]
        : prev.map((entry) => (entry.dateKey === dateKey ? nextEntry : entry))

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries))
      return nextEntries
    })
    return normalized
  }, [])

  const updateRecord = useCallback(async (dateKey: string, recordId: string, patch: { note: string; imageDataUrls: string[] }) => {
    const applyPatch = (prev: JournalEntry[]) =>
      prev.map((entry) => {
        if (entry.dateKey !== dateKey) return entry

        const nextRecords = entry.records
          .map((record) =>
            record.id === recordId
              ? {
                  ...record,
                  note: patch.note,
                  imageDataUrls: patch.imageDataUrls,
                  updatedAt: Date.now(),
                }
              : record
          )
          .sort((a, b) => b.createdAt - a.createdAt)

        const latestImageRecord = nextRecords.find((record) => record.imageDataUrls.length > 0)

        return {
          ...entry,
          note: nextRecords[0]?.note ?? '',
          imageDataUrl: latestImageRecord?.imageDataUrls[0] ?? null,
          updatedAt: Date.now(),
          records: nextRecords,
        }
      })

    if (window.electronAPI?.journal) {
      await window.electronAPI.journal.updateRecord(recordId, {
        note: patch.note,
        imageDataUrls: patch.imageDataUrls,
      })
      setEntries((prev) => applyPatch(prev))
      return
    }

    setEntries((prev) => {
      const nextEntries = applyPatch(prev)
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries))
      return nextEntries
    })
  }, [])

  return {
    entries,
    entriesByDate,
    appendRecord,
    updateRecord,
    isLoaded,
  }
}
