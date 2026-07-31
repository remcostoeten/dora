import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const scenesDir = path.join(here, "..", "scenes");

export function sceneFilePath(name) {
  return path.join(scenesDir, `${name}.mjs`);
}

export function listScenes() {
  return readdirSync(scenesDir)
    .filter((f) => f.endsWith(".mjs") && f !== "index.mjs")
    .map((f) => f.replace(/\.mjs$/, ""));
}

/**
 * Import a scene module by name and return its default export.
 * @param {string} name
 * @returns {Promise<import("./runner.mjs").Scene>}
 */
export async function loadScene(name) {
  const href = pathToFileURL(sceneFilePath(name)).href;
  return (await import(href)).default;
}

function q(s) {
  return JSON.stringify(s);
}

function serializeStep(step) {
  const parts = [];
  if (step.move != null) parts.push(`move: ${JSON.stringify(step.move)}`);
  if (step.click != null) parts.push(`click: ${step.click}`);
  if (step.duration != null) parts.push(`duration: ${step.duration}`);
  if (step.bend != null) parts.push(`bend: ${step.bend}`);
  if (step.easing != null) parts.push(`easing: ${JSON.stringify(step.easing)}`);
  if (step.type != null) parts.push(`type: ${q(step.type)}`);
  if (step.key != null) parts.push(`key: ${q(step.key)}`);
  if (step.wait != null) parts.push(`wait: ${step.wait}`);
  if (step.delay != null) parts.push(`delay: ${step.delay}`);
  if (step.holdAfter != null) parts.push(`holdAfter: ${step.holdAfter}`);
  if (step.caption != null) parts.push(`caption: ${q(step.caption)}`);
  return `    { ${parts.join(", ")} },`;
}

/**
 * Render a scene object back to a clean, version-control-friendly .mjs source
 * string in the same shape as the hand-written scenes.
 * @param {import("./runner.mjs").Scene} scene
 * @returns {string}
 */
export function serializeScene(scene) {
  const lines = [];
  lines.push('/** @type {import("../src/runner.mjs").Scene} */');
  lines.push("export default {");
  lines.push(`  name: ${q(scene.name)},`);

  const u = scene.url || {};
  const urlParts = [`view: ${q(u.view)}`];
  if (u.connection) urlParts.push(`connection: ${q(u.connection)}`);
  if (u.table) urlParts.push(`table: ${q(u.table)}`);
  lines.push(`  url: { ${urlParts.join(", ")} },`);

  if (scene.mode) lines.push(`  mode: ${q(scene.mode)},`);
  if (scene.size) {
    lines.push(`  size: { width: ${scene.size.width}, height: ${scene.size.height} },`);
  }
  if (scene.editor) {
    const e = [];
    if (scene.editor.fontSize != null) e.push(`fontSize: ${scene.editor.fontSize}`);
    if (scene.editor.lineHeight != null) e.push(`lineHeight: ${scene.editor.lineHeight}`);
    if (e.length) lines.push(`  editor: { ${e.join(", ")} },`);
  }
  if (scene.closeRightSidebar) lines.push("  closeRightSidebar: true,");
  if (scene.leadInMs != null) lines.push(`  leadInMs: ${scene.leadInMs},`);
  if (scene.defaultDelay != null) lines.push(`  defaultDelay: ${scene.defaultDelay},`);
  if (scene.cursor) {
    lines.push(`  cursor: ${JSON.stringify(scene.cursor)},`);
  }

  lines.push("  steps: [");
  for (const s of scene.steps || []) lines.push(serializeStep(s));
  lines.push("  ],");

  if (scene.expect != null) lines.push(`  expect: ${q(scene.expect)},`);

  lines.push("};");
  lines.push("");
  return lines.join("\n");
}
