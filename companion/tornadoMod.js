/**
 * Buff / EF5 wedge tornado — patches Stormworks environment realtime values
 * (and matching floats in live RAM) then spawns a tornado.
 *
 * spawnTornado() has no magnitude API; size/power come from environment.txt.
 */
const fs = require("fs");
const path = require("path");
const { findStormworks } = require("./engineMod");

const STOCK = {
  tornado_intensity: 1.0,
  tornado_base_radius_inner: 10.0,
  tornado_base_radius_outer: 30.0,
  tornado_wind_component_vertical: 100.0,
  tornado_wind_component_radial: 200.0,
  tornado_wind_component_tangential: 100.0,
  tornado_weather_wind_radial: 100.0,
  tornado_weather_wind_tangential: 50.0,
};

// Wide wedge + violent inflow — EF5-class for Stormworks scale
const EF5 = {
  tornado_intensity: 1.0,
  tornado_base_radius_inner: 140.0,
  tornado_base_radius_outer: 720.0,
  tornado_wind_component_vertical: 900.0,
  tornado_wind_component_radial: 1800.0,
  tornado_wind_component_tangential: 1200.0,
  tornado_weather_wind_radial: 900.0,
  tornado_weather_wind_tangential: 450.0,
};

function envPath(sw) {
  return path.join(sw, "rom", "data", "realtime_values", "environment.txt");
}

function backupPath(sw) {
  return path.join(sw, "rom", "stormpower_backup", "environment_tornado.txt");
}

function markerPath(sw) {
  return path.join(sw, "rom", "stormpower_backup", "TORNADO_EF5.txt");
}

function patchEnvText(raw, values) {
  let out = raw;
  for (const [key, val] of Object.entries(values)) {
    const re = new RegExp(`(f32\\s+${key}\\s+)([0-9.]+)`, "i");
    if (re.test(out)) {
      out = out.replace(re, `$1${val}`);
    }
  }
  return out;
}

function isEf5Installed() {
  const sw = findStormworks();
  if (!sw) return { installed: false, stormworks: null };
  return { installed: fs.existsSync(markerPath(sw)), stormworks: sw };
}

function installEf5() {
  const sw = findStormworks();
  if (!sw) return { ok: false, message: "Stormworks not found" };
  const env = envPath(sw);
  if (!fs.existsSync(env)) return { ok: false, message: "environment.txt missing" };

  const backup = backupPath(sw);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.copyFileSync(env, backup);

  // Always patch from backup so re-toggles don't multiply.
  const stock = fs.readFileSync(backup, "utf8");
  fs.writeFileSync(env, patchEnvText(stock, EF5), "utf8");
  fs.writeFileSync(markerPath(sw), `StormPower EF5 tornado ${new Date().toISOString()}\n`, "utf8");

  return {
    ok: true,
    installed: true,
    message: "EF5 wedge tornado ON (live RAM + file). Spawn a tornado now.",
    stormworks: sw,
    map: Object.entries(STOCK)
      .map(([k, from]) => `${from}:${EF5[k]}`)
      .join(","),
  };
}

function uninstallEf5() {
  const sw = findStormworks();
  if (!sw) return { ok: false, message: "Stormworks not found" };
  const backup = backupPath(sw);
  const env = envPath(sw);
  if (fs.existsSync(backup)) {
    fs.copyFileSync(backup, env);
  } else {
    // Best-effort restore to STOCK numbers
    if (fs.existsSync(env)) {
      fs.writeFileSync(env, patchEnvText(fs.readFileSync(env, "utf8"), STOCK), "utf8");
    }
  }
  try {
    fs.unlinkSync(markerPath(sw));
  } catch (_) {}
  return {
    ok: true,
    installed: false,
    message: "EF5 tornado OFF — stock radii restored",
    map: Object.entries(EF5)
      .map(([k, from]) => `${from}:${STOCK[k]}`)
      .join(","),
  };
}

function setEf5(wantOn) {
  return wantOn ? installEf5() : uninstallEf5();
}

function livePatchMap(valuesFrom, valuesTo) {
  return Object.keys(valuesFrom)
    .map((k) => `${valuesFrom[k]}:${valuesTo[k]}`)
    .join(",");
}

module.exports = {
  STOCK,
  EF5,
  isEf5Installed,
  installEf5,
  uninstallEf5,
  setEf5,
  livePatchMap,
};
