/**
 * Electron Store 数据存储层
 * 替代 sqlite3，使用纯 JS 实现，无原生编译依赖
 */

import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'

// 数据类型定义
export interface Item {
  id: string
  type: 'O' | 'KR' | 'TODO'
  parent_id: string | null
  title: string
  content: string
  status: number
  sort_order: number
  total_focus_time: number
  color?: string | null
  objective_icon_mode?: 'folder' | 'emoji' | 'countdown' | null
  objective_icon_emoji?: string | null
  objective_deadline_at?: string | null
  created_at: string
  updated_at: string
}

export interface DailyTask {
  id: string
  content: string
  note?: string
  isDone: boolean
  date: string // YYYY-MM-DD
  sort_order: number
  linkedGoalId: string | null // 关联的 OKR 项 ID
  entryType?: 'manual' | 'objective' | 'kr' | 'todo'
  sourceItemId?: string | null
  origin?: string | null // 来源：'okr' | 'manual' | null
  color?: string | null // 关联项的主题色
  created_at: string
  updated_at: string
}

export interface JournalRecord {
  id: string
  dateKey: string
  note: string
  imageDataUrls: string[]
  createdAt: number
  updatedAt?: number
}

export interface StoreSchema {
  items: Item[]
  dailyTasks: DailyTask[]
  journalRecords: JournalRecord[]
}

// 内存中的数据缓存
let memoryCache: StoreSchema = {
  items: [],
  dailyTasks: [],
  journalRecords: [],
}

let dataFilePath: string | null = null
let initError: Error | null = null
let isInitialized = false

/**
 * 生成 UUID
 */
function generateUUID(): string {
  return randomUUID()
}

/**
 * 获取当前时间字符串
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString()
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export function getTodayString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 获取数据文件路径
 * 使用 Electron 的 userData 目录，确保打包后也能正常工作
 */
function getDataFilePath(): string {
  // 尝试获取 electron app 对象
  let userDataPath: string
  
  try {
    // 动态导入 electron，避免在渲染进程中出错
    const { app } = require('electron')
    if (app && app.getPath) {
      userDataPath = app.getPath('userData')
      console.log('[Store] 使用 Electron userData 目录:', userDataPath)
    } else {
      throw new Error('Electron app not available')
    }
  } catch (e) {
    // 开发环境回退到项目目录
    userDataPath = process.cwd()
    console.log('[Store] 使用项目目录:', userDataPath)
  }
  
  const dataDir = path.join(userDataPath, 'data')
  
  // 确保 data 目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('[Store] 创建数据目录:', dataDir)
  }
  
  return path.join(dataDir, 'db.json')
}

function normalizeJournalRecord(record: Partial<JournalRecord> & { imageDataUrl?: string | null }): JournalRecord {
  const legacyImage = typeof record.imageDataUrl === 'string' ? [record.imageDataUrl] : []
  const imageDataUrls = Array.isArray(record.imageDataUrls)
    ? record.imageDataUrls.filter((value): value is string => typeof value === 'string' && value.length > 0)
    : legacyImage

  return {
    id: String(record.id ?? generateUUID()),
    dateKey: typeof record.dateKey === 'string' ? record.dateKey : getTodayString(),
    note: typeof record.note === 'string' ? record.note : '',
    imageDataUrls,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : Date.now(),
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : undefined,
  }
}

/**
 * 从文件加载数据
 */
function loadFromFile(): void {
  try {
    const filePath = getDataFilePath()
    dataFilePath = filePath
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(data)
      memoryCache = {
        items: parsed.items || [],
        dailyTasks: (parsed.dailyTasks || []).map(normalizeDailyTask),
        journalRecords: (parsed.journalRecords || []).map(normalizeJournalRecord),
      }
      console.log('[Store] 从文件加载数据成功:', filePath)
    } else {
      console.log('[Store] 数据文件不存在，使用默认空数据:', filePath)
      memoryCache = { items: [], dailyTasks: [], journalRecords: [] }
    }
  } catch (error) {
    console.error('[Store] 从文件加载数据失败:', error)
    memoryCache = { items: [], dailyTasks: [], journalRecords: [] }
    initError = error as Error
  }
}

/**
 * 保存数据到文件（异步防抖版本）
 * 解决 Intel Mac 上同步 I/O 可能阻塞渲染线程的问题
 */
let saveTimeout: NodeJS.Timeout | null = null
let pendingSave = false

function saveToFile(): void {
  // 标记有待保存的数据
  pendingSave = true

  // 清除之前的定时器
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  // 延迟 500ms 执行保存，实现防抖（为 Intel 慢速磁盘预留时间）
  saveTimeout = setTimeout(() => {
    if (!pendingSave) return

    try {
      const filePath = dataFilePath || getDataFilePath()
      const data = JSON.stringify(memoryCache, null, 2)

      // 异步写入，避免阻塞主线程
      fs.writeFile(filePath, data, { encoding: 'utf-8' }, (err) => {
        if (err) {
          console.error('[Store] 异步保存数据失败:', err)
        } else {
          console.log('[Store] 数据异步保存成功:', filePath)
        }
      })

      pendingSave = false
    } catch (error) {
      console.error('[Store] 准备保存数据失败:', error)
      pendingSave = false
    }
  }, 500)
}

function inferDailyTaskEntryType(task: Partial<DailyTask>): NonNullable<DailyTask['entryType']> {
  if (task.entryType) return task.entryType

  const linkedId = task.sourceItemId ?? task.linkedGoalId
  if (!linkedId) return 'manual'

  if (task.origin === 'manual') return 'manual'
  return 'todo'
}

function normalizeDailyTask(task: Partial<DailyTask>): DailyTask {
  const linkedGoalId = task.linkedGoalId ?? null
  const sourceItemId = task.sourceItemId ?? linkedGoalId
  const origin = task.origin ?? (linkedGoalId ? 'okr' : 'manual')

  return {
    id: task.id || generateUUID(),
    content: task.content || '',
    note: typeof task.note === 'string' ? task.note : '',
    isDone: !!task.isDone,
    date: task.date || getTodayString(),
    sort_order: typeof task.sort_order === 'number' ? task.sort_order : 0,
    linkedGoalId,
    sourceItemId,
    entryType: inferDailyTaskEntryType({ ...task, linkedGoalId, sourceItemId, origin }),
    origin,
    color: task.color ?? null,
    created_at: task.created_at || getCurrentTimestamp(),
    updated_at: task.updated_at || getCurrentTimestamp(),
  }
}

/**
 * 强制同步保存数据到文件
 * 用于应用退出前确保数据写入磁盘
 */
export function forceSyncSave(): void {
  try {
    // 清除待执行的异步保存
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }

    const filePath = dataFilePath || getDataFilePath()
    const data = JSON.stringify(memoryCache, null, 2)

    // 同步写入，确保数据立即落盘
    fs.writeFileSync(filePath, data, { encoding: 'utf-8' })
    console.log('[Store] 强制同步保存成功:', filePath)
    pendingSave = false
  } catch (error) {
    console.error('[Store] 强制同步保存失败:', error)
  }
}

/**
 * 初始化 Store
 */
export function initStore(): boolean {
  if (isInitialized) {
    return true
  }

  try {
    loadFromFile()
    isInitialized = true
    initError = null
    console.log('[Store] 数据存储初始化成功')
    return true
  } catch (error) {
    console.error('[Store] 初始化失败:', error)
    initError = error as Error
    return false
  }
}

/**
 * 检查 Store 是否可用
 */
export function isStoreAvailable(): boolean {
  return isInitialized && initError === null
}

/**
 * 获取初始化错误
 */
export function getInitError(): Error | null {
  return initError
}

// ==================== Items (OKR) 操作 ====================

/**
 * 获取所有 Items
 */
export function getAllItems(): Item[] {
  if (!isInitialized) {
    console.error('[Store] 无法获取 Items，Store 未初始化')
    return []
  }
  return memoryCache.items || []
}

/**
 * 根据 ID 获取 Item
 */
export function getItemById(id: string): Item | null {
  const items = getAllItems()
  return items.find(item => item.id === id) || null
}

/**
 * 创建 Item
 */
export function createItem(data: Omit<Item, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Item | null {
  if (!isInitialized) {
    console.error('[Store] 无法创建 Item，Store 未初始化')
    throw new Error('Store not initialized')
  }
  
  const newItem: Item = {
    ...data,
    id: data.id || generateUUID(),
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  }
  
  memoryCache.items = [...memoryCache.items, newItem]
  saveToFile()
  return newItem
}

/**
 * 创建 Item 并插入到最前端
 */
export function createItemAtTop(data: Omit<Item, 'id' | 'created_at' | 'updated_at' | 'sort_order'> & { id?: string }): Item | null {
  if (!isInitialized) {
    console.error('[Store] 无法创建 Item，Store 未初始化')
    throw new Error('Store not initialized')
  }

  // 将同类型的 sort_order + 1
  memoryCache.items = memoryCache.items.map(item => {
    if (item.type === data.type && item.parent_id === data.parent_id) {
      return { ...item, sort_order: item.sort_order + 1 }
    }
    return item
  })

  const newItem: Item = {
    ...data,
    id: data.id || generateUUID(),
    sort_order: 0,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  }

  memoryCache.items = [newItem, ...memoryCache.items]
  saveToFile()
  return newItem
}

/**
 * 更新 Item
 */
export function updateItem(id: string, updates: Partial<Omit<Item, 'id' | 'created_at'>>): Item | null {
  if (!isInitialized) {
    console.error('[Store] 无法更新 Item，Store 未初始化')
    return null
  }
  
  const index = memoryCache.items.findIndex(item => item.id === id)
  if (index === -1) return null
  
  const updatedItem: Item = {
    ...memoryCache.items[index],
    ...updates,
    updated_at: getCurrentTimestamp(),
  }
  
  memoryCache.items[index] = updatedItem
  saveToFile()
  return updatedItem
}

/**
 * 删除 Item（级联删除子项）
 */
export function deleteItem(id: string): { success: boolean; deletedIds: string[] } {
  if (!isInitialized) {
    console.error('[Store] 无法删除 Item，Store 未初始化')
    return { success: false, deletedIds: [] }
  }
  
  // 递归获取所有子项 ID
  const getChildrenIds = (parentId: string): string[] => {
    const children = memoryCache.items.filter(item => item.parent_id === parentId)
    let ids: string[] = children.map(c => c.id)
    for (const child of children) {
      ids = [...ids, ...getChildrenIds(child.id)]
    }
    return ids
  }
  
  const childrenIds = getChildrenIds(id)
  const allIdsToDelete = [id, ...childrenIds]
  
  memoryCache.items = memoryCache.items.filter(item => !allIdsToDelete.includes(item.id))
  saveToFile()
  
  return { success: true, deletedIds: allIdsToDelete }
}

/**
 * 获取顶层目标 (O 类型)
 */
export function getObjectives(): Item[] {
  const items = getAllItems()
  return items
    .filter(item => item.type === 'O' && item.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * 获取指定父级下的所有子 Items
 */
export function getChildrenByParentId(parentId: string): Item[] {
  const items = getAllItems()
  return items
    .filter(item => item.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * 获取完整的层级树结构
 */
export function getItemTree(): Array<Item & { children?: Item[] }> {
  const objectives = getObjectives()
  
  return objectives.map(obj => {
    const children = getChildrenByParentId(obj.id)
    const childrenWithTodos = children.map(child => {
      if (child.type === 'KR') {
        const todos = getChildrenByParentId(child.id)
        return { ...child, children: todos }
      }
      return child
    })
    return { ...obj, children: childrenWithTodos }
  })
}

/**
 * 切换 Item 完成状态
 */
export function toggleItemStatus(id: string): Item | null {
  const item = getItemById(id)
  if (!item) return null
  return updateItem(id, { status: item.status === 0 ? 1 : 0 })
}

/**
 * 更新 Item 排序
 */
export function updateItemSortOrder(id: string, sortOrder: number): boolean {
  const result = updateItem(id, { sort_order: sortOrder })
  return result !== null
}

/**
 * 批量移动排序（向后移动）
 */
export function shiftSortOrders(
  parentId: string | null,
  fromSortOrder: number,
  type: 'O' | 'KR' | 'TODO'
): boolean {
  if (!isInitialized) {
    console.error('[Store] 无法更新排序，Store 未初始化')
    return false
  }
  
  memoryCache.items = memoryCache.items.map(item => {
    if (
      item.type === type &&
      item.sort_order >= fromSortOrder &&
      (parentId === null ? item.parent_id === null : item.parent_id === parentId)
    ) {
      return { ...item, sort_order: item.sort_order + 1 }
    }
    return item
  })
  
  saveToFile()
  return true
}

// ==================== DailyTasks 操作 ====================

/**
 * 获取所有 DailyTasks
 */
export function getAllDailyTasks(): DailyTask[] {
  if (!isInitialized) {
    console.error('[Store] 无法获取 DailyTasks，Store 未初始化')
    return []
  }
  return (memoryCache.dailyTasks || []).map(normalizeDailyTask)
}

/**
 * 根据日期获取 DailyTasks
 */
export function getDailyTasksByDate(date: string): DailyTask[] {
  const tasks = getAllDailyTasks()
  return tasks
    .filter(task => task.date === date)
    .sort((a, b) => {
      const aOrder = typeof a.sort_order === 'number' ? a.sort_order : Number.MAX_SAFE_INTEGER
      const bOrder = typeof b.sort_order === 'number' ? b.sort_order : Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
}

/**
 * 根据 ID 获取 DailyTask
 */
export function getDailyTaskById(id: string): DailyTask | null {
  const tasks = getAllDailyTasks()
  return tasks.find(task => task.id === id) || null
}

/**
 * 创建 DailyTask
 */
export function createDailyTask(data: Omit<DailyTask, 'id' | 'created_at' | 'updated_at'>): DailyTask | null {
  if (!isInitialized) {
    console.error('[Store] 无法创建 DailyTask，Store 未初始化')
    throw new Error('Store not initialized')
  }
  
  const newTask: DailyTask = normalizeDailyTask({
    ...data,
    id: generateUUID(),
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  })
  
  // 新任务置顶
  memoryCache.dailyTasks = [newTask, ...memoryCache.dailyTasks]
  saveToFile()
  
  console.log('[Store] DailyTask 创建成功:', newTask.id)
  return newTask
}

/**
 * 更新 DailyTask
 */
export function updateDailyTask(
  id: string,
  updates: Partial<Omit<DailyTask, 'id' | 'created_at'>>
): DailyTask | null {
  if (!isInitialized) {
    console.error('[Store] 无法更新 DailyTask，Store 未初始化')
    return null
  }
  
  const index = memoryCache.dailyTasks.findIndex(task => task.id === id)
  if (index === -1) return null
  
  const updatedTask: DailyTask = {
    ...memoryCache.dailyTasks[index],
    ...updates,
    updated_at: getCurrentTimestamp(),
  }

  memoryCache.dailyTasks[index] = normalizeDailyTask(updatedTask)
  saveToFile()
  return memoryCache.dailyTasks[index]
}

/**
 * 删除 DailyTask
 */
export function deleteDailyTask(id: string): boolean {
  if (!isInitialized) {
    console.error('[Store] 无法删除 DailyTask，Store 未初始化')
    return false
  }
  
  memoryCache.dailyTasks = memoryCache.dailyTasks.filter(task => task.id !== id)
  saveToFile()
  return true
}

/**
 * 切换 DailyTask 完成状态
 */
export function toggleDailyTaskStatus(id: string): DailyTask | null {
  const task = getDailyTaskById(id)
  if (!task) return null
  return updateDailyTask(id, { isDone: !task.isDone })
}

/**
 * 根据 linkedGoalId 更新关联状态（当左侧原件被删除时调用）
 */
export function unlinkDailyTasksByGoalId(goalId: string): void {
  if (!isInitialized) {
    console.error('[Store] 无法更新关联状态，Store 未初始化')
    return
  }
  
  memoryCache.dailyTasks = memoryCache.dailyTasks.map(task => {
    if (task.linkedGoalId === goalId) {
      return { ...task, linkedGoalId: null }
    }
    return task
  })
  
  saveToFile()
}

// ==================== 数据迁移与种子 ====================

// ==================== JournalRecords 操作 ====================

export function getAllJournalRecords(): JournalRecord[] {
  if (!isInitialized) {
    console.error('[Store] 无法获取 JournalRecords，Store 未初始化')
    return []
  }

  return (memoryCache.journalRecords || [])
    .map(normalizeJournalRecord)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function getJournalRecordsByDate(dateKey: string): JournalRecord[] {
  return getAllJournalRecords().filter((record) => record.dateKey === dateKey)
}

export function getJournalRecordById(id: string): JournalRecord | null {
  return getAllJournalRecords().find((record) => record.id === id) || null
}

export function createJournalRecord(data: Omit<JournalRecord, 'id'> & { id?: string }): JournalRecord {
  if (!isInitialized) {
    console.error('[Store] 无法创建 JournalRecord，Store 未初始化')
    throw new Error('Store not initialized')
  }

  const newRecord = normalizeJournalRecord({
    ...data,
    id: data.id || generateUUID(),
  })

  memoryCache.journalRecords = [newRecord, ...(memoryCache.journalRecords || [])]
  saveToFile()
  return newRecord
}

export function updateJournalRecord(
  id: string,
  updates: Partial<Omit<JournalRecord, 'id' | 'createdAt'>>
): JournalRecord | null {
  if (!isInitialized) {
    console.error('[Store] 无法更新 JournalRecord，Store 未初始化')
    return null
  }

  const index = memoryCache.journalRecords.findIndex((record) => record.id === id)
  if (index === -1) return null

  const updatedRecord = normalizeJournalRecord({
    ...memoryCache.journalRecords[index],
    ...updates,
    updatedAt: Date.now(),
  })

  memoryCache.journalRecords[index] = updatedRecord
  saveToFile()
  return updatedRecord
}

/**
 * 种子数据 - 初始化示例数据
 */
export function seedData(): void {
  if (!isInitialized) {
    console.error('[Store] 无法执行种子，Store 未初始化')
    return
  }
  
  // 如果已有数据，不执行种子
  if (memoryCache.items.length > 0) {
    console.log('[Store] 数据已存在，跳过种子')
    return
  }
  
  console.log('[Store] 开始初始化种子数据...')
  
  try {
    // 创建示例 O
    const o1 = createItem({
      type: 'O',
      parent_id: null,
      title: '提升产品用户体验',
      content: '通过优化界面和交互，提升用户满意度',
      status: 0,
      sort_order: 0,
      total_focus_time: 0,
      color: '#007AFF',
    })
    
    if (!o1) {
      console.error('[Store] 创建种子数据失败')
      return
    }
    
    // 创建示例 KR
    const kr1 = createItem({
      type: 'KR',
      parent_id: o1.id,
      title: '用户满意度达到 90%',
      content: '通过问卷调查收集用户反馈',
      status: 0,
      sort_order: 0,
      total_focus_time: 0,
    })
    
    const kr2 = createItem({
      type: 'KR',
      parent_id: o1.id,
      title: '页面加载速度提升 50%',
      content: '优化资源加载和渲染性能',
      status: 0,
      sort_order: 1,
      total_focus_time: 0,
    })
    
    if (kr1 && kr2) {
      // 创建示例 TODO
      createItem({
        type: 'TODO',
        parent_id: kr1.id,
        title: '设计用户调研问卷',
        content: '',
        status: 0,
        sort_order: 0,
        total_focus_time: 0,
      })
      
      createItem({
        type: 'TODO',
        parent_id: kr2.id,
        title: '分析当前性能瓶颈',
        content: '',
        status: 0,
        sort_order: 0,
        total_focus_time: 0,
      })
    }
    
    console.log('[Store] 种子数据初始化完成')
  } catch (error) {
    console.error('[Store] 种子数据初始化失败:', error)
  }
}

/**
 * 重新种子数据（清空后重建）
 */
export function reseedData(): void {
  if (!isInitialized) {
    console.error('[Store] 无法执行重新种子，Store 未初始化')
    return
  }
  
  try {
    memoryCache.items = []
    memoryCache.dailyTasks = []
    memoryCache.journalRecords = []
    saveToFile()
    seedData()
  } catch (error) {
    console.error('[Store] 重新种子失败:', error)
    throw error
  }
}
