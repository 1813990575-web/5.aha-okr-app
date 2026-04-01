/**
 * 数据库初始化模块
 * 使用 sqlite3 实现本地数据持久化
 */

import sqlite3 from 'sqlite3'
import path from 'path'
import fs from 'fs'

let db: sqlite3.Database | null = null

/**
 * 获取数据库文件路径
 * 使用项目目录下的 data 文件夹
 */
export function getDbPath(): string {
  // 使用项目根目录下的 data 文件夹
  const dbDir = path.join(process.cwd(), 'data')
  
  // 确保目录存在
  if (!fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true })
      console.log('[Database] 创建目录:', dbDir)
    } catch (err) {
      console.error('[Database] 创建目录失败:', err)
    }
  }
  
  const dbPath = path.join(dbDir, 'aha-okr.db')
  console.log('[Database] 数据库路径:', dbPath)
  return dbPath
}

/**
 * 初始化数据库连接
 * 创建 Items 表结构
 */
export function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const dbPath = getDbPath()
    
    console.log('[Database] 尝试打开数据库:', dbPath)
    
    db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        console.error('[Database] 打开数据库失败:', err)
        reject(err)
        return
      }

      console.log('[Database] 数据库连接成功')

      // 启用外键约束
      db!.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) {
          console.error('[Database] 启用外键约束失败:', err)
        }
      })

      // 创建 Items 表
      db!.run(`
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK(type IN ('O', 'KR', 'TODO')),
          parent_id TEXT,
          title TEXT NOT NULL,
          content TEXT DEFAULT '',
          status INTEGER DEFAULT 0 CHECK(status IN (0, 1)),
          sort_order INTEGER DEFAULT 0,
          total_focus_time INTEGER DEFAULT 0,
          color TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES items(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('[Database] 创建表失败:', err)
          reject(err)
          return
        }

        // 创建索引优化查询性能
        db!.run(`CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id)`, () => {})
        db!.run(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(type)`, () => {})
        db!.run(`CREATE INDEX IF NOT EXISTS idx_items_sort_order ON items(sort_order)`, () => {})
        
        // 迁移：为已存在的表添加 color 字段
        db!.run(`ALTER TABLE items ADD COLUMN color TEXT DEFAULT NULL`, (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column')) {
            console.log('[Database] color 字段已存在或添加失败:', alterErr.message)
          }
        })

        console.log('[Database] 初始化完成')
        resolve(db!)
      })
    })
  })
}

/**
 * 获取数据库实例
 */
export function getDatabase(): sqlite3.Database {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()')
  }
  return db
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): Promise<void> {
  return new Promise((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('[Database] 关闭数据库失败:', err)
        } else {
          console.log('[Database] 连接已关闭')
        }
        db = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}

/**
 * 检查数据库是否已初始化
 */
export function isDatabaseInitialized(): boolean {
  return db !== null
}
