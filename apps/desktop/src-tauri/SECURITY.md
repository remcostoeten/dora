# Tauri Security Notes

## Content Security Policy

The desktop app sets a non-null CSP in `tauri.conf.json` so injected markup does
not get unrestricted script, network, or embedding permissions.

Monaco requires `script-src 'unsafe-eval'` for its editor runtime and
`worker-src blob:` for Vite-built language workers. The app also allows inline
styles for the current React styling stack, Tauri IPC endpoints, the telemetry
ingestion endpoint, local asset protocol images, and `data:`/`blob:` images used
by the UI.

## macOS Private API

`macOSPrivateApi` remains enabled because the macOS window setup in
`src/init.rs` uses a transparent frameless window, overlay title bar, window
background effects, hidden title, and custom traffic-light positioning. Those
native chrome customizations depend on Tauri's `macos-private-api` feature in
`Cargo.toml`.

This blocks Mac App Store distribution and should be revisited before any App
Store release target. For direct beta distribution, keep it enabled unless the
macOS chrome is simplified to standard decorations without overlay traffic-light
positioning or background effects.
