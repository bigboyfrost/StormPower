/**
 * Live Stormworks memory patcher (Cheat Engine–style).
 * Writes process RAM so Mega Waves / Overrev apply without restarting the game.
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Unique mag under the Lua API's 0–1 clamp so we can Exact-Value scan it, then overwrite.
const WAVE_MARKER = 0.814759;
const WAVE_LIVE_MAG = 40.0; // ~40× max API tsunami with stock shader

// Distinctive engine_max_force only. Never 20000 — same bits as radar_range and other data.
const ENGINE_TARGETS = [
  { from: 60000, to: 1500000 }, // Medium Engine 25×
  { from: 200000, to: 5000000 }, // Large Engine 25×
  { from: 1500000, to: 1500000 },
  { from: 5000000, to: 5000000 },
  { from: 500000, to: 500000 }, // small file-patched 25× after restart
];

let waveTimer = null;
let engineTimer = null;
let waveEnabled = false;
let engineEnabled = false;
let lastWave = { ok: false, message: "idle", hits: 0 };
let lastEngine = { ok: false, message: "idle", writes: 0 };

function helperScriptPath() {
  return path.join(__dirname, "StormPowerMem.ps1");
}

function runHelper(args, timeoutMs = 45000) {
  return new Promise((resolve) => {
    const ps1 = helperScriptPath();
    if (!fs.existsSync(ps1)) {
      resolve({ ok: false, error: "StormPowerMem.ps1 missing" });
      return;
    }
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, ...args],
      { windowsHide: true }
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_) {}
      resolve({ ok: false, error: "memory helper timed out", raw: out });
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      out += d.toString("utf8");
    });
    child.stderr.on("data", (d) => {
      err += d.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = (out || "").trim();
      const brace = text.indexOf("{");
      try {
        const json = JSON.parse(brace >= 0 ? text.slice(brace) : text);
        resolve(json);
      } catch (_) {
        resolve({
          ok: false,
          error: err || text || `helper exit ${code}`,
          raw: text,
        });
      }
    });
  });
}

async function patchWavesOnce() {
  const res = await runHelper([
    "-Action",
    "wave",
    "-Find",
    String(WAVE_MARKER),
    "-Write",
    String(WAVE_LIVE_MAG),
  ]);
  lastWave = {
    ok: !!res.ok,
    message: res.message || res.error || "wave patch",
    hits: res.hits || 0,
    writes: res.writes || 0,
    frozen: res.frozen || 0,
  };
  return lastWave;
}

async function patchEnginesOnce() {
  const map = ENGINE_TARGETS.map((t) => `${t.from}:${t.to}`).join(",");
  const res = await runHelper(["-Action", "engine", "-Map", map], 90000);
  lastEngine = {
    ok: !!res.ok,
    message: res.message || res.error || "engine patch",
    hits: res.hits || 0,
    writes: res.writes || 0,
  };
  return lastEngine;
}

function startWaveLive() {
  waveEnabled = true;
  if (waveTimer) return getStatus();
  const tick = async () => {
    if (!waveEnabled) return;
    try {
      await patchWavesOnce();
    } catch (_) {}
  };
  setTimeout(tick, 400);
  setTimeout(tick, 1500);
  setTimeout(tick, 3500);
  waveTimer = setInterval(tick, 2000);
  return getStatus();
}

function stopWaveLive() {
  waveEnabled = false;
  if (waveTimer) {
    clearInterval(waveTimer);
    waveTimer = null;
  }
  runHelper(["-Action", "wave-clear"]).catch(() => {});
  lastWave = { ok: true, message: "wave live OFF", hits: 0 };
  return getStatus();
}

function startEngineLive() {
  engineEnabled = true;
  if (engineTimer) return getStatus();
  const tick = async () => {
    if (!engineEnabled) return;
    try {
      await patchEnginesOnce();
    } catch (_) {}
  };
  setTimeout(tick, 200);
  engineTimer = setInterval(tick, 5000);
  return getStatus();
}

function stopEngineLive() {
  engineEnabled = false;
  if (engineTimer) {
    clearInterval(engineTimer);
    engineTimer = null;
  }
  lastEngine = { ok: true, message: "engine live OFF", hits: 0, writes: 0 };
  return getStatus();
}

function getStatus() {
  return {
    waveEnabled,
    engineEnabled,
    waveMarker: WAVE_MARKER,
    waveLiveMag: WAVE_LIVE_MAG,
    lastWave,
    lastEngine,
  };
}

module.exports = {
  WAVE_MARKER,
  WAVE_LIVE_MAG,
  startWaveLive,
  stopWaveLive,
  startEngineLive,
  stopEngineLive,
  patchWavesOnce,
  patchEnginesOnce,
  getStatus,
};
