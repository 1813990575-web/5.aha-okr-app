// Electron API 类型声明

export interface DatabaseAPI {
  init: () => Promise<{ success: boolean; error?: string }>
  getAllItems: () => Promise<any[]>
  getItemById: (id: string) => Promise<any | null>
  createItem: (item: any) => Promise<any>
  createItemAtTop: (item: any) => Promise<any>
  updateItem: (id: string, updates: any) => Promise<any | null>
  deleteItem: (id: string) => Promise<{ success: boolean; deletedIds: string[] }>
  getObjectives: () => Promise<any[]>
  getChildrenByParentId: (parentId: string) => Promise<any[]>
  getItemTree: () => Promise<any[]>
  toggleItemStatus: (id: string) => Promise<any | null>
  updateItemSortOrder: (id: string, sortOrder: number) => Promise<boolean>
  shiftSortOrders: (parentId: string | null, fromSortOrder: number, type: 'O' | 'KR' | 'TODO') => Promise<boolean>
}

export interface DailyTasksAPI {
  getAllTasks: () => Promise<any[]>
  getTasksByDate: (date: string) => Promise<any[]>
  createTask: (data: any) => Promise<any>
  updateTask: (id: string, updates: any) => Promise<any | null>
  deleteTask: (id: string) => Promise<boolean>
  toggleTaskStatus: (id: string) => Promise<any | null>
}

export interface JournalAPI {
  getAllRecords: () => Promise<any[]>
  getRecordsByDate: (dateKey: string) => Promise<any[]>
  getRecordById: (id: string) => Promise<any | null>
  createRecord: (data: any) => Promise<any>
  updateRecord: (id: string, updates: any) => Promise<any | null>
}

export interface AppAPI {
  getVersion: () => Promise<string>
}

export interface ElectronAPI {
  database: DatabaseAPI
  dailyTasks: DailyTasksAPI
  journal: JournalAPI
  app: AppAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
