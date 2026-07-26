/**
 * Boot smoke test: launches Studio in a real browser against the mock data
 * adapter (no Tauri) and fails on anything a blank-window regression would
 * produce — an uncaught page error, a console.error, a missing table grid, or
 * a SQL run that yields no results.
 *
 * Scenarios:
 *   1. Database Studio mounts and the demo table grid renders rows.
 *   2. The SQL console mounts Monaco, runs a query, and shows a result grid.
 *
 * Usage: node smoke/boot-smoke.mjs [--base <url>] [--headed]
 * Without --base it starts `bun vite --port 1420 --strictPort` in apps/desktop
 * itself and tears it down afterwards. On failure it writes a screenshot to
 * smoke-artifacts/ and exits non-zero.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const DIRNAME = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(DIRNAME, "../../..");
const ARTIFACT_DIR = path.join(DIRNAME, "..", "smoke-artifacts");
const PORT = 1420;
const HEADED = process.argv.includes("--headed");
const BASE = argFlag("base") || `http://localhost:${PORT}`;
const CONNECTION = "demo-ecommerce-001";

/**
 * Console errors that do not indicate a broken boot. Keep this list short and
 * documented — every entry is a hole in the smoke test.
 */
const CONSOLE_ERROR_ALLOWLIST = [
  // Vite HMR websocket noise when the dev server restarts mid-run.
  /WebSocket connection/i,
];

function argFlag(key) {
  const i = process.argv.indexOf(`--${key}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}

function log(...a) {
  console.log("[smoke]", ...a);
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not up yet; retry until the deadline.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`dev server at ${url} did not respond within ${timeoutMs}ms`);
}

async function startDevServer() {
  log(`starting vite dev server on port ${PORT}`);
  const child = spawn("bun", ["vite", "--port", String(PORT), "--strictPort"], {
    cwd: path.join(REPO_ROOT, "apps", "desktop"),
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  await waitForServer(BASE, 60_000);
  return child;
}

async function main() {
  let devServer = null;
  let serverWasRunning = true;
  try {
    await fetch(BASE);
  } catch {
    serverWasRunning = false;
  }
  if (!serverWasRunning) {
    devServer = await startDevServer();
  }

  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (CONSOLE_ERROR_ALLOWLIST.some((pattern) => pattern.test(text))) return;
    consoleErrors.push(text);
  });

  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("dora_demo_notice_dismissed", "true");
      localStorage.setItem("dora_has_seen_scroll_hint", "true");
    } catch {
      // Storage unavailable; the demo notice will just be visible.
    }
  });

  let failed = false;
  try {
    log("scenario 1: database studio mounts and the demo grid renders");
    await page.goto(`${BASE}/?view=database-studio&connection=${CONNECTION}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector('[data-cell-key="0:1"]', { timeout: 30_000 });
    log("  grid rendered");

    log("scenario 2: SQL console mounts Monaco and a query returns rows");
    await page.goto(`${BASE}/?view=sql-console&connection=${CONNECTION}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector(".monaco-editor", { timeout: 30_000 });
    const editor = page.locator(".monaco-editor").first();
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("SELECT * FROM transactions LIMIT 5;");
    await page.keyboard.press("Control+Enter");
    await page.waitForFunction(
      () => /TXN-/.test(document.body.textContent || ""),
      null,
      { timeout: 30_000 },
    );
    log("  query executed and results rendered");

    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      failed = true;
      for (const error of pageErrors) console.error("[smoke] page error:", error);
      for (const error of consoleErrors) console.error("[smoke] console.error:", error);
    }
  } catch (error) {
    failed = true;
    console.error("[smoke] scenario failed:", error);
    for (const err of pageErrors) console.error("[smoke] page error:", err);
    for (const err of consoleErrors) console.error("[smoke] console.error:", err);
  }

  if (failed) {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    const screenshot = path.join(ARTIFACT_DIR, "boot-smoke-failure.png");
    try {
      await page.screenshot({ path: screenshot, fullPage: true });
      console.error(`[smoke] screenshot written to ${screenshot}`);
    } catch {
      console.error("[smoke] could not capture a failure screenshot");
    }
  }

  await context.close();
  await browser.close();
  if (devServer) {
    devServer.kill("SIGTERM");
  }

  if (failed) {
    process.exit(1);
  }
  log("boot smoke passed");
}

main().catch((error) => {
  console.error("[smoke] fatal:", error);
  process.exit(1);
});
