# Plan 04: Project folder linking + ORM detection

**Effort:** S. **Depends on:** nothing (IR-agnostic). **Parallel with:** 02, 03.

Let the user link a project folder; detect whether it's Drizzle or Prisma and
locate the schema file(s). Feeds the parsers (02/03).

## Backend (Rust) — small additions

The app already has file-dialog commands in
`apps/desktop/src-tauri/src/window/commands.rs` (`open_file`, `open_data_files`
using `rfd::AsyncFileDialog`) and `probe_database_file` reads files via
`tokio::fs`. Add:

- `pick_folder(app) -> Result<Option<String>, Error>` — `rfd::AsyncFileDialog`
  `.pick_folder()` (copy `open_file`'s structure).
- `read_project_file(path: String) -> Result<String, Error>` — `tokio::fs`
  read-to-string with a size cap (e.g. 2 MB) and a path guard.
- `list_dir(path, glob/exts) -> Result<Vec<String>, Error>` — shallow + a couple
  known subdirs (see detection below); or just return entries and filter in TS.

Register these in `lib.rs` + `bindings.rs` *(SHARED, append-only)*. Confirm
`capabilities/default.json` permits fs read for arbitrary paths (it already has
`fs:allow-exists` over `**`; add a read-text permission if the plugin route is
used — but the **custom Rust command path avoids capability fiddling**, prefer
it).

## Detection (TS) — `link/detect-orm.ts`

Given a linked folder path:
- **Prisma:** look for `prisma/schema.prisma` (and `schema.prisma` at root, and
  the `prisma.schema` field in `package.json`). Newer Prisma supports a
  `prisma/schema/` multi-file dir — collect all `*.prisma`.
- **Drizzle:** look for `drizzle.config.ts`/`.js`; read its `schema` path
  (string or glob); fall back to common locations (`src/db/schema.ts`,
  `src/schema.ts`, `db/schema/*.ts`, `src/db/schema/*.ts`).
- If both exist, let the user choose; if neither, show guidance.

Return `{ orm: 'drizzle' | 'prisma'; schemaFiles: {path,text}[]; configPath? }`.

## Files (owned)

`packages/studio/src/features/orm-cockpit/link/`
- `detect-orm.ts`, `link-api.ts` (wrappers over the new Rust commands),
  `__tests__/detect-orm.test.ts` (fixture folders).

## Acceptance criteria

- [ ] User picks a folder; the app detects Drizzle vs Prisma and finds the
      schema file(s), including multi-file Drizzle dirs and Prisma multi-file.
- [ ] Reads file contents (size-capped) and hands `{path,text}[]` to the parser.
- [ ] Graceful messaging when neither ORM is detected, or config points nowhere.
- [ ] New Rust commands registered; both `bindings.ts` synced; typechecks clean.

## Risks

- `drizzle.config.ts` is TS and may compute the schema path — do a best-effort
  static read of the `schema:` value; if it's dynamic, fall back to the common
  locations + let the user point at the file manually.
- Large monorepos: don't deep-scan; check known locations + the config, then
  offer a manual file picker as the escape hatch.
