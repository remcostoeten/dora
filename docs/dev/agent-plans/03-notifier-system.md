# Notifier System Plan

## Goal

Keep one toast system across the app, make the styling coherent, and remove old notification assumptions from call sites.

## Problems To Fix

- Some call sites still depend on old toast semantics.
- Success, error, info, and loading states need one visual language.
- Long descriptions need truncation or pacing so toasts do not become unreadable.
- Destructive vs success behavior should be explicit at the call site.

## Scope

Primary files:

- `apps/desktop/src/shared/ui/notifier.tsx`
- `apps/desktop/src/hooks/use-toast.ts`

Secondary files if needed:

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/main.tsx`
- `apps/desktop/src/shared/ui/disabled-feature.tsx`
- `apps/desktop/src/core/undo/use-undo.ts`

## Implementation Plan

1. Verify that every user-facing toast goes through the notifier wrapper.
2. Keep the wrapper API small and explicit: success, error, info, loading, dismiss.
3. Normalize title/description formatting so very long strings do not dominate the UI.
4. Keep durations sensible and make errors dismissible by default.
5. Review all call sites that still rely on implicit default-success behavior and make the intended variant explicit.
6. Remove any old toast implementation paths that can be imported accidentally.
7. Keep the styling restrained and consistent with the rest of the desktop shell.

## Acceptance Criteria

- Success and error toasts look like one system.
- No page still depends on dead toast plumbing.
- Long messages remain readable and do not break layout.
- The app only has one active notification API in practice.

## Verification

- Trigger success, error, info, loading, and dismiss flows in at least one representative screen.
- Search the app for toast imports and confirm they all resolve to the notifier wrapper.
- Run `bun x tsc -p apps/desktop/tsconfig.app.json --noEmit --ignoreDeprecations 6.0`.
- Run `bun run --cwd apps/desktop build`.

