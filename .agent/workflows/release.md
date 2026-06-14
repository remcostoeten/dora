---
description: Generate release notes and changelog using AI
---

# Release Generation Workflow

Optional AI helper for drafting release notes before a tag. The normal release path is documented in `docs/distribution/release-guide.md`: run `bun run release` (or **Release dispatch** in Actions). CI bumps versions, prepends `CHANGELOG.md` via git-cliff, tags, builds, publishes the GitHub release, then updates `README.md`. Use this workflow only when you want a human-reviewed draft in `docs/RELEASE_NOTES.md` ahead of that automation.

## Prerequisites

1. Ensure you have a `.env` file with your API key configured (see `tools/scripts/.env.example`)
2. For Gemini: Set `GEMINI_API_KEY` in your environment
3. For Ollama: Run `bun setup:ai` first to verify your local setup

## Commands

// turbo-all

### Test API Connection

```bash
bun release:gen --test
```

### List Available Models (Gemini only)

```bash
bun release:gen --list-models
```

### Preview Release Notes (Dry Run)

```bash
bun release:gen --dry-run
```

### Generate Release Notes

```bash
bun release:gen
```

### Generate and Build Executables

```bash
bun release:gen --build
```

### Generate with Version Bump

```bash
bun release:gen --version-bump=patch
bun release:gen --version-bump=minor
bun release:gen --version-bump=major
```

## Output Files

- `docs/RELEASE_NOTES.md` — draft release notes (not written to the repo root)
- `CHANGELOG.md` — appended entry when using `--version-bump` locally (CI prepends via git-cliff during Release dispatch)
- `apps/desktop/package.json` — updated version when using `--version-bump`

## Troubleshooting

1. **API Error**: Run `--test` to verify connectivity
2. **Bad Output**: The AI should return valid JSON; if not, check model availability with `--list-models`
3. **No Commits**: Ensure you have commits since the last git tag
