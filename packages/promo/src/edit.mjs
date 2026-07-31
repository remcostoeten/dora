import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { loadScene, sceneFilePath, serializeScene } from "./scene-io.mjs";
import { editorClient } from "./overlay-edit.mjs";

function log(...args) {
  console.log("[promo]", ...args);
}

/**
 * Open an existing scene in a browser timeline editor, tweak step timings and
 * captions, then write the result back to `scenes/<name>.mjs`. No dev server
 * required — the editor is a standalone page.
 *
 * @param {string} name
 * @returns {Promise<string|null>} path to the written scene, or null if cancelled
 */
export async function editScene(name) {
  const scene = await loadScene(name);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 900, height: 900 },
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

  await page.setContent(
    '<!doctype html><html><head><meta charset="utf-8"><title>promo edit</title></head><body></body></html>',
  );
  await page.evaluate(editorClient, { scene });

  log("editing — adjust steps in the browser, then click Save");
  await finished;

  await context.close().catch(() => {});
  await browser.close().catch(() => {});

  if (!payload) {
    log("cancelled — scene unchanged");
    return null;
  }

  const next = {
    ...scene,
    leadInMs: payload.leadInMs,
    defaultDelay: payload.defaultDelay,
    cursor: payload.cursor,
    steps: payload.steps,
  };

  const file = sceneFilePath(name);
  writeFileSync(file, serializeScene(next), "utf8");
  log("wrote", file, `(${next.steps.length} steps)`);
  return file;
}
