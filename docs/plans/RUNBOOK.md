# RUNBOOK — execute the Pillar 1 & 2 plans

This is an **orchestration script**. When asked to "execute docs/plans/RUNBOOK.md",
act as the coordinator: launch the agents in the waves below (Agent tool,
`isolation: "worktree"`, parallel agents in a single message), wait for each
wave, then run the coordinator/integration step before the next dependent wave.

Plans live in `docs/plans/pillar-1-edge-db-connectors/` and
`docs/plans/pillar-2-orm-cockpit/`. Read `docs/plans/README.md` first
(parallelization rules, shared-file list, bindings regen, verification).

## Hard rules for every agent

- Implement **only** the plan's "Files (owned)" / new files. Do NOT edit the
  shared registration files (`lib.rs`, `bindings.rs`, `integrations.rs`,
  `database-type-selector.tsx`, `connection-dialog.tsx`, `source-labels.ts`,
  `types.ts`, `bindings.ts`). Instead emit a `## REGISTRATION PATCH` block at the
  end of the final report (exact file + lines to append). The coordinator applies
  these once.
- Resolve the plan's flagged "unknown to resolve first" / Risk **before coding**;
  report the finding. Follow real API behavior over the plan if they differ.
- Add the unit tests the acceptance criteria require. Match surrounding style.
- Self-verify what's possible without registration: `cargo check`,
  `cargo test --lib <yours>`, `bun run typecheck` in `packages/studio`. Report
  what could/couldn't be verified in isolation.

## Agent prompt template

```
Execute docs/plans/<PATH>.md in this repo.
Read first, in order: docs/plans/README.md ; <PREREQ doc if the plan names one> ; docs/plans/<PATH>.md.
Follow the "Hard rules for every agent" in docs/plans/RUNBOOK.md:
- implement ONLY this plan's owned/new files;
- do NOT touch shared registration files — instead end your report with a "## REGISTRATION PATCH"
  block listing exact file paths + lines to append;
- resolve the plan's "unknown to resolve first"/Risk before coding and report the finding;
- add the required unit tests; self-verify with cargo check / cargo test --lib <yours> / bun run typecheck.
Final report: (1) files built, (2) spike/risk finding, (3) verification results,
(4) the "## REGISTRATION PATCH" block, (5) anything needing a live service to test.
```

## Coordinator/integration prompt (run after each wave that produced owned files)

```
Integrate completed plans. Agents worked in separate worktrees and left "## REGISTRATION PATCH"
blocks (below).
1. Merge each agent's owned files into the working tree.
2. Apply every REGISTRATION PATCH: append entries to lib.rs generate_handler!, bindings.rs
   collect_commands!, integrations.rs wrappers, database-type-selector.tsx (tile + TYPE_THEME +
   ProviderKey), connection-dialog.tsx (import + selectedIntegration union + conditional render),
   source-labels.ts case, types.ts (DatabaseType/DEFAULT_PORTS when a new engine). Resolve ordering.
3. Regenerate bindings per docs/plans/README.md: run the export test, then hand-sync new command
   methods + types into packages/studio/src/lib/bindings.ts.
4. Verify: cargo check && cargo test --lib integrations:: ; bun run typecheck in packages/studio AND
   apps/desktop ; bun run test in packages/studio. Fix red.
5. Report final status + what still needs a live service to verify.
REGISTRATION PATCHES:
<paste each agent's block>
```

---

## Pillar 1 — edge/serverless DB connectors

**Wave P1 (parallel, 4 agents):**
- `pillar-1-edge-db-connectors/02-vercel-postgres.md`   (prereq: `00-provider-integration-pattern.md`)
- `pillar-1-edge-db-connectors/04-xata.md`              (prereq: `00-provider-integration-pattern.md`)
- `pillar-1-edge-db-connectors/03-planetscale.md`       (prereq: `00-provider-integration-pattern.md`)
- `pillar-1-edge-db-connectors/01-cloudflare-d1.md`     (prereq: `00-provider-integration-pattern.md`; biggest — new HTTP adapter)

→ then run the **coordinator** step.

**Wave P1b (after P1 integrates):**
- `pillar-1-edge-db-connectors/05-branch-aware-connects.md`  (needs PlanetScale from P1)

→ coordinator step.

**Not yet executable** (epic stubs — do not launch; scope as separate projects):
`06-upstash-redis.md`, `07-mongodb-atlas.md`.

> First-run advice: launch **only `02-vercel-postgres.md`** as a single agent,
> run the full loop incl. coordinator, confirm the pattern + prompts work, then
> fan out the rest of Wave P1.

## Pillar 2 — ORM & migration cockpit (sequenced; the IR is a shared contract)

**Wave A (1 agent, alone — blocks everything):**
- `pillar-2-orm-cockpit/01-schema-ir-and-introspection.md`

→ coordinator/merge. The IR types are now frozen at
`packages/studio/src/features/orm-cockpit/ir/types.ts`.

**Wave B (parallel, 4 agents)** — add to each prompt: *"Import the SchemaIR types
from `packages/studio/src/features/orm-cockpit/ir/types.ts` as a frozen contract;
do not redefine them."*
- `pillar-2-orm-cockpit/02-drizzle-parser.md`
- `pillar-2-orm-cockpit/03-prisma-parser.md`
- `pillar-2-orm-cockpit/04-folder-linking.md`
- `pillar-2-orm-cockpit/05-diff-engine.md`  (also freezes the `SchemaDiff` type)

→ coordinator/merge.

**Wave C (1 agent):**
- `pillar-2-orm-cockpit/06-migration-generation.md`  (import `SchemaDiff` from plan 05's `diff/types.ts`)

**Wave D (1 agent):**
- `pillar-2-orm-cockpit/07-cockpit-ui.md`

→ final coordinator step + manual run against a real Drizzle and Prisma project
with known drift.

## Done criteria

- Each wave's coordinator step ends green: `cargo check`, `cargo test --lib`,
  `bun run typecheck` (both apps), `bun run test`.
- Connectors verified against a **live** account (D1/Vercel/PlanetScale/Xata) —
  isolation tests don't exercise the real connection.
- Pillar 2 verified by linking a real project and confirming the drift +
  generated migration are correct.
