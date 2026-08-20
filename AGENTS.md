# Dora project-wide agent instructions

## Agent skills

Project skills live at `.agents/skills/<name>/SKILL.md` — the single canonical root, read directly by Codex and other tools following the agents standard. Only the repo's own `dora-*` skills are tracked; everything else under `.agents/` is local state and stays gitignored.

## Release notes, changelogs and pull requests

- Release notes drafts go to `docs/RELEASE_NOTES.md`, in plain Markdown. No emojis, no marketing fluff. Structure them as Highlights (critical changes only), Features, Fixes, Technical.
- Never invent version numbers. Use the one provided, or increment the logical patch/minor.
- Always label a PR before merging — the label drives GitHub's auto-generated release notes (`.github/release.yml`). Unlabelled PRs fall into "Other Changes". Valid labels: `feat`, `fix`, `perf`, `refactor`, `deps`, `ci`, `docs`. One label per PR, the one that best describes user-visible impact.
- Keep `README.md` professional: no decorative emojis, text labels (Done/WIP) instead of status icons.

## TypeScript conventions

- When a component or function has a single props/args type that is not exported, name it `type Props` (or inline it) instead of `ComponentNameProps`.
- Export types only when consumed outside their defining module.

## Local database containers

`docker-compose.databases.yml` at the repo root stands up real servers for manual testing and the live adapter tests (`apps/desktop/src-tauri/tests/live_db_tests.rs`, gated behind `DORA_LIVE_DB_TESTS=1`; CI runs them via `.github/workflows/live-db-tests.yml`).

Port map (note the swap: **MySQL is NOT on its default port**):

| Service | Host port | URL |
| --- | --- | --- |
| postgres (17) | 5432 | `postgres://postgres:rootpass@127.0.0.1:5432/dora` |
| mysql (8.4) | **3307** | `mysql://root:rootpass@127.0.0.1:3307/dora` |
| mariadb (11.4) | 3306 | `mysql://root:rootpass@127.0.0.1:3306/dora` |
| cockroach (v25.1) | 26257 | `postgres://root@127.0.0.1:26257/defaultdb?sslmode=disable` |
| libsql (sqld) | 8081 | `http://127.0.0.1:8081` |

Start what you need: `docker compose -f docker-compose.databases.yml up -d --wait mysql mariadb`. If a container has a stale/broken port binding from an old compose run, `up -d --force-recreate --wait <service>` fixes it.
