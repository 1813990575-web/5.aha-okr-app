export interface JournalRecord {
  id: string
  dateKey: string
  note: string
  imageDataUrls: string[]
  createdAt: number
  updatedAt?: number
}

export interface JournalEntry {
  id: string
  dateKey: string
  note: string
  imageDataUrl?: string | null
  updatedAt: number
  records: JournalRecord[]
}
