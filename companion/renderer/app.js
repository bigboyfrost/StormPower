(() => {
  const shell = document.getElementById("shell");
  const listEl = document.getElementById("list");
  const pathEl = document.getElementById("path");
  const linkStatus = document.getElementById("linkStatus");
  const versionPill = document.getElementById("versionPill");
  const updateBanner = document.getElementById("updateBanner");
  const updateText = document.getElementById("updateText");
  const updateBtn = document.getElementById("updateBtn");
  const backBtn = document.getElementById("backBtn");
  const popOutBtn = document.getElementById("popOutBtn");
  const lastAction = document.getElementById("lastAction");
  const peerEl = document.getElementById("peer");
  const countEl = document.getElementById("count");
  const sizeEl = document.getElementById("size");
  const distEl = document.getElementById("dist");
  const peerValue = document.getElementById("peerValue");
  const countValue = document.getElementById("countValue");
  const sizeValue = document.getElementById("sizeValue");
  const distValue = document.getElementById("distValue");
  const sideLeft = document.getElementById("sideLeft");
  const sideRight = document.getElementById("sideRight");

  let applying = false;
  let flashUntil = 0;
  let detached = false;

  function sizeFromSlider() {
    return Number(sizeEl.value) / 2;
  }

  function syncLabels() {
    peerValue.textContent = String(peerEl.value);
    countValue.textContent = String(countEl.value);
    sizeValue.textContent = `${sizeFromSlider().toFixed(1)}×`;
    distValue.textContent = `${distEl.value} m`;
  }

  function pushSettings() {
    if (applying || !window.stormpower) return;
    window.stormpower.updateSettings({
      peer: Number(peerEl.value),
      count: Number(countEl.value),
      size: sizeFromSlider(),
      dist: Number(distEl.value),
    });
  }

  function setDetachedUi(on) {
    detached = !!on;
    shell.classList.toggle("detached", detached);
    popOutBtn.textContent = detached ? "Dock" : "Pop out";
    popOutBtn.classList.toggle("active", detached);
  }

  [peerEl, countEl, sizeEl, distEl].forEach((el) => {
    el.addEventListener("input", () => {
      syncLabels();
      pushSettings();
    });
  });

  sideLeft.addEventListener("click", () => {
    window.stormpower?.updateSettings({ side: "left" });
  });
  sideRight.addEventListener("click", () => {
    window.stormpower?.updateSettings({ side: "right" });
  });

  backBtn.addEventListener("click", () => window.stormpower?.back());
  popOutBtn.addEventListener("click", () => window.stormpower?.setDetached(!detached));

  function render(state) {
    if (!state) return;
    applying = true;
    pathEl.textContent = state.path || state.title || "Home";
    lastAction.textContent = state.lastAction || "";

    if (state.settings) {
      peerEl.value = state.settings.peer ?? 0;
      countEl.value = state.settings.count ?? 5;
      distEl.value = state.settings.dist ?? 20;
      sizeEl.value = Math.round((state.settings.size ?? 1) * 2);
      sideLeft.classList.toggle("active", state.settings.side !== "right");
      sideRight.classList.toggle("active", state.settings.side === "right");
      syncLabels();
    }

    listEl.innerHTML = "";
    (state.items || []).forEach((item, idx) => {
      const li = document.createElement("li");
      if (item.active) li.classList.add("active");
      if (item.toggle) li.classList.add("has-toggle");

      const right = item.folder
        ? `<span class="chev">›</span>`
        : item.toggle
          ? `<button type="button" class="ios-switch ${item.on ? "on" : ""}" data-idx="${idx}" aria-label="Toggle ${item.label}"><span class="ios-knob"></span></button>`
          : `<span class="chev"></span>`;

      li.innerHTML = `
        <span class="idx">${item.i}</span>
        <span class="label">${item.label}</span>
        ${right}
        ${item.sub ? `<span class="sub">${item.sub}</span>` : ""}
      `;

      const sw = li.querySelector(".ios-switch");
      if (sw) {
        sw.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.stormpower?.activateIndex(idx);
        });
      }
      li.addEventListener("click", (e) => {
        if (e.target.closest(".ios-switch")) return;
        window.stormpower?.activateIndex(idx);
      });
      listEl.appendChild(li);
    });
    listEl.querySelector(".active")?.scrollIntoView({ block: "nearest" });
    applying = false;
  }

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
    window.stormpower.onState(render);
    window.stormpower.onStatus((s) => {
      setLinked(!!s?.lastPoll && Date.now() - s.lastPoll < 3000);
    });
    window.stormpower.onUpdate((info) => {
      if (!info?.updateAvailable) return;
      updateBanner.classList.remove("hidden");
      updateText.textContent = `Update ${info.latest} available`;
    });
    window.stormpower.onDetach((s) => setDetachedUi(!!s?.detached));
    window.stormpower.getConfig().then((cfg) => {
      versionPill.textContent = `v${cfg.version || "—"}`;
      if (cfg.state) render(cfg.state);
      setDetachedUi(!!cfg.detached);
    });
    updateBtn.addEventListener("click", async () => {
      updateText.textContent = "Opening updater…";
      await window.stormpower.openUpdateUi();
      updateText.textContent = "Update available";
    });
  }

  window.addEventListener("keydown", (e) => {
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
      window.stormpower?.nav(map[e.key]);
    }
  });

  syncLabels();
})();
