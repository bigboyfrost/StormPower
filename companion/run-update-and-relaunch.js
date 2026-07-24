/**
 * Quit-safe updater: runs AFTER Electron closes.
 * Downloads, stages, installs, then relaunches StormPower.
 */
const path = require("path");
const { spawn } = require("child_process");
const { checkForUpdates, installFromStaging, ROOT, localVersion } = require("./updater");

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

(async () => {
  // Wait for Electron to fully exit and release file locks
  sleep(2000);
  console.log("[run-update] downloading/installing… local=", localVersion());
  try {
    const info = await checkForUpdates({ silent: false, apply: true });
    if (info.pendingRestart || info.applied) {
      const res = installFromStaging();
      console.log("[run-update] install:", res);
    } else {
      console.log("[run-update] nothing to apply", info);
    }
  } catch (err) {
    console.error("[run-update] failed", err);
  }
  sleep(500);
  relaunch();
})();
