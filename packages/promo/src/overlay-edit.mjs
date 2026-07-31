/**
 * Browser-side timeline editor. Injected into a blank page via
 * `page.evaluate(editorClient, { scene })`. Renders the scene's steps as an
 * editable list (text/delay/holdAfter/caption, reorder, delete, add) plus
 * global lead-in / default-delay, and on Save hands the edited scene fields
 * back to Node through `window.__promoSave`.
 *
 * Self-contained: runs in the page, references only `config`.
 *
 * @param {{ scene: import("./runner.mjs").Scene }} config
 */
export function editorClient(config) {
  const scene = config.scene;
  const steps = (scene.steps || []).map((s) => Object.assign({}, s));
  const meta = {
    leadInMs: scene.leadInMs ?? 600,
    defaultDelay: scene.defaultDelay ?? 95,
    cursor: Object.assign(
      {
        duration: 420,
        bend: 0.16,
        easing: [0.22, 0.8, 0.25, 1],
        size: 16,
        ripple: true,
      },
      scene.cursor || {},
    ),
  };

  document.body.style.cssText =
    "margin:0;background:#0e0f13;color:#e6e6e6;" +
    "font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;";

  const root = document.createElement("div");
  root.style.cssText = "max-width:760px;margin:0 auto;padding:24px 20px 80px";
  document.body.appendChild(root);

  function el(tag, css, props) {
    const n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (props) Object.assign(n, props);
    return n;
  }

  function field(label, value, type, onChange, width) {
    const wrap = el("label", "display:inline-flex;flex-direction:column;gap:2px;margin:0 10px 6px 0");
    wrap.appendChild(el("span", "font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.05em", { textContent: label }));
    const input = el("input", `background:#16181d;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:5px 7px;font:inherit;width:${width || "90px"}`);
    input.type = type;
    input.value = value == null ? "" : value;
    input.oninput = () => onChange(input.value);
    wrap.appendChild(input);
    return wrap;
  }

  function kindOf(s) {
    if (s.move != null) return "move";
    if (s.type != null) return "type";
    if (s.key != null) return "key";
    if (s.wait != null) return "wait";
    return "caption";
  }

  function num(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  function decimal(v) {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  function curve(v) {
    const values = String(v)
      .split(",")
      .map((part) => parseFloat(part.trim()));
    return values.length === 4 && values.every(Number.isFinite)
      ? values
      : undefined;
  }

  const header = el("div", "display:flex;align-items:baseline;gap:10px;margin-bottom:6px");
  header.appendChild(el("h1", "font-size:18px;margin:0", { textContent: "edit: " }));
  header.appendChild(el("span", "color:#7fd1ff;font-size:18px", { textContent: scene.name }));
  if (scene.mode) header.appendChild(el("span", "opacity:.5", { textContent: "· " + scene.mode }));
  root.appendChild(header);

  const globals = el("div", "display:flex;flex-wrap:wrap;margin:10px 0 18px;padding-bottom:14px;border-bottom:1px solid #2a2e37");
  globals.appendChild(field("leadInMs", meta.leadInMs, "number", (v) => { meta.leadInMs = num(v) ?? 0; renderFooter(); }));
  globals.appendChild(field("defaultDelay", meta.defaultDelay, "number", (v) => { meta.defaultDelay = num(v) ?? 0; renderFooter(); }));
  globals.appendChild(field("cursor duration", meta.cursor.duration, "number", (v) => { meta.cursor.duration = num(v) ?? 420; renderFooter(); }));
  globals.appendChild(field("cursor bend", meta.cursor.bend, "number", (v) => { meta.cursor.bend = decimal(v) ?? 0.16; }, "72px"));
  globals.appendChild(field("cubic curve", meta.cursor.easing.join(", "), "text", (v) => { meta.cursor.easing = curve(v) ?? meta.cursor.easing; }, "170px"));
  globals.appendChild(field("cursor size", meta.cursor.size, "number", (v) => { meta.cursor.size = num(v) ?? 16; }, "72px"));
  const ripple = el("label", "display:inline-flex;align-items:center;gap:7px;margin:18px 10px 6px 0");
  const rippleInput = el("input");
  rippleInput.type = "checkbox";
  rippleInput.checked = meta.cursor.ripple !== false;
  rippleInput.onchange = () => { meta.cursor.ripple = rippleInput.checked; };
  ripple.appendChild(rippleInput);
  ripple.appendChild(el("span", "font-size:11px;opacity:.7", { textContent: "click ripple" }));
  globals.appendChild(ripple);
  root.appendChild(globals);

  const list = el("div");
  root.appendChild(list);

  function moveStep(i, d) {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const tmp = steps[i];
    steps[i] = steps[j];
    steps[j] = tmp;
    render();
  }

  function row(s, i) {
    const kind = kindOf(s);
    const card = el("div", "background:#16181d;border:1px solid #2a2e37;border-radius:10px;padding:10px 12px;margin-bottom:8px");

    const top = el("div", "display:flex;align-items:center;gap:8px;margin-bottom:6px");
    top.appendChild(el("span", "font-size:11px;opacity:.4;width:22px", { textContent: "#" + (i + 1) }));
    top.appendChild(el("span", "font-size:11px;padding:1px 7px;border-radius:5px;background:#222630;color:#7fd1ff", { textContent: kind }));
    const spacer = el("span", "flex:1");
    top.appendChild(spacer);
    const mk = (label, fn) => {
      const b = el("button", "background:#222630;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit;margin-left:5px", { textContent: label });
      b.onclick = fn;
      return b;
    };
    top.appendChild(mk("↑", () => moveStep(i, -1)));
    top.appendChild(mk("↓", () => moveStep(i, 1)));
    const del = mk("🗑", () => { steps.splice(i, 1); render(); });
    del.style.borderColor = "#5a2a2e";
    top.appendChild(del);
    card.appendChild(top);

    const fields = el("div", "display:flex;flex-wrap:wrap;align-items:flex-end");
    if (kind === "move") {
      fields.appendChild(field("x", s.move.x, "number", (v) => { s.move.x = num(v) ?? 0; }, "72px"));
      fields.appendChild(field("y", s.move.y, "number", (v) => { s.move.y = num(v) ?? 0; }, "72px"));
      fields.appendChild(field("duration", s.duration, "number", (v) => { s.duration = num(v); renderFooter(); }));
      fields.appendChild(field("bend", s.bend, "number", (v) => { s.bend = decimal(v); }, "72px"));
      fields.appendChild(field("cubic curve", s.easing?.join(", "), "text", (v) => { s.easing = curve(v); }, "170px"));
      const clickLabel = el("label", "display:inline-flex;align-items:center;gap:6px;margin:18px 10px 6px 0");
      const clickInput = el("input");
      clickInput.type = "checkbox";
      clickInput.checked = s.click !== false;
      clickInput.onchange = () => { s.click = clickInput.checked; };
      clickLabel.appendChild(clickInput);
      clickLabel.appendChild(el("span", "font-size:11px;opacity:.7", { textContent: "click" }));
      fields.appendChild(clickLabel);
    } else if (kind === "type") {
      fields.appendChild(field("type", s.type, "text", (v) => { s.type = v; renderFooter(); }, "260px"));
      fields.appendChild(field("delay", s.delay, "number", (v) => { s.delay = num(v); renderFooter(); }));
    } else if (kind === "key") {
      fields.appendChild(field("key", s.key, "text", (v) => { s.key = v; }, "140px"));
    } else if (kind === "wait") {
      fields.appendChild(field("wait", s.wait, "number", (v) => { s.wait = num(v) ?? 0; renderFooter(); }));
    }
    if (kind !== "wait" && kind !== "caption") {
      fields.appendChild(field("holdAfter", s.holdAfter, "number", (v) => { s.holdAfter = num(v); renderFooter(); }));
    }
    fields.appendChild(field("caption", s.caption, "text", (v) => { s.caption = v || undefined; }, "240px"));
    card.appendChild(fields);
    return card;
  }

  function render() {
    list.innerHTML = "";
    steps.forEach((s, i) => list.appendChild(row(s, i)));
    renderFooter();
  }

  const addBar = el("div", "display:flex;gap:8px;align-items:center;margin:14px 0");
  const sel = el("select", "background:#16181d;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:6px 8px;font:inherit");
  for (const k of ["move", "type", "key", "wait", "caption"]) sel.appendChild(el("option", "", { value: k, textContent: "+ " + k }));
  const addBtn = el("button", "background:#222630;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit", { textContent: "add step" });
  addBtn.onclick = () => {
    const k = sel.value;
    if (k === "move") steps.push({ move: { x: 450, y: 450 }, click: true });
    else if (k === "type") steps.push({ type: "" });
    else if (k === "key") steps.push({ key: "Enter" });
    else if (k === "wait") steps.push({ wait: 800 });
    else steps.push({ caption: "" });
    render();
  };
  addBar.appendChild(sel);
  addBar.appendChild(addBtn);
  root.appendChild(addBar);

  const footer = el("div", "position:fixed;left:0;right:0;bottom:0;display:flex;align-items:center;gap:14px;padding:12px 20px;background:#1c1f26;border-top:1px solid #2a2e37");
  const est = el("span", "opacity:.7");
  footer.appendChild(est);
  footer.appendChild(el("span", "flex:1"));
  const saveBtn = el("button", "background:#1f6feb;color:#fff;border:1px solid #1f6feb;border-radius:6px;padding:8px 18px;cursor:pointer;font:inherit", { textContent: "save → .mjs" });
  const cancelBtn = el("button", "background:#222630;color:#e6e6e6;border:1px solid #2a2e37;border-radius:6px;padding:8px 14px;cursor:pointer;font:inherit", { textContent: "cancel" });
  footer.appendChild(cancelBtn);
  footer.appendChild(saveBtn);
  document.body.appendChild(footer);

  function renderFooter() {
    let ms = meta.leadInMs;
    for (const s of steps) {
      if (s.type != null) ms += (s.delay ?? meta.defaultDelay) * s.type.length;
      if (s.move != null) ms += s.duration ?? meta.cursor.duration;
      if (s.wait != null) ms += s.wait;
      if (s.holdAfter != null) ms += s.holdAfter;
    }
    est.textContent = "≈ " + (ms / 1000).toFixed(1) + "s  ·  " + steps.length + " steps";
  }

  function normalize() {
    return steps.map((s) => {
      const out = {};
      if (s.move != null) out.move = { x: s.move.x, y: s.move.y };
      if (s.click != null) out.click = s.click;
      if (s.duration != null && !Number.isNaN(s.duration)) out.duration = s.duration;
      if (s.bend != null && !Number.isNaN(s.bend)) out.bend = s.bend;
      if (s.easing) out.easing = s.easing;
      if (s.type != null) out.type = s.type;
      if (s.key != null) out.key = s.key;
      if (s.wait != null) out.wait = s.wait;
      if (s.delay != null && !Number.isNaN(s.delay)) out.delay = s.delay;
      if (s.holdAfter != null && !Number.isNaN(s.holdAfter)) out.holdAfter = s.holdAfter;
      if (s.caption) out.caption = s.caption;
      return out;
    });
  }

  saveBtn.onclick = () => {
    root.remove();
    footer.remove();
    window.__promoSave({
      steps: normalize(),
      leadInMs: meta.leadInMs,
      defaultDelay: meta.defaultDelay,
      cursor: meta.cursor,
    });
  };
  cancelBtn.onclick = () => {
    root.remove();
    footer.remove();
    window.__promoCancel();
  };

  render();
}
