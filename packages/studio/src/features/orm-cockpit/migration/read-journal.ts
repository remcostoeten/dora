/**
 * Read a Drizzle migrations *journal* (`<out>/meta/_journal.json`) into a small
 * ordered list of entries. This is the file `drizzle-kit generate` writes; each
 * entry's `tag` matches a sibling `<tag>.sql` migration file and its `when`
 * timestamp is what Drizzle's own migrator uses to decide what to apply.
 *
 * Unlike the schema parsers (which feed the drift diff), this powers the
 * *migration status* view: "which migrations exist in the repo, and which has
 * the live DB applied?". Pure over an injected {@link ProjectReader} so it can
 * be unit-tested with fixture folders; the Tauri-backed wrapper lives in
 * `link-api.ts`. Everything degrades gracefully — a missing/garbled journal
 * yields an empty list, never a throw.
 */

import type { ProjectReader } from '@studio/features/orm-cockpit/link/detect-orm'

export type JournalEntry = {
	/** Position in the journal (0-based), preserved as the apply order. */
	idx: number
	/** Migration tag — matches the `<tag>.sql` filename, e.g. `0000_init`. */
	tag: string
	/** Epoch milliseconds Drizzle stamped the migration with (`when`). */
	when: number
}

/** Default Drizzle output directory when `drizzle.config` doesn't set `out`. */
const DEFAULT_OUT_DIR = 'drizzle'

/**
 * Parse the raw `_journal.json` text into ordered {@link JournalEntry} records.
 * Sorted by `idx` so the apply order is stable regardless of file ordering.
 */
export function parseJournal(text: string): JournalEntry[] {
	let json: unknown
	try {
		json = JSON.parse(text)
	} catch {
		return []
	}
	if (!json || typeof json !== 'object') {
		return []
	}
	const entries = (json as { entries?: unknown }).entries
	if (!Array.isArray(entries)) {
		return []
	}

	const out: JournalEntry[] = []
	for (const raw of entries) {
		if (!raw || typeof raw !== 'object') {
			continue
		}
		const e = raw as { idx?: unknown; tag?: unknown; when?: unknown }
		const idx = typeof e.idx === 'number' ? e.idx : null
		const tag = typeof e.tag === 'string' ? e.tag : null
		const when = typeof e.when === 'number' ? e.when : null
		if (idx === null || tag === null || when === null) {
			continue
		}
		out.push({ idx, tag, when })
	}
	return out.sort(function (a, b) {
		return a.idx - b.idx
	})
}

/**
 * Best-effort extraction of the Drizzle `out:` directory from a config file's
 * text (e.g. `out: './drizzle'`). Falls back to {@link DEFAULT_OUT_DIR}. A
 * computed/dynamic value won't match and degrades to the default.
 */
export function extractOutDir(configText: string | null): string {
	if (configText === null) {
		return DEFAULT_OUT_DIR
	}
	const match = configText.match(/out\s*:\s*["'`]([^"'`]+)["'`]/)
	if (!match) {
		return DEFAULT_OUT_DIR
	}
	return match[1].replace(/^\.\//, '').replace(/\/+$/, '') || DEFAULT_OUT_DIR
}

/**
 * Locate and read the journal under a linked folder. `configText` (the
 * drizzle.config contents, when available) is used to honor a custom `out`
 * directory; otherwise the default `drizzle/` is tried.
 *
 * Returns the parsed entries plus the journal path actually read (null when no
 * journal was found — the project has no generated migrations).
 */
export async function readJournalWithReader(
	folder: string,
	configText: string | null,
	reader: ProjectReader,
): Promise<{ entries: JournalEntry[]; journalPath: string | null }> {
	const outDir = extractOutDir(configText)
	const journalPath = joinPath(folder, `${outDir}/meta/_journal.json`)
	const text = await reader.readFile(journalPath)
	if (text === null) {
		return { entries: [], journalPath: null }
	}
	return { entries: parseJournal(text), journalPath }
}

function joinPath(base: string, rel: string): string {
	const cleanBase = base.replace(/\/+$/, '')
	const cleanRel = rel.replace(/^\.\//, '').replace(/^\/+/, '')
	return `${cleanBase}/${cleanRel}`
}
