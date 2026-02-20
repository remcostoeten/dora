# Future Features Roadmap

This file tracks features that are **not fully shipped** in the desktop app yet.

## Near-Term

| Feature | Status | Notes |
| :-- | :--: | :-- |
| MySQL connection support | In Progress | Database selector entry exists but is currently disabled in UI. |
| SSH tunnel UX | In Progress | Backend types/commands exist; frontend control is still disabled. |
| SQL Console result filtering | In Progress | Toolbar action currently shows a placeholder toast. |
| AI assistant surface in app | Planned | Sidebar item is present but disabled. |
| Schema visualizer UI | Planned | Sidebar item exists as a disabled placeholder. |

## Platform & Quality

| Area | Status | Notes |
| :-- | :--: | :-- |
| Frontend strict typecheck (`tsc --noEmit`) | In Progress | Multiple type regressions currently fail strict checks. |
| Bundle-size reduction | In Progress | Build currently emits large chunk warnings (Monaco/editor-heavy paths). |
| Docker manager hardening | In Progress | Feature is functional beta and actively being improved. |

## Longer-Term

- Collaborative workflows and multi-environment comparison tools.
- Rich schema diffing/migration assistance.
- Broader cloud provider setup/templating.
