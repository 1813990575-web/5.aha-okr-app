import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

// 禁用 GPU 沙盒，修复 Intel Mac 上的渲染问题
app.commandLine.appendSwitch('disable-gpu-sandbox')
// 禁用硬件加速，避免 Intel 芯片的渲染卡顿
app.disableHardwareAcceleration()

// 版本检查器导入
import { checkForUpdates, getCurrentVersion } from './version-checker'

// Store 数据层导入
import {
  initStore,
  getAllItems,
  getItemById,
  createItem,
  createItemAtTop,
  updateItem,
  deleteItem,
  getObjectives,
  getChildrenByParentId,
  getItemTree,
  toggleItemStatus,
  updateItemSortOrder,
  shiftSortOrders,
  seedData,
  reseedData,
  // DailyTasks 操作
  getAllDailyTasks,
  getDailyTasksByDate,
  getDailyTaskById,
  createDailyTask,
  updateDailyTask,
  deleteDailyTask,
  toggleDailyTaskStatus,
  unlinkDailyTasksByGoalId,
  getTodayString,
  // 强制保存
  forceSyncSave,
} from '../src/store/index'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 20, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // 加载应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 初始化 Store
function initializeStore(forceReseed = false) {
  try {
    const success = initStore()
    if (!success) {
      console.error('[Main] Store 初始化失败')
      return { success: false, error: 'Store initialization failed' }
    }
    if (forceReseed) {
      reseedData()
    } else {
      seedData()
    }
    console.log('[Main] Store 初始化成功')
    return { success: true }
  } catch (error) {
    console.error('[Main] Store 初始化失败:', error)
    return { success: false, error: String(error) }
  }
}

// 设置 IPC 处理器
function setupIpcHandlers() {
  // Store 初始化
  ipcMain.handle('store:init', async () => {
    return initializeStore()
  })

  // ==================== Items (OKR) 操作 ====================

  // 获取所有 Items
  ipcMain.handle('db:getAllItems', async () => {
    try {
      return getAllItems()
    } catch (error) {
      console.error('[IPC] getAllItems 错误:', error)
      throw error
    }
  })

  // 根据 ID 获取 Item
  ipcMain.handle('db:getItemById', async (_, id: string) => {
    try {
      return getItemById(id)
    } catch (error) {
      console.error('[IPC] getItemById 错误:', error)
      throw error
    }
  })

  // 创建 Item
  ipcMain.handle('db:createItem', async (_, item: any) => {
    try {
      return createItem(item)
    } catch (error) {
      console.error('[IPC] createItem 错误:', error)
      throw error
    }
  })

  // 创建 Item 并插入到最前端
  ipcMain.handle('db:createItemAtTop', async (_, item: any) => {
    try {
      return createItemAtTop(item)
    } catch (error) {
      console.error('[IPC] createItemAtTop 错误:', error)
      throw error
    }
  })

  // 更新 Item
  ipcMain.handle('db:updateItem', async (_, id: string, updates: any) => {
    try {
      return updateItem(id, updates)
    } catch (error) {
      console.error('[IPC] updateItem 错误:', error)
      throw error
    }
  })

  // 删除 Item
  ipcMain.handle('db:deleteItem', async (_, id: string) => {
    try {
      const result = deleteItem(id)
      // 删除 Item 后，断开关联的 DailyTasks
      unlinkDailyTasksByGoalId(id)
      return result
    } catch (error) {
      console.error('[IPC] deleteItem 错误:', error)
      throw error
    }
  })

  // 获取所有目标 (O 类型)
  ipcMain.handle('db:getObjectives', async () => {
    try {
      return getObjectives()
    } catch (error) {
      console.error('[IPC] getObjectives 错误:', error)
      throw error
    }
  })

  // 获取子 Items
  ipcMain.handle('db:getChildrenByParentId', async (_, parentId: string) => {
    try {
      return getChildrenByParentId(parentId)
    } catch (error) {
      console.error('[IPC] getChildrenByParentId 错误:', error)
      throw error
    }
  })

  // 获取层级树
  ipcMain.handle('db:getItemTree', async () => {
    try {
      return getItemTree()
    } catch (error) {
      console.error('[IPC] getItemTree 错误:', error)
      throw error
    }
  })

  // 切换完成状态
  ipcMain.handle('db:toggleItemStatus', async (_, id: string) => {
    try {
      return toggleItemStatus(id)
    } catch (error) {
      console.error('[IPC] toggleItemStatus 错误:', error)
      throw error
    }
  })

  // 更新排序
  ipcMain.handle('db:updateItemSortOrder', async (_, id: string, sortOrder: number) => {
    try {
      return updateItemSortOrder(id, sortOrder)
    } catch (error) {
      console.error('[IPC] updateItemSortOrder 错误:', error)
      throw error
    }
  })

  // 批量移动排序（向后移动）
  ipcMain.handle('db:shiftSortOrders', async (_, parentId: string | null, fromSortOrder: number, type: 'O' | 'KR' | 'TODO') => {
    try {
      return shiftSortOrders(parentId, fromSortOrder, type)
    } catch (error) {
      console.error('[IPC] shiftSortOrders 错误:', error)
      throw error
    }
  })

  // ==================== DailyTasks 操作 ====================

  // 获取所有 DailyTasks
  ipcMain.handle('daily:getAllTasks', async () => {
    try {
      return getAllDailyTasks()
    } catch (error) {
      console.error('[IPC] getAllDailyTasks 错误:', error)
      throw error
    }
  })

  // 根据日期获取 DailyTasks
  ipcMain.handle('daily:getTasksByDate', async (_, date: string) => {
    try {
      return getDailyTasksByDate(date)
    } catch (error) {
      console.error('[IPC] getDailyTasksByDate 错误:', error)
      throw error
    }
  })

  // 根据 ID 获取 DailyTask
  ipcMain.handle('daily:getTaskById', async (_, id: string) => {
    try {
      return getDailyTaskById(id)
    } catch (error) {
      console.error('[IPC] getDailyTaskById 错误:', error)
      throw error
    }
  })

  // 创建 DailyTask
  ipcMain.handle('daily:createTask', async (_, data: any) => {
    try {
      return createDailyTask(data)
    } catch (error) {
      console.error('[IPC] createDailyTask 错误:', error)
      throw error
    }
  })

  // 更新 DailyTask
  ipcMain.handle('daily:updateTask', async (_, id: string, updates: any) => {
    try {
      return updateDailyTask(id, updates)
    } catch (error) {
      console.error('[IPC] updateDailyTask 错误:', error)
      throw error
    }
  })

  // 删除 DailyTask
  ipcMain.handle('daily:deleteTask', async (_, id: string) => {
    try {
      return deleteDailyTask(id)
    } catch (error) {
      console.error('[IPC] deleteDailyTask 错误:', error)
      throw error
    }
  })

  // 切换 DailyTask 完成状态
  ipcMain.handle('daily:toggleTaskStatus', async (_, id: string) => {
    try {
      return toggleDailyTaskStatus(id)
    } catch (error) {
      console.error('[IPC] toggleDailyTaskStatus 错误:', error)
      throw error
    }
  })

  // 获取今天的日期字符串
  ipcMain.handle('daily:getTodayString', async () => {
    try {
      return getTodayString()
    } catch (error) {
      console.error('[IPC] getTodayString 错误:', error)
      throw error
    }
  })

  // ==================== 版本信息 ====================

  // 获取当前版本号
  ipcMain.handle('app:getVersion', async () => {
    return getCurrentVersion()
  })
}

app.whenReady().then(async () => {
  // 设置 IPC 处理器
  setupIpcHandlers()

  // 初始化 Store
  initializeStore(false)

  // 创建窗口
  createWindow()

  // 延迟检查版本更新（等待窗口加载完成）
  setTimeout(() => {
    checkForUpdates()
  }, 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

// 应用退出前强制保存数据（解决 Intel Mac 数据丢失问题）
app.on('will-quit', (event) => {
  console.log('[Main] 应用即将退出，执行强制保存...')
  forceSyncSave()
  console.log('[Main] 强制保存完成')
})
