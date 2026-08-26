# Animation improvement plans

Written by the `improve-animations` skill from the motion sweep of `packages/studio` at commit `d39cca69` (2026-08-26). Each plan is self-contained — an executor needs no context beyond the plan file. Execute with `improve-animations execute <plan>` or hand a plan file to any agent.

Shared context: the Studio's motion vocabulary is `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` (`packages/studio/src/styles.css:182-183`), tw-animate-css for Radix surfaces, and framer-motion in four files. All plans extend these; none invent new tokens.

## Plans

| # | Title | Severity | Status |
| --- | --- | --- | --- |
| [001](001-reduced-motion-baseline.md) | Add a prefers-reduced-motion baseline to the Studio stylesheet | MEDIUM | TODO |
| [002](002-right-edge-drawers-slide.md) | Slide the right-edge drawers instead of teleporting them | HIGH | TODO |
| [003](003-hold-to-confirm-connection-delete.md) | Hold-to-confirm the connection delete button | MEDIUM | TODO |
| [004](004-wire-collapsible-animation.md) | Wire the dead accordion keyframes into CollapsibleContent | MEDIUM | TODO |
| [005](005-pending-changes-bar-enter-exit.md) | Ease the pending-changes bar in and out | MEDIUM | TODO |
| [006](006-selection-action-bar-symmetric-exit.md) | Give the selection action bar a symmetric exit | MEDIUM | TODO |
| [007](007-connection-status-dot-transitions.md) | Mark connection status transitions on the tab-bar dot | MEDIUM | TODO |
| [008](008-onboarding-tour-card-motion.md) | Let the onboarding tour card enter, step, and leave with the spotlight | LOW | TODO |

## Recommended execution order

1. **001** — foundation; 007's shake and every later plan's reduced-motion story assume it.
2. **002** — highest leverage, and it creates `shared/hooks/use-presence.ts`, which 005 and 008 reuse.
3. **005**, **006**, **004**, **007**, **003** — independent of each other, any order.
4. **008** — delight tier, last.

## Dependencies

- **005 and 008 depend on 002** for `packages/studio/src/shared/hooks/use-presence.ts`. Both plans inline instructions to create the hook if it doesn't exist yet, so the dependency is soft — but executing 002 first avoids duplicate creation.
- **007 depends on 001** only for its reduced-motion verification step (the `.connection-status-error { animation: none }` rule lives in 001's media block).
- 003, 004, 006 are fully independent.

## Out of scope, noted during the sweep

- The context-menu and command-palette connection-delete paths remain un-confirmed after 003 — routing them through an AlertDialog is a UX/safety fix, not a motion fix. Worth filing as an issue.
- The SQL console's executing state (`sql-console.tsx:442-443` nulls the result, so the pane reverts to the idle placeholder while a query runs) is a missing state, not missing motion — fix the state before animating that swap.
- Runner-up not planned: the new-row emerald highlight (`grid-body.tsx:82`) ends in a hard ~150ms cut after 4s; lengthening the un-highlight transition to ~600ms `var(--ease-out)` would be a two-token change if wanted later.
