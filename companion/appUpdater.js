/**
 * Packaged-app updates via electron-updater (GitHub Releases / NSIS).
 * Loose/dev installs keep using companion/updater.js zip flow.
 */
const { autoUpdater } = require("electron-updater");
const https = require("https");
const fs = require("fs");
const { isPackaged, changelogPath, readAppVersion } = require("./paths");

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let lastInfo = null;
let progressCb = null;

function emitProgress(message) {
  const msg = typeof message === "string" ? message : (message && message.message) || "";
  if (typeof progressCb === "function") progressCb(msg);
}

function setProgressHandler(fn) {
  progressCb = typeof fn === "function" ? fn : null;
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
    const file = changelogPath();
    if (!fs.existsSync(file)) return "";
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
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
  } catch (_) {}
  return "";
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
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
              reject(new Error(`GitHub HTTP ${res.statusCode}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on("error", reject);
  });
}

/** Prefer raw GitHub markdown body — electron-updater often gives HTML. */
async function fetchGithubReleaseMarkdown(tag) {
  try {
    const clean = String(tag || "").replace(/^v/i, "");
    const url = clean
      ? `https://api.github.com/repos/bigboyfrost/StormPower/releases/tags/v${clean}`
      : "https://api.github.com/repos/bigboyfrost/StormPower/releases/latest";
    const release = await httpsGetJson(url);
    const body = String(release.body || "")
      .replace(/^\uFEFF/, "")
      .trim();
    return body;
  } catch (_) {
    return "";
  }
}

function htmlToRoughMarkdown(html) {
  return String(html || "")
    .replace(/^\uFEFF/, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h1>/gi, "\n")
    .replace(/<\/h2>/gi, "\n")
    .replace(/<\/h3>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<h1[^>]*>/gi, "# ")
    .replace(/<h2[^>]*>/gi, "## ")
    .replace(/<h3[^>]*>/gi, "### ")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<b[^>]*>/gi, "**")
    .replace(/<\/b>/gi, "**")
    .replace(/<code[^>]*>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(s) {
  return /<\/?[a-z][\s\S]*>/i.test(String(s || ""));
}

async function resolveNotes(updateInfo, current, latest) {
  // Prefer GitHub markdown for the version being offered (local CHANGELOG
  // does not contain notes for a version you have not installed yet).
  const fromApi = await fetchGithubReleaseMarkdown(latest);
  if (fromApi && !looksLikeHtml(fromApi)) return fromApi;
  if (fromApi && looksLikeHtml(fromApi)) return htmlToRoughMarkdown(fromApi);

  const fromChangelog = notesFromChangelog(current);
  if (fromChangelog) return fromChangelog;

  let notes = "";
  if (updateInfo) {
    if (typeof updateInfo.releaseNotes === "string") notes = updateInfo.releaseNotes;
    else if (Array.isArray(updateInfo.releaseNotes)) {
      notes = updateInfo.releaseNotes.map((n) => n.note || n).join("\n\n");
    }
  }
  notes = String(notes || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!notes) return `## ${latest}\n- StormPower update available.`;
  if (looksLikeHtml(notes)) return htmlToRoughMarkdown(notes);
  return notes;
}

function wireEvents() {
  autoUpdater.removeAllListeners("download-progress");
  autoUpdater.removeAllListeners("error");
  autoUpdater.on("download-progress", (p) => {
    const pct = Math.round(p.percent || 0);
    emitProgress(`Downloading update... ${pct}%`);
  });
  autoUpdater.on("error", (err) => {
    console.error("[appUpdater]", err);
    emitProgress(`Update error: ${err.message || err}`);
  });
}

function zipProgressAdapter(p) {
  emitProgress(p);
}

async function checkForUpdates({ silent = true } = {}) {
  if (!isPackaged()) {
    const zipUpdater = require("./updater");
    return zipUpdater.checkForUpdates({ silent, onProgress: zipProgressAdapter });
  }

  wireEvents();
  const current = readAppVersion();
  try {
    emitProgress("Checking for updates...");
    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result && result.updateInfo;
    const latest = String((updateInfo && updateInfo.version) || current).replace(/^v/i, "");
    const available = cmpSemver(latest, current) > 0 && !!updateInfo;

    const notes = await resolveNotes(updateInfo, current, latest);

    lastInfo = {
      updateAvailable: available,
      current,
      latest,
      notes,
      changelog: notes,
      htmlUrl: `https://github.com/bigboyfrost/StormPower/releases/tag/v${latest}`,
      message: available
        ? `Update available: v${current} → v${latest}`
        : `You're on the latest version (v${current}).`,
      _electronUpdater: true,
    };
    return lastInfo;
  } catch (err) {
    if (!silent) throw err;
    return {
      updateAvailable: false,
      current,
      latest: current,
      notes: notesFromChangelog(current),
      changelog: notesFromChangelog(current),
      message: err.message || String(err),
    };
  }
}

async function downloadAndInstall(onProgress) {
  if (onProgress) setProgressHandler(onProgress);
  if (!isPackaged()) {
    const zipUpdater = require("./updater");
    return zipUpdater.checkForUpdates({
      silent: false,
      apply: true,
      onProgress: zipProgressAdapter,
    });
  }

  wireEvents();
  emitProgress("Downloading update...");
  await autoUpdater.downloadUpdate();
  emitProgress("Installing and restarting...");
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  return {
    applied: true,
    closing: true,
    message: "Installing update and restarting...",
  };
}

function getCachedInfo() {
  return lastInfo;
}

module.exports = {
  checkForUpdates,
  downloadAndInstall,
  setProgressHandler,
  getCachedInfo,
  isPackaged,
};
