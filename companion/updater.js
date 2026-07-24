/**
 * StormPower auto-updater
 * Checks GitHub Releases for a newer VERSION and can download the zipball.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const VERSION_FILE = path.join(ROOT, "VERSION");
const CONFIG_FILE = path.join(ROOT, "update-config.json");
const CHANGELOG_FILE = path.join(ROOT, "CHANGELOG.md");

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
    owner: cfg.owner || process.env.STORMPOWER_GH_OWNER || "",
    repo: cfg.repo || process.env.STORMPOWER_GH_REPO || "StormPower",
    branch: cfg.branch || "main",
  };
}

function localVersion() {
  try {
    return fs.readFileSync(VERSION_FILE, "utf8").trim();
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

/** Extract notes for versions newer than `sinceVersion` (exclusive). Falls back to latest section. */
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
      if (cmpSemver(ver, since) > 0) {
        blocks.push(`## ${heading}\n${body}`);
      }
    }
    if (blocks.length) return blocks.join("\n\n");
    // Fallback: newest version section in the file
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const heading = (nl >= 0 ? part.slice(0, nl) : part).trim();
      const body = (nl >= 0 ? part.slice(nl + 1) : "").trim();
      if (/^\d+\.\d+/.test(heading.replace(/^v/i, ""))) {
        return `## ${heading}\n${body}`;
      }
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

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { "User-Agent": "StormPower-Updater" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(dest)));
      })
      .on("error", (err) => {
        try {
          fs.unlinkSync(dest);
        } catch (_) {}
        reject(err);
      });
  });
}

async function checkForUpdates({ silent = true, apply = false, onProgress } = {}) {
  const cfg = getConfig();
  const current = localVersion();
  const progress = (message) => {
    if (typeof onProgress === "function") onProgress({ message });
  };

  if (!cfg.owner) {
    return {
      updateAvailable: false,
      current,
      latest: current,
      notes: notesFromChangelog(current),
      message: "Repo not configured yet (run once after GitHub publish).",
    };
  }

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
    const asset = (release.assets || []).find((a) => /stormpower.*\.zip$/i.test(a.name));
    zipUrl = asset?.browser_download_url || release.zipball_url || "";
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
  console.log(`[updater] downloading ${latest}…`);
  await downloadFile(zipUrl, tmpZip);

  progress("Extracting update…");
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    execFileSync("tar", ["-xf", tmpZip, "-C", tmpDir], { stdio: "ignore" });
  } catch (_) {
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${tmpZip}' -DestinationPath '${tmpDir}' -Force`],
      { stdio: "ignore" }
    );
  }

  progress("Installing files…");
  const entries = fs.readdirSync(tmpDir).map((n) => path.join(tmpDir, n));
  const srcRoot = entries.find((p) => fs.statSync(p).isDirectory()) || tmpDir;
  copyUpdate(srcRoot, ROOT);

  // Sync Stormworks addon after update
  try {
    const dest = path.join(process.env.APPDATA || "", "Stormworks", "data", "missions", "StormPower");
    if (dest && process.env.APPDATA) {
      fs.mkdirSync(dest, { recursive: true });
      const addon = path.join(ROOT, "addon");
      for (const name of ["playlist.xml", "script.lua"]) {
        const src = path.join(addon, name);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
      }
    }
  } catch (_) {}

  try {
    fs.unlinkSync(tmpZip);
  } catch (_) {}
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}

  // Prefer freshly installed changelog for the finished screen
  const installedNotes = notesFromChangelog(current) || notes;
  info.applied = true;
  info.notes = installedNotes;
  info.changelog = installedNotes;
  info.message = `Updated to ${latest}. Restart StormPower.`;
  progress(info.message);
  return info;
}

function copyUpdate(fromDir, toDir) {
  const skip = new Set(["node_modules", ".git", "_update.zip", "_update_extract"]);
  for (const name of fs.readdirSync(fromDir)) {
    if (skip.has(name)) continue;
    const src = path.join(fromDir, name);
    const dest = path.join(toDir, name);
    const st = fs.statSync(src);
    if (st.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyUpdate(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

if (require.main === module) {
  checkForUpdates({ silent: false, apply: process.argv.includes("--apply") })
    .then((info) => {
      console.log(JSON.stringify(info, null, 2));
      if (info.updateAvailable && !info.applied) {
        console.log("Run: update.bat   (opens the changelog update screen)");
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { checkForUpdates, getConfig, localVersion, notesFromChangelog };
