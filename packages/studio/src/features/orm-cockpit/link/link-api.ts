import { commands } from '@studio/lib/bindings'
import {
	detectOrm,
	type DetectOrmResult,
	type ProjectReader,
} from '@studio/features/orm-cockpit/link/detect-orm'

/**
 * Tauri-backed wrappers over the `pick_folder` / `read_project_file` /
 * `list_dir` commands, plus a convenience that picks a folder and detects its
 * ORM in one call. The pure detection lives in `detect-orm.ts`.
 */

/** Open the folder picker. Returns null if the user cancels. */
export async function pickProjectFolder(): Promise<string | null> {
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
	return detectOrm(folder, createTauriProjectReader())
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
