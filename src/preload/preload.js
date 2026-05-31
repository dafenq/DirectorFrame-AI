const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("shotFactory", {
  getProject: () => ipcRenderer.invoke("project:get"),
  newProject: () => ipcRenderer.invoke("project:new"),
  openProject: () => ipcRenderer.invoke("project:open"),
  saveProject: (saveAs) => ipcRenderer.invoke("project:save", saveAs),
  importScript: () => ipcRenderer.invoke("project:importScript"),
  importAssets: (kind) => ipcRenderer.invoke("assets:import", kind),
  updateProject: (project) => ipcRenderer.invoke("project:update", project),
  generateBatch: (options) => ipcRenderer.invoke("batch:generate", options),
  cancelBatch: () => ipcRenderer.invoke("batch:cancel"),
  resumeBatch: () => ipcRenderer.invoke("batch:resume"),
  onBatchProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("batch:progress", listener);
    return () => ipcRenderer.removeListener("batch:progress", listener);
  },
  selfCheck: () => ipcRenderer.invoke("project:selfCheck"),
  exportProject: () => ipcRenderer.invoke("project:export"),
  checkUpdates: () => ipcRenderer.invoke("app:checkUpdates")
});
