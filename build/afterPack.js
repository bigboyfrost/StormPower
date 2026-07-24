/**
 * Bake build/icon.ico into StormPower.exe without winCodeSign
 * (signAndEditExecutable needs symlink privileges we may not have).
 */
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

function findRcedit(projectDir) {
  const names = ["rcedit-x64.exe", "rcedit.exe"];
  const roots = [
    path.join(projectDir, "node_modules", "rcedit", "bin"),
    path.join(projectDir, "node_modules", "electron-builder", "node_modules", "rcedit", "bin"),
  ];
  for (const root of roots) {
    for (const name of names) {
      const p = path.join(root, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(context.packager.projectDir, "build", "icon.ico");
  const rceditBin = findRcedit(context.packager.projectDir);

  if (!fs.existsSync(exePath)) {
    console.warn("[afterPack] exe missing:", exePath);
    return;
  }
  if (!fs.existsSync(iconPath)) {
    console.warn("[afterPack] icon missing:", iconPath);
    return;
  }
  if (!rceditBin) {
    console.warn("[afterPack] rcedit binary not found");
    return;
  }

  await execFileAsync(rceditBin, [
    exePath,
    "--set-icon",
    iconPath,
    "--set-version-string",
    "CompanyName",
    "Aimless Developement",
    "--set-version-string",
    "FileDescription",
    "StormPower",
    "--set-version-string",
    "ProductName",
    "StormPower",
  ]);
  console.log("[afterPack] applied icon to", exeName);
};
