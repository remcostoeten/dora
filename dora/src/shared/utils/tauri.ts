export function isTauri(): boolean {
  if (typeof window === "undefined") return false
  // Tauri v2 uses __TAURI_INTERNALS__, v1 used __TAURI__
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window
}
