"use strict";
const electron = require("electron");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const fs = require("fs");
const CURRENT_VERSION = "1.0.3";
const VERSION_URL = "https://raw.githubusercontent.com/1813990575-web/5.Aha-OKR/main/version.json";
function compareVersions(local, remote) {
  const localParts = local.split(".").map(Number);
  const remoteParts = remote.split(".").map(Number);
  const maxLength = Math.max(localParts.length, remoteParts.length);
  for (let i = 0; i < maxLength; i++) {
    const localPart = localParts[i] || 0;
    const remotePart = remoteParts[i] || 0;
    if (remotePart > localPart) {
      return true;
    } else if (remotePart < localPart) {
      return false;
    }
  }
  return false;
}
function fetchRemoteVersion() {
  return new Promise((resolve) => {
    const request = https.get(VERSION_URL, { timeout: 5e3 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, { timeout: 5e3 }, (redirectResponse) => {
            handleResponse(redirectResponse, resolve);
          }).on("error", () => {
            resolve(null);
          });
          return;
        }
      }
      handleResponse(response, resolve);
    });
    request.on("error", () => {
      resolve(null);
    });
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
  });
}
function handleResponse(response, resolve) {
  if (response.statusCode !== 200) {
    resolve(null);
    return;
  }
  let data = "";
  response.on("data", (chunk) => {
    data += chunk;
  });
  response.on("end", () => {
    try {
      const versionInfo = JSON.parse(data);
      resolve(versionInfo);
    } catch {
      resolve(null);
    }
  });
  response.on("error", () => {
    resolve(null);
  });
}
function showUpdateDialog(versionInfo) {
  const result = electron.dialog.showMessageBoxSync({
    type: "info",
    title: "发现新版本",
    message: `发现新版本 ${versionInfo.version}`,
    detail: versionInfo.releaseNotes || "新版本已发布，请下载最新安装包以获取更好的体验。",
    buttons: ["去下载", "稍后"],
    defaultId: 0,
    cancelId: 1
  });
  if (result === 0) {
    electron.shell.openExternal(versionInfo.downloadUrl);
  }
}
async function checkForUpdates() {
  try {
    console.log("[VersionChecker] 正在检查版本更新...");
    const remoteVersionInfo = await fetchRemoteVersion();
    if (!remoteVersionInfo) {
      console.log("[VersionChecker] 无法获取远程版本信息");
      return;
    }
    console.log(`[VersionChecker] 本地版本: ${CURRENT_VERSION}, 远程版本: ${remoteVersionInfo.version}`);
    if (compareVersions(CURRENT_VERSION, remoteVersionInfo.version)) {
      console.log("[VersionChecker] 发现新版本");
      showUpdateDialog(remoteVersionInfo);
    } else {
      console.log("[VersionChecker] 当前已是最新版本");
    }
  } catch (error) {
    console.log("[VersionChecker] 版本检查失败:", error);
  }
}
function getCurrentVersion() {
  return CURRENT_VERSION;
}
let memoryCache = {
  items: [],
  dailyTasks: []
};
let dataFilePath = null;
let initError = null;
let isInitialized = false;
function generateUUID() {
  return crypto.randomUUID();
}
function getCurrentTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function getTodayString() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function getDataFilePath() {
  let userDataPath;
  try {
    const { app } = require("electron");
    if (app && app.getPath) {
      userDataPath = app.getPath("userData");
      console.log("[Store] 使用 Electron userData 目录:", userDataPath);
    } else {
      throw new Error("Electron app not available");
    }
  } catch (e) {
    userDataPath = process.cwd();
    console.log("[Store] 使用项目目录:", userDataPath);
  }
  const dataDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log("[Store] 创建数据目录:", dataDir);
  }
  return path.join(dataDir, "db.json");
}
function loadFromFile() {
  try {
    const filePath = getDataFilePath();
    dataFilePath = filePath;
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      memoryCache = JSON.parse(data);
      console.log("[Store] 从文件加载数据成功:", filePath);
    } else {
      console.log("[Store] 数据文件不存在，使用默认空数据:", filePath);
      memoryCache = { items: [], dailyTasks: [] };
    }
  } catch (error) {
    console.error("[Store] 从文件加载数据失败:", error);
    memoryCache = { items: [], dailyTasks: [] };
    initError = error;
  }
}
let saveTimeout = null;
let pendingSave = false;
function saveToFile() {
  pendingSave = true;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    if (!pendingSave) return;
    try {
      const filePath = dataFilePath || getDataFilePath();
      const data = JSON.stringify(memoryCache, null, 2);
      fs.writeFile(filePath, data, { encoding: "utf-8" }, (err) => {
        if (err) {
          console.error("[Store] 异步保存数据失败:", err);
        } else {
          console.log("[Store] 数据异步保存成功:", filePath);
        }
      });
      pendingSave = false;
    } catch (error) {
      console.error("[Store] 准备保存数据失败:", error);
      pendingSave = false;
    }
  }, 500);
}
function forceSyncSave() {
  try {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
    const filePath = dataFilePath || getDataFilePath();
    const data = JSON.stringify(memoryCache, null, 2);
    fs.writeFileSync(filePath, data, { encoding: "utf-8" });
    console.log("[Store] 强制同步保存成功:", filePath);
    pendingSave = false;
  } catch (error) {
    console.error("[Store] 强制同步保存失败:", error);
  }
}
function initStore() {
  if (isInitialized) {
    return true;
  }
  try {
    loadFromFile();
    isInitialized = true;
    initError = null;
    console.log("[Store] 数据存储初始化成功");
    return true;
  } catch (error) {
    console.error("[Store] 初始化失败:", error);
    initError = error;
    return false;
  }
}
function getAllItems() {
  if (!isInitialized) {
    console.error("[Store] 无法获取 Items，Store 未初始化");
    return [];
  }
  return memoryCache.items || [];
}
function getItemById(id) {
  const items = getAllItems();
  return items.find((item) => item.id === id) || null;
}
function createItem(data) {
  if (!isInitialized) {
    console.error("[Store] 无法创建 Item，Store 未初始化");
    throw new Error("Store not initialized");
  }
  const newItem = {
    ...data,
    id: data.id || generateUUID(),
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp()
  };
  memoryCache.items = [...memoryCache.items, newItem];
  saveToFile();
  return newItem;
}
function createItemAtTop(data) {
  if (!isInitialized) {
    console.error("[Store] 无法创建 Item，Store 未初始化");
    throw new Error("Store not initialized");
  }
  memoryCache.items = memoryCache.items.map((item) => {
    if (item.type === data.type && item.parent_id === data.parent_id) {
      return { ...item, sort_order: item.sort_order + 1 };
    }
    return item;
  });
  const newItem = {
    ...data,
    id: data.id || generateUUID(),
    sort_order: 0,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp()
  };
  memoryCache.items = [newItem, ...memoryCache.items];
  saveToFile();
  return newItem;
}
function updateItem(id, updates) {
  if (!isInitialized) {
    console.error("[Store] 无法更新 Item，Store 未初始化");
    return null;
  }
  const index = memoryCache.items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const updatedItem = {
    ...memoryCache.items[index],
    ...updates,
    updated_at: getCurrentTimestamp()
  };
  memoryCache.items[index] = updatedItem;
  saveToFile();
  return updatedItem;
}
function deleteItem(id) {
  if (!isInitialized) {
    console.error("[Store] 无法删除 Item，Store 未初始化");
    return { success: false, deletedIds: [] };
  }
  const getChildrenIds = (parentId) => {
    const children = memoryCache.items.filter((item) => item.parent_id === parentId);
    let ids = children.map((c) => c.id);
    for (const child of children) {
      ids = [...ids, ...getChildrenIds(child.id)];
    }
    return ids;
  };
  const childrenIds = getChildrenIds(id);
  const allIdsToDelete = [id, ...childrenIds];
  memoryCache.items = memoryCache.items.filter((item) => !allIdsToDelete.includes(item.id));
  saveToFile();
  return { success: true, deletedIds: allIdsToDelete };
}
function getObjectives() {
  const items = getAllItems();
  return items.filter((item) => item.type === "O" && item.parent_id === null).sort((a, b) => a.sort_order - b.sort_order);
}
function getChildrenByParentId(parentId) {
  const items = getAllItems();
  return items.filter((item) => item.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
}
function getItemTree() {
  const objectives = getObjectives();
  return objectives.map((obj) => {
    const children = getChildrenByParentId(obj.id);
    const childrenWithTodos = children.map((child) => {
      if (child.type === "KR") {
        const todos = getChildrenByParentId(child.id);
        return { ...child, children: todos };
      }
      return child;
    });
    return { ...obj, children: childrenWithTodos };
  });
}
function toggleItemStatus(id) {
  const item = getItemById(id);
  if (!item) return null;
  return updateItem(id, { status: item.status === 0 ? 1 : 0 });
}
function updateItemSortOrder(id, sortOrder) {
  const result = updateItem(id, { sort_order: sortOrder });
  return result !== null;
}
function shiftSortOrders(parentId, fromSortOrder, type) {
  if (!isInitialized) {
    console.error("[Store] 无法更新排序，Store 未初始化");
    return false;
  }
  memoryCache.items = memoryCache.items.map((item) => {
    if (item.type === type && item.sort_order >= fromSortOrder && (parentId === null ? item.parent_id === null : item.parent_id === parentId)) {
      return { ...item, sort_order: item.sort_order + 1 };
    }
    return item;
  });
  saveToFile();
  return true;
}
function getAllDailyTasks() {
  if (!isInitialized) {
    console.error("[Store] 无法获取 DailyTasks，Store 未初始化");
    return [];
  }
  return memoryCache.dailyTasks || [];
}
function getDailyTasksByDate(date) {
  const tasks = getAllDailyTasks();
  return tasks.filter((task) => task.date === date).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function getDailyTaskById(id) {
  const tasks = getAllDailyTasks();
  return tasks.find((task) => task.id === id) || null;
}
function createDailyTask(data) {
  if (!isInitialized) {
    console.error("[Store] 无法创建 DailyTask，Store 未初始化");
    throw new Error("Store not initialized");
  }
  const newTask = {
    ...data,
    id: generateUUID(),
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp()
  };
  memoryCache.dailyTasks = [newTask, ...memoryCache.dailyTasks];
  saveToFile();
  console.log("[Store] DailyTask 创建成功:", newTask.id);
  return newTask;
}
function updateDailyTask(id, updates) {
  if (!isInitialized) {
    console.error("[Store] 无法更新 DailyTask，Store 未初始化");
    return null;
  }
  const index = memoryCache.dailyTasks.findIndex((task) => task.id === id);
  if (index === -1) return null;
  const updatedTask = {
    ...memoryCache.dailyTasks[index],
    ...updates,
    updated_at: getCurrentTimestamp()
  };
  memoryCache.dailyTasks[index] = updatedTask;
  saveToFile();
  return updatedTask;
}
function deleteDailyTask(id) {
  if (!isInitialized) {
    console.error("[Store] 无法删除 DailyTask，Store 未初始化");
    return false;
  }
  memoryCache.dailyTasks = memoryCache.dailyTasks.filter((task) => task.id !== id);
  saveToFile();
  return true;
}
function toggleDailyTaskStatus(id) {
  const task = getDailyTaskById(id);
  if (!task) return null;
  return updateDailyTask(id, { isDone: !task.isDone });
}
function unlinkDailyTasksByGoalId(goalId) {
  if (!isInitialized) {
    console.error("[Store] 无法更新关联状态，Store 未初始化");
    return;
  }
  memoryCache.dailyTasks = memoryCache.dailyTasks.map((task) => {
    if (task.linkedGoalId === goalId) {
      return { ...task, linkedGoalId: null };
    }
    return task;
  });
  saveToFile();
}
function seedData() {
  if (!isInitialized) {
    console.error("[Store] 无法执行种子，Store 未初始化");
    return;
  }
  if (memoryCache.items.length > 0) {
    console.log("[Store] 数据已存在，跳过种子");
    return;
  }
  console.log("[Store] 开始初始化种子数据...");
  try {
    const o1 = createItem({
      type: "O",
      parent_id: null,
      title: "提升产品用户体验",
      content: "通过优化界面和交互，提升用户满意度",
      status: 0,
      sort_order: 0,
      total_focus_time: 0,
      color: "#007AFF"
    });
    if (!o1) {
      console.error("[Store] 创建种子数据失败");
      return;
    }
    const kr1 = createItem({
      type: "KR",
      parent_id: o1.id,
      title: "用户满意度达到 90%",
      content: "通过问卷调查收集用户反馈",
      status: 0,
      sort_order: 0,
      total_focus_time: 0
    });
    const kr2 = createItem({
      type: "KR",
      parent_id: o1.id,
      title: "页面加载速度提升 50%",
      content: "优化资源加载和渲染性能",
      status: 0,
      sort_order: 1,
      total_focus_time: 0
    });
    if (kr1 && kr2) {
      createItem({
        type: "TODO",
        parent_id: kr1.id,
        title: "设计用户调研问卷",
        content: "",
        status: 0,
        sort_order: 0,
        total_focus_time: 0
      });
      createItem({
        type: "TODO",
        parent_id: kr2.id,
        title: "分析当前性能瓶颈",
        content: "",
        status: 0,
        sort_order: 0,
        total_focus_time: 0
      });
    }
    console.log("[Store] 种子数据初始化完成");
  } catch (error) {
    console.error("[Store] 种子数据初始化失败:", error);
  }
}
function reseedData() {
  if (!isInitialized) {
    console.error("[Store] 无法执行重新种子，Store 未初始化");
    return;
  }
  try {
    memoryCache.items = [];
    memoryCache.dailyTasks = [];
    saveToFile();
    seedData();
  } catch (error) {
    console.error("[Store] 重新种子失败:", error);
    throw error;
  }
}
electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
electron.app.disableHardwareAcceleration();
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 20, y: 18 },
    vibrancy: "sidebar",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("close", (event) => {
    console.log("[Main] 窗口即将关闭，执行强制保存...");
    forceSyncSave();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function initializeStore(forceReseed = false) {
  try {
    const success = initStore();
    if (!success) {
      console.error("[Main] Store 初始化失败");
      return { success: false, error: "Store initialization failed" };
    }
    if (forceReseed) {
      reseedData();
    } else {
      seedData();
    }
    console.log("[Main] Store 初始化成功");
    return { success: true };
  } catch (error) {
    console.error("[Main] Store 初始化失败:", error);
    return { success: false, error: String(error) };
  }
}
function setupIpcHandlers() {
  electron.ipcMain.handle("store:init", async () => {
    return initializeStore();
  });
  electron.ipcMain.handle("db:getAllItems", async () => {
    try {
      return getAllItems();
    } catch (error) {
      console.error("[IPC] getAllItems 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:getItemById", async (_, id) => {
    try {
      return getItemById(id);
    } catch (error) {
      console.error("[IPC] getItemById 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:createItem", async (_, item) => {
    try {
      return createItem(item);
    } catch (error) {
      console.error("[IPC] createItem 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:createItemAtTop", async (_, item) => {
    try {
      return createItemAtTop(item);
    } catch (error) {
      console.error("[IPC] createItemAtTop 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:updateItem", async (_, id, updates) => {
    try {
      return updateItem(id, updates);
    } catch (error) {
      console.error("[IPC] updateItem 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:deleteItem", async (_, id) => {
    try {
      const result = deleteItem(id);
      unlinkDailyTasksByGoalId(id);
      return result;
    } catch (error) {
      console.error("[IPC] deleteItem 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:getObjectives", async () => {
    try {
      return getObjectives();
    } catch (error) {
      console.error("[IPC] getObjectives 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:getChildrenByParentId", async (_, parentId) => {
    try {
      return getChildrenByParentId(parentId);
    } catch (error) {
      console.error("[IPC] getChildrenByParentId 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:getItemTree", async () => {
    try {
      return getItemTree();
    } catch (error) {
      console.error("[IPC] getItemTree 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:toggleItemStatus", async (_, id) => {
    try {
      return toggleItemStatus(id);
    } catch (error) {
      console.error("[IPC] toggleItemStatus 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:updateItemSortOrder", async (_, id, sortOrder) => {
    try {
      return updateItemSortOrder(id, sortOrder);
    } catch (error) {
      console.error("[IPC] updateItemSortOrder 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("db:shiftSortOrders", async (_, parentId, fromSortOrder, type) => {
    try {
      return shiftSortOrders(parentId, fromSortOrder, type);
    } catch (error) {
      console.error("[IPC] shiftSortOrders 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:getAllTasks", async () => {
    try {
      return getAllDailyTasks();
    } catch (error) {
      console.error("[IPC] getAllDailyTasks 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:getTasksByDate", async (_, date) => {
    try {
      return getDailyTasksByDate(date);
    } catch (error) {
      console.error("[IPC] getDailyTasksByDate 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:getTaskById", async (_, id) => {
    try {
      return getDailyTaskById(id);
    } catch (error) {
      console.error("[IPC] getDailyTaskById 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:createTask", async (_, data) => {
    try {
      return createDailyTask(data);
    } catch (error) {
      console.error("[IPC] createDailyTask 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:updateTask", async (_, id, updates) => {
    try {
      return updateDailyTask(id, updates);
    } catch (error) {
      console.error("[IPC] updateDailyTask 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:deleteTask", async (_, id) => {
    try {
      return deleteDailyTask(id);
    } catch (error) {
      console.error("[IPC] deleteDailyTask 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:toggleTaskStatus", async (_, id) => {
    try {
      return toggleDailyTaskStatus(id);
    } catch (error) {
      console.error("[IPC] toggleDailyTaskStatus 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("daily:getTodayString", async () => {
    try {
      return getTodayString();
    } catch (error) {
      console.error("[IPC] getTodayString 错误:", error);
      throw error;
    }
  });
  electron.ipcMain.handle("app:getVersion", async () => {
    return getCurrentVersion();
  });
}
electron.app.whenReady().then(async () => {
  setupIpcHandlers();
  initializeStore(false);
  createWindow();
  setTimeout(() => {
    checkForUpdates();
  }, 3e3);
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
electron.app.on("will-quit", (event) => {
  console.log("[Main] 应用即将退出，执行强制保存...");
  forceSyncSave();
  console.log("[Main] 强制保存完成");
});
//# sourceMappingURL=main.js.map
