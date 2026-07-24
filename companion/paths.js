/**
 * Resolve paths for both loose (dev / friend zip) and packaged (NSIS) installs.
 */
const { app } = require("electron");
const path = require("path");
const fs = require("fs");

function isPackaged() {
  return !!(app && app.isPackaged);
}

function projectRoot() {
  if (isPackaged()) {
    return path.dirname(app.getPath("exe"));
  }
  return path.resolve(__dirname, "..");
}

function addonDir() {
  if (isPackaged()) {
    return path.join(process.resourcesPath, "addon");
  }
  return path.join(projectRoot(), "addon");
}

function changelogPath() {
  if (isPackaged()) {
    return path.join(app.getAppPath(), "CHANGELOG.md");
  }
  return path.join(projectRoot(), "CHANGELOG.md");
}

function iconPath() {
  const candidates = [];
  if (isPackaged()) {
    candidates.push(path.join(process.resourcesPath, "icon.ico"));
    candidates.push(path.join(path.dirname(app.getPath("exe")), "icon.ico"));
  }
  candidates.push(path.join(projectRoot(), "build", "icon.ico"));
  candidates.push(path.join(projectRoot(), "build", "icon.png"));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function userSettingsPath() {
  return path.join(app.getPath("userData"), "user-settings.json");
}

function syncStormworksAddon() {
  try {
    const appData = process.env.APPDATA;
    if (!appData) return false;
    const dest = path.join(appData, "Stormworks", "data", "missions", "StormPower");
    fs.mkdirSync(dest, { recursive: true });
    const src = addonDir();
    let copied = false;
    for (const name of ["playlist.xml", "script.lua"]) {
      const from = path.join(src, name);
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, path.join(dest, name));
        copied = true;
      }
    }
    return copied;
  } catch (err) {
    console.error("[StormPower] addon sync failed:", err.message);
    return false;
  }
}

function readAppVersion() {
  try {
    if (isPackaged()) return String(app.getVersion() || "").replace(/^v/i, "");
  } catch (_) {}
  try {
    const vf = path.join(projectRoot(), "VERSION");
    if (fs.existsSync(vf)) return fs.readFileSync(vf, "utf8").trim().replace(/^v/i, "");
  } catch (_) {}
  try {
    return String(app.getVersion() || "0.0.0").replace(/^v/i, "");
  } catch (_) {
    return "0.0.0";
  }
}

module.exports = {
  isPackaged,
  projectRoot,
  addonDir,
  changelogPath,
  iconPath,
  userSettingsPath,
  syncStormworksAddon,
  readAppVersion,
};
