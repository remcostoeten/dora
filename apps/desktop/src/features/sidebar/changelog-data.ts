export type ChangelogEntry = {
	version: string
	date: string
	commit: string
	title: string
	description: string
	type: 'feature' | 'fix' | 'refactor' | 'breaking'
	details?: string[]
}

export const CURRENT_VERSION = '0.0.106'

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.0.106',
		date: '2026-04-19',
		commit: 'v0.0.106',
		title: 'Live Monitor Global, SSH Tunnels, File Exports & AUR Binary Package',
		description:
			'Global live database change notifications, working SSH tunnels, real file exports, and a fast AUR binary package.',
		type: 'feature',
		details: [
			'Live monitor is now a global context — external DB changes trigger app-wide notifications and data refresh',
			'Fixed SSH tunnel configuration not being passed to the backend when adding or updating connections',
			'Fixed row exports (JSON/SQL) to download as files instead of copying to clipboard',
			'Fixed schema sidebar and SQL console revalidation after DROP TABLE, ADD COLUMN, and SQL mutations',
			'Removed recording overlay feature',
			'AUR package switched to pre-built AppImage — yay -S dora now installs in seconds instead of compiling from source'
		]
	},
	{
		version: '0.0.105',
		date: '2026-04-17',
		commit: 'v0.0.105',
		title: 'Release Automation and AUR Publishing',
		description:
			'Adds source-built AUR publishing, improves release automation, and keeps the desktop packaging flow aligned across channels.',
		type: 'feature',
		details: [
			'Added source-built AUR publishing for Arch Linux',
			'Made the Winget release workflow tolerant of missing Windows checksums',
			'Aligned release metadata and install surfaces for the 0.0.105 package set'
		]
	},
	{
		version: '0.0.102',
		date: '2026-04-05',
		commit: 'v0.0.102',
		title: 'Snap Workflow Follow-up & Packaging Release Cleanup',
		description:
			'Fixes the Snap CI path and cuts a clean follow-up release tag that includes the packaging automation work already on branch head.',
		type: 'fix',
		details: [
			'Fixed Snapcraft CI execution to run correctly in destructive mode on GitHub Actions',
			'Replaced the invalid Tauri bundle flag with a direct Rust release build for Snap packaging',
			'Carries the packaging automation, release guide, and VM lab tooling into a clean release tag'
		]
	},
	{
		version: '0.0.101',
		date: '2026-04-05',
		commit: 'v0.0.101',
		title: 'Packaging Automation, VM Lab & Desktop Iteration',
		description:
			'Adds package-manager release helpers, Ubuntu-host VM workflows, refreshed release surfaces, and folds the current desktop/docs/test iteration into the 0.0.101 release.',
		type: 'feature',
		details: [
			'Added release checksum generation plus Winget, AUR, and Snap packaging helpers',
			'Added interactive release guide and Ubuntu-host VM lab tooling',
			'Updated changelog/release surfaces for the 0.0.101 release',
			'Carried forward the current desktop, docs, test, and workflow iteration work on this branch'
		]
	},
	{
		version: '0.1.0',
		date: '2026-04-04',
		commit: 'eff2c05',
		title: 'Project Foundation & Documentation Audit',
		description:
			'Milestone release establishing the 0.1.x baseline with comprehensive installation paths, updated audit snapshots, and visual showcase enhancements.',
		type: 'feature',
		details: [
			'Established 0.1.0 version baseline across monorepo',
			'Completed Homebrew installation documentation and README overhaul',
			'Verified all 115/115 tests passing for the new milestone'
		]
	},
	{
		version: '0.0.99',
		date: '2026-04-04',
		commit: '852360f',
		title: 'Homebrew Support & CI Security Hardening',
		description:
			'Launched the official Homebrew Tap for easy installation, and fortified the CI/CD pipeline with pinned action SHAs and build target optimizations.',
		type: 'feature',
		details: [
			'Added official Homebrew Tap at remcostoeten/homebrew-dora (brew install dora)',
			'Pinned GitHub Actions to specific commit SHAs for improved supply chain security',
			'Optimized esbuild target to esnext to resolve CI transform issues',
			'Stabilized Rust toolchain branch reference in CI workflows'
		]
	},
	{
		version: '0.0.98',
		date: '2026-04-04',
		commit: '7b490a0',
		title: 'Live Database Updates & Performance Refactor',
		description:
			'Introduced real-time database synchronization through a new backend live monitor manager, replacing legacy frontend polling for significant performance gains.',
		type: 'feature',
		details: [
			'Implemented backend-driven live database monitor manager',
			'Removed inefficient frontend polling logic to reduce CPU usage',
			'Added real-time data grid updates on external database changes',
			'Updated documentation with animated WEBP showcase demonstrating live performance',
			'Removed legacy bloat and optimized workspace checkpointing'
		]
	},
	{
		version: '0.0.97',
		date: '2026-02-20',
		commit: '48e798e',
		title: 'Type Safety Recovery, Feature-State Cleanup & Docker Enhancements',
		description:
			'Restored strict TypeScript health, aligned sidebar feature states with actual availability, and shipped Docker manager improvements including terminal support and UX polish',
		type: 'fix',
		details: [
			'Fixed desktop strict typecheck regressions across adapters, data provider hooks, Monaco integration, and UI utility imports',
			'Aligned sidebar navigation so Docker Manager is active while only unavailable items remain marked as coming soon',
			'Updated and expanded Docker manager components and supporting APIs',
			'Refreshed docs and feature matrix to match implemented behavior'
		]
	},
	{
		version: '0.0.96',
		date: '2026-02-19',
		commit: '92946de',
		title: 'UX Polish, Shortcuts & Cleanup',
		description:
			'Cleaned up debug logging, added new keyboard shortcuts for row deletion and toolbar focus, restored the multiple theme switcher, fixed changelog scrolling, and tied saved snippets to connections',
		type: 'feature',
		details: [
			'Removed verbose debug console.log statements from TauriAdapter',
			'Added Delete/Shift+Backspace shortcuts for deleting selected rows',
			'Added Alt+T shortcut for focusing the toolbar',
			'Added "d" key as alternative deselect shortcut',
			'Saved snippets now track their associated connection_id',
			'Restored multiple theme switcher with AppearancePanel in sidebar',
			'Fixed changelog popover scrolling inside the sidebar',
			'Removed obsolete .cursorrules and RELEASE_TRACKER.md files'
		]
	},
	{
		version: '0.0.95',
		date: '2026-02-09',
		commit: 'bb8c83a',
		title: 'Packaging Expansion & Changelog Stability',
		description:
			'Expanded installer formats, added Intel macOS packaging, and fixed the changelog popover crash/scroll behavior',
		type: 'feature',
		details: [
			'Added Linux RPM target to the Tauri bundle list',
			'Added Windows MSI target alongside NSIS EXE',
			'Added a dedicated Intel macOS release job (macos-13)',
			'Fixed changelog popover crash caused by invalid React child rendering',
			'Restored stable scrolling and navigation across older changelog entries',
			'Added unseen-changes indicator to the changelog trigger button'
		]
	},
	{
		version: '0.0.94',
		date: '2026-02-09',
		commit: '04f7d5e',
		title: 'CI, Test Stability & Cross-Platform Release Recovery',
		description:
			'Stabilized CI pipelines, repaired release workflows, and restored cross-platform artifacts for Linux/macOS/Windows',
		type: 'fix',
		details: [
			'Fixed CI Rust test failures caused by libsql threading behavior in tests',
			'Added PostgreSQL initdb PATH setup for pgtemp in CI',
			'Resolved rust/TypeScript compile and lint blockers in pipelines',
			'Updated release Linux dependencies for Tauri v2 (webkit 4.1/libsoup 3.0)',
			'Removed failing macOS signing env wiring for unsigned CI builds',
			'Fixed Windows release linking by provisioning sqlite via vcpkg and linker env paths',
			'Published release assets: .deb, .AppImage, .dmg, and .exe'
		]
	},
	{
		version: '0.0.93',
		date: '2026-02-06',
		commit: '86f4695',
		title: 'Typo Detection, Theme Toggle & Performance Enhancements',
		description:
			'Drizzle-aware typo diagnostics with fuzzy matching, light/dark theme toggle, SQL snippet saving, custom keyboard shortcuts, LSP utilities for Monaco Editor, improved error handling, and comprehensive performance optimizations',
		type: 'feature',
		details: [
			'Added Drizzle-aware typo detection with fuzzy matching suggestions',
			'Implemented LSP (Language Server Protocol) integration for enhanced editing',
			'Added light/dark theme toggle with persistence',
			'Introduced SQL snippet saving functionality',
			'Created custom keyboard shortcuts UI with persistent bindings',
			'Integrated Monaco Editor workers for offloaded processing',
			'Optimized IPC layer and bundle splitting',
			'Improved error handling with shadcn components instead of native dialogs',
			'Added query history tracking and display',
			'Implemented delete confirmation dialogs',
			'Performed comprehensive code cleanup and dependency audit',
			'Enhanced UI polish across all components'
		]
	},
	{
		version: '0.0.92',
		date: '2026-01-23',
		commit: '88a6727',
		title: 'Docker Manager & UI Overhaul',
		description:
			'Docker container manager MVP, window controls, auto-connect to first database, right-click drag scrolling, Vercel-style dark theme, and improved Structure panel',
		type: 'feature',
		details: [
			'Added Docker container management MVP',
			'Implemented window controls',
			'Added auto-connect feature for the first database',
			'Enabled right-click drag scrolling',
			'Applied Vercel-style dark theme',
			'Improved Structure panel'
		]
	},
	{
		version: '0.0.91',
		date: '2026-01-15',
		commit: '32c1b88',
		title: 'Application Sidebar & URL State',
		description:
			'New application sidebar with animated toggle, URL state management for selected rows/cells, theme synchronization, and enhanced context menu handling',
		type: 'feature'
	},
	{
		version: '0.0.9',
		date: '2026-01-15',
		commit: '30747e35',
		title: 'Undo/Redo & Editor Themes',
		description: 'Added undo/redo functionality, editor themes, DDL retrieval, and dry mode',
		type: 'feature'
	},
	{
		version: '0.0.8',
		date: '2026-01-14',
		commit: 'acb6dafc',
		title: 'Persistent Settings',
		description: 'User theme and setting persistence across sessions',
		type: 'feature'
	},
	{
		version: '0.0.7',
		date: '2026-01-10',
		commit: 'e7a1a3f5',
		title: 'Web Mock View',
		description: 'Implemented data provider pattern for web mock view',
		type: 'feature'
	},
	{
		version: '0.0.6',
		date: '2026-01-09',
		commit: '72598890',
		title: 'Rust Backend Rewrite',
		description: 'Complete backend rewrite in Rust with TypeScript bindings via Specta',
		type: 'breaking'
	},
	{
		version: '0.0.5',
		date: '2025-12-20',
		commit: 'a3ae93db',
		title: 'LibSQL Support',
		description: 'Added LibSQL database support for local and remote Turso connections',
		type: 'feature'
	},
	{
		version: '0.0.4',
		date: '2025-12-20',
		commit: 'cf8014c9',
		title: 'Monaco Editor',
		description: 'Integrated Monaco Editor with switchable SQL editor components',
		type: 'feature'
	},
	{
		version: '0.0.3',
		date: '2025-12-15',
		commit: 'ef157d81',
		title: 'Drizzle Studio UI',
		description: 'Complete UI redesign inspired by Drizzle Studio aesthetics',
		type: 'refactor'
	},
	{
		version: '0.0.2',
		date: '2025-12-15',
		commit: '810927cb',
		title: 'New Frontend Design',
		description: 'Introduced unified header, logo components, and keyboard shortcuts',
		type: 'feature'
	},
	{
		version: '0.0.1',
		date: '2025-12-10',
		commit: '97d10da5',
		title: 'Initial Fork',
		description: 'Forked from the original Drizzle Studio repository',
		type: 'feature'
	}
]
