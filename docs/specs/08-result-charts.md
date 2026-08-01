# Spec 08: Result Set Charts

Status: `[ ]`

## Why

A chart toggle next to the existing table/JSON result views is cheap, demo-friendly, and the single feature most often cited for choosing Outerbase. Frontend-only, with no Rust changes.

## Scope

- New "Chart" view mode in the SQL console results pane (alongside table/JSON) and in the data viewer's current result context.
- Chart types v1: bar, line, area, pie, scatter. Auto-suggest a sensible default from the result shape (one text/date column + one numeric column → bar/line; two numerics → scatter).
- Axis/series pickers: X column, one or more Y columns, optional group-by column; basic aggregations (count, sum, avg) applied client-side when X has duplicate values.
- Export chart as PNG and SVG; chart config remembered per query-history entry so re-running a saved query restores its chart.
- Respect the app theme (dark/light, accent color) via existing CSS variables.

Out of scope: dashboards/pinned charts, auto-refresh, server-side aggregation, drill-down interactions.

## Safe write scope

- Frontend only: new `packages/studio/src/features/sql-console/` result-view component(s) or a shared `packages/studio/src/features/result-charts/` module consumed by sql-console and database-studio
- Query history persistence: additive optional `chartConfig` field wherever history entries are stored on the frontend side; if history is persisted through a Rust command, the field rides inside the existing payload (no new commands)
- `packages/studio/package.json` for the chart dependency

## Implementation notes

1. Library: pick something tree-shakeable and canvas/SVG-light. `recharts` fits the existing React/Radix stack; avoid heavyweight options (echarts) unless recharts proves insufficient, and note bundle-size delta in the PR.
2. Data volume: charts over >10k points should downsample (LTTB or simple bucketing) with an indicator, never lock the UI. The table view remains the source of truth; charting never re-runs the query.
3. Type detection: reuse whatever column-type metadata the result payload already carries from the backend (`bindings.ts` result types) instead of re-sniffing values; fall back to value sniffing only for providers that return untyped columns.
4. Empty/degenerate states matter: zero rows, all-NULL columns, single row, non-numeric-only results should each show a friendly "can't chart this, here's why" state, not a blank canvas.
5. Keyboard-first: the view-mode toggle joins the existing table/JSON shortcut cycle; chart config controls must be reachable by keyboard (Radix primitives).

## Done when

- `SELECT created_at::date, count(*) FROM … GROUP BY 1` renders a sensible default line/bar chart in two clicks (or zero, via auto-suggest).
- Multi-series with group-by works; PNG/SVG export works; config survives history re-run; theme switch restyles live.
- Component tests for type inference, default suggestion, aggregation, and degenerate states.

## Validation

```bash
bun run --cwd apps/desktop test
bun run lint
# manual: run grouped queries against a seeded Docker postgres, toggle themes, export PNG/SVG
```
