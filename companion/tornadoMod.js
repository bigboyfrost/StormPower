/**
 * Tornado strength tiers — spawnTornado has no magnitude API.
 * We patch environment.txt + live RAM floats before each spawn.
 */
const fs = require("fs");
const path = require("path");
const { findStormworks } = require("./engineMod");

const STOCK = {
  tornado_intensity: 1.0,
  tornado_velocity: 0.0,
  tornado_base_radius_inner: 10.0,
  tornado_base_radius_outer: 30.0,
  tornado_wind_component_vertical: 100.0,
  tornado_wind_component_radial: 200.0,
  tornado_wind_component_tangential: 100.0,
  tornado_weather_wind_radial: 100.0,
  tornado_weather_wind_tangential: 50.0,
};

const TIERS = {
  0: { label: "Stock", values: { ...STOCK } },
  1: {
    label: "Strong",
    values: {
      tornado_intensity: 1.0,
      tornado_velocity: 2.0,
      tornado_base_radius_inner: 40.0,
      tornado_base_radius_outer: 120.0,
      tornado_wind_component_vertical: 350.0,
      tornado_wind_component_radial: 700.0,
      tornado_wind_component_tangential: 450.0,
      tornado_weather_wind_radial: 350.0,
      tornado_weather_wind_tangential: 180.0,
    },
  },
  2: {
    label: "EF3",
    values: {
      tornado_intensity: 1.0,
      tornado_velocity: 5.0,
      tornado_base_radius_inner: 90.0,
      tornado_base_radius_outer: 320.0,
      tornado_wind_component_vertical: 700.0,
      tornado_wind_component_radial: 1400.0,
      tornado_wind_component_tangential: 900.0,
      tornado_weather_wind_radial: 700.0,
      tornado_weather_wind_tangential: 350.0,
    },
  },
  3: {
    label: "EF5 Wedge",
    values: {
      tornado_intensity: 1.0,
      tornado_velocity: 12.0,
      tornado_base_radius_inner: 220.0,
      tornado_base_radius_outer: 980.0,
      tornado_wind_component_vertical: 2000.0,
      tornado_wind_component_radial: 4500.0,
      tornado_wind_component_tangential: 2800.0,
      tornado_weather_wind_radial: 2200.0,
      tornado_weather_wind_tangential: 1100.0,
    },
  },
  4: {
    label: "Apocalypse",
    values: {
      tornado_intensity: 1.0,
      tornado_velocity: 25.0,
      tornado_base_radius_inner: 400.0,
      tornado_base_radius_outer: 1800.0,
      tornado_wind_component_vertical: 5000.0,
      tornado_wind_component_radial: 12000.0,
      tornado_wind_component_tangential: 8000.0,
      tornado_weather_wind_radial: 6000.0,
      tornado_weather_wind_tangential: 3000.0,
    },
  },
};

function envPath(sw) {
  return path.join(sw, "rom", "data", "realtime_values", "environment.txt");
}
function backupPath(sw) {
  return path.join(sw, "rom", "stormpower_backup", "environment_tornado.txt");
}

function patchEnvText(raw, values) {
  let out = raw;
  for (const [key, val] of Object.entries(values)) {
    const re = new RegExp(`((?:f32|s32)\\s+${key}\\s+)(-?[0-9.]+)`, "i");
    if (re.test(out)) out = out.replace(re, `$1${val}`);
  }
  return out;
}

function ensureBackup(sw) {
  const env = envPath(sw);
  const backup = backupPath(sw);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup) && fs.existsSync(env)) fs.copyFileSync(env, backup);
  return backup;
}

function applyTier(tierIndex) {
  const tier = TIERS[tierIndex] || TIERS[0];
  const sw = findStormworks();
  if (!sw) return { ok: false, message: "Stormworks not found", tier };
  const env = envPath(sw);
  if (!fs.existsSync(env)) return { ok: false, message: "environment.txt missing", tier };

  const backup = ensureBackup(sw);
  const stockRaw = fs.readFileSync(backup, "utf8");
  fs.writeFileSync(env, patchEnvText(stockRaw, tier.values), "utf8");

  // Build a wide live-RAM map: stock→tier and every tier→this tier so we catch
  // whatever is currently loaded, then freeze the new values.
  const maps = [];
  for (const t of Object.values(TIERS)) {
    for (const key of Object.keys(STOCK)) {
      maps.push(`${t.values[key]}:${tier.values[key]}`);
      maps.push(`${STOCK[key]}:${tier.values[key]}`);
    }
  }
  // Unique
  const map = [...new Set(maps)].join(",");

  return {
    ok: true,
    message: `Tornado ${tier.label} applied`,
    tier,
    tierIndex,
    map,
  };
}

function tierLabel(i) {
  return (TIERS[i] || TIERS[0]).label;
}

function maxTier() {
  return Object.keys(TIERS).length;
}

module.exports = {
  STOCK,
  TIERS,
  applyTier,
  tierLabel,
  maxTier,
};
