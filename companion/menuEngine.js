/**
 * StormPower menu engine — runs in the Electron main process so
 * keyboard navigation works even when Stormworks has focus.
 */
const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "user-settings.json");

const defaultSettings = {
  side: "left", // left | right
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
      { label: "Creatures", sub: "Bears, wolves, zombies (DLC)", goto: "creatures" },
      { label: "Weapons & Ammo", sub: "Guns into your inventory", goto: "weapons" },
      { label: "Tools & Equipment", sub: "Meds, torches, radios", goto: "equipment" },
      { label: "Outfits", sub: "Suits and armor", goto: "outfits" },
      { label: "World Objects", sub: "Barrels, crates, props", goto: "objects" },
      { label: "Weather & Wind", sub: "Wind beyond stock limits", goto: "weather" },
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
      { label: "Polar Bear", cmd: "spawn_creature", id: 3 },
      { label: "Plains Wolf", cmd: "spawn_creature", id: 63 },
      { label: "Arctic Wolf", cmd: "spawn_creature", id: 61 },
      { label: "Sasquatch", cmd: "spawn_creature", id: 12 },
      { label: "Yeti", cmd: "spawn_creature", id: 13 },
      { label: "Crocodile", cmd: "spawn_creature", id: 101 },
      { label: "Mountain Lion", cmd: "spawn_creature", id: 100 },
      { label: "Zombie (Male)", cmd: "spawn_creature", id: 64 },
      { label: "Zombie (Female)", cmd: "spawn_creature", id: 80 },
      { label: "German Shepherd", cmd: "spawn_creature", id: 25 },
      { label: "Husky", cmd: "spawn_creature", id: 32 },
      { label: "Deer", cmd: "spawn_creature", id: 15 },
      { label: "Penguin", cmd: "spawn_creature", id: 51 },
      { label: "Seal", cmd: "spawn_creature", id: 56 },
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
      { label: "Armor Vest", cmd: "outfit", id: 78 },
      { label: "Plate Vest", cmd: "outfit", id: 77 },
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
    ],
  },
  weather: {
    title: "Weather & Wind",
    items: [
      { label: "Clear Skies", cmd: "weather", fog: 0, rain: 0, wind: 0 },
      { label: "Stock Max Wind (1×)", cmd: "weather", fog: 0, rain: 0, wind: 1 },
      { label: "StormPower Wind 2×", cmd: "wind_boost", wind: 2 },
      { label: "StormPower Wind 3×", cmd: "wind_boost", wind: 3 },
      { label: "StormPower Wind 5×", cmd: "wind_boost", wind: 5 },
      { label: "StormPower Wind 10×", cmd: "wind_boost", wind: 10 },
      { label: "Stop Wind Boost", cmd: "wind_boost", wind: 0 },
      { label: "Heavy Fog", cmd: "weather", fog: 1, rain: 0, wind: 0.2 },
      { label: "Heavy Rain", cmd: "weather", fog: 0.2, rain: 1, wind: 0.4 },
    ],
  },
  disasters: {
    title: "Disasters",
    items: [
      { label: "Tsunami", cmd: "disaster", id: "tsunami" },
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
    const dist = Math.max(1, Math.floor(Number(s.dist) || 20));

    switch (item.cmd) {
      case "spawn_animal":
        return `spawn_animal|${peer}|${item.id}|${count}|${size}|${dist}`;
      case "spawn_creature":
        return `spawn_creature|${peer}|${item.id}|${count}|${size}|${dist}`;
      case "spawn_object":
        return `spawn_object|${peer}|${item.id}|${count}|${dist}`;
      case "give":
        return `give|${peer}|${item.id}|${item.slot}|${item.int}|${item.float}`;
      case "outfit":
        return `outfit|${peer}|${item.id}`;
      case "disaster":
        return `disaster|${peer}|${item.id}|${Math.max(dist, 60)}`;
      case "weather":
        return `weather|${peer}|${item.fog}|${item.rain}|${item.wind}`;
      case "wind_boost":
        return `wind_boost|${peer}|${item.wind}`;
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
        // at root — close
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

  /** Compact text for Stormworks setPopupScreen (fullscreen-safe). */
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
    // Popup wraps ~13 chars; keep lines short-ish
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
