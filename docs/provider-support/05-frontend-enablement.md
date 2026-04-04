# WS5: Frontend Enablement

Status: `[ ]`

## Goal

Expose MySQL in the UI only when the backend is ready.

## Ownership

Safe write scope:

- `apps/desktop/src/features/connections/api.ts`
- `apps/desktop/src/features/connections/types.ts`
- `apps/desktop/src/features/connections/validation.ts`
- `apps/desktop/src/features/connections/utils/providers.ts`
- `apps/desktop/src/features/connections/components/connection-dialog/database-type-selector.tsx`
- `apps/desktop/src/features/connections/components/connection-dialog/connection-form.tsx`

Do not edit Rust backend files here.

## Tasks

1. Confirm frontend-to-backend connection mapping supports MySQL in [api.ts](/home/remco/dev/dora/apps/desktop/src/features/connections/api.ts).
2. Re-enable MySQL selection in [database-type-selector.tsx](/home/remco/dev/dora/apps/desktop/src/features/connections/components/connection-dialog/database-type-selector.tsx) only after backend readiness.
3. Verify provider defaults in [providers.ts](/home/remco/dev/dora/apps/desktop/src/features/connections/utils/providers.ts).
4. Verify connection validation in [validation.ts](/home/remco/dev/dora/apps/desktop/src/features/connections/validation.ts).
5. Keep labels and hints honest about feature support.

## Done When

- users can create and test MySQL connections from the dialog
- the UI no longer presents MySQL as disabled
- unsupported MySQL-only gaps are not hidden from the team

## Validation

```bash
bun x tsc --noEmit -p apps/desktop/tsconfig.app.json
```

## Update Notes

- 2026-04-04:
