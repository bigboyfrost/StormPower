const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stormpower", {
  getConfig: () => ipcRenderer.invoke("get-config"),
  getState: () => ipcRenderer.invoke("get-state"),
  nav: (action) => ipcRenderer.send("nav", action),
  toggleMenu: () => ipcRenderer.send("toggle-menu"),
  setOpen: (open) => ipcRenderer.send("set-open", open),
  updateSettings: (partial) => ipcRenderer.send("update-settings", partial || {}),
  setSearch: (q) => ipcRenderer.send("set-search", String(q || "")),
  stm: (dir) => ipcRenderer.send("stm", String(dir || "")),
  stmAt: (idx, dir) => ipcRenderer.send("stm-at", Number(idx), String(dir || "")),
  activateIndex: (idx) => ipcRenderer.send("activate-index", idx),
  focusIndex: (idx) => ipcRenderer.send("focus-index", idx),
  back: () => ipcRenderer.send("back"),
  setDetached: (detached) => ipcRenderer.send("set-detached", !!detached),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  applyUpdate: () => ipcRenderer.invoke("apply-update"),
  openUpdateUi: () => ipcRenderer.invoke("open-update-ui"),
  onState: (cb) => ipcRenderer.on("menu-state", (_e, s) => cb(s)),
  onStatus: (cb) => ipcRenderer.on("bridge-status", (_e, s) => cb(s)),
  onUpdate: (cb) => ipcRenderer.on("update-available", (_e, info) => cb(info)),
  onDetach: (cb) => ipcRenderer.on("detach-state", (_e, s) => cb(s)),
});
