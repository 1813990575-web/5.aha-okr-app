/**
 * 数据模型层
 * 封装 Items 表的 CRUD 操作 (sqlite3 异步版本)
 */

import { getDatabase } from './index'
import type { Database } from 'sqlite3'

/**
 * Item 数据类型
 */
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

/**
 * 创建 Item 的请求类型
 */
export interface CreateItemRequest {
  id?: string
  type: 'O' | 'KR' | 'TODO'
  parent_id?: string | null
  title: string
  content?: string
  status?: number
  sort_order?: number
}

/**
 * 更新 Item 的请求类型
 */
export interface UpdateItemRequest {
  title?: string
  content?: string
  status?: number
  sort_order?: number
  total_focus_time?: number
  color?: string | null
}

/**
 * 生成 UUID
 */
function generateUUID(): string {
  return crypto.randomUUID()
}

/**
 * 执行 SQL 查询 (Promise 封装)
 */
function runSQL(db: Database, sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err)
      } else {
        resolve({ lastID: this.lastID, changes: this.changes })
      }
    })
  })
}

/**
 * 获取单行数据
 */
function getRow<T>(db: Database, sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err)
      } else {
        resolve(row as T || null)
      }
    })
  })
}

/**
 * 获取多行数据
 */
function getAllRows<T>(db: Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows as T[])
      }
    })
  })
}

/**
 * 创建新 Item
 */
export async function createItem(request: CreateItemRequest): Promise<Item> {
  const db = getDatabase()

  const id = request.id || generateUUID()
  const {
    type,
    parent_id = null,
    title,
    content = '',
    status = 0,
    sort_order = 0,
  } = request

  await runSQL(
    db,
    'INSERT INTO items (id, type, parent_id, title, content, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, type, parent_id, title, content, status, sort_order]
  )

  return getItemById(id) as Promise<Item>
}

/**
 * 创建新 Item 并插入到最前端（sort_order = 0）
 * 会将所有同级的现有项 sort_order + 1
 */
export async function createItemAtTop(request: CreateItemRequest): Promise<Item> {
  const db = getDatabase()
  const id = request.id || generateUUID()
  const {
    type,
    parent_id = null,
    title,
    content = '',
    status = 0,
  } = request

  // 1. 先将所有同级项的 sort_order + 1
  const parentClause = parent_id === null ? 'parent_id IS NULL' : 'parent_id = ?'
  const params = parent_id === null ? [type] : [parent_id, type]
  
  await runSQL(
    db,
    `UPDATE items SET sort_order = sort_order + 1 WHERE ${parentClause} AND type = ?`,
    params
  )

  // 2. 插入新项到 sort_order = 0
  await runSQL(
    db,
    'INSERT INTO items (id, type, parent_id, title, content, status, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, type, parent_id, title, content, status, 0]
  )

  return getItemById(id) as Promise<Item>
}

/**
 * 根据 ID 获取 Item
 */
export async function getItemById(id: string): Promise<Item | null> {
  const db = getDatabase()
  return getRow<Item>(db, 'SELECT * FROM items WHERE id = ?', [id])
}

/**
 * 获取所有 Items（按 sort_order 排序）
 */
export async function getAllItems(): Promise<Item[]> {
  const db = getDatabase()
  return getAllRows<Item>(db, 'SELECT * FROM items ORDER BY sort_order ASC, created_at ASC')
}

/**
 * 获取顶层目标 (O 类型，无 parent_id)
 */
export async function getObjectives(): Promise<Item[]> {
  const db = getDatabase()
  return getAllRows<Item>(
    db,
    "SELECT * FROM items WHERE type = 'O' AND parent_id IS NULL ORDER BY sort_order ASC, created_at ASC"
  )
}

/**
 * 获取指定父级下的所有子 Items
 */
export async function getChildrenByParentId(parentId: string): Promise<Item[]> {
  const db = getDatabase()
  return getAllRows<Item>(
    db,
    'SELECT * FROM items WHERE parent_id = ? ORDER BY sort_order ASC, created_at ASC',
    [parentId]
  )
}

/**
 * 获取完整的层级树结构
 * 返回所有 O 类型及其子 KR 和 TODO
 */
export async function getItemTree(): Promise<Array<Item & { children?: Item[] }>> {
  const objectives = await getObjectives()

  const result: Array<Item & { children?: Item[] }> = []

  for (const obj of objectives) {
    const children = await getChildrenByParentId(obj.id)
    const childrenWithTodos: Array<Item & { children?: Item[] }> = []

    for (const kr of children) {
      if (kr.type === 'KR') {
        const todos = await getChildrenByParentId(kr.id)
        childrenWithTodos.push({ ...kr, children: todos })
      } else {
        childrenWithTodos.push(kr)
      }
    }

    result.push({ ...obj, children: childrenWithTodos })
  }

  return result
}

/**
 * 更新 Item
 */
export async function updateItem(id: string, request: UpdateItemRequest): Promise<Item | null> {
  const db = getDatabase()

  const fields: string[] = []
  const values: (string | number)[] = []

  if (request.title !== undefined) {
    fields.push('title = ?')
    values.push(request.title)
  }
  if (request.content !== undefined) {
    fields.push('content = ?')
    values.push(request.content)
  }
  if (request.status !== undefined) {
    fields.push('status = ?')
    values.push(request.status)
  }
  if (request.sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(request.sort_order)
  }
  if (request.total_focus_time !== undefined) {
    fields.push('total_focus_time = ?')
    values.push(request.total_focus_time)
  }
  if (request.color !== undefined) {
    fields.push('color = ?')
    values.push(request.color)
  }

  if (fields.length === 0) return getItemById(id)

  // 自动更新 updated_at
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)

  const sql = `UPDATE items SET ${fields.join(', ')} WHERE id = ?`

  await runSQL(db, sql, values)
  return getItemById(id)
}

/**
 * 获取所有子项 ID（递归）
 */
export async function getAllChildrenIds(parentId: string): Promise<string[]> {
  const db = getDatabase()
  const ids: string[] = []
  
  // 获取直接子项
  const children = await getAllRows<{ id: string; type: string }>(
    db,
    'SELECT id, type FROM items WHERE parent_id = ?',
    [parentId]
  )
  
  for (const child of children) {
    ids.push(child.id)
    // 递归获取子项的子项
    const grandChildren = await getAllChildrenIds(child.id)
    ids.push(...grandChildren)
  }
  
  return ids
}

/**
 * 删除 Item（级联删除所有子项）
 */
export async function deleteItem(id: string): Promise<{ success: boolean; deletedIds: string[] }> {
  const db = getDatabase()
  
  // 1. 获取所有需要删除的 ID（包括子项）
  const childrenIds = await getAllChildrenIds(id)
  const allIdsToDelete = [id, ...childrenIds]
  
  // 2. 批量删除
  for (const deleteId of allIdsToDelete) {
    await runSQL(db, 'DELETE FROM items WHERE id = ?', [deleteId])
  }
  
  return { success: true, deletedIds: allIdsToDelete }
}

/**
 * 批量更新同级项的 sort_order（向后移动）
 * 用于在指定位置插入新项时，将后面的项顺延
 */
export async function shiftSortOrders(
  parentId: string | null,
  fromSortOrder: number,
  type: 'O' | 'KR' | 'TODO'
): Promise<boolean> {
  const db = getDatabase()
  
  const parentClause = parentId === null ? 'parent_id IS NULL' : 'parent_id = ?'
  const params = parentId === null ? [fromSortOrder, type] : [parentId, fromSortOrder, type]
  
  await runSQL(
    db,
    `UPDATE items 
     SET sort_order = sort_order + 1, updated_at = CURRENT_TIMESTAMP 
     WHERE ${parentClause} 
     AND sort_order >= ? 
     AND type = ?`,
    params
  )
  
  return true
}

/**
 * 批量删除 Items
 */
export async function deleteItems(ids: string[]): Promise<number> {
  const db = getDatabase()
  let deletedCount = 0

  for (const id of ids) {
    const result = await runSQL(db, 'DELETE FROM items WHERE id = ?', [id])
    deletedCount += result.changes
  }

  return deletedCount
}

/**
 * 更新 Item 排序
 */
export async function updateItemSortOrder(id: string, sortOrder: number): Promise<boolean> {
  const db = getDatabase()
  const result = await runSQL(
    db,
    'UPDATE items SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [sortOrder, id]
  )
  return result.changes > 0
}

/**
 * 切换 Item 完成状态
 */
export async function toggleItemStatus(id: string): Promise<Item | null> {
  const item = await getItemById(id)
  if (!item) return null

  const newStatus = item.status === 0 ? 1 : 0
  return updateItem(id, { status: newStatus })
}

/**
 * 搜索 Items
 */
export async function searchItems(keyword: string): Promise<Item[]> {
  const db = getDatabase()
  const pattern = `%${keyword}%`
  return getAllRows<Item>(
    db,
    'SELECT * FROM items WHERE title LIKE ? OR content LIKE ? ORDER BY sort_order ASC, created_at ASC',
    [pattern, pattern]
  )
}

/**
 * 获取统计数据
 */
export async function getStats() {
  const db = getDatabase()

  const totalRow = await getRow<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items')
  const completedRow = await getRow<{ count: number }>(db, 'SELECT COUNT(*) as count FROM items WHERE status = 1')
  const byTypeRows = await getAllRows<{ type: string; count: number }>(
    db,
    'SELECT type, COUNT(*) as count FROM items GROUP BY type'
  )

  return {
    total: totalRow?.count || 0,
    completed: completedRow?.count || 0,
    byType: byTypeRows,
  }
}

/**
 * 清空所有数据（谨慎使用）
 */
export async function clearAllItems(): Promise<number> {
  const db = getDatabase()
  const result = await runSQL(db, 'DELETE FROM items')
  return result.changes
}
