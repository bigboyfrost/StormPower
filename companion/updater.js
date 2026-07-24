/**
 * StormPower auto-updater
 * Downloads GitHub release zips, stages them, then finish-update.js installs
 * AFTER Electron exits (Windows locks .js files while the app is running).
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFileSync, spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const VERSION_FILE = path.join(ROOT, "VERSION");
const CONFIG_FILE = path.join(ROOT, "update-config.json");
const CHANGELOG_FILE = path.join(ROOT, "CHANGELOG.md");
const STAGING_DIR = path.join(ROOT, "_update_staging");
const READY_FILE = path.join(ROOT, "_update_ready.json");
const LOG_FILE = path.join(ROOT, "_update_log.txt");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch (_) {}
  console.log(`[updater] ${msg}`);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function getConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  return {
    owner: cfg.owner || process.env.STORMPOWER_GH_OWNER || "bigboyfrost",
    repo: cfg.repo || process.env.STORMPOWER_GH_REPO || "StormPower",
    branch: cfg.branch || process.env.STORMPOWER_GH_BRANCH || "master",
  };
}

function localVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, "utf8").trim().replace(/^v/i, "");
  } catch (_) {
    return "0.0.0";
  }
}

function cmpSemver(a, b) {
  const pa = String(a).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function notesFromChangelog(sinceVersion) {
  try {
    const raw = fs.readFileSync(CHANGELOG_FILE, "utf8");
    const since = String(sinceVersion || "0.0.0").replace(/^v/i, "");
    const parts = raw.split(/^##\s+/m).filter(Boolean);
    const blocks = [];
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const heading = (nl >= 0 ? part.slice(0, nl) : part).trim();
      const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
      const ver = heading.replace(/^v/i, "").split(/\s+/)[0];
      if (!/^\d+\.\d+/.test(ver)) continue;
      if (cmpSemver(ver, since) > 0) blocks.push(`## ${heading}\n${body}`);
    }
    if (blocks.length) return blocks.join("\n\n");
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const heading = (nl >= 0 ? part.slice(0, nl) : part).trim();
      const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
      if (/^\d+\.\d+/.test(heading.replace(/^v/i, ""))) return `## ${heading}\n${body}`;
    }
  } catch (_) {}
  return "";
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "StormPower-Updater",
          Accept: "application/vnd.github+json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on("error", reject);
  });
}

function downloadFile(url, dest, redirectsLeft = 8) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("http://") ? http : https;
    const req = mod.get(
      url,
      {
        headers: {
          "User-Agent": "StormPower-Updater",
          Accept: "application/octet-stream",
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            reject(new Error("Too many redirects downloading update"));
            return;
          }
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          downloadFile(next, dest, redirectsLeft - 1).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Download failed HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
        file.on("error", reject);
      }
    );
    req.on("error", (err) => {
      try {
        fs.unlinkSync(dest);
      } catch (_) {}
      reject(err);
    });
  });
}

function assertZipFile(filePath) {
  const fd = fs.openSync(filePath, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  // PK\x03\x04 or PK\x05\x06
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error("Downloaded file is not a zip (GitHub download may have failed)");
  }
  const size = fs.statSync(filePath).size;
  if (size < 1000) throw new Error("Downloaded zip is too small — update aborted");
}

/** Prefer a folder that contains VERSION + companion (not addon alone). */
function findUpdateRoot(extractDir) {
  const isRoot = (dir) => {
    try {
      return (
        fs.existsSync(path.join(dir, "VERSION")) &&
        fs.existsSync(path.join(dir, "package.json")) &&
        fs.existsSync(path.join(dir, "companion")) &&
        fs.statSync(path.join(dir, "companion")).isDirectory()
      );
    } catch (_) {
      return false;
    }
  };

  if (isRoot(extractDir)) return extractDir;

  for (const name of fs.readdirSync(extractDir)) {
    const p = path.join(extractDir, name);
    if (fs.statSync(p).isDirectory() && isRoot(p)) return p;
  }

  // One more level (rare)
  for (const name of fs.readdirSync(extractDir)) {
    const p = path.join(extractDir, name);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const n2 of fs.readdirSync(p)) {
      const p2 = path.join(p, n2);
      if (fs.statSync(p2).isDirectory() && isRoot(p2)) return p2;
    }
  }

  throw new Error(
    "Could not find StormPower root in the update zip (need VERSION + companion/). " +
      "Contents: " +
      fs.readdirSync(extractDir).join(", ")
  );
}

function copyUpdate(fromDir, toDir) {
  const skip = new Set([
    "node_modules",
    ".git",
    "_update.zip",
    "_update_extract",
    "_update_staging",
    "_update_ready.json",
    "_update_log.txt",
    "dist",
  ]);
  const errors = [];
  for (const name of fs.readdirSync(fromDir)) {
    if (skip.has(name)) continue;
    const src = path.join(fromDir, name);
    const dest = path.join(toDir, name);
    const st = fs.statSync(src);
    try {
      if (st.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        const nested = copyUpdate(src, dest);
        errors.push(...nested);
      } else {
        fs.copyFileSync(src, dest);
      }
    } catch (err) {
      errors.push(`${dest}: ${err.message}`);
    }
  }
  return errors;
}

function extractZip(zipPath, destDir) {
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  try {
    execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "ignore" });
  } catch (_) {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: "ignore" }
    );
  }
}

function syncAddonFromRoot(rootDir) {
  try {
    if (!process.env.APPDATA) return;
    const dest = path.join(process.env.APPDATA, "Stormworks", "data", "missions", "StormPower");
    fs.mkdirSync(dest, { recursive: true });
    for (const name of ["playlist.xml", "script.lua"]) {
      const src = path.join(rootDir, "addon", name);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
    }
  } catch (err) {
    log("addon sync warning: " + err.message);
  }
}

function sleepMs(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

/**
 * Copy staged update into ROOT. Safe to call after Electron has quit.
 */
function installFromStaging() {
  if (!fs.existsSync(READY_FILE)) {
    return { ok: false, message: "No pending update" };
  }
  const meta = readJson(READY_FILE, null);
  if (!meta || !meta.staging) {
    return { ok: false, message: "Invalid pending update metadata" };
  }
  const staging = meta.staging;
  if (!fs.existsSync(path.join(staging, "VERSION"))) {
    return { ok: false, message: "Staging folder missing VERSION" };
  }

  log(`Installing staged v${meta.latest} from ${staging}`);
  let lastErrors = [];
  for (let attempt = 1; attempt <= 12; attempt++) {
    lastErrors = copyUpdate(staging, ROOT);
    const verNow = localVersion();
    if (lastErrors.length === 0 && cmpSemver(verNow, meta.latest) >= 0) {
      fs.writeFileSync(VERSION_FILE, String(meta.latest).trim() + "\n", "utf8");
      syncAddonFromRoot(ROOT);
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch (_) {}
      try {
        fs.unlinkSync(READY_FILE);
      } catch (_) {}
      try {
        fs.rmSync(path.join(ROOT, "_update_extract"), { recursive: true, force: true });
      } catch (_) {}
      try {
        fs.unlinkSync(path.join(ROOT, "_update.zip"));
      } catch (_) {}
      log(`Install OK — now at v${localVersion()}`);
      return { ok: true, version: localVersion(), message: `Installed v${localVersion()}` };
    }
    log(`Attempt ${attempt}: ver=${verNow} errors=${lastErrors.slice(0, 3).join(" | ")}`);
    sleepMs(500);
  }

  return {
    ok: false,
    message:
      "Could not overwrite files (still locked?). Close StormPower fully and run update.bat again.",
    errors: lastErrors.slice(0, 8),
  };
}

function spawnFinishUpdate({ relaunch = true } = {}) {
  const finishScript = path.join(__dirname, "finish-update.js");
  const args = [finishScript];
  if (!relaunch) args.push("--no-relaunch");

  // Prefer system node — Electron's process.execPath cannot run .js finish scripts
  const nodeCmd = process.platform === "win32" ? "node.exe" : "node";
  const child = spawn(nodeCmd, args, {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, STORMPOWER_ROOT: ROOT },
  });
  child.unref();
  return true;
}

async function checkForUpdates({ silent = true, apply = false, onProgress } = {}) {
  const cfg = getConfig();
  const current = localVersion();
  const progress = (message) => {
    log(message);
    if (typeof onProgress === "function") onProgress({ message });
  };

  let latest = current;
  let zipUrl = "";
  let htmlUrl = "";
  let notes = "";

  try {
    progress("Fetching latest release…");
    const release = await httpsGetJson(
      `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/releases/latest`
    );
    latest = (release.tag_name || release.name || current).replace(/^v/i, "");
    htmlUrl = release.html_url || "";
    notes = String(release.body || "").trim();
    // Prefer GitHub source zipball for auto-updates — always nested as
    // owner-repo-hash/VERSION+companion (old buggy finders also work).
    // Manual friend packs are separate release assets with a different name.
    zipUrl =
      release.zipball_url ||
      (release.assets || []).find((a) => /friends-install.*\.zip$/i.test(a.name))
        ?.browser_download_url ||
      (release.assets || []).find((a) => /\.zip$/i.test(a.name))?.browser_download_url ||
      "";
  } catch (_) {
    try {
      progress("Reading VERSION from branch…");
      const raw = await new Promise((resolve, reject) => {
        https
          .get(
            `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/VERSION`,
            { headers: { "User-Agent": "StormPower-Updater" } },
            (res) => {
              let d = "";
              res.on("data", (c) => (d += c));
              res.on("end", () => resolve(d.trim()));
            }
          )
          .on("error", reject);
      });
      if (raw) latest = raw.replace(/^v/i, "");
      zipUrl = `https://github.com/${cfg.owner}/${cfg.repo}/archive/refs/heads/${cfg.branch}.zip`;
      htmlUrl = `https://github.com/${cfg.owner}/${cfg.repo}`;
    } catch (err) {
      if (!silent) throw err;
      return {
        updateAvailable: false,
        current,
        latest: current,
        notes: notesFromChangelog(current),
        message: err.message,
      };
    }
  }

  if (!notes) notes = notesFromChangelog(current);
  if (!notes) notes = `## ${latest}\n- StormPower update available.`;

  const updateAvailable = cmpSemver(latest, current) > 0;
  const info = {
    updateAvailable,
    current,
    latest,
    htmlUrl,
    zipUrl,
    notes,
    changelog: notes,
    owner: cfg.owner,
    repo: cfg.repo,
  };

  if (!apply || !updateAvailable) return info;

  const tmpZip = path.join(ROOT, "_update.zip");
  const tmpDir = path.join(ROOT, "_update_extract");
  progress(`Downloading v${latest}…`);
  await downloadFile(zipUrl, tmpZip);
  assertZipFile(tmpZip);

  progress("Extracting update…");
  extractZip(tmpZip, tmpDir);
  const srcRoot = findUpdateRoot(tmpDir);
  log(`Update root detected: ${srcRoot}`);

  // Stage a clean copy so finish-update can install after Electron exits
  progress("Staging update (will install on restart)…");
  if (fs.existsSync(STAGING_DIR)) fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  fs.mkdirSync(STAGING_DIR, { recursive: true });
  const stageErrors = copyUpdate(srcRoot, STAGING_DIR);
  if (!fs.existsSync(path.join(STAGING_DIR, "VERSION"))) {
    throw new Error("Staging failed — VERSION missing. " + stageErrors.slice(0, 3).join("; "));
  }
  // Ensure staged VERSION matches release tag
  fs.writeFileSync(path.join(STAGING_DIR, "VERSION"), latest + "\n", "utf8");

  const ready = {
    latest,
    from: current,
    staging: STAGING_DIR,
    root: ROOT,
    createdAt: Date.now(),
  };
  fs.writeFileSync(READY_FILE, JSON.stringify(ready, null, 2), "utf8");

  try {
    fs.unlinkSync(tmpZip);
  } catch (_) {}
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}

  info.applied = true;
  info.pendingRestart = true;
  info.notes = notesFromChangelog(current) || notes;
  info.changelog = info.notes;
  info.message =
    `Update v${latest} downloaded. Click Restart — StormPower must quit so files can install (Windows locks them while open).`;
  progress(info.message);
  return info;
}

if (require.main === module) {
  const apply = process.argv.includes("--apply");
  const finishOnly = process.argv.includes("--finish");
  (async () => {
    if (finishOnly) {
      const res = installFromStaging();
      console.log(JSON.stringify(res, null, 2));
      process.exit(res.ok ? 0 : 1);
    }
    const info = await checkForUpdates({ silent: false, apply });
    console.log(JSON.stringify(info, null, 2));
    if (info.pendingRestart) {
      const res = installFromStaging();
      console.log(JSON.stringify(res, null, 2));
      if (!res.ok) process.exit(1);
    } else if (info.updateAvailable && !info.applied) {
      console.log("Run: update.bat");
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  checkForUpdates,
  getConfig,
  localVersion,
  notesFromChangelog,
  installFromStaging,
  spawnFinishUpdate,
  READY_FILE,
  ROOT,
};
