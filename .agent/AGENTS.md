# AI Agent Guidelines

## Release Notes & Changelogs

- **Location**: Release notes drafts must be written to `docs/RELEASE_NOTES.md`.
- **Format**: Plain text Markdown. **STRICTLY NO EMOJIS**. No "marketing fluff".
- **Structure**:
    - Highlights (Critical changes only)
    - Features (New capabilities)
    - Fixes (Bug fixes)
    - Technical (Refactors, build changes)
- **Version**: Do not invent version numbers. Use the provided one or increment logical patch/minor.

## Pull Requests

- **Always add a label** before merging. The label drives GitHub's auto-generated release notes
  (configured in `.github/release.yml`). PRs without a matching label fall into "Other Changes".
- Valid labels: `feat`, `fix`, `perf`, `refactor`, `deps`, `ci`, `docs`.
- One label per PR is enough. Use the label that best describes the user-visible impact.

## Documentation

- Keep `README.md` professional.
- **NO DECORATIVE EMOJIS**.
- Use text labels (Done/WIP) instead of status icons.
