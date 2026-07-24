/**
 * Live Stormworks memory patcher (Cheat Engine–style).
 * Writes process RAM so Mega Waves / Overrev apply without restarting the game.
 *
 * IMPORTANT: PowerShell cannot execute scripts from inside app.asar — we always
 * materialize StormPowerMem.ps1 to %TEMP% (or extraResources) before spawning.
 */
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
// note: do not require("electron").app here — helper path uses process.resourcesPath

// Unique mag under the Lua API's 0–1 clamp so we can Exact-Value scan it, then overwrite.
const WAVE_MARKER = 0.814759;
const WAVE_LIVE_MAG = 120.0; // boat-wrecking crest vs stock max (~1)

// Distinctive engine_max_force only. Never 20000 — same bits as radar_range.
const ENGINE_TARGETS = [
  { from: 60000, to: 1500000 },
  { from: 200000, to: 5000000 },
  { from: 1500000, to: 1500000 },
  { from: 5000000, to: 5000000 },
  { from: 500000, to: 500000 },
];

let waveTimer = null;
let waveScanTimer = null;
let engineTimer = null;
let waveEnabled = false;
let engineEnabled = false;
let lastWave = { ok: false, message: "idle", hits: 0 };
let lastEngine = { ok: false, message: "idle", writes: 0 };
let helperReadyPath = null;
let waveBusy = false;
let engineBusy = false;

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

  const dest = path.join(os.tmpdir(), "StormPowerMem.ps1");
  let src = null;
  let body = null;

  for (const c of candidateHelperSources()) {
    try {
      if (!fs.existsSync(c)) continue;
      // Paths inside app.asar: Node can read; external PS cannot execute.
      body = fs.readFileSync(c, "utf8");
      src = c;
      break;
    } catch (_) {}
  }

  if (!body) {
    throw new Error("StormPowerMem.ps1 missing from install");
  }

  // Always write to TEMP so powershell -File gets a real Win32 path.
  fs.writeFileSync(dest, body, "utf8");
  helperReadyPath = dest;
  return dest;
}

function runHelper(args, timeoutMs = 20000) {
  return new Promise((resolve) => {
    let ps1;
    try {
      ps1 = ensureHelperOnDisk();
    } catch (err) {
      resolve({ ok: false, error: String(err.message || err) });
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

async function patchWavesOnce(mode = "wave") {
  // "wave-freeze" = fast rewrite of known addresses only
  // "wave" = freeze + scan for new marker (slower)
  const res = await runHelper(
    ["-Action", mode, "-Find", String(WAVE_MARKER), "-Write", String(WAVE_LIVE_MAG)],
    mode === "wave-freeze" ? 8000 : 45000
  );
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

  const freezeTick = async () => {
    if (!waveEnabled || waveBusy) return;
    waveBusy = true;
    try {
      await patchWavesOnce("wave-freeze");
    } catch (_) {}
    waveBusy = false;
  };
  const scanTick = async () => {
    if (!waveEnabled || waveBusy) return;
    waveBusy = true;
    try {
      await patchWavesOnce("wave");
    } catch (_) {}
    waveBusy = false;
  };

  // Immediate hard scan, then keep magnitude locked hard.
  setTimeout(scanTick, 200);
  setTimeout(scanTick, 1000);
  setTimeout(scanTick, 2500);
  waveTimer = setInterval(freezeTick, 400);
  waveScanTimer = setInterval(scanTick, 2500);
  return getStatus();
}

function stopWaveLive() {
  waveEnabled = false;
  if (waveTimer) {
    clearInterval(waveTimer);
    waveTimer = null;
  }
  if (waveScanTimer) {
    clearInterval(waveScanTimer);
    waveScanTimer = null;
  }
  runHelper(["-Action", "wave-clear"]).catch(() => {});
  lastWave = { ok: true, message: "wave live OFF", hits: 0 };
  return getStatus();
}

function startEngineLive() {
  engineEnabled = true;
  if (engineTimer) return getStatus();
  const tick = async () => {
    if (!engineEnabled || engineBusy) return;
    engineBusy = true;
    try {
      await patchEnginesOnce();
    } catch (_) {}
    engineBusy = false;
  };
  setTimeout(tick, 200);
  engineTimer = setInterval(tick, 4000);
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
  let helperPath = null;
  try {
    helperPath = ensureHelperOnDisk();
  } catch (err) {
    helperPath = String(err.message || err);
  }
  return {
    waveEnabled,
    engineEnabled,
    waveMarker: WAVE_MARKER,
    waveLiveMag: WAVE_LIVE_MAG,
    helperPath,
    lastWave,
    lastEngine,
  };
}

/** Call when a sea/mega_wave command is queued so we re-scan immediately. */
function kickWaveScan() {
  if (!waveEnabled) startWaveLive();
  patchWavesOnce("wave").catch(() => {});
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
  kickWaveScan,
  getStatus,
  ensureHelperOnDisk,
};
