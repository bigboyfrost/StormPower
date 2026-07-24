/**
 * Runs AFTER Electron quits. Installs staged update files, then relaunches.
 * Usage: node companion/finish-update.js [--no-relaunch]
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { installFromStaging, ROOT, localVersion } = require("./updater");

function sleep(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (_) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

function relaunch() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCmd, ["start"], {
    cwd: ROOT,
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();
}

function main() {
  const noRelaunch = process.argv.includes("--no-relaunch");
  // Give Electron time to fully release file locks
  sleep(2000);
  const res = installFromStaging();
  const logPath = path.join(ROOT, "_update_log.txt");
  try {
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] finish-update: ${JSON.stringify(res)} local=${localVersion()}\n`,
      "utf8"
    );
  } catch (_) {}

  if (!res.ok) {
    console.error(res.message || "Update failed");
    if (!noRelaunch) {
      // Still try to open so user sees something
      sleep(500);
      relaunch();
    }
    process.exit(1);
  }

  console.log(res.message || "Update installed");
  if (!noRelaunch) {
    sleep(400);
    relaunch();
  }
}

main();
