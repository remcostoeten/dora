/**
 * No-op stub for `@studio/monaco-workers` in the Next/marketing build.
 *
 * The studio package's real monaco-workers module uses Vite's `?worker` import
 * suffix to bundle local Monaco web workers (needed for the offline Tauri
 * desktop app). Next/turbopack can't resolve `?worker`, so we alias the module
 * to this stub here (see `turbopack.resolveAlias` in next.config.ts).
 *
 * On the web, `@monaco-editor/react`'s default loader fetches Monaco (and its
 * workers) from a CDN, so no local worker setup is required.
 */
export function preloadMonacoWorkers(): void {}
