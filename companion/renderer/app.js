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
  const searchEl = document.getElementById("search");

  let applying = false;
  let flashUntil = 0;
  let detached = false;
  let searchTimer = null;

  function setDetachedUi(on) {
    detached = !!on;
    shell.classList.toggle("detached", detached);
    popOutBtn.textContent = detached ? "Dock" : "Pop out";
    popOutBtn.classList.toggle("active", detached);
  }

  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      window.stormpower?.setSearch(searchEl.value);
    }, 60);
  });

  searchEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      e.preventDefault();
      window.stormpower?.nav(
        e.key === "ArrowDown" ? "down" : e.key === "ArrowUp" ? "up" : "select"
      );
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      window.stormpower?.stm(e.key === "ArrowLeft" ? "dec" : "inc");
    }
    if (e.key === "Escape") {
      searchEl.value = "";
      window.stormpower?.setSearch("");
      searchEl.blur();
    }
  });

  backBtn.addEventListener("click", () => window.stormpower?.back());
  popOutBtn.addEventListener("click", () => window.stormpower?.setDetached(!detached));

  function stmControls(item, idx) {
    if (item.folder) return `<span class="chev">›</span>`;
    if (!item.stm && !item.toggle) return `<span class="chev"></span>`;

    // STM: ‹ amount ›  [iPhone switch]
    // Arrows edit amount/value first; switch enables or fires the action.
    const amount = `<span class="stm-value">${item.stmValue || "—"}</span>`;
    const sw = `<button type="button" class="ios-switch ${item.on ? "on" : ""}" data-act="toggle" data-idx="${idx}" aria-label="Enable"><span class="ios-knob"></span></button>`;

    return `
      <div class="stm">
        <button type="button" class="stm-btn" data-act="dec" data-idx="${idx}" aria-label="Decrease">‹</button>
        ${amount}
        <button type="button" class="stm-btn" data-act="inc" data-idx="${idx}" aria-label="Increase">›</button>
        ${sw}
      </div>
    `;
  }

  function render(state) {
    if (!state) return;
    applying = true;
    pathEl.textContent = state.path || state.title || "Home";
    lastAction.textContent = state.lastAction || "";

    if (document.activeElement !== searchEl) {
      searchEl.value = state.search || "";
    }

    listEl.innerHTML = "";
    (state.items || []).forEach((item, idx) => {
      const li = document.createElement("li");
      if (item.active) li.classList.add("active");
      if (item.toggle || item.stm) li.classList.add("has-stm");

      li.innerHTML = `
        <span class="idx">${item.i}</span>
        <span class="label">${item.label}</span>
        ${stmControls(item, idx)}
        ${item.sub ? `<span class="sub">${item.sub}</span>` : ""}
      `;

      li.querySelectorAll("[data-act]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const act = btn.getAttribute("data-act");
          const i = Number(btn.getAttribute("data-idx"));
          if (act === "dec") window.stormpower?.stmAt(i, "dec");
          else if (act === "inc") window.stormpower?.stmAt(i, "inc");
          else if (act === "toggle") window.stormpower?.activateIndex(i);
        });
      });

      li.addEventListener("click", (e) => {
        if (e.target.closest("[data-act]")) return;
        // Folders open on click; STM rows focus so you can set amount then flip the switch
        if (item.folder) window.stormpower?.activateIndex(idx);
        else if (item.stm || item.toggle) window.stormpower?.focusIndex(idx);
        else window.stormpower?.activateIndex(idx);
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
      if (cfg.updateAvailable) updateBanner.classList.remove("hidden");
    });
    updateBtn.addEventListener("click", async () => {
      updateText.textContent = "Opening updater…";
      await window.stormpower.openUpdateUi();
      updateText.textContent = "Update available — stays until you update";
    });
  }

  window.addEventListener("keydown", (e) => {
    if (document.activeElement === searchEl) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      window.stormpower?.stm("dec");
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      window.stormpower?.stm("inc");
      return;
    }
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
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
})();
