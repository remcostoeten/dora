# Desktop workspace helpers

## Windows Tauri dev

Run `pwsh scripts/tauri-dev-win.ps1` (or `bun run tauri:win` from `apps/desktop`) whenever you want to start the dev build with the exact toolchain we verified. The script configures `PATH`, `CMAKE_GENERATOR`, and `AWS_LC_SYS_CMAKE_GENERATOR` before invoking `bun x tauri dev`.

## Refresh libsql-sys vendor

If libsql/rusqlite is upgraded, run `pwsh scripts/update-libsql-sys.ps1` from `apps/desktop`. The script re-copies the crate into `src-tauri/vendor/libsql-sys` so the `[patch.crates-io]` entry keeps pointing at a valid, bundled SQLite source before you rebuild.
