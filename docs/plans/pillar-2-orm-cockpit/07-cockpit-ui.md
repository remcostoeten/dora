# Plan 07: Cockpit UI

**Effort:** M. **Depends on:** public functions from 01–06 (build against stubs,
integrate last). **Surface only — no business logic here.**

The cockpit screen: link a project → see drift vs the live DB → preview a
migration. A new feature surface alongside the SQL console / ORM runners.

## Files (owned)

`packages/studio/src/features/orm-cockpit/components/`
- `orm-cockpit-panel.tsx` — the screen.
- `drift-view.tsx` — renders a `SchemaDiff` (grouped by table; per-row
  confidence chips: green `safe` / amber `review` / red `destructive`).
- `migration-preview.tsx` — shows generated SQL with the destructive/review
  toggles from plan 06; "Copy" + "Open in SQL console" actions.
- `use-orm-cockpit.ts` — orchestration hook (ties link → parse → introspect →
  diff → generate).

## Flow / state (in `use-orm-cockpit.ts`)

1. **Link** — call `pickFolder()` (plan 04) → `detectOrm()` → read schema files.
2. **Parse** — `parseDrizzleSchema` or `parsePrismaSchema` (02/03) → code IR.
3. **Introspect** — `getDatabaseSchema(connectionId)` (existing command) →
   `fromLiveSchema()` (01) → live IR. Use the **connected DB's dialect**.
4. **Diff** — `diffSchema(liveIR, codeIR)` (05). Direction: live = `from`, code =
   `to` (so "added in code" → needs creating in DB). Label clearly in the UI.
5. **Generate** — `generateMigrationSql(diff, dialect)` (06) on demand.
6. Surface all `warnings[]` from every step (parser/diff/gen) in a collapsible
   "notes" area — never swallow them.

## UX requirements

- Empty/initial state: "Link a project folder to compare its schema with this
  database." with a Link button. Persist the last-linked folder per connection
  (reuse existing settings storage) and a Refresh/re-scan button.
- Drift view: count summary ("3 tables differ · 1 destructive"), per-table
  expandable rows, confidence chips, before/after for changed columns.
- Migration preview: toggles to include destructive / review statements (default
  off), copy button, "Open in SQL console". Make destructive inclusion an
  explicit, deliberate action.
- Loading + error states for each phase (mirror the integration connect-flows'
  patterns).
- Mount point: add to wherever ORM runners/SQL console are surfaced — find the
  studio's main panel/tab host and add an "ORM cockpit" entry. *(This may touch a
  shared nav file — keep the edit minimal/append-only.)*

## Acceptance criteria

- [ ] Link a Drizzle project → drift view renders with correct confidence chips;
      generate → valid SQL preview.
- [ ] Same for a Prisma project.
- [ ] Identical schema → "in sync" empty state, no spurious diffs.
- [ ] Warnings from parse/diff/gen are visible, not swallowed.
- [ ] Destructive statements require explicit opt-in before they appear in the
      copyable SQL.
- [ ] `bun run typecheck` + `bun run test` clean; manual run against a real
      project with known drift.

## Risks

- Don't let the UI imply the migration was applied — it's preview + hand-off in
  v1 (see plan 06). Copy wording carefully ("Generated — review and run in SQL
  console").
- Big schemas → virtualize the drift list if needed (reuse grid virtualization
  patterns if present).
