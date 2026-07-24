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
    backup: path.join(sw, "rom", "stormpower_backup"),
    marker: path.join(sw, "rom", "stormpower_backup", "INSTALLED.txt"),
  };
}

function isInstalled() {
  const sw = findStormworks();
  if (!sw) return { installed: false, stormworks: null, reason: "Stormworks not found" };
  const p = pathsFor(sw);
  const installed = fs.existsSync(p.marker);
  return { installed, stormworks: sw, paths: p };
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
    message: "Mega-wave engine ON (~45% taller crests) — restart Stormworks",
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

module.exports = {
  engineModRoot,
  findStormworks,
  isInstalled,
  install,
  uninstall,
  setInstalled,
};
