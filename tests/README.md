# Tests

This repository uses Vitest for unit tests. Test files live under `tests/` and
mirror the application structure to keep production code free of colocated tests.

## Quick Start

Run the full suite from the repo root:

```bash
bun run test
```

Watch mode:

```bash
bun run test:watch
```

UI runner:

```bash
bun run test:ui
```

## Structure

- `tests/apps/desktop/...` mirrors `apps/desktop/src/...`
- `tests/setup/vitest.setup.ts` holds shared test setup

## Conventions

- Use `@tested-by` JSDoc tags in source files to link to the owning test.
- Prefer `@` imports in tests; `@` maps to `apps/desktop/src`.
