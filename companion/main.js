const {
  app,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { checkForUpdates } = require("./updater");
const { createMenuEngine } = require("./menuEngine");

const PORT = 21773;
const WIN_W = 622;
const WIN_H = 800;
const TOGGLE_W = 52;
const TOGGLE_H = 52;

let mainWindow = null;
let toggleWindow = null;
let tray = null;
let keyListener = null;
const commandQueue = [];
let lastStatus = { connected: false, lastPoll: 0 };

let menu = null;

function enqueue(cmd) {
  const line = String(cmd || "").trim();
  if (!line || line.length > 400) return false;
  commandQueue.push(line);
  if (commandQueue.length > 80) commandQueue.shift();
  return true;
}

function sendMain(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function sendToggle(channel, payload) {
  if (toggleWindow && !toggleWindow.isDestroyed()) {
    toggleWindow.webContents.send(channel, payload);
  }
}

function placeWindows(side) {
  const display = screen.getPrimaryDisplay().workArea;
  const isRight = side === "right";
  const mainX = isRight ? display.x + display.width - WIN_W - 24 : display.x + 24;
  const mainY = display.y + Math.max(20, Math.floor((display.height - WIN_H) / 2));
  const toggleX = isRight ? display.x + display.width - TOGGLE_W - 12 : display.x + 12;
  const toggleY = display.y + Math.floor(display.height / 2) - TOGGLE_H / 2;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBounds({ x: mainX, y: mainY, width: WIN_W, height: WIN_H });
  }
  if (toggleWindow && !toggleWindow.isDestroyed()) {
    toggleWindow.setBounds({ x: toggleX, y: toggleY, width: TOGGLE_W, height: TOGGLE_H });
  }
}

function onMenuChange(snap) {
  sendMain("menu-state", snap);
  sendToggle("menu-state", { open: snap.open });
  if (snap.open) showMainWindow();
  else hideMainWindow();
}

function showMainWindow() {
  if (!mainWindow) return;
  placeWindows(menu.settings.side);
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  // Allow mouse clicks on Back / list while open
  mainWindow.setFocusable(true);
  mainWindow.showInactive();
  mainWindow.moveTop();
}

function hideMainWindow() {
  if (!mainWindow) return;
  mainWindow.setFocusable(false);
  mainWindow.hide();
}

function showToggleAlways() {
  if (!toggleWindow) return;
  placeWindows(menu.settings.side);
  toggleWindow.setAlwaysOnTop(true, "screen-saver");
  toggleWindow.setFocusable(true);
  toggleWindow.showInactive();
  toggleWindow.moveTop();
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
    sendMain("bridge-status", lastStatus);
    // Multiplex command + fullscreen UI in one reply (Stormworks allows ~1 httpGet / 2 ticks)
    const cmd = commandQueue.length ? commandQueue.shift() : "NONE";
    const open = menu && menu.open ? "1" : "0";
    const ui = menu ? menu.getInGameText() : "StormPower";
    const body = cmd + "\n---\n" + open + "\n" + String(ui).replace(/\r/g, "").slice(0, 800);
    res.type("text/plain").send(body);
  });

  // Kept for compatibility
  api.get("/sw/ui", (_req, res) => {
    lastStatus.connected = true;
    lastStatus.lastPoll = Date.now();
    const open = menu ? (menu.open ? 1 : 0) : 0;
    const text = menu ? menu.getInGameText() : "StormPower";
    res.type("text/plain").send(open + "\n" + String(text).replace(/\r/g, "").slice(0, 900));
  });

  api.get("/sw/ping", (_req, res) => res.type("text/plain").send("OK"));

  api.post("/api/command", (req, res) => {
    const ok = enqueue(req.body?.line);
    res.status(ok ? 200 : 400).json({ ok, queue: commandQueue.length });
  });

  api.get("/api/toggle", (_req, res) => {
    const open = menu.toggleOpen();
    res.json({ ok: true, open });
  });
  api.post("/api/toggle", (_req, res) => {
    const open = menu.toggleOpen();
    res.json({ ok: true, open });
  });

  api.get("/api/status", (_req, res) => {
    res.json({
      ...lastStatus,
      queue: commandQueue.length,
      port: PORT,
      toggleKey: "F4 / Insert / F8",
      menuVisible: !!(menu && menu.open),
      side: menu ? menu.settings.side : "left",
      product: "StormPower",
      studio: "Aimless Developement",
      snapshot: menu ? menu.getSnapshot() : null,
    });
  });

  api.get("/api/state", (_req, res) => {
    res.json(menu ? menu.getSnapshot() : {});
  });

  const server = http.createServer(api);
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[StormPower] bridge http://127.0.0.1:${PORT}`);
  });
  server.on("error", (err) => {
    console.error("[StormPower] port busy:", err.message);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: WIN_W,
    height: WIN_H,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: false,
    focusable: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("will-resize", (e) => e.preventDefault());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function createToggleWindow() {
  toggleWindow = new BrowserWindow({
    width: TOGGLE_W,
    height: TOGGLE_H,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  toggleWindow.setAlwaysOnTop(true, "screen-saver");
  toggleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toggleWindow.loadFile(path.join(__dirname, "renderer", "toggle.html"));
  toggleWindow.on("closed", () => {
    toggleWindow = null;
  });
}

function createTray() {
  const img = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGD4z0ABYBzVMKoBAw0M/kP4jGQbQJYGkhWQZQDlBqB7gFEOYBoAAGmWAxXQvYJvAAAAAElFTkSuQmCC"
  );
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip("StormPower");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Toggle menu", click: () => menu.toggleOpen() },
      { label: "Force open", click: () => menu.setOpen(true) },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
  tray.on("click", () => menu.toggleOpen());
}

function normalizeKeyName(e) {
  const raw = String(e.name || e.standardName || "").toUpperCase().trim();
  const map = {
    UP: "UP",
    "UP ARROW": "UP",
    DOWN: "DOWN",
    "DOWN ARROW": "DOWN",
    LEFT: "LEFT",
    "LEFT ARROW": "LEFT",
    RIGHT: "RIGHT",
    "RIGHT ARROW": "RIGHT",
    RETURN: "RETURN",
    ENTER: "RETURN",
    BACKSPACE: "BACKSPACE",
    ESCAPE: "ESCAPE",
    ESC: "ESCAPE",
    INSERT: "INSERT",
    INS: "INSERT",
    F4: "F4",
    F8: "F8",
  };
  if (map[raw]) return map[raw];
  if (/^[0-9]$/.test(raw)) return raw;
  return raw;
}

function startLowLevelKeys() {
  try {
    const { GlobalKeyboardListener } = require("node-global-key-listener");
    keyListener = new GlobalKeyboardListener({
      windows: {
        onError: (code) => console.error("[StormPower] keyhook error", code),
        onInfo: (info) => console.log("[StormPower] keyhook", info),
      },
    });

    keyListener.addListener((e) => {
      if (!e || e.state !== "DOWN") return;
      const name = normalizeKeyName(e);

      if (name === "F4" || name === "INSERT" || name === "F8") {
        menu.toggleOpen();
        // Capture so the game doesn't also eat it awkwardly
        return true;
      }

      if (!menu.open) return;

      if (name === "UP") {
        menu.handleNav("up");
        return true;
      }
      if (name === "DOWN") {
        menu.handleNav("down");
        return true;
      }
      if (name === "LEFT" || name === "BACKSPACE" || name === "ESCAPE") {
        menu.handleNav("back");
        return true;
      }
      if (name === "RIGHT" || name === "RETURN") {
        menu.handleNav("select");
        return true;
      }
      if (/^[1-9]$/.test(name)) {
        menu.handleNav("num:" + name);
        return true;
      }
    });
    console.log("[StormPower] low-level keys OK (F4/Insert/F8 + arrows)");
  } catch (err) {
    console.error("[StormPower] key listener failed:", err.message);
    globalShortcut.register("F4", () => menu.toggleOpen());
    globalShortcut.register("Insert", () => menu.toggleOpen());
    globalShortcut.register("Up", () => menu.open && menu.handleNav("up"));
    globalShortcut.register("Down", () => menu.open && menu.handleNav("down"));
    globalShortcut.register("Left", () => menu.open && menu.handleNav("back"));
    globalShortcut.register("Right", () => menu.open && menu.handleNav("select"));
    globalShortcut.register("Return", () => menu.open && menu.handleNav("select"));
    globalShortcut.register("Backspace", () => menu.open && menu.handleNav("back"));
  }
}

app.whenReady().then(async () => {
  menu = createMenuEngine({
    enqueue,
    onChange: onMenuChange,
    onSideChange: (side) => placeWindows(side),
  });

  createHttpBridge();
  createMainWindow();
  createToggleWindow();
  createTray();
  startLowLevelKeys();

  placeWindows(menu.settings.side);
  showToggleAlways();

  // Start with menu open so user sees it immediately
  menu.setOpen(true);

  try {
    const info = await checkForUpdates({ silent: true });
    if (info?.updateAvailable) sendMain("update-available", info);
  } catch (_) {}

  console.log("[StormPower] ready — Aimless Developement");
  console.log("[StormPower] Fullscreen: use in-game popup mirror (addon draws menu).");
  console.log("[StormPower] Windowed: floating UI + edge toggle button.");
});

app.on("will-quit", () => {
  try {
    if (keyListener) keyListener.kill();
  } catch (_) {}
  try {
    globalShortcut.unregisterAll();
  } catch (_) {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-config", () => ({
  port: PORT,
  toggleKey: "F4 / Insert / F8",
  width: WIN_W,
  height: WIN_H,
  product: "StormPower",
  studio: "Aimless Developement",
  version: readVersion(),
  state: menu ? menu.getSnapshot() : null,
}));

ipcMain.handle("get-state", () => (menu ? menu.getSnapshot() : null));
ipcMain.on("nav", (_e, action) => menu && menu.handleNav(action));
ipcMain.on("toggle-menu", () => menu && menu.toggleOpen());
ipcMain.on("set-open", (_e, open) => menu && menu.setOpen(!!open));
ipcMain.on("update-settings", (_e, partial) => menu && menu.updateSettings(partial || {}));
ipcMain.on("activate-index", (_e, idx) => menu && menu.selectIndex(Number(idx)));
ipcMain.on("back", () => menu && menu.handleNav("back"));
ipcMain.on("queue-command", (_e, line) => enqueue(line));
ipcMain.handle("check-updates", async () => checkForUpdates({ silent: false }));
ipcMain.handle("apply-update", async () => checkForUpdates({ silent: false, apply: true }));

function readVersion() {
  try {
    return fs.readFileSync(path.join(app.getAppPath(), "VERSION"), "utf8").trim();
  } catch (_) {
    return app.getVersion();
  }
}
