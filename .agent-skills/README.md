# Agent skills

Canonical source for Dora's project-local agent skills. Every skill lives at
`.agent-skills/<skill-name>/SKILL.md` and is copied from here into the two agent
roots by `bun run skills:sync`.

Edit the canonical file. Never edit a generated copy — `skills:check` fails on drift.

## Why there are copies instead of one directory

Claude Code and Codex do not share a discovery root. `.agent-skills/FINDINGS.md`
section 7 verified, against the installed versions:

| Root | Codex 0.146.0 | Claude Code 2.1.220 |
| --- | --- | --- |
| `.claude/skills/` | not loaded | loaded |
| `.codex/skills/` | loaded | not loaded |
| `.agents/skills/` | loaded | not loaded |
| `.agent-skills/` | not loaded | not loaded |

Symlinks would work for Claude Code (per-skill only, not a symlinked `skills`
directory) but Dora ships on Windows, so copies it is. Generated copies are
byte-identical to canonical, which makes the drift check a plain byte compare.

## Layout

```
.agent-skills/<name>/SKILL.md    canonical, edit this
.claude/skills/<name>/SKILL.md   generated, read by Claude Code
.codex/skills/<name>/SKILL.md    generated, read by Codex
```

Only directories named `dora-*` are managed by this repo. Both agent roots also
hold locally installed third-party skills, which stay gitignored and are never
rewritten or pruned. `.gitignore` re-includes exactly `*/skills/dora-*/`.

## Commands

```bash
bun run skills:sync
bun run skills:check
```

`skills:sync` regenerates both copies and prunes managed skills whose canonical
source is gone.

`skills:check` fails on:

- **drift** — a generated copy differs from canonical, is missing, or has no
  canonical source. Fix with `bun run skills:sync`.
- **paths** — a repository path referenced by a SKILL.md does not exist. This is
  the check that matters. Skills rot when a refactor moves a file and the skill
  keeps pointing at the old location.
- **commands** — a project command referenced by a SKILL.md is not defined in a
  package.json, turbo.json, or a workflow.

`skills:check` runs in CI on every pull request, in the `lint` job of
`.github/workflows/ci.yml`.

### What the checks actually read

Both extractors are deliberately narrow, matching how tracked docs in this repo
already write things:

- Paths: backtick-quoted spans only. Glob and placeholder segments are reduced to
  their longest concrete prefix (`apps/*/src` becomes `apps`), which must exist.
  Import specifiers (`@studio/...`), URLs, and Rust paths (`a::b`) are skipped.
- Commands: lines inside fenced `bash`/`sh`/`shell`/`console` blocks whose first
  token is a project runner (bun, bunx, turbo, cargo, npm, npx, pnpm, yarn, node,
  docker). Generic shell such as `git status` is ignored. A command matches when
  it equals a defined command or is one plus extra arguments.

Consequence worth knowing: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
appears in `docs/provider-support/` but in no package.json, turbo.json, or
workflow, so citing it in a SKILL.md fails check (c) until it is defined somewhere.

## Index

Eleven skills are **written**: `dora-tauri-boundary`, `dora-query-pipeline`,
`dora-data-grid`, `dora-connection-lifecycle`, `dora-add-database-driver`,
`dora-database-parity`, `dora-add-provider`, `dora-migration-safety`,
`dora-release-cut`, `dora-orm-cockpit` and `dora-testing`. Together they
partition the wire, query lifecycle, grid rendering, connections, engines,
providers, schema modeling and conversion, migrations, testing and releases;
each one names the others it defers to rather than restating them.

The six earlier placeholders that written skills superseded were deleted rather
than kept alongside them — a stub whose trigger overlaps a written skill is a
routing bug under Codex, where the guard is unverified. The two remaining
placeholders, `dora-orm-cockpit` and `dora-testing`, have now been implemented
and their invocation guards removed.

Deleting `dora-release` left one area with no skill and no placeholder: bundle
and packaging configuration — what the desktop app ships inside it, as opposed to
how a version is cut and published. `dora-release-cut` excludes it deliberately.

| Skill | Responsibility | Trigger | Defers to |
| --- | --- | --- | --- |
| `dora-tauri-boundary` | The IPC wire: command signatures, request and response types, serde representation, error shape, payload cost | Adding or changing a Tauri command, a type that crosses IPC, or how a backend error is represented | `dora-query-pipeline` for lifecycle, `dora-data-grid` for rendering |
| `dora-query-pipeline` | Query lifecycle: execution, cancellation, concurrency, per-tab isolation, ownership of result state | Changing how a query is started, polled, cancelled or superseded, how many run at once, or how a stale result is kept from painting | `dora-tauri-boundary` for the wire, `dora-data-grid` for rendering |
| `dora-data-grid` | Rendering the browse table: cell display and editors, selection, focus, keyboard, virtualization, draft row | Changing how a value is displayed or edited in place, how rows and cells are selected or focused, what the keyboard does in the grid, or when rows virtualize | `dora-query-pipeline` for anything that moves data, `dora-tauri-boundary` for the wire |
| `dora-connection-lifecycle` | Connection creation, persistence, opening, health, credentials, SSH tunnels, teardown | Changing how a connection is added, opened, watched, disconnected or removed; where a secret lives and when it is read; relaunch or moved-file behaviour; data-file sessions | `dora-query-pipeline` for running queries, `dora-tauri-boundary` for command shape |
| `dora-add-database-driver` | Add a database engine end to end: connection enums, read/write/watch adapters and factories, executor, stored type id, frontend registries, capability entry, connect tile | Adding an engine Dora cannot speak — a new wire protocol or HTTP query API needing its own adapter. Not a hosted account integration over an engine it already speaks | `dora-connection-lifecycle` for connecting and secrets, `dora-query-pipeline` for lifecycle, `dora-tauri-boundary` for the wire; pairs with `dora-database-parity` for verification |
| `dora-migration-safety` | Drift migration generation and its gates: confidence classification, SQL emission and sectioning, down-script reversibility, preview opt-ins, console handoff, Drizzle journal reconciliation | Changing how a diff is classified safe/review/destructive, how migration SQL is emitted or gated, what a down script contains, or how migration status reconciles against the database | `dora-query-pipeline` for executing the handed-off SQL; upstream IR, ORM parsers and converters are out of scope |
| `dora-database-parity` | What must hold across every supported database: known behaviour differences, capability flags, degradation, where engine-specific code may live, the verification matrix | Changing behaviour that reads or writes data, introspects a schema, emits SQL, or is gated per engine; deciding which engines a data-facing change must be verified against | `dora-add-database-driver` for adding an engine, `dora-query-pipeline` for lifecycle, `dora-tauri-boundary` for the wire |
| `dora-add-provider` | Hosted-provider account integrations: the Rust API module, its commands, the connect flow and tile, token storage, refresh and revocation, and the handoff that builds a connection from a picked row | Wiring or changing a Neon/Supabase/Turso/PlanetScale/Vercel/Xata/Cloudflare-style integration, or how a provider token is saved, refreshed, revoked or turned into a credential. Not a provider reached by pasting a URL — that is a preset | `dora-connection-lifecycle` for storing and tearing down the connection, `dora-add-database-driver` when the provider needs an engine that does not exist yet, `dora-tauri-boundary` for command registration |
| `dora-release-cut` | Cutting a release and recovering a broken one: version sources of truth, dispatch entry points, the CI gates, per-channel publish and verify | Shipping a version, changing the release or channel workflows, changing the updater manifest or its signing, or diagnosing a tag with no build, a missing asset, or a channel that did not publish | none |
| `dora-orm-cockpit` | Schema modeling and deterministic ORM conversion: project discovery, SchemaIR and QueryIR, live/Drizzle/Prisma parsers, Drizzle ↔ SQL conversion | Changing schema IR or type normalization, ORM project detection/parsing, converter grammar, warnings/errors or upstream cockpit orchestration | `dora-migration-safety` owns everything from the diff downward; `dora-query-pipeline` executes resulting SQL; `dora-tauri-boundary` owns project-file command shapes |
| `dora-testing` | Test architecture and evidence: Vitest, Rust tests, mocks/setup, coverage, browser smoke, live databases and PR CI | Adding or changing tests, test configuration, test scripts, feature/live fixtures, smoke coverage or CI gates; deciding what proves a change verified | Pairs with the domain skill for behavior; `dora-release-cut` owns release-channel workflows |

## Adding a skill

1. Create `.agent-skills/<name>/SKILL.md` with `name` and `description`
   frontmatter. Prefix the directory with `dora-` or it will not be tracked by git
   or managed by the scripts.
2. Run `bun run skills:sync`.
3. Run `bun run skills:check`.
4. Add a row to the index above.
5. Commit the canonical file and both generated copies together.

Bundled resources (`references/`, `assets/`, `scripts/`) are supported: anything
inside a canonical skill directory is copied verbatim.
