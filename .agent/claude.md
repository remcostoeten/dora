# Claude Context

## Project Structure

- **Root**: `/home/remco-stoeten/dora`
- **CLI**: `tools/dora-cli` (Go)
- **Scripts**: `tools/scripts` (TypeScript)
- **Docs**: `docs/` (Release notes, changelogs)

## Key Rules

1. **No Emojis**: Never use emojis in technical documentation or release notes.
2. **Path Awareness**: Always check `docs/` for release notes, not root.
3. **CLI**: The `dora` binary is the source of truth for build management.

## Release Process

When asked to handle a release:

1. Check `docs/RELEASE_NOTES.md` for the current draft.
2. Use `dora-cli` scripts if available (`bun run generate-release`).
3. If writing notes manually, follow `AGENTS.md` guidelines.
