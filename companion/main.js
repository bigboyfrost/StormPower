const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { checkForUpdates } = require("./updater");

const PORT = 21773;
const TOGGLE_KEY = "F4";
const WIN_W = 622;
const WIN_H = 800;

let mainWindow = null;
let menuVisible = false;
const commandQueue = [];
let lastStatus = { connected: false, lastPoll: 0 };

const NAV_KEYS = [
  "Up",
  "Down",
  "Left",
  "Right",
  "Return",
  "Enter",
  "Backspace",
  "Escape",
  "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

function enqueue(cmd) {
  const line = String(cmd || "").trim();
  if (!line || line.length > 400) return false;
  commandQueue.push(line);
  if (commandQueue.length > 80) commandQueue.shift();
  return true;
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createHttpBridge() {
  const api = express();
  api.use(express.json({ limit: "64kb" }));
  api.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });

  api.get("/sw/poll", (req, res) => {
    lastStatus.connected = true;
    lastStatus.lastPoll = Date.now();
    sendToRenderer("bridge-status", lastStatus);
    if (!commandQueue.length) {
      res.type("text/plain").send("NONE");
      return;
    }
    res.type("text/plain").send(commandQueue.shift());
  });

  api.get("/sw/ping", (_req, res) => res.type("text/plain").send("OK"));

  api.post("/api/command", (req, res) => {
    const ok = enqueue(req.body?.line);
    res.status(ok ? 200 : 400).json({ ok, queue: commandQueue.length });
  });

  api.get("/api/status", (_req, res) => {
    res.json({
      ...lastStatus,
      queue: commandQueue.length,
      port: PORT,
      toggleKey: TOGGLE_KEY,
      menuVisible,
      product: "StormPower",
      studio: "Aimless Developement",
    });
  });

  const server = http.createServer(api);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[StormPower] bridge http://127.0.0.1:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("[StormPower] port busy:", err.message);
  });
}

function registerNavHotkeys() {
  const map = {
    Up: "up",
    Down: "down",
    Left: "back",
    Right: "select",
    Return: "select",
    Enter: "select",
    Backspace: "back",
    Escape: "back",
  };
  for (const key of NAV_KEYS) {
    try {
      globalShortcut.unregister(key);
    } catch (_) {}
  }
  for (const key of NAV_KEYS) {
    const action = map[key] || ( /^\d$/.test(key) ? `num:${key}` : null);
    if (!action) continue;
    try {
      globalShortcut.register(key, () => {
        if (!menuVisible) return;
        sendToRenderer("nav", action);
      });
    } catch (err) {
      // some keys fail on certain layouts; ignore
    }
  }
}

function unregisterNavHotkeys() {
  for (const key of NAV_KEYS) {
    try {
      globalShortcut.unregister(key);
    } catch (_) {}
  }
}

function createWindow() {
  const display = screen.getPrimaryDisplay().workArea;
  const x = display.x + 28;
  const y = display.y + Math.max(20, Math.floor((display.height - WIN_H) / 2));

  mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    minWidth: WIN_W,
    maxWidth: WIN_W,
    minHeight: WIN_H,
    maxHeight: WIN_H,
    x,
    y,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    // Critical: do not steal focus from Stormworks
    focusable: false,
    show: false,
    hasShadow: true,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setContentProtection(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Keep size locked even if OS tries to change it
  mainWindow.on("will-resize", (e) => e.preventDefault());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showMenu() {
  if (!mainWindow) return;
  menuVisible = true;
  mainWindow.showInactive(); // show without activating / stealing focus
  registerNavHotkeys();
  sendToRenderer("menu-visibility", true);
}

function hideMenu() {
  if (!mainWindow) return;
  menuVisible = false;
  unregisterNavHotkeys();
  sendToRenderer("menu-visibility", false);
  mainWindow.hide();
}

function toggleMenu() {
  if (menuVisible) hideMenu();
  else showMenu();
}

app.whenReady().then(async () => {
  createHttpBridge();
  createWindow();

  const ok = globalShortcut.register(TOGGLE_KEY, () => toggleMenu());
  console.log(`[StormPower] ${TOGGLE_KEY} toggle:`, ok ? "ok" : "FAILED");

  // Quiet update check on boot
  try {
    const info = await checkForUpdates({ silent: true });
    if (info?.updateAvailable) {
      sendToRenderer("update-available", info);
      console.log(`[StormPower] update available: ${info.latest}`);
    }
  } catch (err) {
    console.log("[StormPower] update check skipped:", err.message);
  }

  showMenu();
  console.log("[StormPower] ready — By Aimless Developement");
});

app.on("will-quit", () => {
  unregisterNavHotkeys();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-config", () => ({
  port: PORT,
  toggleKey: TOGGLE_KEY,
  width: WIN_W,
  height: WIN_H,
  product: "StormPower",
  studio: "Aimless Developement",
  version: readVersion(),
}));

ipcMain.on("queue-command", (_e, line) => enqueue(line));
ipcMain.on("hide-menu", () => hideMenu());
ipcMain.on("toggle-menu", () => toggleMenu());
ipcMain.handle("check-updates", async () => checkForUpdates({ silent: false }));
ipcMain.handle("apply-update", async () => {
  const info = await checkForUpdates({ silent: false, apply: true });
  return info;
});

function readVersion() {
  try {
    const p = path.join(app.getAppPath(), "VERSION");
    return fs.readFileSync(p, "utf8").trim();
  } catch (_) {
    return app.getVersion();
  }
}
