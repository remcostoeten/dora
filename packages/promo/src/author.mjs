import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { setupStudioEditor } from "./runner.mjs";
import { sceneFilePath, serializeScene } from "./scene-io.mjs";
import { recorderClient } from "./overlay-author.mjs";

function log(...args) {
  console.log("[promo]", ...args);
}

/**
 * Interactively author a scene: open the live app in a headed browser, record
 * your keystrokes through the recorder overlay, then write `scenes/<name>.mjs`.
 *
 * @param {string} name
 * @param {{ base?: string, view?: string, connection?: string, table?: string,
 *           mode?: "sql"|"drizzle"|"prisma" }} opts
 * @returns {Promise<string|null>} path to the written scene, or null if cancelled
 */
export async function authorScene(name, opts = {}) {
  const scene = {
    name,
    url: {
      view: opts.view || "sql-console",
      connection: opts.connection || "demo-ecommerce-001",
    },
    mode: opts.mode || "drizzle",
    size: { width: 1600, height: 900 },
    editor: { fontSize: 18, lineHeight: 30 },
    closeRightSidebar: true,
    leadInMs: 600,
    defaultDelay: 95,
    cursor: {
      duration: 420,
      bend: 0.16,
      easing: [0.22, 0.8, 0.25, 1],
      size: 16,
      ripple: true,
    },
    steps: [],
  };
  if (opts.table) scene.url.table = opts.table;

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: scene.size,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  let payload = null;
  let resolve;
  const finished = new Promise((res) => {
    resolve = res;
  });

  await page.exposeFunction("__promoSave", (data) => {
    payload = data;
    resolve();
  });
  await page.exposeFunction("__promoCancel", () => resolve());
  page.on("close", () => resolve());

  await setupStudioEditor(page, scene, { base: opts.base });
  await page.evaluate(recorderClient, {
    name,
    defaultDelay: scene.defaultDelay,
  });

  log("recording — type in the editor, use the overlay, then click Save");
  await finished;

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  if (!payload) {
    log("cancelled — nothing written");
    return null;
  }

  scene.steps = payload.steps || [];
  if (payload.expect) scene.expect = payload.expect;

  const file = sceneFilePath(name);
  writeFileSync(file, serializeScene(scene), "utf8");
  log("wrote", file, `(${scene.steps.length} steps)`);
  return file;
}
