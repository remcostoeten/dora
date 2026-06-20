# Plan: Branch-aware connects (Neon + PlanetScale)

**Tier:** enhancement. **Effort:** M. **Depends on:** existing Neon flow;
PlanetScale plan (`03-planetscale.md`) for PS branches.

> Nobody does branch-aware DB connections well in a desktop GUI, and it sets up
> Pillar 2's "diff two branches" feature. Neon and PlanetScale both have
> first-class branches.

## Goal

Let the user pick a **branch** (not just a database) when connecting to Neon and
PlanetScale, and show the branch on the connection. Default to the primary
branch so the common case stays one click.

## Neon

Today `neon.rs` `get_default_branch` silently picks the primary branch and
`list_databases` flattens everything. Change to **expose branches** as a pick
step:

- `integrations/neon.rs`: add `list_branches(project_id) -> Vec<NeonBranch
  { id, name, is_default }>` (the `/projects/{id}/branches` call already exists
  inside `get_default_branch` — factor it out and return all branches).
- `neon_connect_uri` already takes `branch_id`; thread the chosen branch through.
- `features/integrations/neon/neon-connect-flow.tsx`: after selecting a database
  row, if the project has >1 branch, show a branch selector (default = primary).
  Keep the current one-step UX when there's a single branch. Reflect the branch
  in the connection name (`<db> · <branch>`).

## PlanetScale

Implement as part of `03-planetscale.md` — its `list_branches` + per-branch
password minting already makes branch the natural pick step. This doc just
records that PS branch support is **required**, not optional, for that connector.

## Connection labeling

Store/show the branch so the connection list distinguishes
`myapp · main` from `myapp · preview-123`. Use the existing connection `name`
field; no schema change needed.

## Acceptance criteria

- [ ] Neon: a project with multiple branches shows a branch picker; primary is
      preselected; connecting to a non-primary branch works and is labeled.
- [ ] Neon: single-branch projects keep the current one-step flow.
- [ ] PlanetScale: branch picker present (covered by `03`).
- [ ] No regression in existing Neon connect tests; add a `list_branches` decode
      test.

## Risks

- Don't make the common (single-branch) path slower — only surface the picker
  when `branches.length > 1`.
- Branch lists can be large on busy projects — reuse the search/filter UI
  pattern from the database picker.
