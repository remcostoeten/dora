export type ChangelogEntry = {
	version: string
	date: string
	commit: string
	title: string
	description: string
	type: 'feature' | 'fix' | 'refactor' | 'breaking'
}

export const CURRENT_VERSION = '0.0.91'

export const CHANGELOG: ChangelogEntry[] = [
	{
		version: '0.0.91',
		date: '2026-01-15',
		commit: 'HEAD',
		title: 'Rolldown Migration',
		description: 'Migrated build system to Rolldown for improved performance',
		type: 'refactor'
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
