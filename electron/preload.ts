/**
 * Electron Preload Script
 * 提供安全的 IPC 通信接口
 */

import { contextBridge, ipcRenderer } from 'electron'

// 数据库操作接口 (OKR Items)
export interface DatabaseAPI {
  // 初始化
  init: () => Promise<{ success: boolean; error?: string }>

  // CRUD 操作
  getAllItems: () => Promise<any[]>
  getItemById: (id: string) => Promise<any | null>
  createItem: (item: any) => Promise<any>
  createItemAtTop: (item: any) => Promise<any>
  updateItem: (id: string, updates: any) => Promise<any | null>
  deleteItem: (id: string) => Promise<{ success: boolean; deletedIds: string[] }>

  // 层级查询
  getObjectives: () => Promise<any[]>
  getChildrenByParentId: (parentId: string) => Promise<any[]>
  getItemTree: () => Promise<any[]>

  // 其他操作
  toggleItemStatus: (id: string) => Promise<any | null>
  updateItemSortOrder: (id: string, sortOrder: number) => Promise<boolean>
  shiftSortOrders: (parentId: string | null, fromSortOrder: number, type: 'O' | 'KR' | 'TODO') => Promise<boolean>
}

// DailyTasks 操作接口
export interface DailyTasksAPI {
  getAllTasks: () => Promise<any[]>
  getTasksByDate: (date: string) => Promise<any[]>
  getTaskById: (id: string) => Promise<any | null>
  createTask: (data: any) => Promise<any>
  updateTask: (id: string, updates: any) => Promise<any | null>
  deleteTask: (id: string) => Promise<boolean>
  toggleTaskStatus: (id: string) => Promise<any | null>
  getTodayString: () => Promise<string>
}

const databaseAPI: DatabaseAPI = {
  init: () => ipcRenderer.invoke('store:init'),
  getAllItems: () => ipcRenderer.invoke('db:getAllItems'),
  getItemById: (id: string) => ipcRenderer.invoke('db:getItemById', id),
  createItem: (item: any) => ipcRenderer.invoke('db:createItem', item),
  createItemAtTop: (item: any) => ipcRenderer.invoke('db:createItemAtTop', item),
  updateItem: (id: string, updates: any) => ipcRenderer.invoke('db:updateItem', id, updates),
  deleteItem: (id: string) => ipcRenderer.invoke('db:deleteItem', id),
  getObjectives: () => ipcRenderer.invoke('db:getObjectives'),
  getChildrenByParentId: (parentId: string) => ipcRenderer.invoke('db:getChildrenByParentId', parentId),
  getItemTree: () => ipcRenderer.invoke('db:getItemTree'),
  toggleItemStatus: (id: string) => ipcRenderer.invoke('db:toggleItemStatus', id),
  updateItemSortOrder: (id: string, sortOrder: number) => ipcRenderer.invoke('db:updateItemSortOrder', id, sortOrder),
  shiftSortOrders: (parentId: string | null, fromSortOrder: number, type: 'O' | 'KR' | 'TODO') =>
    ipcRenderer.invoke('db:shiftSortOrders', parentId, fromSortOrder, type),
}

const dailyTasksAPI: DailyTasksAPI = {
  getAllTasks: () => ipcRenderer.invoke('daily:getAllTasks'),
  getTasksByDate: (date: string) => ipcRenderer.invoke('daily:getTasksByDate', date),
  getTaskById: (id: string) => ipcRenderer.invoke('daily:getTaskById', id),
  createTask: (data: any) => ipcRenderer.invoke('daily:createTask', data),
  updateTask: (id: string, updates: any) => ipcRenderer.invoke('daily:updateTask', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('daily:deleteTask', id),
  toggleTaskStatus: (id: string) => ipcRenderer.invoke('daily:toggleTaskStatus', id),
  getTodayString: () => ipcRenderer.invoke('daily:getTodayString'),
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  database: databaseAPI,
  dailyTasks: dailyTasksAPI,
})

// 类型声明
declare global {
  interface Window {
    electronAPI: {
      database: DatabaseAPI
      dailyTasks: DailyTasksAPI
    }
  }
}
