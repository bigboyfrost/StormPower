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
const { spawn } = require("child_process");
const { checkForUpdates, spawnFinishUpdate } = require("./updater");
const { createMenuEngine } = require("./menuEngine");

const PORT = 21773;
const WIN_W = 622;
const WIN_H = 800;
const TOGGLE_W = 64;
const TOGGLE_H = 64;
const UPDATE_W = 720;
const UPDATE_H = 640;
const UPDATE_UI_ONLY = process.argv.includes("--update-ui");

let mainWindow = null;
let toggleWindow = null;
let updateWindow = null;
let tray = null;
let keyListener = null;
const commandQueue = [];
let lastStatus = { connected: false, lastPoll: 0 };
let detached = false;
let cachedUpdateInfo = null;

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

function sendUpdate(channel, payload) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.webContents.send(channel, payload);
  }
}

function createUpdateWindow(opts = {}) {
  if (updateWindow && !updateWindow.isDestroyed()) {
    updateWindow.focus();
    return updateWindow;
  }

  const display = screen.getPrimaryDisplay().workArea;
  const x = Math.round(display.x + (display.width - UPDATE_W) / 2);
  const y = Math.round(display.y + (display.height - UPDATE_H) / 2);

  updateWindow = new BrowserWindow({
    width: UPDATE_W,
    height: UPDATE_H,
    x,
    y,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    minimizable: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: false,
    focusable: true,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, "preload-update.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  updateWindow.setAlwaysOnTop(true, "screen-saver");
  updateWindow.loadFile(path.join(__dirname, "renderer", "update.html"));
  updateWindow.once("ready-to-show", () => {
    updateWindow.show();
    updateWindow.focus();
  });
  updateWindow.on("closed", () => {
    updateWindow = null;
    if (UPDATE_UI_ONLY) app.quit();
  });
  return updateWindow;
}

function openUpdateScreen(info) {
  if (info) cachedUpdateInfo = info;
  createUpdateWindow();
}

function relaunchStormPower() {
  // Finish installs AFTER this process exits (file locks on Windows)
  try {
    spawnFinishUpdate({ relaunch: true });
  } catch (err) {
    console.error("[StormPower] finish-update spawn failed", err);
    // Fallback: try direct relaunch
    const root = path.resolve(__dirname, "..");
    const child = spawn(process.execPath, [root], {
      cwd: root,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }
  setTimeout(() => app.quit(), 300);
}

function placeWindows(side) {
  const display = screen.getPrimaryDisplay().workArea;
  const isRight = side === "right";
  const toggleX = isRight ? display.x + display.width - TOGGLE_W - 10 : display.x + 10;
  const toggleY = display.y + 8;
  const mainX = isRight ? display.x + display.width - WIN_W - 16 : display.x + 16;
  const mainY = display.y + 8 + TOGGLE_H + 6;

  // When popped out, leave menu where the user dragged it (other monitor OK)
  if (mainWindow && !mainWindow.isDestroyed() && !detached) {
    mainWindow.setBounds({ x: mainX, y: mainY, width: WIN_W, height: WIN_H });
  }
  if (toggleWindow && !toggleWindow.isDestroyed()) {
    toggleWindow.setBounds({ x: toggleX, y: toggleY, width: TOGGLE_W, height: TOGGLE_H });
  }
}

function setDetached(on) {
  detached = !!on;
  if (!mainWindow || mainWindow.isDestroyed()) {
    sendMain("detach-state", { detached });
    return;
  }
  if (detached) {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setMovable(true);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setFocusable(true);
    // Nudge slightly so user sees it can move
    const b = mainWindow.getBounds();
    mainWindow.setBounds({ ...b, x: b.x + 24, y: b.y + 24 });
    mainWindow.show();
    mainWindow.focus();
  } else {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    mainWindow.setMovable(true);
    placeWindows(menu ? menu.settings.side : "left");
    if (menu && menu.open) showMainWindow();
  }
  sendMain("detach-state", { detached });
}

function onMenuChange(snap) {
  sendMain("menu-state", snap);
  sendToggle("menu-state", { open: snap.open });
  if (snap.open) showMainWindow();
  else hideMainWindow();
}

function showMainWindow() {
  if (!mainWindow) return;
  if (!detached) placeWindows(menu.settings.side);
  if (!detached) mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setFocusable(true);
  // Take focus so arrow keys work without rapid-clicking the panel
  mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
  sendMain("menu-focused", { open: true });
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
  toggleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  toggleWindow.setSkipTaskbar(true);
  toggleWindow.setFocusable(true);
  // Never auto-hide — this is the primary open/close control
  if (!toggleWindow.isVisible()) toggleWindow.show();
  else toggleWindow.showInactive();
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
  mainWindow.setMovable(true);
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
  // Dedicated updater UI (update.bat / npm run update)
  // NOTE: never install staged files while Electron is running — Windows locks .js
  if (UPDATE_UI_ONLY) {
    createUpdateWindow();
    console.log("[StormPower] update UI mode");
    return;
  }

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
  // Keep menu keyboard-ready: re-assert focus while open (game steals it otherwise)
  setInterval(() => {
    if (!menu || !menu.open) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (detached) return;
    try {
      if (!mainWindow.isFocused()) {
        mainWindow.setFocusable(true);
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop();
      }
    } catch (_) {}
  }, 700);
  setInterval(() => {
    if (toggleWindow && !toggleWindow.isDestroyed()) {
      toggleWindow.setAlwaysOnTop(true, "screen-saver");
      if (!toggleWindow.isVisible()) toggleWindow.showInactive();
      toggleWindow.moveTop();
    }
  }, 2000);

  menu.setOpen(true);

  try {
    const info = await checkForUpdates({ silent: true });
    cachedUpdateInfo = info;
    if (info?.updateAvailable) sendMain("update-available", info);
  } catch (_) {}

  console.log("[StormPower] ready — Aimless Developement");
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
  detached,
  state: menu ? menu.getSnapshot() : null,
}));

ipcMain.handle("get-state", () => (menu ? menu.getSnapshot() : null));
ipcMain.on("nav", (_e, action) => menu && menu.handleNav(action));
ipcMain.on("toggle-menu", () => menu && menu.toggleOpen());
ipcMain.on("set-open", (_e, open) => menu && menu.setOpen(!!open));
ipcMain.on("update-settings", (_e, partial) => menu && menu.updateSettings(partial || {}));
ipcMain.on("activate-index", (_e, idx) => menu && menu.selectIndex(Number(idx)));
ipcMain.on("back", () => menu && menu.handleNav("back"));
ipcMain.on("set-detached", (_e, on) => setDetached(!!on));
ipcMain.on("queue-command", (_e, line) => enqueue(line));
ipcMain.handle("check-updates", async () => {
  cachedUpdateInfo = await checkForUpdates({ silent: false });
  return cachedUpdateInfo;
});
ipcMain.handle("apply-update", async () => {
  // Prefer the changelog screen over silent apply
  openUpdateScreen(cachedUpdateInfo);
  return { openedUi: true, ...(cachedUpdateInfo || {}) };
});
ipcMain.handle("open-update-ui", async () => {
  const info = cachedUpdateInfo || (await checkForUpdates({ silent: true }));
  cachedUpdateInfo = info;
  openUpdateScreen(info);
  return info;
});
ipcMain.handle("update-ui-info", async () => {
  if (cachedUpdateInfo) return cachedUpdateInfo;
  cachedUpdateInfo = await checkForUpdates({ silent: false });
  return cachedUpdateInfo;
});
ipcMain.handle("update-ui-apply", async () => {
  // Close StormPower FIRST, then install (Windows locks files while open)
  const root = path.resolve(__dirname, "..");
  const script = path.join(__dirname, "run-update-and-relaunch.js");
  try {
    const child = spawn("node.exe", [script], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env },
    });
    child.unref();
  } catch (err) {
    console.error("[StormPower] failed to spawn updater", err);
    return { applied: false, message: String(err.message || err) };
  }
  setTimeout(() => app.quit(), 250);
  return {
    applied: true,
    closing: true,
    message: "Closing StormPower to install the update…",
  };
});
ipcMain.on("update-ui-close", () => {
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
  else if (UPDATE_UI_ONLY) app.quit();
});
ipcMain.on("update-ui-restart", () => {
  // Same quit-then-install path
  const root = path.resolve(__dirname, "..");
  const script = path.join(__dirname, "run-update-and-relaunch.js");
  try {
    const child = spawn("node.exe", [script], {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch (_) {}
  setTimeout(() => app.quit(), 250);
});

function readVersion() {
  try {
    return fs.readFileSync(path.join(app.getAppPath(), "VERSION"), "utf8").trim();
  } catch (_) {
    return app.getVersion();
  }
}
