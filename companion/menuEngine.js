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
  count: 5,
  size: 1.0,
  dist: 20,
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch (_) {
    return { ...defaultSettings };
  }
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
      { label: "Toggles", sub: "Waves, boost, rules, sirens…", goto: "toggles" },
      { label: "Spawns", sub: "Animals, creatures, objects", goto: "spawns" },
      { label: "Gear", sub: "Weapons, tools, outfits", goto: "gear" },
      { label: "World", sub: "Weather, disasters, explosions", goto: "world" },
      { label: "Player", sub: "Heal, money, loadout", goto: "player" },
      { label: "Settings", sub: "Overlay, updates, cleanup", goto: "settings" },
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
  world: {
    title: "World",
    items: [
      { label: "Weather & Waves", sub: "One-shot weather / wave presets", goto: "weather" },
      { label: "Disasters", sub: "Tsunami, tornado, meteor…", goto: "disasters" },
      { label: "Explosions", sub: "Blasts around you (Weapons DLC)", goto: "explosions" },
    ],
  },
  toggles: {
    title: "Toggles",
    items: [
      {
        label: "Mute Disaster Sirens",
        sub: "Force warning towers off",
        toggle: "sirens_muted",
        cmd: "sirens_toggle",
      },
      {
        label: "Massive Waves",
        sub: "Live RAM tsunami boost — no restart",
        toggle: "massive_waves",
        cmd: "sea_toggle",
      },
      {
        label: "Ultra Massive Waves",
        sub: "Live RAM 120x tsunami — wrecks boats, no wind",
        toggle: "ultra_waves",
        cmd: "sea_toggle_ultra",
      },
      {
        label: "Mega Wave Engine",
        sub: "Locks live wave boost + shader for next boot",
        toggle: "engine_mod",
        local: "engine_mod",
      },
      {
        label: "Overrev Engine Power",
        sub: "Live RAM 25x Medium/Large torque",
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
      {
        label: "Menu on Right",
        sub: "Off = left side",
        toggle: "side_right",
        cmd: "side_toggle",
      },
    ],
  },
  settings: {
    title: "Settings",
    items: [
      { label: "Unlock All Islands", cmd: "setting", key: "unlock_all_islands", value: 1 },
      {
        label: "Check for Updates",
        sub: "Look for a new StormPower release",
        local: "check_updates",
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
  weather: {
    title: "Weather & Waves",
    items: [
      { label: "Clear / Calm Seas", sub: "No wind, flat water", cmd: "sea", mode: 0, wind: 0 },
      { label: "Choppy Seas", sub: "Wind 0.72", cmd: "sea", mode: 1, wind: 0.72 },
      { label: "Max Weather Waves", sub: "Wind 1.0 — tallest stock waves", cmd: "sea", mode: 1, wind: 1 },
      { label: "Ultra Wind x5", sub: "Force shove only (not wave height)", cmd: "ultra_wind", wind: 5 },
      { label: "Ultra Wind x10", sub: "Force shove only", cmd: "ultra_wind", wind: 10 },
      { label: "50x Wind", sub: "Chaos shove — separate from Ultra Waves", cmd: "ultra_wind", wind: 50 },
      { label: "Spawn One Mega Wave", sub: "Uses spawn distance in front of you", cmd: "mega_wave" },
      { label: "Despawn Siren Towers", sub: "Remove towers entirely", cmd: "sirens", mode: "kill" },
      { label: "Heavy Fog", cmd: "weather", fog: 1, rain: 0, wind: 0.2 },
      { label: "Heavy Rain + Wind", cmd: "weather", fog: 0.2, rain: 1, wind: 0.85 },
    ],
  },
  disasters: {
    title: "Disasters",
    items: [
      { label: "Tsunami", sub: "At spawn distance ahead", cmd: "disaster", id: "tsunami" },
      { label: "Whirlpool", cmd: "disaster", id: "whirlpool" },
      { label: "Tornado", cmd: "disaster", id: "tornado" },
      { label: "Meteor", cmd: "disaster", id: "meteor" },
      { label: "Meteor Shower", cmd: "disaster", id: "shower" },
      { label: "Volcano", cmd: "disaster", id: "volcano" },
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

function createMenuEngine({ enqueue, onChange, onSideChange, onLocalAction, onToggle }) {
  const state = {
    open: false,
    stack: ["home"],
    cursor: 0,
    settings: loadSettings(),
    lastAction: "",
    toggles: {
      chaos: false,
      boost: false,
      engine_mod: false,
      overrev_engine: false,
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

  function notify() {
    if (typeof onChange === "function") onChange(getSnapshot());
  }

  function peerId() {
    return Math.max(0, Math.floor(Number(state.settings.peer) || 0));
  }

  function distM() {
    return Math.max(1, Math.min(5000, Math.floor(Number(state.settings.dist) || 20)));
  }

  function buildCommand(item, toggleOn) {
    const s = state.settings;
    const peer = peerId();
    const count = Math.max(1, Math.floor(Number(s.count) || 1));
    const size = Math.max(0.5, Number(s.size) || 1);
    const dist = distM();

    switch (item.cmd) {
      case "spawn_animal":
        return `spawn_animal|${peer}|${item.id}|${count}|${size}|${dist}`;
      case "spawn_creature":
        return `spawn_creature|${peer}|${item.id}|${count}|${size}|${dist}`;
      case "spawn_object":
        return `spawn_object|${peer}|${item.id}|${count}|${dist}`;
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
      case "mega_wave":
        return `mega_wave|${peer}|${dist}`;
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

  function activate() {
    const item = page().items[state.cursor];
    if (!item) return;
    if (item.goto) {
      state.stack.push(item.goto);
      state.cursor = 0;
      state.lastAction = "Opened " + item.label;
      notify();
      return;
    }

    // Local companion actions (engine mod, update check, etc.) — not sent to Lua
    if (item.local) {
      let next = true;
      if (item.toggle) {
        next = !state.toggles[item.toggle];
        state.toggles[item.toggle] = next;
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
    const line = buildCommand(item);
    if (line) {
      enqueue(line);
      state.lastAction = "Sent: " + item.label;
      notify();
    }
  }

  function back() {
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
    const n = page().items.length;
    if (!n) return;
    state.cursor = (state.cursor + delta + n) % n;
    notify();
  }

  function selectIndex(idx) {
    const items = page().items;
    if (items[idx]) {
      state.cursor = idx;
      activate();
    }
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

  function getSnapshot() {
    const p = page();
    return {
      open: state.open,
      path: state.stack.map((k) => MENU[k]?.title || k).join(" > "),
      title: p.title,
      cursor: state.cursor,
      items: p.items.map((it, i) => ({
        i: i + 1,
        label: it.label,
        sub: it.sub || "",
        folder: !!it.goto,
        toggle: it.toggle || null,
        on: it.toggle ? !!state.toggles[it.toggle] : false,
        active: i === state.cursor,
      })),
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
      lines.push(mark + it.i + " " + it.label + tog);
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
    getSnapshot,
    getInGameText,
    activate,
    back,
    move,
    selectIndex,
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
