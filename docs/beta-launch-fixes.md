# Beta Launch Fix List

Compiled 2026-06-06. Work through top-to-bottom; sections are ordered by blast radius.

---

## 1 — Hard crashes (Rust panics)

`apps/desktop/src-tauri/src/database/sqlite/execute.rs` lines 273, 319, 331, 346, 364, 375, 386, 397, 409, 422 all contain:

```rust
other => panic!("Expected Page event, got {:?}", other)
```

If the event stream ever arrives out of expected order (malformed data, race, future refactor), the entire app process crashes with no recovery. Replace every `panic!()` in this file with proper error propagation:

```rust
other => {
    log::error!("Unexpected event in execute path: {:?}", other);
    let _ = sender.send(QueryExecEvent::Finished {
        elapsed_ms: 0,
        affected_rows: 0,
        error: Some(format!("Internal error: unexpected event {:?}", other)),
    });
    return Err(Error::Any(anyhow::anyhow!("Unexpected event")));
}
```

---

## 2 — Silent failures (console.error without user feedback)

43 `console.error` calls across the features layer have no paired toast or dialog. Users see a hanging or stale UI with no explanation. The most impactful ones:

| File | Line | Operation |
|------|------|-----------|
| `features/database-studio/hooks/use-database-studio-sync.ts` | 151, 197, 204 | table load / validation |
| `features/sidebar/database-sidebar.tsx` | 201, 362, 365, 393, 401, 523, 571, 714 | rename, drop, duplicate, copy schema |
| `features/connections/components/connection-dialog.tsx` | 360 | file picker failure |
| `features/docker-manager/components/create-container-dialog.tsx` | 93 | port discovery |
| `features/docker-manager/components/compose-export-dialog.tsx` | 69 | save file |
| `features/command-palette/command-palette.tsx` | 340, 410 | table / snippet load |

Pattern for every fix — after the `console.error`, add:

```ts
toast.error('Failed to [action]', { description: error instanceof Error ? error.message : String(error) })
```

Docker stream errors (`use-container-logs.ts` 36, 50) are cleanup/internal — a `log.warn` is fine there, no toast needed.

---

## 3 — Downloads page is placeholder

`apps/marketing/src/views/downloads-view.tsx` lines 13, 19, 23 are literal text: "Installer placeholder for Apple Silicon and Intel", "Installer placeholder for Windows desktop releases.", "Installer placeholder for Linux desktop packages."

Replace with real GitHub Releases links. The release pipeline already produces `.dmg` (Intel + Apple Silicon), `.exe`, `.deb`, `.rpm`, `.AppImage`, and `.snap`. Wire them up. Consider fetching the latest release tag from the GitHub API so the links stay current automatically:

```ts
// fetch https://api.github.com/repos/remcostoeten/dora/releases/latest
// and build download URLs from assets[].browser_download_url
```

---

## 4 — No Content Security Policy

`apps/desktop/src-tauri/tauri.conf.json` line 28: `"csp": null`

Add a basic policy. Tauri apps don't need to be as strict as web apps (no external network for assets), but a null CSP means any injected script runs unchecked:

```json
"csp": "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://ingestion.remcostoeten.nl ipc: http://ipc.localhost"
```

`unsafe-eval` is needed for Monaco. `unsafe-inline` for styles. Tighten further after confirming no regressions.

---

## 5 — Credentials `.expect("ok")` panics

`apps/desktop/src-tauri/src/credentials.rs` lines 152, 173, 192, 213, 236, 257, 280 all call:

```rust
let (sanitized, pw) = extract_sensitive_data(dbi).expect("ok");
```

On Linux systems where the system keyring is unavailable (headless servers, some CI environments, minimal desktop setups), this crashes instead of falling back gracefully. Replace with:

```rust
let (sanitized, pw) = extract_sensitive_data(dbi)
    .map_err(|e| Error::Any(anyhow::anyhow!("Failed to extract credentials: {}", e)))?;
```

---

## 6 — Suspense with null fallback

`packages/studio/src/pages/Index.tsx` line 718:

```tsx
<Suspense fallback={null}>
```

This wraps the CommandPalette. When it lazy-loads, the user sees a blank area with no indicator. Replace with a minimal spinner or skeleton that matches the command palette dimensions:

```tsx
<Suspense fallback={<div className="h-10 w-full animate-pulse rounded-md bg-muted/50" />}>
```

---

## 7 — `macOSPrivateApi: true`

`apps/desktop/src-tauri/tauri.conf.json` line 30.

Document _why_ this is needed (likely for the custom traffic-light window buttons / vibrancy). If it can be removed, remove it. If not, add a comment in the config and open a tracking issue — macOS private APIs can break silently on OS updates and will definitely block Mac App Store distribution if that's ever a goal.

---

## 8 — No auto-updater

`tauri.conf.json` has no `updater` block. Users must manually download each new release. For a beta launch with frequent patches, this will kill adoption.

Add to `tauri.conf.json`:

```json
"updater": {
  "active": true,
  "dialog": true,
  "pubkey": "<your-tauri-updater-pubkey>",
  "endpoints": [
    "https://github.com/remcostoeten/dora/releases/latest/download/latest.json"
  ]
}
```

Generate a keypair with `tauri signer generate`. Add the update manifest (`latest.json`) to the release pipeline. The `dora-manager-executor` directory in the repo root suggests this was partially planned.

---

## 9 — Chunk size warning suppressed

`apps/desktop/vite.config.ts` line 23: `chunkSizeWarningLimit: 1000` (1 MB).

This masks real bundle bloat. Monaco editor and `@xyflow/react` are both large. Run a build, check `stats.html` (the rollup visualizer is already configured with `open: false`), and verify the actual vendor chunks. If `vendor-monaco` or `vendor-flow` exceed 2 MB uncompressed, consider:

- Monaco: already split into `monaco-workers` chunk — confirm workers load off the critical path
- @xyflow: lazy-load the schema visualizer tab so it only loads when opened

Lower the warning limit back to the Vite default (500 KB) after optimising so future regressions are visible.

---

## 10 — Docker view hard reloads without cleanup

`packages/studio/src/features/docker-manager/components/docker-view.tsx` line 412:

```ts
window.location.reload()
```

Called on connection change. This nukes all React state and any open Docker streams/event listeners without cleanup. Replace with a proper state reset:

```ts
// Call cleanup hooks first, then navigate to root
queryClient.clear()
navigate('/')
```

---

## Checklist

- [x] **1** Replace `panic!()` calls in `sqlite/execute.rs` (the flagged event-shape panics were in tests; they now return `anyhow::Result` errors)
- [x] **2** Add `toast.error` to silent user-facing `console.error` sites; internal editor helper, Docker stream cleanup, and low-level Docker client logs remain console-only
- [x] **3** Populate downloads page with real release links via the GitHub latest-release API
- [x] **4** Set CSP in `tauri.conf.json`
- [x] **5** Replace `.expect("ok")` in `credentials.rs` (the flagged sites were tests; production credential extraction was already using `?`)
- [x] **6** Replace `fallback={null}` in `pages/Index.tsx`
- [x] **7** Document or remove `macOSPrivateApi: true`
- [ ] **8** Configure auto-updater in `tauri.conf.json` — blocked until a real Tauri updater keypair is generated and the release workflow publishes `latest.json`
- [x] **9** Lower `chunkSizeWarningLimit`, audit bundle with `stats.html` (production build shows `vendor-monaco` 206 KB and lazy `feature-visualizer` 237 KB; only Monaco worker chunks exceed 2 MB and are split as workers)
- [x] **10** Replace `window.location.reload()` in `docker-view.tsx`
