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
  created_at: string
  updated_at: string
}

export interface DailyTask {
  id: string
  content: string
  isDone: boolean
  date: string // YYYY-MM-DD
  linkedGoalId: string | null // 关联的 OKR 项 ID
  origin?: string | null // 来源：'okr' | 'manual' | null
  color?: string | null // 关联项的主题色
  created_at: string
  updated_at: string
}

export interface StoreSchema {
  items: Item[]
  dailyTasks: DailyTask[]
}

// 内存中的数据缓存
let memoryCache: StoreSchema = {
  items: [],
  dailyTasks: [],
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
 * 使用项目目录下的 data/db.json，避免 Application Support 权限问题
 */
function getDataFilePath(): string {
  // 使用绝对路径指向项目目录
  const projectRoot = '/Users/aha/mine-apps/5.Aha-OKR'
  const dataDir = path.join(projectRoot, 'data')
  
  // 确保 data 目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('[Store] 创建数据目录:', dataDir)
  }
  
  return path.join(dataDir, 'db.json')
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
      memoryCache = JSON.parse(data)
      console.log('[Store] 从文件加载数据成功:', filePath)
    } else {
      console.log('[Store] 数据文件不存在，使用默认空数据:', filePath)
      memoryCache = { items: [], dailyTasks: [] }
    }
  } catch (error) {
    console.error('[Store] 从文件加载数据失败:', error)
    memoryCache = { items: [], dailyTasks: [] }
    initError = error as Error
  }
}

/**
 * 保存数据到文件
 */
function saveToFile(): void {
  try {
    const filePath = dataFilePath || getDataFilePath()
    const data = JSON.stringify(memoryCache, null, 2)
    
    // 直接写入，不使用临时文件
    fs.writeFileSync(filePath, data, { encoding: 'utf-8' })
    console.log('[Store] 数据保存成功:', filePath)
  } catch (error) {
    console.error('[Store] 保存数据失败:', error)
    throw error
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
  return memoryCache.dailyTasks || []
}

/**
 * 根据日期获取 DailyTasks
 */
export function getDailyTasksByDate(date: string): DailyTask[] {
  const tasks = getAllDailyTasks()
  return tasks
    .filter(task => task.date === date)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
  
  const newTask: DailyTask = {
    ...data,
    id: generateUUID(),
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  }
  
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
  
  memoryCache.dailyTasks[index] = updatedTask
  saveToFile()
  return updatedTask
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
    saveToFile()
    seedData()
  } catch (error) {
    console.error('[Store] 重新种子失败:', error)
    throw error
  }
}
