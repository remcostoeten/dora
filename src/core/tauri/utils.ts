export function isTauri(): boolean {
    if (typeof window === 'undefined') return false
    // Check for Tauri v2 internals
    return !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__
}
