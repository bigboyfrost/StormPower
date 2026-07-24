/**
 * StormPower menu engine — runs in the Electron main process so
 * keyboard navigation works even when Stormworks has focus.
 */
const fs = require("fs");
const path = require("path");
const { userSettingsPath } = require("./paths");

function settingsFile() {
  try {
    return userSettingsPath();
  } catch (_) {
    return path.join(__dirname, "user-settings.json");
  }
}

const defaultSettings = {
  side: "left",
  peer: 0,
  count: 1,
  size: 1.0,
  dist: 200,
  wave_height: 12,
  wave_interval: 12,
  wave_dist: 250,
  wave_dir: "ahead",
  wind_speed: 0, // 0–500× shove (ultra wind)
  tornado_tier: 3, // 0 stock … 4 apocalypse
};

const DIR_LABELS = {
  ahead: "Ahead of you",
  surround: "Surround (rotating)",
  random: "Random each wave",
  N: "From north",
  NE: "From north-east",
  E: "From east",
  SE: "From south-east",
  S: "From south",
  SW: "From south-west",
  W: "From west",
  NW: "From north-west",
};

function formatCycleValue(item, value) {
  if (item.cycle === "wave_dir") {
    return DIR_LABELS[value] || String(value);
  }
  if (item.cycle === "wind_speed") {
    return `${value}x`;
  }
  if (item.cycle === "tornado_tier") {
    return ["Stock", "Strong", "EF3", "EF5 Wedge", "Apocalypse"][Number(value)] || String(value);
  }
  return `${value}${item.unit || ""}`;
}

function loadSettings() {
  let s;
  try {
    s = { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch (_) {
    s = { ...defaultSettings };
  }
  // Old builds let the drag bars save values that break spawning: a 1m distance
  // puts disasters inside the player and leaves no open water for a tsunami.
  const dist = Number(s.dist);
  if (!Number.isFinite(dist) || dist < 20) s.dist = defaultSettings.dist;
  const size = Number(s.size);
  if (!Number.isFinite(size) || size <= 0 || size > 20) s.size = defaultSettings.size;
  const count = Number(s.count);
  if (!Number.isFinite(count) || count < 1) s.count = 1;
  s.count = Math.min(50, Math.floor(s.count));
  return s;
}

function saveSettings(s) {
  try {
    const file = settingsFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(s, null, 2), "utf8");
  } catch (_) {}
}

const MENU = {
  home: {
    title: "Home",
    items: [
      { label: "Waves & Wind", sub: "Repeating tsunamis, height, direction", goto: "waves" },
      { label: "Disasters", sub: "Tornado, meteor, volcano…", goto: "disasters" },
      { label: "Weather", sub: "Fog, rain, stock sea state", goto: "weather" },
      { label: "Spawns", sub: "Animals, creatures, objects", goto: "spawns" },
      { label: "Gear", sub: "Weapons, tools, outfits", goto: "gear" },
      { label: "Explosions", sub: "Blasts (Weapons DLC)", goto: "explosions" },
      { label: "Player", sub: "Heal, money, loadout", goto: "player" },
      { label: "Game Rules", sub: "Damage, fuel, sirens, chaos…", goto: "rules" },
      { label: "Overlay", sub: "Side, updates, cleanup", goto: "settings" },
    ],
  },
  spawns: {
    title: "Spawns",
    items: [
      { label: "Animals", sub: "Sharks, whales, krakens", goto: "animals" },
      { label: "Creatures", sub: "Wildlife & monsters (DLC)", goto: "creatures" },
      { label: "World Objects", sub: "Barrels, crates, props", goto: "objects" },
    ],
  },
  gear: {
    title: "Gear",
    items: [
      { label: "Weapons & Ammo", sub: "Guns into your inventory", goto: "weapons" },
      { label: "Tools & Equipment", sub: "Meds, torches, radios", goto: "equipment" },
      { label: "Outfits", sub: "Suits and armor", goto: "outfits" },
    ],
  },
  rules: {
    title: "Game Rules",
    items: [
      {
        label: "Mute Disaster Sirens",
        sub: "Force warning towers off",
        toggle: "sirens_muted",
        cmd: "sirens_toggle",
      },
      {
        label: "Overrev Engine Power",
        sub: "Live 25x Medium/Large torque",
        toggle: "overrev_engine",
        local: "overrev_engine",
      },
      {
        label: "Chaos Mode",
        sub: "20s apocalypse, then auto-cleans up",
        toggle: "chaos",
        cmd: "chaos_toggle",
      },
      { label: "Infinite Fuel", toggle: "infinite_fuel", cmd: "setting_toggle", key: "infinite_fuel" },
      { label: "Infinite Batteries", toggle: "infinite_batteries", cmd: "setting_toggle", key: "infinite_batteries" },
      { label: "Infinite Ammo", toggle: "infinite_ammo", cmd: "setting_toggle", key: "infinite_ammo" },
      { label: "No Engine Overheat", toggle: "no_engine_overheat", cmd: "setting_toggle", key: "engine_overheating", invert: true },
      { label: "No Clip", toggle: "no_clip", cmd: "setting_toggle", key: "no_clip" },
      { label: "Player Damage", toggle: "player_damage", cmd: "setting_toggle", key: "player_damage", defaultOn: true },
      { label: "Vehicle Damage", toggle: "vehicle_damage", cmd: "setting_toggle", key: "vehicle_damage", defaultOn: true },
      { label: "NPC Damage", toggle: "npc_damage", cmd: "setting_toggle", key: "npc_damage", defaultOn: true },
      { label: "Lightning", toggle: "lightning", cmd: "setting_toggle", key: "lightning" },
      { label: "Sharks", toggle: "sharks", cmd: "setting_toggle", key: "sharks" },
      { label: "Fast Travel", toggle: "fast_travel", cmd: "setting_toggle", key: "fast_travel" },
      { label: "Third Person", toggle: "third_person", cmd: "setting_toggle", key: "third_person" },
      { label: "Map Show Players", toggle: "map_show_players", cmd: "setting_toggle", key: "map_show_players" },
      { label: "Map Show Vehicles", toggle: "map_show_vehicles", cmd: "setting_toggle", key: "map_show_vehicles" },
      { label: "Unlock All Islands", cmd: "setting", key: "unlock_all_islands", value: 1 },
      { label: "Despawn Siren Towers", sub: "Remove towers entirely", cmd: "sirens", mode: "kill" },
    ],
  },
  settings: {
    title: "Overlay",
    items: [
      {
        label: "Menu on Right",
        sub: "Off = left side",
        toggle: "side_right",
        cmd: "side_toggle",
      },
      {
        label: "Check for Updates",
        sub: "Look for a new StormPower release",
        local: "check_updates",
      },
      {
        label: "Spawn Distance",
        sub: "‹› how far ahead things appear",
        cycle: "dist",
        unit: "m",
        stm: true,
        values: [20, 50, 100, 150, 200, 300, 500, 800, 1200, 2000],
      },
      {
        label: "Spawn Amount",
        sub: "‹› how many per switch flip",
        cycle: "count",
        unit: "x",
        stm: true,
        values: [1, 2, 3, 5, 8, 12, 20, 35, 50],
      },
      {
        label: "Spawn Size",
        sub: "‹› scale for animals and creatures",
        cycle: "size",
        unit: "x",
        stm: true,
        values: [0.5, 1, 1.5, 2, 3, 5, 8, 12, 20],
      },
      { label: "Clean Up Spawns", sub: "Remove StormPower spawns", cmd: "cleanup" },
    ],
  },
  animals: {
    title: "Animals",
    items: [
      { label: "Shark", cmd: "spawn_animal", id: 0 },
      { label: "Whale", cmd: "spawn_animal", id: 1 },
      { label: "Kraken", cmd: "spawn_animal", id: 4 },
    ],
  },
  creatures: {
    title: "Creatures",
    items: [
      { label: "Grizzly Bear", cmd: "spawn_creature", id: 1 },
      { label: "Black Bear", cmd: "spawn_creature", id: 2 },
      { label: "Polar Bear", cmd: "spawn_creature", id: 3 },
      { label: "Plains Wolf", cmd: "spawn_creature", id: 63 },
      { label: "Arctic Wolf", cmd: "spawn_creature", id: 61 },
      { label: "Mountain Lion", cmd: "spawn_creature", id: 100 },
      { label: "Crocodile", cmd: "spawn_creature", id: 101 },
      { label: "Sasquatch", cmd: "spawn_creature", id: 12 },
      { label: "Yeti", cmd: "spawn_creature", id: 13 },
      { label: "Zombie (Male)", cmd: "spawn_creature", id: 64 },
      { label: "Zombie (Female)", cmd: "spawn_creature", id: 80 },
      { label: "German Shepherd", cmd: "spawn_creature", id: 25 },
      { label: "Husky", cmd: "spawn_creature", id: 32 },
      { label: "Labrador", cmd: "spawn_creature", id: 28 },
      { label: "St Bernard", cmd: "spawn_creature", id: 33 },
      { label: "Red Fox", cmd: "spawn_creature", id: 36 },
      { label: "Arctic Fox", cmd: "spawn_creature", id: 37 },
      { label: "Deer (Male)", cmd: "spawn_creature", id: 15 },
      { label: "Cow (Holstein)", cmd: "spawn_creature", id: 11 },
      { label: "Chicken", cmd: "spawn_creature", id: 4 },
      { label: "Penguin", cmd: "spawn_creature", id: 51 },
      { label: "Seal", cmd: "spawn_creature", id: 56 },
      { label: "Badger", cmd: "spawn_creature", id: 0 },
      { label: "Pig", cmd: "spawn_creature", id: 55 },
      { label: "Buffalo", cmd: "spawn_creature", id: 97 },
      { label: "Coyote", cmd: "spawn_creature", id: 102 },
    ],
  },
  weapons: {
    title: "Weapons & Ammo",
    items: [
      { label: "Pistol", cmd: "give", id: 35, slot: 1, int: 17, float: 0 },
      { label: "Pistol Ammo", cmd: "give", id: 36, slot: 2, int: 30, float: 0 },
      { label: "SMG", cmd: "give", id: 37, slot: 1, int: 30, float: 0 },
      { label: "SMG Ammo", cmd: "give", id: 38, slot: 2, int: 60, float: 0 },
      { label: "Rifle", cmd: "give", id: 39, slot: 1, int: 10, float: 0 },
      { label: "Rifle Ammo", cmd: "give", id: 40, slot: 2, int: 30, float: 0 },
      { label: "Grenade", cmd: "give", id: 41, slot: 2, int: 3, float: 0 },
      { label: "C4 + Detonator", cmd: "c4_kit" },
      { label: "Speargun + Ammo", cmd: "spear_kit" },
      { label: "Flare Gun + Ammo", cmd: "flare_kit" },
      { label: "MG Ammo Box (HE)", cmd: "give", id: 43, slot: 2, int: 1, float: 0 },
      { label: "Artillery Shell (HE)", cmd: "give", id: 68, slot: 2, int: 1, float: 0 },
      { label: "Full Combat Loadout", cmd: "loadout" },
    ],
  },
  equipment: {
    title: "Tools & Equipment",
    items: [
      { label: "First Aid Kit", cmd: "give", id: 11, slot: 2, int: 4, float: 0 },
      { label: "Defibrillator", cmd: "give", id: 9, slot: 1, int: 4, float: 0 },
      { label: "Fire Extinguisher", cmd: "give", id: 10, slot: 1, int: 0, float: 100 },
      { label: "Flashlight", cmd: "give", id: 15, slot: 2, int: 0, float: 100 },
      { label: "Binoculars", cmd: "give", id: 6, slot: 2, int: 0, float: 100 },
      { label: "Night Vision", cmd: "give", id: 17, slot: 2, int: 0, float: 100 },
      { label: "Welding Torch", cmd: "give", id: 27, slot: 1, int: 0, float: 100 },
      { label: "Underwater Torch", cmd: "give", id: 26, slot: 1, int: 0, float: 100 },
      { label: "Oxygen Mask", cmd: "give", id: 18, slot: 2, int: 0, float: 100 },
      { label: "Radio", cmd: "give", id: 19, slot: 2, int: 1, float: 100 },
      { label: "Transponder", cmd: "give", id: 25, slot: 2, int: 1, float: 100 },
      { label: "Compass", cmd: "give", id: 8, slot: 2, int: 0, float: 0 },
      { label: "Flare", cmd: "give", id: 12, slot: 2, int: 4, float: 0 },
      { label: "Strobe Light", cmd: "give", id: 23, slot: 2, int: 1, float: 100 },
      { label: "Glowstick", cmd: "give", id: 72, slot: 2, int: 0, float: 0 },
      { label: "Radiation Detector", cmd: "give", id: 30, slot: 2, int: 0, float: 100 },
      { label: "Remote Control", cmd: "give", id: 21, slot: 2, int: 1, float: 100 },
      { label: "Hose", cmd: "give", id: 16, slot: 1, int: 1, float: 0 },
      { label: "Cable", cmd: "give", id: 7, slot: 2, int: 0, float: 0 },
      { label: "Rope", cmd: "give", id: 22, slot: 2, int: 0, float: 0 },
      { label: "Coal", cmd: "give", id: 28, slot: 2, int: 0, float: 0 },
      { label: "Dog Whistle", cmd: "give", id: 73, slot: 2, int: 0, float: 0 },
      { label: "Bomb Disposal", cmd: "give", id: 74, slot: 1, int: 0, float: 0 },
      { label: "Fishing Rod", cmd: "give", id: 81, slot: 1, int: 0, float: 0 },
    ],
  },
  outfits: {
    title: "Outfits",
    items: [
      { label: "Diving Suit", cmd: "outfit", id: 1 },
      { label: "Firefighter", cmd: "outfit", id: 2 },
      { label: "Scuba", cmd: "outfit", id: 3 },
      { label: "Parachute", cmd: "outfit", id: 4 },
      { label: "Arctic Suit", cmd: "outfit", id: 5 },
      { label: "Hazmat", cmd: "outfit", id: 29 },
      { label: "Chest Rig", cmd: "outfit", id: 75 },
      { label: "Black Hawk Vest", cmd: "outfit", id: 76 },
      { label: "Plate Vest", cmd: "outfit", id: 77 },
      { label: "Armor Vest", cmd: "outfit", id: 78 },
      { label: "Space Suit", cmd: "outfit", id: 79 },
      { label: "Exploration Suit", cmd: "outfit", id: 80 },
      { label: "Firefighter SCBA", cmd: "outfit", id: 149 },
    ],
  },
  objects: {
    title: "World Objects",
    items: [
      { label: "Small Crate", cmd: "spawn_object", id: 2 },
      { label: "Barrel", cmd: "spawn_object", id: 6 },
      { label: "Blue Barrel", cmd: "spawn_object", id: 25 },
      { label: "Toxic Barrel", cmd: "spawn_object", id: 56 },
      { label: "Container", cmd: "spawn_object", id: 27 },
      { label: "Gas Canister", cmd: "spawn_object", id: 28 },
      { label: "Pallet", cmd: "spawn_object", id: 29 },
      { label: "Buoyancy Ring", cmd: "spawn_object", id: 26 },
      { label: "Basketball", cmd: "spawn_object", id: 4 },
      { label: "Television", cmd: "spawn_object", id: 5 },
      { label: "Chair", cmd: "spawn_object", id: 9 },
      { label: "Office Chair", cmd: "spawn_object", id: 13 },
      { label: "Log", cmd: "spawn_object", id: 21 },
      { label: "Bin", cmd: "spawn_object", id: 22 },
      { label: "Fire Extinguisher", cmd: "spawn_object", id: 31 },
      { label: "Tool Cart", cmd: "spawn_object", id: 32 },
      { label: "Microwave", cmd: "spawn_object", id: 36 },
      { label: "Box (Closed)", cmd: "spawn_object", id: 38 },
      { label: "Coal Chunk", cmd: "spawn_object", id: 69 },
      { label: "Meteorite", cmd: "spawn_object", id: 70 },
      { label: "C4 Block", cmd: "spawn_object", id: 66 },
      { label: "Grenade Prop", cmd: "spawn_object", id: 67 },
      { label: "Glowstick Prop", cmd: "spawn_object", id: 71 },
    ],
  },
  explosions: {
    title: "Explosions",
    items: [
      { label: "Tiny Blast", sub: "Magnitude 0.15 ahead of you", cmd: "explode", mag: 0.15 },
      { label: "Small Explosion", sub: "Magnitude 0.35", cmd: "explode", mag: 0.35 },
      { label: "Medium Explosion", sub: "Magnitude 0.6", cmd: "explode", mag: 0.6 },
      { label: "Large Explosion", sub: "Magnitude 0.85", cmd: "explode", mag: 0.85 },
      { label: "Max Explosion", sub: "Magnitude 1.0 (Weapons DLC)", cmd: "explode", mag: 1 },
      { label: "Ring of Blasts", sub: "6 explosions around you", cmd: "explode_ring", mag: 0.55 },
      { label: "Fire Bomb (small)", sub: "Explosive fire size 3", cmd: "firebomb", size: 3, emag: 2 },
      { label: "Fire Bomb (large)", sub: "Explosive fire size 8", cmd: "firebomb", size: 8, emag: 4 },
    ],
  },
  waves: {
    title: "Waves & Wind",
    items: [
      {
        label: "Wave Engine",
        sub: "‹› height, then flip switch",
        toggle: "wave_engine",
        local: "wave_engine",
        stm: true,
      },
      {
        label: "Wave Height",
        sub: "‹› set, switch applies",
        cycle: "wave_height",
        unit: "x",
        stm: true,
        values: [1, 2, 3, 5, 8, 12, 18, 25, 40, 60, 90, 140],
      },
      {
        label: "Wave Interval",
        sub: "‹› set, switch applies",
        cycle: "wave_interval",
        unit: "s",
        stm: true,
        values: [5, 8, 10, 12, 15, 20, 25, 30, 45, 60],
      },
      {
        label: "Wave Distance",
        sub: "‹› set, switch applies",
        cycle: "wave_dist",
        unit: "m",
        stm: true,
        values: [100, 150, 200, 250, 300, 400, 600, 900, 1400],
      },
      {
        label: "Wave Direction",
        sub: "‹› set, switch applies",
        cycle: "wave_dir",
        stm: true,
        values: ["ahead", "surround", "random", "N", "NE", "E", "SE", "S", "SW", "W", "NW"],
      },
      {
        label: "Wind Force",
        sub: "‹› up to 500x, switch applies",
        cycle: "wind_speed",
        stm: true,
        values: [0, 1, 5, 10, 25, 50, 100, 200, 350, 500],
      },
      { label: "Spawn One Wave", sub: "‹› amount, switch spawns", local: "wave_once", stm: true },
      { label: "Clear Waves", sub: "Cancel event and unlock memory", local: "wave_clear", stm: true },
    ],
  },
  weather: {
    title: "Weather",
    items: [
      { label: "Clear Sky", sub: "No fog / rain / wind", cmd: "weather", fog: 0, rain: 0, wind: 0 },
      { label: "Choppy Seas", sub: "Stock weather wind 72%", cmd: "sea", mode: 1, wind: 0.72 },
      { label: "Max Stock Seas", sub: "Wind 100% (not tsunami mode)", cmd: "sea", mode: 1, wind: 1 },
      { label: "Heavy Fog", cmd: "weather", fog: 1, rain: 0, wind: 0.2 },
      { label: "Heavy Rain + Wind", cmd: "weather", fog: 0.2, rain: 1, wind: 0.85 },
    ],
  },
  disasters: {
    title: "Disasters",
    items: [
      {
        label: "Spawn Tornado",
        sub: "‹› strength, switch spawns",
        local: "spawn_tornado",
        cycle: "tornado_tier",
        stm: true,
        values: [0, 1, 2, 3, 4],
      },
      { label: "Whirlpool", sub: "‹› amount, switch spawns", cmd: "disaster", id: "whirlpool", stm: true },
      { label: "Meteor", sub: "‹› amount, switch spawns", cmd: "disaster", id: "meteor", stm: true },
      { label: "Meteor Shower", sub: "‹› amount, switch spawns", cmd: "disaster", id: "shower", stm: true },
      { label: "Volcano", sub: "‹› amount, switch spawns", cmd: "disaster", id: "volcano", stm: true },
      { label: "Stock Tsunami", sub: "‹› amount — API max", cmd: "disaster", id: "tsunami", stm: true },
    ],
  },
  player: {
    title: "Player",
    items: [
      { label: "Heal & Revive", cmd: "heal" },
      { label: "Clear Inventory", cmd: "clear_inv" },
      { label: "Full Combat Loadout", cmd: "loadout" },
      { label: "Add $100,000", cmd: "money" },
    ],
  },
};

function createMenuEngine({
  enqueue,
  onChange,
  onSideChange,
  onLocalAction,
  onToggle,
  onSettingChange,
}) {
  const state = {
    open: false,
    stack: ["home"],
    cursor: 0,
    settings: loadSettings(),
    lastAction: "",
    search: "",
    active: {},
    toggles: {
      chaos: false,
      boost: false,
      engine_mod: false,
      overrev_engine: false,
      wave_engine: true,
      tornado_ef5: false,
      massive_waves: false,
      ultra_waves: false,
      sirens_muted: true,
      infinite_fuel: false,
      infinite_batteries: false,
      infinite_ammo: false,
      no_engine_overheat: false,
      no_clip: false,
      player_damage: true,
      vehicle_damage: true,
      npc_damage: true,
      lightning: false,
      sharks: false,
      fast_travel: false,
      third_person: false,
      map_show_players: false,
      map_show_vehicles: false,
      side_right: false,
    },
  };

  // Sync side toggle from saved settings
  state.toggles.side_right = state.settings.side === "right";

  function page() {
    return MENU[state.stack[state.stack.length - 1]] || MENU.home;
  }

  function visibleItems() {
    const q = String(state.search || "").trim().toLowerCase();
    if (!q) return page().items;

    const hits = [];
    for (const [pageKey, pageDef] of Object.entries(MENU)) {
      if (pageKey === "home") continue;
      for (const it of pageDef.items || []) {
        if (it.goto) continue;
        const hay = `${it.label} ${it.sub || ""} ${pageDef.title}`.toLowerCase();
        if (!hay.includes(q)) continue;
        hits.push({
          ...it,
          label: it.label,
          sub: `${pageDef.title}${it.sub ? " · " + it.sub : ""}`,
          _searchSource: pageKey,
        });
      }
    }
    return hits.slice(0, 80);
  }

  function notify() {
    if (typeof onChange === "function") onChange(getSnapshot());
  }

  function peerId() {
    return Math.max(0, Math.floor(Number(state.settings.peer) || 0));
  }

  function distM() {
    return Math.max(1, Math.min(5000, Math.floor(Number(state.settings.dist) || 20)));
  }

  // Rows whose spawns can be removed again: switch OFF despawns exactly what it spawned.
  const DESPAWNABLE = new Set(["spawn_animal", "spawn_creature", "spawn_object"]);
  // Tsunami/whirlpool are gerstner events — cancelGerstner takes them back down.
  const GERSTNER = new Set(["tsunami", "whirlpool"]);

  function itemTag(item) {
    const base = `${item.cmd || item.local || "x"}_${item.id !== undefined ? item.id : item.label}`;
    return base.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
  }

  function isStateful(item) {
    if (!item || !item.cmd) return false;
    if (DESPAWNABLE.has(item.cmd)) return true;
    if (item.cmd === "disaster" && GERSTNER.has(item.id)) return true;
    return false;
  }

  function buildCommand(item, toggleOn) {
    const s = state.settings;
    const peer = peerId();
    const count = Math.max(1, Math.floor(Number(s.count) || 1));
    const size = Math.max(0.5, Number(s.size) || 1);
    const dist = distM();
    const tag = `|t=${itemTag(item)}`;

    switch (item.cmd) {
      case "spawn_animal":
        return `spawn_animal|${peer}|${item.id}|${count}|${size}|${dist}${tag}`;
      case "spawn_creature":
        return `spawn_creature|${peer}|${item.id}|${count}|${size}|${dist}${tag}`;
      case "spawn_object":
        return `spawn_object|${peer}|${item.id}|${count}|${dist}${tag}`;
      case "give":
        return `give|${peer}|${item.id}|${item.slot}|${item.int}|${item.float}|${count}`;
      case "outfit":
        return `outfit|${peer}|${item.id}`;
      case "disaster":
        return `disaster|${peer}|${item.id}|${dist}`;
      case "weather":
        return `weather|${peer}|${item.fog}|${item.rain}|${item.wind}`;
      case "sea":
        return `sea|${peer}|${item.mode}|${item.wind}|${dist}`;
      case "sea_toggle":
        return toggleOn ? `sea|${peer}|2|1|${dist}` : `sea|${peer}|0|0|${dist}`;
      case "sea_toggle_ultra":
        // Wind stays at 1 — height comes from Mega Wave Engine shader, not force wind
        return toggleOn ? `sea|${peer}|4|1|${dist}` : `sea|${peer}|0|0|${dist}`;
      case "ultra_wind":
        return `ultra_wind|${peer}|${item.wind}`;
      case "mega_wave": {
        const wd = Math.max(80, Math.floor(Number(s.wave_dist) || dist));
        return `mega_wave|${peer}|${wd}|-1`;
      }
      case "sirens":
        return `sirens|${peer}|${item.mode}`;
      case "sirens_toggle":
        // toggle ON = muted
        return `sirens|${peer}|${toggleOn ? "off" : "on"}`;
      case "chaos":
        return `chaos|${peer}|${item.mode}`;
      case "chaos_toggle":
        return `chaos|${peer}|${toggleOn ? "on" : "off"}`;
      case "boost":
        return `boost|${peer}|${item.mode}`;
      case "boost_toggle":
        return `boost|${peer}|${toggleOn ? "on" : "off"}`;
      case "boost_flip":
        return `boost|${peer}|flip`;
      case "explode":
        return `explode|${peer}|${item.mag}|${dist}`;
      case "explode_ring":
        return `explode_ring|${peer}|${item.mag}|${dist}`;
      case "firebomb":
        return `firebomb|${peer}|${item.size}|${item.emag}|${dist}`;
      case "heal":
        return `heal|${peer}`;
      case "clear_inv":
        return `clear_inv|${peer}`;
      case "loadout":
        return `loadout|${peer}`;
      case "c4_kit":
        return `c4_kit|${peer}`;
      case "spear_kit":
        return `spear_kit|${peer}`;
      case "flare_kit":
        return `flare_kit|${peer}`;
      case "money":
        return `money|${peer}`;
      case "cleanup":
        return `cleanup|${peer}`;
      case "setting":
        return `setting|${peer}|${item.key}|${item.value}`;
      case "setting_toggle": {
        let on = !!toggleOn;
        if (item.invert) on = !on;
        return `setting|${peer}|${item.key}|${on ? 1 : 0}`;
      }
      default:
        return null;
    }
  }

  function cycleSetting(key, values, delta) {
    if (!values || !values.length) return null;
    const cur = state.settings[key];
    let idx = values.findIndex((v) => String(v) === String(cur));
    if (idx < 0) idx = 0;
    const next = values[(idx + delta + values.length) % values.length];
    state.settings[key] = next;
    saveSettings(state.settings);
    return next;
  }

  function stmAdjust(item, dir) {
    // Arrows ONLY change amount/value — never flip the switch.
    if (!item || item.goto) return;
    const delta = dir === "dec" ? -1 : 1;

    if (item.cycle && item.values) {
      const next = cycleSetting(item.cycle, item.values, delta);
      state.lastAction = `${item.label}: ${formatCycleValue(item, next)}`;
      notify();
      if (typeof onSettingChange === "function") onSettingChange(item.cycle, next);
      return;
    }

    // Wave Engine: amount = wave height before you flip the switch
    if (item.toggle === "wave_engine") {
      const values = [1, 2, 3, 5, 8, 12, 18, 25, 40, 60, 90, 140];
      const next = cycleSetting("wave_height", values, delta);
      state.lastAction = `Wave Height: ${next}x`;
      notify();
      if (typeof onSettingChange === "function") onSettingChange("wave_height", next);
      return;
    }

    // Default amount (spawn count) for actions / other toggles
    const cur = Math.max(1, Math.floor(Number(state.settings.count) || 1));
    const next = Math.max(1, Math.min(50, cur + delta));
    state.settings.count = next;
    saveSettings(state.settings);
    state.lastAction = `Amount: ${next}`;
    notify();
  }

  function stm(dir) {
    stmAdjust(visibleItems()[state.cursor], dir);
  }

  function stmAt(idx, dir) {
    const items = visibleItems();
    if (!items[idx]) return;
    state.cursor = idx;
    stmAdjust(items[idx], dir);
  }

  function activate() {
    const items = visibleItems();
    const item = items[state.cursor];
    if (!item) return;
    if (item.goto) {
      state.search = "";
      state.stack.push(item.goto);
      state.cursor = 0;
      state.lastAction = "Opened " + item.label;
      notify();
      return;
    }

    // Switch / Enter: enable or fire. Amount is edited with ← → only (STM).
    // Local companion actions first so cycle+local (e.g. tornado tier) does not advance on enable.
    if (item.local) {
      let next = true;
      if (item.toggle) {
        next = !state.toggles[item.toggle];
        state.toggles[item.toggle] = next;
      } else {
        // One-shot local action: show the switch move, then spring back.
        pulseActive(itemTag(item), item.label + "…");
      }
      state.lastAction = item.label + "…";
      notify();
      Promise.resolve()
        .then(() =>
          typeof onLocalAction === "function"
            ? onLocalAction(item.local, { on: next, item })
            : { ok: false, message: "No handler" }
        )
        .then((res) => {
          if (res && res.ok === false && item.toggle) {
            state.toggles[item.toggle] = !next;
          }
          if (res && typeof res.installed === "boolean" && item.toggle) {
            state.toggles[item.toggle] = !!res.installed;
          }
          if (item.toggle && typeof onToggle === "function") {
            onToggle(item.toggle, !!state.toggles[item.toggle]);
          }
          state.lastAction = (res && res.message) || item.label;
          notify();
        })
        .catch((err) => {
          if (item.toggle) state.toggles[item.toggle] = !next;
          state.lastAction = String(err.message || err);
          notify();
        });
      return;
    }

    // Cycle-only rows: switch re-applies the current value (arrows already set it).
    if (item.cycle && item.values) {
      const cur = state.settings[item.cycle];
      pulseActive(itemTag(item), `${item.label}: ${formatCycleValue(item, cur)}`);
      if (typeof onSettingChange === "function") onSettingChange(item.cycle, cur);
      return;
    }

    if (item.toggle) {
      const key = item.toggle;
      const next = !state.toggles[key];
      state.toggles[key] = next;

      // Exclusive wave modes
      if (key === "massive_waves" && next) state.toggles.ultra_waves = false;
      if (key === "ultra_waves" && next) state.toggles.massive_waves = false;
      if ((key === "massive_waves" || key === "ultra_waves") && !next) {
        // turning off is fine
      }

      if (item.cmd === "side_toggle") {
        state.settings.side = next ? "right" : "left";
        saveSettings(state.settings);
        state.lastAction = "Side: " + state.settings.side;
        if (typeof onSideChange === "function") onSideChange(state.settings.side);
        notify();
        return;
      }

      const line = buildCommand(item, next);
      if (line) {
        enqueue(line);
        state.lastAction = `${item.label}: ${next ? "ON" : "OFF"}`;
        if (typeof onToggle === "function") onToggle(key, next);
        notify();
      }
      return;
    }

    if (item.cmd === "set_side") {
      state.settings.side = item.side === "right" ? "right" : "left";
      state.toggles.side_right = state.settings.side === "right";
      saveSettings(state.settings);
      state.lastAction = "Side: " + state.settings.side;
      if (typeof onSideChange === "function") onSideChange(state.settings.side);
      notify();
      return;
    }

    const tag = itemTag(item);

    // Stateful rows: switch ON spawns, switch OFF removes what this row spawned.
    if (isStateful(item)) {
      if (state.active[tag]) {
        const peer = peerId();
        if (item.cmd === "disaster") enqueue(`disaster_cancel|${peer}`);
        else enqueue(`despawn_tag|${peer}|${tag}`);
        delete state.active[tag];
        state.lastAction = `${item.label}: removed`;
        notify();
        return;
      }
      const line = buildCommand(item);
      if (line) {
        enqueue(line);
        state.active[tag] = true;
        const n = Math.max(1, Math.floor(Number(state.settings.count) || 1));
        state.lastAction = `${item.label}: ${item.cmd === "disaster" ? "active" : `spawned ×${n}`}`;
        notify();
      }
      return;
    }

    // Momentary rows (gear, explosions, one-shot disasters): the switch fires and
    // springs back, because the game gives us no way to take these back.
    const line = buildCommand(item);
    if (line) {
      enqueue(line);
      pulseActive(tag, `Sent: ${item.label}`);
    }
  }

  function pulseActive(tag, message) {
    state.active[tag] = true;
    state.lastAction = message;
    notify();
    setTimeout(() => {
      delete state.active[tag];
      notify();
    }, 900);
  }

  function back() {
    if (state.search) {
      state.search = "";
      state.cursor = 0;
      state.lastAction = "Cleared search";
      notify();
      return true;
    }
    if (state.stack.length > 1) {
      state.stack.pop();
      state.cursor = 0;
      state.lastAction = "Back";
      notify();
      return true;
    }
    return false;
  }

  function move(delta) {
    const n = visibleItems().length;
    if (!n) return;
    state.cursor = (state.cursor + delta + n) % n;
    notify();
  }

  function selectIndex(idx) {
    const items = visibleItems();
    if (items[idx]) {
      state.cursor = idx;
      activate();
    }
  }

  function focusIndex(idx) {
    const items = visibleItems();
    if (!items[idx]) return;
    state.cursor = idx;
    notify();
  }

  function handleNav(action) {
    if (!state.open && action !== "toggle") return;
    if (action === "up") move(-1);
    else if (action === "down") move(1);
    else if (action === "select") activate();
    else if (action === "back") {
      if (!back() && typeof onChange === "function") {
        state.open = false;
        notify();
      }
    } else if (action.startsWith("num:")) {
      selectIndex(Number(action.slice(4)) - 1);
    }
  }

  function setOpen(open) {
    state.open = !!open;
    if (state.open && state.stack.length === 0) state.stack = ["home"];
    notify();
  }

  function toggleOpen() {
    setOpen(!state.open);
    return state.open;
  }

  function updateSettings(partial) {
    state.settings = { ...state.settings, ...partial };
    saveSettings(state.settings);
    if (partial.side !== undefined) {
      state.toggles.side_right = state.settings.side === "right";
      if (typeof onSideChange === "function") onSideChange(state.settings.side);
    }
    notify();
  }

  function setToggle(key, on) {
    if (!key || !(key in state.toggles)) return;
    state.toggles[key] = !!on;
    notify();
  }

  function setSearch(query) {
    state.search = String(query || "").slice(0, 80);
    state.cursor = 0;
    notify();
  }

  function getSnapshot() {
    const p = page();
    const items = visibleItems();
    const searching = !!String(state.search || "").trim();
    return {
      open: state.open,
      path: searching
        ? `Search · "${state.search}"`
        : state.stack.map((k) => MENU[k]?.title || k).join(" > "),
      title: searching ? "Search" : p.title,
      search: state.search || "",
      cursor: state.cursor,
      items: items.map((it, i) => {
        let stmValue = "";
        if (it.cycle) {
          stmValue = formatCycleValue(it, state.settings[it.cycle]);
        } else if (it.toggle === "wave_engine") {
          stmValue = `${state.settings.wave_height}x`;
        } else if (it.stm || it.cmd || it.local) {
          stmValue = `×${Math.max(1, Math.floor(Number(state.settings.count) || 1))}`;
        } else if (it.toggle) {
          stmValue = `×${Math.max(1, Math.floor(Number(state.settings.count) || 1))}`;
        }
        const on = it.toggle
          ? !!state.toggles[it.toggle]
          : it.goto
            ? false
            : !!state.active[itemTag(it)];
        return {
          i: i + 1,
          label: it.label,
          sub: it.sub || "",
          folder: !!it.goto,
          cycle: !!it.cycle,
          stm: !!(it.stm || it.toggle || it.cycle || it.cmd || it.local),
          stmValue,
          toggle: it.toggle || null,
          on,
          active: i === state.cursor,
        };
      }),
      settings: { ...state.settings },
      toggles: { ...state.toggles },
      lastAction: state.lastAction,
    };
  }

  function getInGameText() {
    if (!state.open) {
      return "StormPower\n[F4] Open menu";
    }
    const snap = getSnapshot();
    const lines = [];
    lines.push("StormPower · " + snap.title);
    lines.push("dist " + snap.settings.dist + "m · x" + snap.settings.count + " · " + snap.settings.size + "x");
    const start = Math.max(0, snap.cursor - 2);
    const end = Math.min(snap.items.length, start + 6);
    for (let i = start; i < end; i++) {
      const it = snap.items[i];
      const mark = it.active ? ">" : " ";
      const tog = it.toggle ? (it.on ? " [ON]" : " [OFF]") : "";
      const val = it.cycle ? ": " + it.sub : "";
      lines.push(mark + it.i + " " + it.label + tog + val);
    }
    if (snap.lastAction) lines.push(snap.lastAction);
    lines.push("[F4] close  [Bksp] back");
    return lines.join("\n");
  }

  return {
    handleNav,
    setOpen,
    toggleOpen,
    updateSettings,
    setToggle,
    setSearch,
    getSnapshot,
    getInGameText,
    activate,
    back,
    move,
    selectIndex,
    focusIndex,
    stm,
    stmAt,
    get settings() {
      return state.settings;
    },
    get toggles() {
      return state.toggles;
    },
    get open() {
      return state.open;
    },
  };
}

module.exports = { createMenuEngine, MENU };
