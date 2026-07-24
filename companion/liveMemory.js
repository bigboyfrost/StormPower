/**
 * Live Stormworks memory control (Cheat Engine style) + the wave pulse engine.
 *
 * A persistent PowerShell daemon keeps the process handle and the address cache
 * hot, so holding a wave costs milliseconds. Two daemons are used: wave work must
 * never wait behind a slow full-memory engine scan.
 *
 * PowerShell cannot execute a script from inside app.asar, so the helper is always
 * materialized to %TEMP% first.
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const WAVE_MARKER = 0.814759;

// Distinctive engine_max_force values only (20000 collides with radar_range).
const ENGINE_TARGETS = [
  { from: 60000, to: 1500000 },
  { from: 200000, to: 5000000 },
  { from: 1500000, to: 1500000 },
  { from: 5000000, to: 5000000 },
  { from: 500000, to: 500000 },
];

const cfg = {
  height: 10,
  intervalMs: 12000,
  dist: 250,
  dir: "ahead",
};

const hooks = {
  enqueue: null,
  getPeer: () => 0,
};

let helperReadyPath = null;
let waveEnabled = false;
let engineEnabled = false;
let pulseTimer = null;
let freezeTimer = null;
let engineTimer = null;
let pulseBusy = false;
let surroundStep = 0;
let lastWave = { ok: false, message: "idle", locked: 0 };
let lastEngine = { ok: false, message: "idle", writes: 0 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function candidateHelperSources() {
  const list = [];
  try {
    if (process.resourcesPath) {
      list.push(path.join(process.resourcesPath, "StormPowerMem.ps1"));
      list.push(path.join(process.resourcesPath, "companion", "StormPowerMem.ps1"));
    }
  } catch (_) {}
  list.push(path.join(__dirname, "StormPowerMem.ps1"));
  return list;
}

function ensureHelperOnDisk() {
  if (helperReadyPath && fs.existsSync(helperReadyPath)) return helperReadyPath;
  let body = null;
  for (const c of candidateHelperSources()) {
    try {
      if (!fs.existsSync(c)) continue;
      body = fs.readFileSync(c, "utf8");
      break;
    } catch (_) {}
  }
  if (!body) throw new Error("StormPowerMem.ps1 missing from install");
  const dest = path.join(os.tmpdir(), "StormPowerMem.ps1");
  fs.writeFileSync(dest, body, "utf8");
  helperReadyPath = dest;
  return dest;
}

/** Request/response channel over a long-lived PowerShell daemon. */
function createChannel(label) {
  let child = null;
  let buffer = "";
  let waiters = [];
  let chain = Promise.resolve();
  let ready = false;

  function kill() {
    ready = false;
    const dead = child;
    child = null;
    buffer = "";
    for (const w of waiters.splice(0)) w.reject(new Error("daemon closed"));
    if (dead) {
      try {
        dead.kill();
      } catch (_) {}
    }
  }

  function ensure() {
    if (child && ready) return;
    if (child) return;
    const ps1 = ensureHelperOnDisk();
    child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Action", "daemon"],
      { windowsHide: true }
    );
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        let json;
        try {
          json = JSON.parse(line);
        } catch (_) {
          continue;
        }
        if (!ready) {
          ready = true;
          continue;
        }
        const w = waiters.shift();
        if (w) w.resolve(json);
      }
    });
    child.stderr.on("data", (d) => {
      console.error(`[StormPower ${label}]`, d.toString("utf8").trim());
    });
    child.on("close", () => kill());
    child.on("error", () => kill());
  }

  function raw(cmd, timeoutMs) {
    return new Promise((resolve) => {
      try {
        ensure();
      } catch (err) {
        resolve({ ok: false, error: String(err.message || err) });
        return;
      }
      if (!child) {
        resolve({ ok: false, error: "daemon unavailable" });
        return;
      }
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        // A hung scan means the handle is wedged; restart the daemon.
        kill();
        resolve({ ok: false, error: "memory daemon timeout" });
      }, timeoutMs);
      waiters.push({
        resolve: (json) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(json);
        },
        reject: () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ ok: false, error: "daemon closed" });
        },
      });
      try {
        child.stdin.write(cmd + "\n");
      } catch (err) {
        resolve({ ok: false, error: String(err.message || err) });
      }
    });
  }

  return {
    send(cmd, timeoutMs = 10000) {
      chain = chain.then(() => raw(cmd, timeoutMs)).catch(() => ({ ok: false, error: "channel error" }));
      return chain;
    },
    stop: kill,
  };
}

const waveChannel = createChannel("wave");
const engineChannel = createChannel("engine");

function configure(opts = {}) {
  if (typeof opts.enqueue === "function") hooks.enqueue = opts.enqueue;
  if (typeof opts.getPeer === "function") hooks.getPeer = opts.getPeer;
}

function setWaveConfig(partial = {}) {
  if (partial.height !== undefined) {
    const h = Number(partial.height);
    if (Number.isFinite(h) && h > 0) cfg.height = h;
  }
  if (partial.intervalMs !== undefined) {
    const i = Number(partial.intervalMs);
    if (Number.isFinite(i) && i >= 2000) cfg.intervalMs = i;
  }
  if (partial.dist !== undefined) {
    const d = Number(partial.dist);
    if (Number.isFinite(d) && d >= 80) cfg.dist = d;
  }
  if (partial.dir !== undefined) cfg.dir = String(partial.dir);

  waveChannel.send(`set ${WAVE_MARKER} ${cfg.height}`).catch(() => {});

  if (waveEnabled && partial.intervalMs !== undefined && pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = setInterval(runPulse, cfg.intervalMs);
  }
  return getStatus();
}

const COMPASS = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 };

function bearingForPulse() {
  const dir = String(cfg.dir || "ahead").toLowerCase();
  if (dir === "ahead") return -1;
  if (dir === "random") return -2;
  if (dir === "surround") {
    const bearing = (surroundStep % 8) * 45;
    surroundStep += 3; // 135° apart: consecutive walls hit from very different sides
    return bearing;
  }
  if (COMPASS[dir] !== undefined) return COMPASS[dir];
  const n = Number(dir);
  return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : -1;
}

function spawnWaveCommand(bearing) {
  if (typeof hooks.enqueue !== "function") return;
  const peer = hooks.getPeer();
  hooks.enqueue(`mega_wave|${peer}|${Math.round(cfg.dist)}|${bearing}`);
}

async function runPulse() {
  if (!waveEnabled || pulseBusy) return;
  pulseBusy = true;
  try {
    // Drop the held magnitude to 0 first: the game ignores a new tsunami that is
    // weaker than the active one, which is why a frozen wave blocked every respawn.
    await waveChannel.send("release", 8000);
    spawnWaveCommand(bearingForPulse());

    for (let i = 0; i < 10 && waveEnabled; i++) {
      await sleep(150);
      const res = await waveChannel.send("freeze", 8000);
      if (res && res.locked > 0) {
        lastWave = { ok: true, message: res.message, locked: res.locked };
        return;
      }
    }
    // Cache miss (first run, or the game moved the event): pay for a full scan once.
    const scan = await waveChannel.send("scan", 90000);
    lastWave = {
      ok: !!scan.ok,
      message: scan.message || scan.error || "scan",
      locked: scan.locked || 0,
    };
  } finally {
    pulseBusy = false;
  }
}

async function freezeTick() {
  if (!waveEnabled || pulseBusy) return;
  const res = await waveChannel.send("freeze", 8000);
  if (res && (res.locked || res.message)) {
    lastWave = {
      ok: !!res.ok,
      message: res.message || res.error || "freeze",
      locked: res.locked || 0,
    };
  }
}

function startWaves(partial) {
  if (partial) setWaveConfig(partial);
  waveEnabled = true;
  waveChannel.send(`set ${WAVE_MARKER} ${cfg.height}`).catch(() => {});
  if (!pulseTimer) {
    runPulse();
    pulseTimer = setInterval(runPulse, cfg.intervalMs);
  }
  if (!freezeTimer) freezeTimer = setInterval(freezeTick, 400);
  return getStatus();
}

function stopWaves({ clearCache = true } = {}) {
  waveEnabled = false;
  if (pulseTimer) {
    clearInterval(pulseTimer);
    pulseTimer = null;
  }
  if (freezeTimer) {
    clearInterval(freezeTimer);
    freezeTimer = null;
  }
  // Release first so the Lua cancel is not fighting a frozen magnitude.
  waveChannel.send(clearCache ? "forget" : "release", 8000).catch(() => {});
  if (typeof hooks.enqueue === "function") {
    hooks.enqueue(`wave_clear|${hooks.getPeer()}`);
  }
  lastWave = { ok: true, message: "waves cleared", locked: 0 };
  return getStatus();
}

/** One wave right now, using current height/direction, without starting the loop. */
async function pulseOnce() {
  waveChannel.send(`set ${WAVE_MARKER} ${cfg.height}`).catch(() => {});
  await waveChannel.send("release", 8000);
  spawnWaveCommand(bearingForPulse());
  for (let i = 0; i < 10; i++) {
    await sleep(150);
    const res = await waveChannel.send("freeze", 8000);
    if (res && res.locked > 0) {
      lastWave = { ok: true, message: res.message, locked: res.locked };
      if (!freezeTimer) freezeTimer = setInterval(freezeTick, 400);
      return lastWave;
    }
  }
  const scan = await waveChannel.send("scan", 90000);
  lastWave = { ok: !!scan.ok, message: scan.message || scan.error || "scan", locked: scan.locked || 0 };
  if (!freezeTimer && lastWave.locked > 0) freezeTimer = setInterval(freezeTick, 400);
  return lastWave;
}

async function patchEnginesOnce() {
  const map = ENGINE_TARGETS.map((t) => `${t.from}:${t.to}`).join(",");
  const res = await engineChannel.send(`engine ${map}`, 120000);
  lastEngine = {
    ok: !!res.ok,
    message: res.message || res.error || "engine patch",
    writes: res.writes || 0,
  };
  return lastEngine;
}

function startEngineLive() {
  engineEnabled = true;
  if (engineTimer) return getStatus();
  const tick = () => {
    if (!engineEnabled) return;
    patchEnginesOnce().catch(() => {});
  };
  tick();
  engineTimer = setInterval(tick, 15000);
  return getStatus();
}

function stopEngineLive() {
  engineEnabled = false;
  if (engineTimer) {
    clearInterval(engineTimer);
    engineTimer = null;
  }
  lastEngine = { ok: true, message: "engine live OFF", writes: 0 };
  return getStatus();
}

function getStatus() {
  return {
    waveEnabled,
    engineEnabled,
    marker: WAVE_MARKER,
    config: { ...cfg },
    lastWave,
    lastEngine,
  };
}

function shutdown() {
  stopWaves({ clearCache: false });
  stopEngineLive();
  waveChannel.stop();
  engineChannel.stop();
}

function patchFloatMap(map, timeoutMs = 120000) {
  return engineChannel.send(`engine ${map}`, timeoutMs);
}

module.exports = {
  WAVE_MARKER,
  configure,
  setWaveConfig,
  startWaves,
  stopWaves,
  pulseOnce,
  startEngineLive,
  stopEngineLive,
  patchEnginesOnce,
  patchFloatMap,
  getStatus,
  shutdown,
  ensureHelperOnDisk,
};
