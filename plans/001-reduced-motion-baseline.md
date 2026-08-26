# 001 — Add a prefers-reduced-motion baseline to the Studio stylesheet

- **Status**: TODO
- **Commit**: d39cca69
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file (`packages/studio/src/styles.css`), ~30 lines added

## Problem

`packages/studio/src/styles.css` (2078 lines) contains ~14 keyframe animations, several of them `infinite`, and has **zero** `prefers-reduced-motion` handling (grep confirms no occurrence in the file or anywhere in `packages/studio/src`). Users who ask the OS for reduced motion still get:

- `packages/studio/src/styles.css:906` — `.db-type-icon-glint { animation: dbTypeIconGlint 3.6s cubic-bezier(0.4, 0, 0.2, 1) infinite; }` (a mask-position sweep across database-type icons; purely decorative)
- `packages/studio/src/styles.css:960` — `.desktop-only-notice__shimmer::after { animation: desktopOnlyNoticeShimmer 3.2s ease-in-out infinite; }` (a `translateX(-120%→120%)` sheen; decorative)
- `packages/studio/src/styles.css:995` — `.cockpit-skeleton::after { animation: cockpitSkeletonSheen 3.6s var(--ease-out) infinite; }` (a `translateX(-130%→130%)` sheen; decorative)
- `packages/studio/src/styles.css:1258-1276` — `.sv-edge-flow` (+ `--match`, `--active` variants) — `animation: sv-flow 1.4s linear infinite` marching-ants stroke movement in the schema visualizer
- `packages/studio/src/styles.css:773-775` — `.connection-status-error { animation: statusShake 0.4s ease-out; }` — a ±4px translateX shake (movement; currently dead CSS, wired by plan 007)

Reduced motion means **fewer and gentler animations, not zero**. Opacity/color feedback stays; movement and infinite decoration go.

## Target

One `@media (prefers-reduced-motion: reduce)` block appended at the end of `packages/studio/src/styles.css`:

```css
/*
 * Reduced-motion baseline. Movement and infinite decorative animation is
 * suppressed; opacity/color feedback (shimmers, pulses, fades) is kept on
 * purpose — reduced motion means gentler, not zero.
 */
@media (prefers-reduced-motion: reduce) {
	.db-type-icon-glint {
		animation: none;
		-webkit-mask-position: 150% center;
		mask-position: 150% center;
	}

	.desktop-only-notice__shimmer::after,
	.cockpit-skeleton::after {
		animation: none;
	}

	.sv-edge-flow,
	.sv-edge-flow--match,
	.sv-edge-flow--active {
		animation: none;
	}

	.connection-status-error {
		animation: none;
	}
}
```

Deliberately **not** suppressed (keep them — they are feedback, not decoration):

- `.async-count-shimmer` / `.ai-thinking-label` (`:836`, `:851`) — background-position shimmer, loading feedback, no element movement
- `.desktop-only-hint` (`:920`) and `.settings-section-highlight` (`:937`) — finite box-shadow pulses, attention feedback
- `.async-count-reveal` (`:847`), `.connection-status-success` (`:769`, a 0.95→1 scale pulse), `.query-tab-indicator` (`:1024`) — sub-3px/one-shot feedback

## Repo conventions to follow

- All Studio-global CSS lives in `packages/studio/src/styles.css`. Easing tokens are at `:182-183` (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`; `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`).
- The file uses tab indentation and block comments explaining *why* (exemplar: the exit-flash rationale at `styles.css:604-618`). Match both.
- Note: some animation classes live inside an `@layer` block that closes at `styles.css:998`. The new media block goes at the very end of the file, **outside** any `@layer`, so it wins over layered rules.

## Steps

1. Open `packages/studio/src/styles.css`, go to the end of the file, and append the `@media (prefers-reduced-motion: reduce)` block exactly as written in **Target** (tab-indented).

## Boundaries

- Do NOT touch any `.tsx` files.
- Do NOT add a global `* { animation: none }` catch-all — the selective list above is the whole change.
- Do NOT remove or edit the existing keyframes/classes; only the new media block is added.
- If any of the cited selectors no longer exist at their lines (drift since d39cca69), STOP and report instead of improvising.

## Verification

- **Mechanical**: `cd packages/studio && bun run typecheck` still passes (CSS-only change; this catches accidental file corruption via the Vite/TS pipeline in dependent builds). Grep check: `grep -c 'prefers-reduced-motion' packages/studio/src/styles.css` returns `1`.
- **Feel check**: run the Studio in a browser (`localhost:1420` dev server), open DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce", then confirm:
  - The connection dialog's database-type icons no longer glint; icons still render normally.
  - The schema visualizer's FK edges show static dashes (no marching ants).
  - The ORM cockpit empty skeleton shows no sweeping sheen but the ghost table still renders.
  - The async row-count shimmer in SQL results **still shimmers** (kept deliberately).
- **Done when**: with reduced motion emulated, no infinite movement animation runs anywhere in the Studio, and loading shimmers/pulse feedback still work.
