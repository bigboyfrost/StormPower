const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stormpowerUpdate", {
  getUpdateInfo: () => ipcRenderer.invoke("update-ui-info"),
  applyUpdate: () => ipcRenderer.invoke("update-ui-apply"),
  close: () => ipcRenderer.send("update-ui-close"),
  restart: () => ipcRenderer.send("update-ui-restart"),
  onProgress: (cb) => ipcRenderer.on("update-progress", (_e, p) => cb(p)),
});
