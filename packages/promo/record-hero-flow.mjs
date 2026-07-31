/**
 * Records the README hero clip: browse a data-rich table, inline-edit a cell,
 * open the command palette (Ctrl/Cmd+K) to jump to the SQL Console, and run a
 * query. Drives the Studio UI in a plain browser (mock adapter, no Tauri) at
 * localhost:1420.
 *
 * Prereq: `bun vite --port 1420 --strictPort` in apps/desktop.
 * Usage:   node packages/promo/record-hero-flow.mjs [--out <dir>] [--base <url>] [--headed]
 * Outputs: <out>/dora-hero.mp4 and <out>/dora-hero.webp (animated, README-ready).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const SIZE = { width: 1600, height: 900 };
const BASE = argFlag("base") || "http://localhost:1420";
const OUT_DIR = path.resolve(argFlag("out") || path.join(process.cwd(), "promo-out"));
const HEADED = process.argv.includes("--headed");
const NAME = "dora-hero";
const PLAYBACK_SPEED = 1.18;

function argFlag(key) {
  const i = process.argv.indexOf(`--${key}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}

function log(...a) {
  console.log("[hero]", ...a);
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
  if (r.status !== 0) throw new Error(`ffmpeg failed (exit ${r.status})`);
}

// A synthetic cursor: Playwright's recorded video never shows the real pointer,
// so we render our own dot that tracks mouse events and pulses on click. This is
// what makes "editing a cell" legible in the clip.
const CURSOR_SCRIPT = `
  (function () {
    function install() {
      if (document.getElementById('__promo_cursor')) return;
      const dot = document.createElement('div');
      dot.id = '__promo_cursor';
      dot.style.cssText = [
        'position:fixed','top:0','left:0','z-index:2147483647','pointer-events:none',
        'width:22px','height:22px','margin:-11px 0 0 -11px','border-radius:50%',
        'background:rgba(255,255,255,0.92)',
        'box-shadow:0 0 0 2px rgba(0,0,0,0.35), 0 2px 10px rgba(0,0,0,0.45)',
        'transition:transform 0.05s ease-out','transform:translate(-100px,-100px)',
      ].join(';');
      document.documentElement.appendChild(dot);
      let x = -100, y = -100;
      window.addEventListener('mousemove', function (e) {
        x = e.clientX; y = e.clientY;
        dot.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      }, true);
      window.addEventListener('mousedown', function () {
        const ring = document.createElement('div');
        ring.style.cssText = [
          'position:fixed','z-index:2147483646','pointer-events:none',
          'left:' + x + 'px','top:' + y + 'px','width:14px','height:14px',
          'margin:-7px 0 0 -7px','border-radius:50%',
          'border:2px solid rgba(120,200,160,0.9)',
          'transition:all 0.4s ease-out','opacity:1',
        ].join(';');
        document.documentElement.appendChild(ring);
        requestAnimationFrame(function () {
          ring.style.width = '46px'; ring.style.height = '46px';
          ring.style.margin = '-23px 0 0 -23px'; ring.style.opacity = '0';
        });
        setTimeout(function () { ring.remove(); }, 450);
      }, true);
    }
    if (document.body) install();
    else document.addEventListener('DOMContentLoaded', install);
    new MutationObserver(install).observe(document.documentElement, { childList: true });
  })();
`;

let cursorPosition = { x: 80, y: SIZE.height - 80 };
let curveDirection = 1;

async function moveTo(page, locator, steps = 24) {
  const box = await locator.boundingBox();
  if (!box) return null;
  const end = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const dx = end.x - cursorPosition.x;
  const dy = end.y - cursorPosition.y;
  const distance = Math.hypot(dx, dy) || 1;
  const bend = Math.min(100, Math.max(24, distance * 0.14)) * curveDirection;
  const normal = { x: (-dy / distance) * bend, y: (dx / distance) * bend };
  const controlA = {
    x: cursorPosition.x + dx * 0.3 + normal.x,
    y: cursorPosition.y + dy * 0.3 + normal.y,
  };
  const controlB = {
    x: cursorPosition.x + dx * 0.72 + normal.x * 0.4,
    y: cursorPosition.y + dy * 0.72 + normal.y * 0.4,
  };

  for (let frame = 1; frame <= steps; frame++) {
    const progress = frame / steps;
    const eased = 1 - Math.pow(1 - progress, 3);
    const inverse = 1 - eased;
    const x =
      inverse ** 3 * cursorPosition.x +
      3 * inverse ** 2 * eased * controlA.x +
      3 * inverse * eased ** 2 * controlB.x +
      eased ** 3 * end.x;
    const y =
      inverse ** 3 * cursorPosition.y +
      3 * inverse ** 2 * eased * controlA.y +
      3 * inverse * eased ** 2 * controlB.y +
      eased ** 3 * end.y;
    await page.mouse.move(x, y);
    await page.waitForTimeout(12);
  }

  cursorPosition = end;
  curveDirection *= -1;
  return end;
}

async function main() {
  const workDir = path.join(OUT_DIR, ".work-hero");
  mkdirSync(OUT_DIR, { recursive: true });
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: workDir, size: SIZE },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("dora_demo_notice_dismissed", "true");
    } catch {}
    try {
      localStorage.setItem("dora_has_seen_scroll_hint", "true");
    } catch {}
    try {
      localStorage.setItem("dora_onboarding_tour_completed", "1");
    } catch {}
  });
  await page.addInitScript(CURSOR_SCRIPT);

  const hold = (ms) => page.waitForTimeout(ms);
  const recordingStartedAt = Date.now();
  let trimStartSec = 0;

  try {
    await page.goto(
      `${BASE}/?view=database-studio&connection=demo-ecommerce-001`,
      { waitUntil: "networkidle" },
    );
    await page.waitForSelector('[data-cell-key="0:1"]', { timeout: 15000 });
    trimStartSec = Math.max(
      0,
      (Date.now() - recordingStartedAt) / 1000 - 0.25,
    );
    await hold(900);

    log("open the transactions table (1,200 rows)");
    const txTable = page.getByText("transactions", { exact: true }).first();
    await moveTo(page, txTable);
    await hold(140);
    await txTable.click();
    // Wait until the grid actually shows transaction rows (TXN-… ids), not the
    // blank frame during the table's initial fetch.
    await page.waitForFunction(
      () => {
        const cell = document.querySelector('[data-cell-key="1:1"]');
        return !!cell && /TXN-/.test(cell.textContent || "");
      },
      null,
      { timeout: 15000 },
    );
    await hold(950);

    log("briefly showcase the cell context menu");
    const contextCell = page.locator('[data-cell-key="0:2"]');
    await moveTo(page, contextCell, 20);
    await hold(120);
    await contextCell.click({ button: "right" });
    const contextMenu = page.locator('[data-slot="context-menu-content"]');
    await contextMenu.waitFor({ state: "visible", timeout: 5000 });
    const filterAction = page
      .getByRole("menuitem", { name: /filter by value/i })
      .first();
    if (await filterAction.isVisible().catch(() => false)) {
      await moveTo(page, filterAction, 16);
      await hold(950);
    }
    await page.keyboard.press("Escape");
    await hold(260);

    log("inline-edit an amount cell");
    const amountCell = page.locator('[data-cell-key="0:3"]');
    await moveTo(page, amountCell);
    await hold(180);
    await amountCell.dblclick();
    await hold(320);
    await page.keyboard.type("1499.50", { delay: 55 });
    await hold(260);
    await page.keyboard.press("Enter");
    await hold(900);

    log("open the command palette (Ctrl/Cmd+K) and jump to the SQL Console");
    await page.keyboard.press("Control+K");
    await page.waitForSelector('[role="option"]', { timeout: 8000 });
    await hold(650);
    await page.keyboard.type("SQL Console", { delay: 45 });
    await hold(550);
    await page.keyboard.press("Enter");
    await page.waitForSelector(".monaco-editor", { timeout: 15000 });
    await hold(750);

    log("write and run a query");
    const editor = page.locator(".monaco-editor").first();
    await moveTo(page, editor, 18);
    await editor.click();
    await hold(160);
    await page.evaluate((query) => {
      const editors = window.monaco?.editor?.getEditors?.() || [];
      const target = editors.find((candidate) => candidate.hasTextFocus()) || editors[0];
      if (!target) return;
      target.setValue(query);
      target.setPosition({ lineNumber: 1, column: query.length + 1 });
      target.focus();
    }, "SELECT * FROM transactions ORDER BY amount DESC LIMIT 50;");
    await hold(380);
    await page.keyboard.press("Control+Enter");
    await hold(1700);
  } finally {
    await context.close();
    await browser.close();
  }

  const webm = readdirSync(workDir)
    .filter((f) => f.endsWith(".webm"))
    .map((f) => path.join(workDir, f))[0];
  if (!webm) throw new Error("no video was recorded");

  const mp4 = path.join(OUT_DIR, `${NAME}.mp4`);
  const scale =
    `setpts=PTS/${PLAYBACK_SPEED},` +
    `scale=${SIZE.width}:${SIZE.height}:flags=lanczos,format=yuv420p`;
  ffmpeg([
    "-ss", trimStartSec.toFixed(3),
    "-i", webm,
    "-vf", scale,
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    "-movflags", "+faststart",
    "-an",
    mp4,
  ]);
  log("wrote", mp4);

  const webp = path.join(OUT_DIR, `${NAME}.webp`);
  ffmpeg([
    "-ss", trimStartSec.toFixed(3),
    "-i", webm,
    "-vf", `setpts=PTS/${PLAYBACK_SPEED},fps=24,scale=1280:-1:flags=lanczos`,
    "-c:v", "libwebp_anim",
    "-lossless", "0",
    "-q:v", "72",
    "-loop", "0",
    "-an",
    webp,
  ]);
  log("wrote", webp);

  rmSync(workDir, { recursive: true, force: true });
  log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
