const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stormpower", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  queueCommand: (line) => ipcRenderer.send("queue-command", line),
  hideMenu: () => ipcRenderer.send("hide-menu"),
  toggleMenu: () => ipcRenderer.send("toggle-menu"),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  applyUpdate: () => ipcRenderer.invoke("apply-update"),
  onVisibility: (cb) => ipcRenderer.on("menu-visibility", (_e, v) => cb(v)),
  onStatus: (cb) => ipcRenderer.on("bridge-status", (_e, s) => cb(s)),
  onNav: (cb) => ipcRenderer.on("nav", (_e, action) => cb(action)),
  onUpdate: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
});
