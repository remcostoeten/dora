# Dora growth plans — parallel-executable specs

These are implementation plans for two strategic pillars, written so multiple
agents can execute them **in parallel** with minimal merge conflict. Each plan
is self-contained: goal, scope, file boundaries, step-by-step, acceptance
criteria, verification commands, and risks.

- **Pillar 1 — Be the GUI for every serverless/edge DB.** Reuse the
  token → account-visibility → resource-picker → auto-mint-connection pattern
  (already shipped for Turso/Supabase/Neon) to add more providers.
  → `pillar-1-edge-db-connectors/`
- **Pillar 2 — ORM & migration cockpit.** Link a project folder, parse its
  Drizzle/Prisma schema, diff it against the live DB, generate/preview
  migrations. → `pillar-2-orm-cockpit/`

## How to run these in parallel without clobbering each other

Most of each plan creates **new, owned files** (no conflict). The risk is a
handful of **shared registration files** every connector appends to. Rules:

1. **One agent per plan, each in its own git worktree.** Launch with the Agent
   tool using `isolation: "worktree"`. Owned files never collide.
2. **Shared files are append-only.** Each plan has a `## Shared-file
   registration` section listing the *exact* additions (always appended to the
   end of an existing list). Adjacent appends can still conflict on merge — so:
3. **Serialize the registration + bindings step.** After the parallel agents
   finish their owned work, a single coordinator pass applies every plan's
   `Shared-file registration` block and regenerates bindings **once**. Treat
   that as the merge/integration step.

### The shared registration files (touched by every Pillar-1 connector)

| File | What to append |
| --- | --- |
| `apps/desktop/src-tauri/src/database/commands/integrations.rs` | `#[tauri::command]` wrappers |
| `apps/desktop/src-tauri/src/lib.rs` | entries in `tauri::generate_handler![…]` |
| `apps/desktop/src-tauri/src/bindings.rs` | entries in `collect_commands![…]` |
| `packages/studio/src/features/connections/components/connection-dialog/database-type-selector.tsx` | a provider tile + `TYPE_THEME` entry + `ProviderKey` union member |
| `packages/studio/src/features/connections/components/connection-dialog.tsx` | import + `selectedIntegration` union member + conditional render |
| `packages/studio/src/features/connections/source-labels.ts` | a `resolveProviderLabel` case |
| `packages/studio/src/features/connections/types.ts` | a new `DatabaseType` member + `DEFAULT_PORTS` entry (only for connectors that add a new engine) |

### Bindings regeneration (do once, in the coordinator pass)

`bindings.ts` exists in **two** places and is **not** auto-synced in dev:

- Generated: `apps/desktop/src/lib/bindings.ts` — produced by the export test.
- Hand-synced: `packages/studio/src/lib/bindings.ts` — the one the studio
  package imports (`@studio/lib/bindings`).

Workflow:

```bash
# from apps/desktop/src-tauri
cargo test --lib export_bindings -- --ignored --exact bindings::tests::export_bindings
# then hand-copy the new command methods + types from
#   apps/desktop/src/lib/bindings.ts  →  packages/studio/src/lib/bindings.ts
```

## Verification (every plan ends with these)

```bash
# Rust compiles + unit tests
cd apps/desktop/src-tauri && cargo check && cargo test --lib integrations::
# Frontend typecheck (run in both)
cd packages/studio && bun run typecheck
cd apps/desktop && bun run typecheck
# Studio test suite
cd packages/studio && bun run test
```

## Status / priority

| Plan | Tier | Effort | Blocks |
| --- | --- | --- | --- |
| P1 · Cloudflare D1 | land-grab | M–L (new HTTP adapter) | — |
| P1 · Vercel Postgres | cheap | S (reuses Postgres adapter) | — |
| P1 · PlanetScale | cheap | S–M (reuses MySQL adapter) | — |
| P1 · Xata | cheap | S (reuses Postgres adapter) | — |
| P1 · Branch-aware connects | enhancement | M | PlanetScale (for PS branches) |
| P1 · Upstash (Redis) | epic | L (new paradigm) | — |
| P1 · MongoDB Atlas | epic | L (new paradigm) | — |
| P2 · Schema IR + introspection | foundation | M | blocks all P2 |
| P2 · Drizzle parser | foundation | M | P2 diff |
| P2 · Prisma parser | foundation | M | P2 diff |
| P2 · Folder linking | foundation | S | P2 diff |
| P2 · Diff engine | core | M | P2 migration, UI |
| P2 · Migration generation | core | M | P2 UI |
| P2 · Cockpit UI | surface | M | — |

"Cheap" / "reuses X adapter" means **no new Rust query adapter is needed** — the
provider hands back a standard Postgres/MySQL connection string, so the work is
only the integration connect-flow + registration.
