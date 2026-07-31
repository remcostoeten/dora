/**
 * Browser-side recorder. Injected into the live Studio page via
 * `page.evaluate(recorderClient, config)`. It listens (passively) to keystrokes
 * on the real Monaco editor, infers `type`/`key`/`wait` steps with measured
 * timing, and on Save hands the result back to Node through `window.__promoSave`.
 *
 * Self-contained on purpose: it runs in the page, so it may not reference
 * anything from module scope. `config` is the only input.
 *
 * @param {{ defaultDelay?: number, name: string }} config
 */
export function recorderClient(config) {
  const events = [];

  function median(nums) {
    if (!nums.length) return 0;
    const s = nums.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function infer() {
    const units = [];
    for (const e of events) {
      const last = units[units.length - 1];
      if (e.kind === "char" && last && last.kind === "char") {
        last.text += e.value;
        last.gaps.push(e.t - last.tEnd);
        last.tEnd = e.t;
      } else if (e.kind === "char") {
        units.push({ kind: "char", text: e.value, t: e.t, tEnd: e.t, gaps: [] });
      } else {
        units.push({ kind: e.kind, value: e.value, t: e.t, tEnd: e.t });
      }
    }

    for (let j = 0; j < units.length; j++) {
      if (units[j].kind !== "caption") continue;
      let k = j + 1;
      while (k < units.length && units[k].kind === "caption") k++;
      if (k < units.length && units[k]._caption == null) {
        units[k]._caption = units[j].value;
        units[j]._dead = true;
      }
    }

    const real = units.filter((u) => !u._dead);
    const steps = [];
    for (let j = 0; j < real.length; j++) {
      const u = real[j];
      if (u.kind === "caption") {
        steps.push({ caption: u.value });
        continue;
      }
      const next = real[j + 1];
      let hold = next ? Math.round((next.t - u.tEnd) / 50) * 50 : 0;
      if (hold < 250) hold = 0;
      if (hold > 8000) hold = 8000;

      const step = {};
      if (u.kind === "char") {
        step.type = u.text;
        const med = median(u.gaps);
        if (med) step.delay = clamp(Math.round(med / 5) * 5, 20, 400);
      } else if (u.kind === "key") {
        step.key = u.value;
      } else if (u.kind === "wait") {
        step.wait = u.value;
      } else if (u.kind === "move") {
        step.move = u.value;
        step.click = true;
      }
      if (u._caption) step.caption = u._caption;
      if (hold) step.holdAfter = hold;
      steps.push(step);
    }
    return steps;
  }

  const onKey = (e) => {
    const tgt = e.target;
    if (tgt && tgt.closest && tgt.closest("#promo-overlay")) return;
    const t = performance.now();
    const k = e.key;
    if (k === "Shift" || k === "Control" || k === "Alt" || k === "Meta") return;

    const printable =
      k && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable) {
      events.push({ t, kind: "char", value: k });
    } else {
      const mods = [];
      if (e.ctrlKey) mods.push("Control");
      if (e.metaKey) mods.push("Meta");
      if (e.altKey) mods.push("Alt");
      const key = k === " " ? "Space" : k;
      events.push({ t, kind: "key", value: mods.length ? mods.concat(key).join("+") : key });
    }
    render();
  };

  const onPointer = (e) => {
    const tgt = e.target;
    if (tgt && tgt.closest && tgt.closest("#promo-overlay")) return;
    events.push({
      t: performance.now(),
      kind: "move",
      value: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
    });
    render();
  };

  const wrap = document.createElement("div");
  wrap.id = "promo-overlay";
  wrap.style.cssText =
    "position:fixed;top:16px;right:16px;z-index:2147483647;width:320px;" +
    "font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
    "color:#e6e6e6;background:#16181d;border:1px solid #2a2e37;border-radius:10px;" +
    "box-shadow:0 8px 30px rgba(0,0,0,.5);overflow:hidden;user-select:none;";
  wrap.innerHTML =
    '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#1c1f26;border-bottom:1px solid #2a2e37">' +
    '<span style="width:9px;height:9px;border-radius:50%;background:#ff4d4f;box-shadow:0 0 8px #ff4d4f"></span>' +
    '<b style="letter-spacing:.04em">REC</b>' +
    '<span style="opacity:.6">scene:</span><span style="color:#7fd1ff">' +
    config.name +
    "</span></div>" +
    '<div id="promo-count" style="padding:8px 12px 4px;opacity:.7">steps captured: 0</div>' +
    '<div id="promo-list" style="max-height:220px;overflow:auto;padding:0 12px 8px;white-space:pre"></div>' +
    '<div id="promo-cap" style="display:none;padding:8px 12px;gap:6px;border-top:1px solid #2a2e37">' +
    '<input id="promo-cap-input" placeholder="caption text…" style="width:100%;box-sizing:border-box;background:#0e0f13;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:6px 8px"></div>' +
    '<div id="promo-hold" style="display:none;padding:8px 12px;gap:6px;border-top:1px solid #2a2e37">' +
    '<input id="promo-hold-input" type="number" value="800" step="100" style="width:100%;box-sizing:border-box;background:#0e0f13;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:6px 8px"></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;background:#1c1f26;border-top:1px solid #2a2e37">' +
    '<button id="promo-btn-cap" style="flex:1">+ caption</button>' +
    '<button id="promo-btn-hold" style="flex:1">+ hold</button>' +
    '<button id="promo-btn-save" style="flex:1;background:#1f6feb;border-color:#1f6feb;color:#fff">save</button>' +
    '<button id="promo-btn-cancel" style="flex:1">cancel</button>' +
    "</div>";
  document.body.appendChild(wrap);

  for (const b of wrap.querySelectorAll("button")) {
    b.style.cssText +=
      "background:#222630;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:6px 8px;cursor:pointer;font:inherit";
  }

  const countEl = wrap.querySelector("#promo-count");
  const listEl = wrap.querySelector("#promo-list");
  const capBox = wrap.querySelector("#promo-cap");
  const capInput = wrap.querySelector("#promo-cap-input");
  const holdBox = wrap.querySelector("#promo-hold");
  const holdInput = wrap.querySelector("#promo-hold-input");

  function describe(s) {
    if (s.move != null) return "move  " + s.move.x + "," + s.move.y + " + click";
    if (s.type != null) return "type  " + JSON.stringify(s.type).slice(1, -1);
    if (s.key != null) return "key   " + s.key;
    if (s.wait != null) return "wait  " + s.wait + "ms";
    if (s.caption != null) return "cap   " + s.caption;
    return "?";
  }

  function render() {
    const steps = infer();
    countEl.textContent = "steps captured: " + steps.length;
    listEl.textContent = steps
      .map((s, i) => {
        const hold = s.holdAfter ? "  ⏱" + s.holdAfter : "";
        const cap = s.caption && s.type != null ? "  💬" + s.caption : "";
        return String(i + 1).padStart(2) + " " + describe(s) + hold + cap;
      })
      .join("\n");
    listEl.scrollTop = listEl.scrollHeight;
  }

  wrap.querySelector("#promo-btn-cap").onclick = () => {
    capBox.style.display = "block";
    capInput.value = "";
    capInput.focus();
  };
  capInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      const v = capInput.value.trim();
      if (v) events.push({ t: performance.now(), kind: "caption", value: v });
      capBox.style.display = "none";
      render();
    } else if (e.key === "Escape") {
      capBox.style.display = "none";
    }
  };

  wrap.querySelector("#promo-btn-hold").onclick = () => {
    holdBox.style.display = "block";
    holdInput.focus();
  };
  holdInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      const v = parseInt(holdInput.value, 10);
      if (v > 0) events.push({ t: performance.now(), kind: "wait", value: v });
      holdBox.style.display = "none";
      render();
    } else if (e.key === "Escape") {
      holdBox.style.display = "none";
    }
  };

  function cleanup() {
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("click", onPointer, true);
    wrap.remove();
  }

  wrap.querySelector("#promo-btn-save").onclick = () => {
    const steps = infer();
    let expect = "";
    try {
      const eds = window.monaco?.editor?.getEditors?.() || [];
      const ed = eds.find((e) => e.getValue().trim().length > 0) || eds[0];
      expect = ed ? ed.getValue() : "";
    } catch (_e) {
      expect = "";
    }
    cleanup();
    window.__promoSave({ steps, expect });
  };

  wrap.querySelector("#promo-btn-cancel").onclick = () => {
    cleanup();
    window.__promoCancel();
  };

  document.addEventListener("keydown", onKey, true);
  document.addEventListener("click", onPointer, true);
  render();
}
