"use strict";
const electron = require("electron");
const databaseAPI = {
  init: () => electron.ipcRenderer.invoke("store:init"),
  getAllItems: () => electron.ipcRenderer.invoke("db:getAllItems"),
  getItemById: (id) => electron.ipcRenderer.invoke("db:getItemById", id),
  createItem: (item) => electron.ipcRenderer.invoke("db:createItem", item),
  createItemAtTop: (item) => electron.ipcRenderer.invoke("db:createItemAtTop", item),
  updateItem: (id, updates) => electron.ipcRenderer.invoke("db:updateItem", id, updates),
  deleteItem: (id) => electron.ipcRenderer.invoke("db:deleteItem", id),
  getObjectives: () => electron.ipcRenderer.invoke("db:getObjectives"),
  getChildrenByParentId: (parentId) => electron.ipcRenderer.invoke("db:getChildrenByParentId", parentId),
  getItemTree: () => electron.ipcRenderer.invoke("db:getItemTree"),
  toggleItemStatus: (id) => electron.ipcRenderer.invoke("db:toggleItemStatus", id),
  updateItemSortOrder: (id, sortOrder) => electron.ipcRenderer.invoke("db:updateItemSortOrder", id, sortOrder),
  shiftSortOrders: (parentId, fromSortOrder, type) => electron.ipcRenderer.invoke("db:shiftSortOrders", parentId, fromSortOrder, type)
};
const dailyTasksAPI = {
  getAllTasks: () => electron.ipcRenderer.invoke("daily:getAllTasks"),
  getTasksByDate: (date) => electron.ipcRenderer.invoke("daily:getTasksByDate", date),
  getTaskById: (id) => electron.ipcRenderer.invoke("daily:getTaskById", id),
  createTask: (data) => electron.ipcRenderer.invoke("daily:createTask", data),
  updateTask: (id, updates) => electron.ipcRenderer.invoke("daily:updateTask", id, updates),
  deleteTask: (id) => electron.ipcRenderer.invoke("daily:deleteTask", id),
  toggleTaskStatus: (id) => electron.ipcRenderer.invoke("daily:toggleTaskStatus", id),
  getTodayString: () => electron.ipcRenderer.invoke("daily:getTodayString")
};
const appAPI = {
  getVersion: () => electron.ipcRenderer.invoke("app:getVersion")
};
electron.contextBridge.exposeInMainWorld("electronAPI", {
  database: databaseAPI,
  dailyTasks: dailyTasksAPI,
  app: appAPI
});
//# sourceMappingURL=preload.js.map
