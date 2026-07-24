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
const express = require("express");
const http = require("http");
const { spawn } = require("child_process");
const appUpdater = require("./appUpdater");
const { checkForUpdates: checkZipUpdates, spawnFinishUpdate } = require("./updater");
const { createMenuEngine } = require("./menuEngine");
const engineMod = require("./engineMod");
const tornadoMod = require("./tornadoMod");
const liveMemory = require("./liveMemory");
const {
  isPackaged,
  syncStormworksAddon,
  iconPath,
  readAppVersion,
  projectRoot,
  cleanupLeftoverInstallers,
} = require("./paths");

const PORT = 21773;
const WIN_W = 640;
const WIN_H_MIN = 980;
const WIN_H_MAX = 1280;
const TOGGLE_W = 64;
const TOGGLE_H = 64;
const UPDATE_W = 720;
const UPDATE_H = 640;
const UPDATE_UI_ONLY = process.argv.includes("--update-ui");
const UPDATE_POLL_MS = 2 * 60 * 1000; // check while running
const UPDATE_THROTTLE_MS = 45 * 1000;
const UPDATE_INGAME_RESEND_MS = 18 * 1000; // keep nagging until they update

function mainWindowHeight() {
  try {
    const wa = screen.getPrimaryDisplay().workArea;
    return Math.min(WIN_H_MAX, Math.max(WIN_H_MIN, wa.height - 70));
  } catch (_) {
    return WIN_H_MIN;
  }
}

let mainWindow = null;
let toggleWindow = null;
let updateWindow = null;
let tray = null;
let keyListener = null;
const commandQueue = [];
let lastStatus = { connected: false, lastPoll: 0 };
let detached = false;
let cachedUpdateInfo = null;
let lastUpdateCheckAt = 0;
let lastInGameUpdateNotify = "";
let lastInGameUpdateSentAt = 0;
let pendingInGameUpdateVer = "";
let bridgeWasConnected = false;

let menu = null;

function enqueue(cmd) {
  const line = String(cmd || "").trim();
  if (!line || line.length > 400) return false;
  commandQueue.push(line);
  if (commandQueue.length > 80) commandQueue.shift();
  return true;
}

function waveConfigFromSettings(overrides = {}) {
  const s = { ...(menu?.settings || {}), ...overrides };
  return {
    height: Number(s.wave_height) || 12,
    intervalMs: Math.max(3000, (Number(s.wave_interval) || 12) * 1000),
    dist: Math.max(80, Number(s.wave_dist) || 250),
    dir: String(s.wave_dir || "ahead"),
  };
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
  if (isPackaged()) {
    app.relaunch();
    setTimeout(() => app.quit(), 200);
    return;
  }
  // Finish installs AFTER this process exits (file locks on Windows)
  try {
    spawnFinishUpdate({ relaunch: true });
  } catch (err) {
    console.error("[StormPower] finish-update spawn failed", err);
    const root = projectRoot();
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
  const h = mainWindowHeight();
  const mainX = isRight ? display.x + display.width - WIN_W - 16 : display.x + 16;
  const mainY = display.y + 8 + TOGGLE_H + 6;

  // When popped out, leave menu where the user dragged it (other monitor OK)
  if (mainWindow && !mainWindow.isDestroyed() && !detached) {
    mainWindow.setBounds({ x: mainX, y: mainY, width: WIN_W, height: h });
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
  if (snap.open) {
    showMainWindow();
    // Quiet background check whenever the menu is opened (throttled)
    pollForUpdates("menu");
  } else hideMainWindow();
}

function bridgeConnectedRecently() {
  return lastStatus.lastPoll && Date.now() - lastStatus.lastPoll < 15000;
}

function notifyInGameUpdate(info, opts = {}) {
  const force = !!opts.force;
  const ver = String(info?.latest || pendingInGameUpdateVer || "").replace(/^v/i, "");
  if (!ver) return;
  pendingInGameUpdateVer = ver;

  const now = Date.now();
  if (!force) {
    if (ver === lastInGameUpdateNotify && now - lastInGameUpdateSentAt < UPDATE_INGAME_RESEND_MS) return;
    if (!bridgeConnectedRecently()) return; // wait until Stormworks is polling
  }

  lastInGameUpdateNotify = ver;
  lastInGameUpdateSentAt = now;
  const peer = menu?.settings?.peer ?? 0;
  enqueue(`notify_update|${peer}|${ver}`);
}

async function pollForUpdates(reason = "poll") {
  const now = Date.now();
  if (reason !== "startup" && reason !== "bridge" && now - lastUpdateCheckAt < UPDATE_THROTTLE_MS) return;
  lastUpdateCheckAt = now;
  try {
    const info = await appUpdater.checkForUpdates({ silent: true });
    cachedUpdateInfo = info;
    if (info?.updateAvailable) {
      sendMain("update-available", info);
      notifyInGameUpdate(info, { force: reason === "bridge" || reason === "startup" });
    } else if (info && info.updateAvailable === false) {
      // Only clear the sticky nag when we positively know there is no update.
      if (pendingInGameUpdateVer) {
        enqueue(`notify_update_clear|${menu?.settings?.peer ?? 0}`);
      }
      pendingInGameUpdateVer = "";
      lastInGameUpdateNotify = "";
    }
  } catch (err) {
    console.error("[StormPower] update check failed:", err?.message || err);
  }
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
    const now = Date.now();
    const justConnected = !bridgeWasConnected || now - lastStatus.lastPoll > 20000;
    lastStatus.connected = true;
    lastStatus.lastPoll = now;
    bridgeWasConnected = true;
    sendMain("bridge-status", lastStatus);

    // When the game first connects (or reconnects), push any pending update notify
    if (justConnected && pendingInGameUpdateVer) {
      notifyInGameUpdate({ latest: pendingInGameUpdateVer }, { force: true });
    } else if (pendingInGameUpdateVer && now - lastInGameUpdateSentAt >= UPDATE_INGAME_RESEND_MS) {
      notifyInGameUpdate({ latest: pendingInGameUpdateVer });
    }

    if (!commandQueue.length) {
      res.type("text/plain").send("NONE");
      return;
    }
    res.type("text/plain").send(commandQueue.shift());
  });

    api.get("/sw/ping", (_req, res) => res.type("text/plain").send("OK"));

    api.get("/sw/live", (_req, res) => {
      res.json(liveMemory.getStatus());
    });

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
    height: mainWindowHeight(),
    resizable: true,
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
    minWidth: WIN_W,
    maxWidth: WIN_W,
    minHeight: 860,
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
  let img = nativeImage.createEmpty();
  const ico = iconPath();
  if (ico) {
    try {
      img = nativeImage.createFromPath(ico);
      if (!img.isEmpty() && (img.getSize().width > 16 || img.getSize().height > 16)) {
        img = img.resize({ width: 16, height: 16 });
      }
    } catch (_) {}
  }
  if (img.isEmpty()) {
    img = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGD4z0ABYBzVMKoBAw0M/kP4jGQbQJYGkhWQZQDlBqB7gFEOYBoAAGmWAxXQvYJvAAAAAElFTkSuQmCC"
    );
  }
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

  syncStormworksAddon();
  cleanupLeftoverInstallers();

  menu = createMenuEngine({
    enqueue,
    onChange: onMenuChange,
    onSideChange: (side) => placeWindows(side),
    onToggle: (key, on) => {
      if (key === "overrev_engine") {
        if (on) liveMemory.startEngineLive();
        else liveMemory.stopEngineLive();
      }
      if (key === "massive_waves" || key === "ultra_waves") {
        if (on) liveMemory.startWaves(waveConfigFromSettings());
        else liveMemory.stopWaves();
      }
    },
    onSettingChange: (key, value) => {
      if (key === "wind_speed") {
        const w = Math.max(0, Number(value) || 0);
        if (w <= 1) {
          enqueue(`wind|${menu?.settings?.peer ?? 0}|${w}`);
        } else {
          enqueue(`ultra_wind|${menu?.settings?.peer ?? 0}|${w}`);
        }
        return;
      }
      if (key.startsWith("wave_")) {
        const cfg = waveConfigFromSettings({ [key]: value });
        liveMemory.setWaveConfig(cfg);
        const bearing =
          cfg.dir === "ahead" ? -1 : cfg.dir === "random" ? -2 : cfg.dir === "surround" ? -1 : ({ N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 }[cfg.dir] ?? -1);
        enqueue(
          `wave_cfg|${menu?.settings?.peer ?? 0}|${Math.round(cfg.dist)}|${bearing}|${Math.round(
            cfg.intervalMs / 1000 * 60
          )}`
        );
      }
    },
    onLocalAction: async (action, { on }) => {
      if (action === "wave_engine") {
        if (on) {
          const st = liveMemory.startWaves(waveConfigFromSettings());
          return {
            ok: true,
            installed: true,
            message: `Wave engine ON — ${st.config.height}x every ${Math.round(
              st.config.intervalMs / 1000
            )}s`,
          };
        }
        liveMemory.stopWaves();
        return { ok: true, installed: false, message: "Wave engine OFF — seas cleared" };
      }
      if (action === "wave_once") {
        liveMemory.setWaveConfig(waveConfigFromSettings());
        const res = await liveMemory.pulseOnce();
        return { ok: true, message: res.message || "Wave spawned" };
      }
      if (action === "wave_clear") {
        liveMemory.stopWaves();
        menu.setToggle("wave_engine", false);
        menu.setToggle("massive_waves", false);
        menu.setToggle("ultra_waves", false);
        return { ok: true, message: "Waves cleared" };
      }
      if (action === "spawn_tornado") {
        const tier = Math.max(0, Math.min(4, Math.floor(Number(menu.settings.tornado_tier) || 3)));
        const res = tornadoMod.applyTier(tier);
        if (!res.ok) return res;
        if (res.map) {
          liveMemory.patchFloatMap(res.map).catch(() => {});
          // Hold the new radii/winds in RAM so the spawn reads buffed values
          setTimeout(() => liveMemory.patchFloatMap(res.map).catch(() => {}), 80);
          setTimeout(() => liveMemory.patchFloatMap(res.map).catch(() => {}), 250);
        }
        const count = Math.max(1, Math.min(8, Math.floor(Number(menu.settings.count) || 1)));
        const dist = menu.settings.dist || 200;
        const peer = menu.settings.peer ?? 0;
        for (let i = 0; i < count; i++) {
          enqueue(`disaster|${peer}|tornado|${dist}`);
        }
        return {
          ok: true,
          message: `Spawned ${count}× tornado (${tornadoMod.tierLabel(tier)})`,
        };
      }
      if (action === "engine_mod") {
        const res = engineMod.setInstalled(!!on);
        return res;
      }
      if (action === "overrev_engine") {
        const res = engineMod.setOverrevInstalled(!!on);
        if (on) {
          liveMemory.startEngineLive();
          if (res && res.ok) {
            res.message = "Overrev LIVE — patching engine force in RAM (no restart)";
          }
        } else {
          liveMemory.stopEngineLive();
        }
        return res;
      }
      if (action === "check_updates") {
        const info = await appUpdater.checkForUpdates({ silent: false });
        cachedUpdateInfo = info;
        if (info?.updateAvailable) {
          sendMain("update-available", info);
          notifyInGameUpdate(info, { force: true });
          openUpdateScreen(info);
          return { ok: true, message: info.message || `Update v${info.latest}` };
        }
        return { ok: true, message: info?.message || "Up to date" };
      }
      return { ok: false, message: "Unknown action" };
    },
  });

  liveMemory.configure({
    enqueue,
    getPeer: () => menu?.settings?.peer ?? 0,
  });
  liveMemory.setWaveConfig(waveConfigFromSettings());

  // Wave engine ON by default
  try {
    liveMemory.startWaves(waveConfigFromSettings());
    menu.setToggle("wave_engine", true);
  } catch (_) {}

  try {
    // The old 900m shader only scaled the *visuals*; physics stayed at stock, so
    // giant-looking waves passed through boats. Height now comes from the live
    // magnitude lock, which drives physics and visuals together.
    const em = engineMod.isInstalled();
    menu.setToggle("engine_mod", false);
    if (em.installed) {
      engineMod.uninstall();
    }
    const overrev = engineMod.isOverrevInstalled();
    menu.setToggle("overrev_engine", !!overrev.installed);
    if (overrev.installed) liveMemory.startEngineLive();
  } catch (_) {}

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

  await pollForUpdates("startup");
  setInterval(() => {
    pollForUpdates("interval");
    cleanupLeftoverInstallers();
  }, UPDATE_POLL_MS);

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
  try {
    liveMemory.shutdown();
  } catch (_) {}
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("get-config", () => ({
  port: PORT,
  toggleKey: "F4 / Insert / F8",
  width: WIN_W,
  height: mainWindowHeight(),
  product: "StormPower",
  studio: "Aimless Developement",
  version: readVersion(),
  detached,
  updateAvailable: !!(cachedUpdateInfo && cachedUpdateInfo.updateAvailable),
  state: menu ? menu.getSnapshot() : null,
}));

ipcMain.handle("get-state", () => (menu ? menu.getSnapshot() : null));
ipcMain.on("nav", (_e, action) => menu && menu.handleNav(action));
ipcMain.on("toggle-menu", () => menu && menu.toggleOpen());
ipcMain.on("set-open", (_e, open) => menu && menu.setOpen(!!open));
ipcMain.on("update-settings", (_e, partial) => menu && menu.updateSettings(partial || {}));
ipcMain.on("set-search", (_e, q) => menu && menu.setSearch(q));
ipcMain.on("stm", (_e, dir) => menu && menu.stm(dir));
ipcMain.on("stm-at", (_e, idx, dir) => menu && menu.stmAt(Number(idx), dir));
ipcMain.on("activate-index", (_e, idx) => menu && menu.selectIndex(Number(idx)));
ipcMain.on("focus-index", (_e, idx) => menu && menu.focusIndex(Number(idx)));
ipcMain.on("back", () => menu && menu.handleNav("back"));
ipcMain.on("set-detached", (_e, on) => setDetached(!!on));
ipcMain.on("queue-command", (_e, line) => enqueue(line));
ipcMain.handle("check-updates", async () => {
  cachedUpdateInfo = await appUpdater.checkForUpdates({ silent: false });
  if (cachedUpdateInfo?.updateAvailable) notifyInGameUpdate(cachedUpdateInfo);
  return cachedUpdateInfo;
});
ipcMain.handle("apply-update", async () => {
  // Prefer the changelog screen over silent apply
  openUpdateScreen(cachedUpdateInfo);
  return { openedUi: true, ...(cachedUpdateInfo || {}) };
});
ipcMain.handle("open-update-ui", async () => {
  const info = cachedUpdateInfo || (await appUpdater.checkForUpdates({ silent: true }));
  cachedUpdateInfo = info;
  openUpdateScreen(info);
  return info;
});
ipcMain.handle("update-ui-info", async () => {
  if (cachedUpdateInfo) return cachedUpdateInfo;
  cachedUpdateInfo = await appUpdater.checkForUpdates({ silent: false });
  return cachedUpdateInfo;
});
ipcMain.handle("update-ui-apply", async () => {
  const progress = (message) => {
    const msg = typeof message === "string" ? message : message?.message || "";
    sendUpdate("update-progress", { message: msg });
  };

  if (isPackaged()) {
    try {
      appUpdater.setProgressHandler(progress);
      const result = await appUpdater.downloadAndInstall(progress);
      return result;
    } catch (err) {
      console.error("[StormPower] packaged update failed", err);
      return { applied: false, message: String(err.message || err) };
    }
  }

  // Loose/dev folder install: stage zip then quit for finish-update
  const root = projectRoot();
  const script = path.join(__dirname, "run-update-and-relaunch.js");
  try {
    await checkZipUpdates({ silent: false, apply: true, onProgress: progress });
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
    message: "Closing StormPower to install the update...",
  };
});
ipcMain.on("update-ui-close", () => {
  if (updateWindow && !updateWindow.isDestroyed()) updateWindow.close();
  else if (UPDATE_UI_ONLY) app.quit();
});
ipcMain.on("update-ui-restart", () => {
  if (isPackaged()) {
    appUpdater
      .downloadAndInstall((message) => {
        const msg = typeof message === "string" ? message : message?.message || "";
        sendUpdate("update-progress", { message: msg });
      })
      .catch((err) => console.error("[StormPower] restart-update failed", err));
    return;
  }
  const root = projectRoot();
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
  return readAppVersion();
}
