(() => {
  const listEl = document.getElementById("list");
  const pathEl = document.getElementById("path");
  const linkStatus = document.getElementById("linkStatus");
  const versionPill = document.getElementById("versionPill");
  const updateBanner = document.getElementById("updateBanner");
  const updateText = document.getElementById("updateText");
  const updateBtn = document.getElementById("updateBtn");
  const peerEl = document.getElementById("peer");
  const countEl = document.getElementById("count");
  const sizeEl = document.getElementById("size");
  const distEl = document.getElementById("dist");
  const peerValue = document.getElementById("peerValue");
  const countValue = document.getElementById("countValue");
  const sizeValue = document.getElementById("sizeValue");
  const distValue = document.getElementById("distValue");

  // size slider 1..40 maps to 0.5 .. 20.0
  function sizeFromSlider() {
    return (Number(sizeEl.value) / 2).toFixed(1);
  }

  function syncLabels() {
    peerValue.textContent = String(peerEl.value);
    countValue.textContent = String(countEl.value);
    sizeValue.textContent = `${sizeFromSlider()}×`;
    distValue.textContent = `${distEl.value} m`;
  }

  [peerEl, countEl, sizeEl, distEl].forEach((el) => el.addEventListener("input", syncLabels));
  syncLabels();

  const MENU = {
    home: {
      title: "Home",
      items: [
        { label: "Animals", sub: "Sharks, whales, krakens", goto: "animals" },
        { label: "Creatures", sub: "Bears, wolves, zombies (DLC)", goto: "creatures" },
        { label: "Weapons & Ammo", sub: "Put guns into your inventory", goto: "weapons" },
        { label: "Tools & Equipment", sub: "Meds, torches, radios", goto: "equipment" },
        { label: "Outfits", sub: "Suits and armor", goto: "outfits" },
        { label: "World Objects", sub: "Barrels, crates, props", goto: "objects" },
        { label: "Weather & Wind", sub: "Push wind past stock limits", goto: "weather" },
        { label: "Disasters", sub: "Tsunami, tornado, meteor…", goto: "disasters" },
        { label: "Player", sub: "Heal, money, loadout", goto: "player" },
        { label: "Game Rules", sub: "Fuel, damage, no-clip", goto: "rules" },
        { label: "Clean Up Spawns", sub: "Remove StormPower-spawned things", cmd: "cleanup" },
      ],
    },
    animals: {
      title: "Animals",
      items: [
        { label: "Shark", sub: "Uses Amount × Scale × Distance", cmd: "spawn_animal", id: 0 },
        { label: "Whale", sub: "Uses Amount × Scale × Distance", cmd: "spawn_animal", id: 1 },
        { label: "Kraken", sub: "Uses Amount × Scale × Distance", cmd: "spawn_animal", id: 4 },
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
        { label: "Full Combat Loadout", sub: "Rifle, ammo, grenades, armor", cmd: "loadout" },
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
        { label: "Night Vision Binoculars", cmd: "give", id: 17, slot: 2, int: 0, float: 100 },
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
        { label: "Clear Skies", sub: "Fog/rain off, calm wind", cmd: "weather", fog: 0, rain: 0, wind: 0 },
        { label: "Stock Max Wind", sub: "Game default ceiling (1.0)", cmd: "weather", fog: 0, rain: 0, wind: 1 },
        { label: "StormPower Wind 2×", sub: "Beyond stock — reinforced every tick", cmd: "wind_boost", wind: 2 },
        { label: "StormPower Wind 3×", sub: "Stronger than the weather slider allows", cmd: "wind_boost", wind: 3 },
        { label: "StormPower Wind 5×", sub: "Extreme — vehicles will feel it", cmd: "wind_boost", wind: 5 },
        { label: "StormPower Wind 10×", sub: "Maximum boost StormPower will push", cmd: "wind_boost", wind: 10 },
        { label: "Stop Wind Boost", sub: "Return control to normal weather", cmd: "wind_boost", wind: 0 },
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

  let stack = ["home"];
  let cursor = 0;
  let flashUntil = 0;

  function page() {
    return MENU[stack[stack.length - 1]] || MENU.home;
  }

  function render() {
    pathEl.textContent = stack.map((k) => MENU[k]?.title || k).join(" › ");
    listEl.innerHTML = "";
    page().items.forEach((item, i) => {
      const li = document.createElement("li");
      if (i === cursor) li.classList.add("active");
      li.innerHTML = `
        <span class="idx">${i + 1}</span>
        <span class="label">${item.label}</span>
        <span class="chev">${item.goto ? "›" : ""}</span>
        ${item.sub ? `<span class="sub">${item.sub}</span>` : ""}
      `;
      li.addEventListener("mouseenter", () => {
        cursor = i;
        highlight();
      });
      li.addEventListener("click", () => {
        cursor = i;
        activate();
      });
      listEl.appendChild(li);
    });
    highlight();
  }

  function highlight() {
    [...listEl.children].forEach((li, i) => li.classList.toggle("active", i === cursor));
    listEl.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  function vals() {
    return {
      peer: Math.max(0, Math.floor(Number(peerEl.value) || 0)),
      count: Math.max(1, Math.floor(Number(countEl.value) || 1)),
      size: Math.max(0.5, Number(sizeFromSlider())),
      dist: Math.max(1, Math.floor(Number(distEl.value) || 20)),
    };
  }

  function build(item) {
    const v = vals();
    switch (item.cmd) {
      case "spawn_animal":
        return `spawn_animal|${v.peer}|${item.id}|${v.count}|${v.size}|${v.dist}`;
      case "spawn_creature":
        return `spawn_creature|${v.peer}|${item.id}|${v.count}|${v.size}|${v.dist}`;
      case "spawn_object":
        return `spawn_object|${v.peer}|${item.id}|${v.count}|${v.dist}`;
      case "give":
        return `give|${v.peer}|${item.id}|${item.slot}|${item.int}|${item.float}`;
      case "outfit":
        return `outfit|${v.peer}|${item.id}`;
      case "disaster":
        return `disaster|${v.peer}|${item.id}|${Math.max(v.dist, 60)}`;
      case "weather":
        return `weather|${v.peer}|${item.fog}|${item.rain}|${item.wind}`;
      case "wind_boost":
        return `wind_boost|${v.peer}|${item.wind}`;
      case "heal":
        return `heal|${v.peer}`;
      case "clear_inv":
        return `clear_inv|${v.peer}`;
      case "loadout":
        return `loadout|${v.peer}`;
      case "c4_kit":
        return `c4_kit|${v.peer}`;
      case "spear_kit":
        return `spear_kit|${v.peer}`;
      case "money":
        return `money|${v.peer}`;
      case "cleanup":
        return `cleanup|${v.peer}`;
      case "setting":
        return `setting|${v.peer}|${item.key}|${item.value}`;
      default:
        return null;
    }
  }

  async function queue(line) {
    if (window.stormpower) {
      window.stormpower.queueCommand(line);
    } else {
      await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line }),
      });
    }
    linkStatus.textContent = "Sent to game";
    linkStatus.className = "pill ok";
    flashUntil = Date.now() + 900;
  }

  function activate() {
    const item = page().items[cursor];
    if (!item) return;
    if (item.goto) {
      stack.push(item.goto);
      cursor = 0;
      render();
      return;
    }
    const line = build(item);
    if (line) queue(line);
  }

  function back() {
    if (stack.length > 1) {
      stack.pop();
      cursor = 0;
      render();
    } else if (window.stormpower) {
      window.stormpower.hideMenu();
    }
  }

  function move(delta) {
    const n = page().items.length;
    if (!n) return;
    cursor = (cursor + delta + n) % n;
    highlight();
  }

  function onNav(action) {
    if (action === "up") move(-1);
    else if (action === "down") move(1);
    else if (action === "select") activate();
    else if (action === "back") back();
    else if (action.startsWith("num:")) {
      const idx = Number(action.slice(4)) - 1;
      if (page().items[idx]) {
        cursor = idx;
        activate();
      }
    }
  }

  window.addEventListener("keydown", (e) => {
    // Fallback if window somehow has focus
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "back",
      ArrowRight: "select",
      Enter: "select",
      Backspace: "back",
      Escape: "back",
    };
    if (map[e.key]) {
      e.preventDefault();
      onNav(map[e.key]);
    } else if (/^[1-9]$/.test(e.key)) {
      onNav(`num:${e.key}`);
    }
  });

  function setLinked(ok) {
    if (Date.now() < flashUntil) return;
    if (ok) {
      linkStatus.textContent = "Linked to Stormworks";
      linkStatus.className = "pill ok";
    } else {
      linkStatus.textContent = "Waiting for game";
      linkStatus.className = "pill warning";
    }
  }

  if (window.stormpower) {
    window.stormpower.onNav(onNav);
    window.stormpower.onVisibility(() => {});
    window.stormpower.onStatus((s) => setLinked(!!s?.lastPoll && Date.now() - s.lastPoll < 3000));
    window.stormpower.onUpdate((info) => {
      if (!info?.updateAvailable) return;
      updateBanner.classList.remove("hidden");
      updateText.textContent = `Update ${info.latest} available`;
    });
    window.stormpower.getConfig().then((cfg) => {
      versionPill.textContent = `v${cfg.version || "—"}`;
    });
    updateBtn.addEventListener("click", async () => {
      updateText.textContent = "Updating…";
      const res = await window.stormpower.applyUpdate();
      updateText.textContent = res?.message || (res?.applied ? "Updated — restart StormPower" : "Update failed");
    });
  } else {
    setInterval(async () => {
      try {
        const res = await fetch("/api/status");
        const data = await res.json();
        setLinked(!!data.connected);
      } catch (_) {
        linkStatus.textContent = "Bridge offline";
        linkStatus.className = "pill bad";
      }
    }, 1000);
  }

  render();
})();
