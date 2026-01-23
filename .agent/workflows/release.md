---
description: Generate release notes and changelog using AI
---

# Release Generation Workflow

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

- `RELEASE_NOTES.md` - Full release notes
- `CHANGELOG.md` - Appended changelog entry
- `apps/desktop/package.json` - Updated version (if using --version-bump)

## Troubleshooting

1. **API Error**: Run `--test` to verify connectivity
2. **Bad Output**: The AI should return valid JSON; if not, check model availability with `--list-models`
3. **No Commits**: Ensure you have commits since the last git tag
