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
  const countEl = document.getElementById("count");
  const sizeEl = document.getElementById("size");
  const distEl = document.getElementById("dist");
  const countValue = document.getElementById("countValue");
  const sizeValue = document.getElementById("sizeValue");
  const distValue = document.getElementById("distValue");
  const searchEl = document.getElementById("search");

  let applying = false;
  let flashUntil = 0;
  let detached = false;
  let searchTimer = null;

  function sizeFromSlider() {
    return Number(sizeEl.value) / 2;
  }

  function syncLabels() {
    countValue.textContent = String(countEl.value);
    sizeValue.textContent = `${sizeFromSlider().toFixed(1)}×`;
    distValue.textContent = `${distEl.value} m`;
  }

  function pushSettings() {
    if (applying || !window.stormpower) return;
    window.stormpower.updateSettings({
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

  [countEl, sizeEl, distEl].forEach((el) => {
    el.addEventListener("input", () => {
      syncLabels();
      pushSettings();
    });
  });

  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      window.stormpower?.setSearch(searchEl.value);
    }, 80);
  });

  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      e.preventDefault();
      window.stormpower?.nav(
        e.key === "ArrowDown" ? "down" : e.key === "ArrowUp" ? "up" : "select"
      );
    }
    if (e.key === "Escape") {
      searchEl.value = "";
      window.stormpower?.setSearch("");
      searchEl.blur();
    }
  });

  backBtn.addEventListener("click", () => window.stormpower?.back());
  popOutBtn.addEventListener("click", () => window.stormpower?.setDetached(!detached));

  function render(state) {
    if (!state) return;
    applying = true;
    pathEl.textContent = state.path || state.title || "Home";
    lastAction.textContent = state.lastAction || "";

    if (document.activeElement !== searchEl) {
      searchEl.value = state.search || "";
    }

    if (state.settings) {
      countEl.value = state.settings.count ?? 5;
      distEl.value = state.settings.dist ?? 20;
      sizeEl.value = Math.round((state.settings.size ?? 1) * 2);
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
      updateText.textContent = `Update v${info.latest} available — stays until you update`;
    });
    window.stormpower.onDetach((s) => setDetachedUi(!!s?.detached));
    window.stormpower.getConfig().then((cfg) => {
      versionPill.textContent = `v${cfg.version || "—"}`;
      if (cfg.state) render(cfg.state);
      setDetachedUi(!!cfg.detached);
      if (cfg.state?.updateAvailable || cfg.updateAvailable) {
        updateBanner.classList.remove("hidden");
      }
    });
    updateBtn.addEventListener("click", async () => {
      updateText.textContent = "Opening updater…";
      await window.stormpower.openUpdateUi();
      updateText.textContent = "Update available — stays until you update";
    });
  }

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === searchEl) return;
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
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      searchEl.focus();
    }
  });

  syncLabels();
})();
