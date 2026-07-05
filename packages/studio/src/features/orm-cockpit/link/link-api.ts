import { commands } from '@studio/lib/bindings'
import {
	detectOrm,
	type DetectedOrm,
	type DetectOrmResult,
	type ProjectReader,
} from '@studio/features/orm-cockpit/link/detect-orm'
import {
	readJournalWithReader,
	type JournalEntry,
} from '@studio/features/orm-cockpit/migration/read-journal'
import {
	resolveProjectTarget,
	type DbTarget,
} from '@studio/features/orm-cockpit/link/connection-target'
import {
	isWebDemo,
	demoDrizzleLink,
	DEMO_PROJECT_FOLDER,
} from '@studio/features/orm-cockpit/link/demo-project'

/**
 * Tauri-backed wrappers over the `pick_folder` / `read_project_file` /
 * `list_dir` commands, plus a convenience that picks a folder and detects its
 * ORM in one call. The pure detection lives in `detect-orm.ts`.
 */

/** Open the folder picker. Returns null if the user cancels. */
export async function pickProjectFolder(): Promise<string | null> {
	if (isWebDemo()) {
		return DEMO_PROJECT_FOLDER
	}
	try {
		const result = await commands.pickFolder()
		return result.status === 'ok' ? result.data : null
	} catch {
		return null
	}
}

/** A {@link ProjectReader} backed by the Rust fs commands. */
export function createTauriProjectReader(): ProjectReader {
	return {
		async readFile(path: string): Promise<string | null> {
			try {
				const result = await commands.readProjectFile(path)
				return result.status === 'ok' ? result.data : null
			} catch {
				return null
			}
		},
		async listDir(path: string): Promise<string[]> {
			try {
				const result = await commands.listDir(path)
				return result.status === 'ok' ? result.data : []
			} catch {
				return []
			}
		},
	}
}

/** Detect the ORM in an already-chosen folder using the live fs. */
export async function detectProjectOrm(folder: string): Promise<DetectOrmResult> {
	if (isWebDemo()) {
		return { kind: 'linked', link: demoDrizzleLink() }
	}
	return detectOrm(folder, createTauriProjectReader())
}

/**
 * Read the Drizzle migration journal under a linked folder, honoring a custom
 * `out` dir from the given drizzle.config path when available.
 *
 * Drizzle resolves `out` relative to the config file's own directory, so in a
 * monorepo (config at `<root>/apps/api/drizzle.config.ts`, `out: './drizzle'`)
 * the journal lives under `apps/api/drizzle` — not the linked repo root. We base
 * the lookup on the config's directory whenever a config path is known.
 */
export async function readDrizzleJournal(
	folder: string,
	configPath?: string,
): Promise<{ entries: JournalEntry[]; journalPath: string | null }> {
	const reader = createTauriProjectReader()
	const configText = configPath ? await reader.readFile(configPath) : null
	const base = configPath ? dirname(configPath) : folder
	return readJournalWithReader(base, configText, reader)
}

function dirname(path: string): string {
	const normalized = path.replace(/\/+$/, '')
	const i = normalized.lastIndexOf('/')
	return i > 0 ? normalized.slice(0, i) : normalized
}

/**
 * Resolve which database a linked project points at (from its config `url` /
 * `.env*`), so the cockpit can warn when it differs from the connection being
 * diffed against. Resolution is rooted at the config's directory in a monorepo.
 */
export async function resolveProjectDatabaseTarget(
	rootDir: string,
	configPath: string | undefined,
	orm: DetectedOrm,
	schemaTexts: string[] = [],
): Promise<DbTarget | null> {
	const reader = createTauriProjectReader()
	const base = configPath ? dirname(configPath) : rootDir
	const configText = configPath ? await reader.readFile(configPath) : null
	// Drizzle keeps the url in its config; Prisma keeps it in the schema's
	// `datasource` block — fall back to the schema text when there's no config.
	const text = configText ?? schemaTexts.join('\n\n')
	return resolveProjectTarget(base, text, orm, reader)
}

/**
 * Full flow for the cockpit: pick a folder, then detect. Returns null only when
 * the user cancels the picker.
 */
export async function linkProject(): Promise<{ folder: string; result: DetectOrmResult } | null> {
	const folder = await pickProjectFolder()
	if (folder === null) {
		return null
	}
	return { folder, result: await detectProjectOrm(folder) }
}
