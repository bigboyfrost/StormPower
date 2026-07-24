/**
 * StormPower menu engine — runs in the Electron main process so
 * keyboard navigation works even when Stormworks has focus.
 */
const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "user-settings.json");

const defaultSettings = {
  side: "left",
  peer: 0,
  count: 5,
  size: 1.0,
  dist: 20,
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
  } catch (_) {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), "utf8");
  } catch (_) {}
}

const MENU = {
  home: {
    title: "Home",
    items: [
      { label: "Animals", sub: "Sharks, whales, krakens", goto: "animals" },
      { label: "Creatures", sub: "Wildlife & monsters (DLC)", goto: "creatures" },
      { label: "Weapons & Ammo", sub: "Guns into your inventory", goto: "weapons" },
      { label: "Tools & Equipment", sub: "Meds, torches, radios", goto: "equipment" },
      { label: "Outfits", sub: "Suits and armor", goto: "outfits" },
      { label: "World Objects", sub: "Barrels, crates, props", goto: "objects" },
      { label: "Explosions", sub: "Blasts around you (Weapons DLC)", goto: "explosions" },
      { label: "Weather & Waves", sub: "Ultra wind, massive seas", goto: "weather" },
      { label: "Disasters", sub: "Tsunami, tornado, meteor…", goto: "disasters" },
      { label: "Player", sub: "Heal, money, loadout", goto: "player" },
      { label: "Game Rules", sub: "Fuel, damage, no-clip", goto: "rules" },
      { label: "Overlay Side", sub: "Left or right of the screen", goto: "side" },
      { label: "Clean Up Spawns", sub: "Remove StormPower spawns", cmd: "cleanup" },
    ],
  },
  side: {
    title: "Overlay Side",
    items: [
      { label: "Appear on Left", sub: "Default", cmd: "set_side", side: "left" },
      { label: "Appear on Right", cmd: "set_side", side: "right" },
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
      { label: "Ultra Wind x5", sub: "Pushes weather wind hard (visual/force)", cmd: "ultra_wind", wind: 5 },
      { label: "Ultra Wind x10", sub: "Maximum ultra wind push", cmd: "ultra_wind", wind: 10 },
      { label: "MASSIVE WAVES", sub: "Cancel+respawn tsunami loop @ spawn dist", cmd: "sea", mode: 2, wind: 1 },
      { label: "ULTRA MASSIVE WAVES", sub: "Faster despawn/respawn + ultra wind", cmd: "sea", mode: 3, wind: 10 },
      { label: "Stop Massive Waves", sub: "Cancel wave events, calm wind", cmd: "sea", mode: 0, wind: 0 },
      { label: "Spawn One Mega Wave", sub: "Uses spawn distance in front of you", cmd: "mega_wave" },
      { label: "Disable Disaster Sirens", sub: "Force-mute warning towers", cmd: "sirens", mode: "off" },
      { label: "Enable Disaster Sirens", sub: "Allow warning towers again", cmd: "sirens", mode: "on" },
      { label: "Despawn Siren Towers", sub: "Remove towers entirely (nuclear option)", cmd: "sirens", mode: "kill" },
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
  rules: {
    title: "Game Rules",
    items: [
      { label: "Infinite Fuel ON", cmd: "setting", key: "infinite_fuel", value: 1 },
      { label: "Infinite Fuel OFF", cmd: "setting", key: "infinite_fuel", value: 0 },
      { label: "Infinite Batteries ON", cmd: "setting", key: "infinite_batteries", value: 1 },
      { label: "No Clip ON", cmd: "setting", key: "no_clip", value: 1 },
      { label: "No Clip OFF", cmd: "setting", key: "no_clip", value: 0 },
      { label: "Player Damage OFF", cmd: "setting", key: "player_damage", value: 0 },
      { label: "Player Damage ON", cmd: "setting", key: "player_damage", value: 1 },
      { label: "Vehicle Damage OFF", cmd: "setting", key: "vehicle_damage", value: 0 },
      { label: "Unlock All Islands", cmd: "setting", key: "unlock_all_islands", value: 1 },
    ],
  },
};

function createMenuEngine({ enqueue, onChange, onSideChange }) {
  const state = {
    open: false,
    stack: ["home"],
    cursor: 0,
    settings: loadSettings(),
    lastAction: "",
  };

  function page() {
    return MENU[state.stack[state.stack.length - 1]] || MENU.home;
  }

  function notify() {
    if (typeof onChange === "function") onChange(getSnapshot());
  }

  function buildCommand(item) {
    const s = state.settings;
    const peer = Math.max(0, Math.floor(Number(s.peer) || 0));
    const count = Math.max(1, Math.floor(Number(s.count) || 1));
    const size = Math.max(0.5, Number(s.size) || 1);
    const dist = Math.max(1, Math.min(5000, Math.floor(Number(s.dist) || 20)));

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
      case "ultra_wind":
        return `ultra_wind|${peer}|${item.wind}`;
      case "mega_wave":
        return `mega_wave|${peer}|${dist}`;
      case "sirens":
        return `sirens|${peer}|${item.mode}`;
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
    if (item.cmd === "set_side") {
      state.settings.side = item.side === "right" ? "right" : "left";
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
    if (partial.side && typeof onSideChange === "function") onSideChange(state.settings.side);
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
        active: i === state.cursor,
      })),
      settings: { ...state.settings },
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
      lines.push(mark + it.i + " " + it.label);
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
    getSnapshot,
    getInGameText,
    activate,
    back,
    move,
    selectIndex,
    get settings() {
      return state.settings;
    },
    get open() {
      return state.open;
    },
  };
}

module.exports = { createMenuEngine, MENU };
