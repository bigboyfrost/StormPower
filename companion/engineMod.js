/**
 * Install / uninstall StormPower mega-wave engine mod into Stormworks rom/.
 * Pure Node — no bat scripts required (menu-driven).
 */
const fs = require("fs");
const path = require("path");
const { app } = require("electron");
const { isPackaged, projectRoot } = require("./paths");

function engineModRoot() {
  if (isPackaged()) {
    return path.join(process.resourcesPath, "engine-mod");
  }
  return path.join(projectRoot(), "engine-mod");
}

function findStormworks() {
  if (process.env.STORMPOWORKS_PATH && fs.existsSync(process.env.STORMPOWORKS_PATH)) {
    return process.env.STORMPOWORKS_PATH;
  }

  const candidates = [];
  try {
    const Registry = require("child_process").execSync(
      'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
      { encoding: "utf8" }
    );
    const m = Registry.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) {
      const steam = m[1].trim().replace(/\//g, "\\");
      const vdf = path.join(steam, "steamapps", "libraryfolders.vdf");
      if (fs.existsSync(vdf)) {
        const raw = fs.readFileSync(vdf, "utf8");
        for (const match of raw.matchAll(/"path"\s+"([^"]+)"/g)) {
          const lib = match[1].replace(/\\\\/g, "\\");
          candidates.push(path.join(lib, "steamapps", "common", "Stormworks"));
        }
      }
      candidates.push(path.join(steam, "steamapps", "common", "Stormworks"));
    }
  } catch (_) {}

  candidates.push(
    path.join(process.env["ProgramFiles(x86)"] || "", "Steam", "steamapps", "common", "Stormworks"),
    path.join(process.env.ProgramFiles || "", "Steam", "steamapps", "common", "Stormworks"),
    "D:\\SteamLibrary\\steamapps\\common\\Stormworks",
    "E:\\SteamLibrary\\steamapps\\common\\Stormworks",
    "V:\\SteamLibrary\\steamapps\\common\\Stormworks"
  );

  for (const p of candidates) {
    if (!p) continue;
    if (fs.existsSync(path.join(p, "stormworks64.exe")) || fs.existsSync(path.join(p, "stormworks.exe"))) {
      return p;
    }
  }
  return null;
}

function pathsFor(sw) {
  return {
    shader: path.join(sw, "rom", "graphics", "shaders", "ocean_common.glslh"),
    env: path.join(sw, "rom", "data", "realtime_values", "environment.txt"),
    definitions: path.join(sw, "rom", "data", "definitions"),
    backup: path.join(sw, "rom", "stormpower_backup"),
    marker: path.join(sw, "rom", "stormpower_backup", "INSTALLED.txt"),
    overrevMarker: path.join(sw, "rom", "stormpower_backup", "OVERREV_INSTALLED.txt"),
  };
}

const OVERREV_DEFINITIONS = [
  "engine.xml",
  "aircraft_engine.xml",
  "engine_diesel.xml",
  "modular_engine_cylinder_straight.xml",
  "modular_engine_piston_3x3.xml",
  "modular_engine_piston_5x5.xml",
];

function isInstalled() {
  const sw = findStormworks();
  if (!sw) return { installed: false, stormworks: null, reason: "Stormworks not found" };
  const p = pathsFor(sw);
  const installed = fs.existsSync(p.marker);
  return { installed, stormworks: sw, paths: p };
}

function isOverrevInstalled() {
  const sw = findStormworks();
  if (!sw) return { installed: false, stormworks: null, reason: "Stormworks not found" };
  const p = pathsFor(sw);
  return {
    installed: fs.existsSync(p.overrevMarker),
    stormworks: sw,
    paths: p,
  };
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function install() {
  const status = isInstalled();
  if (!status.stormworks) {
    return { ok: false, message: "Stormworks not found. Set STORMPOWORKS_PATH if needed." };
  }
  const mod = engineModRoot();
  const shaderSrc = path.join(mod, "shaders", "ocean_common.glslh");
  const envSrc = path.join(mod, "realtime_values", "environment.txt");
  if (!fs.existsSync(shaderSrc) || !fs.existsSync(envSrc)) {
    return { ok: false, message: "engine-mod files missing from StormPower install" };
  }

  const p = status.paths;
  ensureDir(p.backup);
  if (!fs.existsSync(path.join(p.backup, "ocean_common.glslh"))) {
    copyFile(p.shader, path.join(p.backup, "ocean_common.glslh"));
  }
  if (!fs.existsSync(path.join(p.backup, "environment.txt"))) {
    copyFile(p.env, path.join(p.backup, "environment.txt"));
  }

  copyFile(shaderSrc, p.shader);
  copyFile(envSrc, p.env);
  fs.writeFileSync(p.marker, `StormPower mega-wave mod ${new Date().toISOString()}\n`, "utf8");

  return {
    ok: true,
    installed: true,
    message: "Mega-wave engine ON (localized island-scale wall) — restart Stormworks",
    stormworks: status.stormworks,
  };
}

function uninstall() {
  const status = isInstalled();
  if (!status.stormworks) {
    return { ok: false, message: "Stormworks not found" };
  }
  const p = status.paths;
  const mod = engineModRoot();
  let shaderSrc = path.join(p.backup, "ocean_common.glslh");
  let envSrc = path.join(p.backup, "environment.txt");
  if (!fs.existsSync(shaderSrc)) shaderSrc = path.join(mod, "stock", "shaders", "ocean_common.glslh");
  if (!fs.existsSync(envSrc)) envSrc = path.join(mod, "stock", "realtime_values", "environment.txt");

  if (!fs.existsSync(shaderSrc) || !fs.existsSync(envSrc)) {
    return {
      ok: false,
      message: "No backup found — use Steam Verify integrity to restore",
    };
  }

  copyFile(shaderSrc, p.shader);
  copyFile(envSrc, p.env);
  try {
    fs.unlinkSync(p.marker);
  } catch (_) {}

  return {
    ok: true,
    installed: false,
    message: "Mega-wave engine OFF — restart Stormworks",
    stormworks: status.stormworks,
  };
}

function setInstalled(wantOn) {
  if (wantOn) return install();
  return uninstall();
}

function installOverrev() {
  const status = isOverrevInstalled();
  if (!status.stormworks) {
    return { ok: false, installed: false, message: "Stormworks not found" };
  }

  const p = status.paths;
  const backupDir = path.join(p.backup, "definitions");
  ensureDir(backupDir);
  let patched = 0;

  for (const name of OVERREV_DEFINITIONS) {
    const target = path.join(p.definitions, name);
    if (!fs.existsSync(target)) continue;
    const backup = path.join(backupDir, name);
    if (!fs.existsSync(backup)) copyFile(target, backup);

    // Always patch from the pristine backup, so repeated installs never multiply twice.
    const stock = fs.readFileSync(backup, "utf8");
    const boosted = stock.replace(/engine_max_force="([0-9.]+)"/, (_all, raw) => {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return _all;
      return `engine_max_force="${Math.round(value * 25)}"`;
    });
    if (boosted !== stock) {
      fs.writeFileSync(target, boosted, "utf8");
      patched += 1;
    }
  }

  if (!patched) {
    return {
      ok: false,
      installed: false,
      message: "No supported engine definitions were found",
    };
  }

  fs.writeFileSync(
    p.overrevMarker,
    `StormPower 25x engine torque ${new Date().toISOString()}\n`,
    "utf8"
  );
  return {
    ok: true,
    installed: true,
    message: `Overrev Power ON (${patched} engine types, 25x torque) — restart Stormworks`,
    stormworks: status.stormworks,
  };
}

function uninstallOverrev() {
  const status = isOverrevInstalled();
  if (!status.stormworks) {
    return { ok: false, installed: false, message: "Stormworks not found" };
  }

  const p = status.paths;
  const backupDir = path.join(p.backup, "definitions");
  let restored = 0;
  for (const name of OVERREV_DEFINITIONS) {
    const backup = path.join(backupDir, name);
    if (!fs.existsSync(backup)) continue;
    copyFile(backup, path.join(p.definitions, name));
    restored += 1;
  }
  try {
    fs.unlinkSync(p.overrevMarker);
  } catch (_) {}

  return {
    ok: restored > 0,
    installed: false,
    message:
      restored > 0
        ? `Overrev Power OFF (${restored} engine types restored) — restart Stormworks`
        : "No Overrev Power backups found; use Steam Verify integrity",
    stormworks: status.stormworks,
  };
}

function setOverrevInstalled(wantOn) {
  return wantOn ? installOverrev() : uninstallOverrev();
}

module.exports = {
  engineModRoot,
  findStormworks,
  isInstalled,
  install,
  uninstall,
  setInstalled,
  isOverrevInstalled,
  installOverrev,
  uninstallOverrev,
  setOverrevInstalled,
};
