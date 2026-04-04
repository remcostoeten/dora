# WS7: Docs And Release State

Status: `[ ]`

## Goal

Keep docs aligned with the actual shipped provider surface.

## Ownership

Safe write scope:

- `README.md`
- `apps/desktop/RELEASE_TASKS.md`
- `docs/app-audit-2026-02-20.md`
- `docs/provider-support-roadmap.md`
- files in `docs/provider-support/`

## Tasks

1. Do not claim MySQL support in the main README until backend and runtime verification are real.
2. When MySQL beta is usable, update product copy and feature tables.
3. Document omissions explicitly:
   - SSH tunneling if unsupported
   - live updates if unsupported
   - destructive operations if unsupported
4. Keep workstream statuses updated as agents finish slices.

## Done When

- product docs match reality
- agent handoff docs reflect current implementation state

## Validation

- manual doc review

## Update Notes

- 2026-04-04:
