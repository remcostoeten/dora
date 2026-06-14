import { extensionOf } from './data-files'

export type DataFileEntry = {
	path: string
	fileType: string
	viewName: string
}

function basename(path: string): string {
	return path.split(/[\\/]/).pop() ?? path
}

function stemOf(path: string): string {
	const name = basename(path)
	const lower = name.toLowerCase()
	if (lower.endsWith('.sqlite2.db')) return name.slice(0, -'.sqlite2.db'.length)
	const dot = name.lastIndexOf('.')
	return dot > 0 ? name.slice(0, dot) : name
}

/** Mirrors Rust `view_name_for` in `file_source.rs`. */
export function viewNameForPath(path: string, taken: Set<string> = new Set()): string {
	let sanitized = stemOf(path)
		.split('')
		.map(function (char) {
			return /[a-zA-Z0-9]/.test(char) ? char : '_'
		})
		.join('')

	if (sanitized.length === 0 || /^\d/.test(sanitized)) {
		sanitized = `t_${sanitized}`
	}

	const base = sanitized.toLowerCase()
	if (!taken.has(base)) {
		return base
	}

	let suffix = 2
	while (true) {
		const candidate = `${base}_${suffix}`
		if (!taken.has(candidate)) {
			return candidate
		}
		suffix += 1
	}
}

const FILE_TYPE_LABELS: Record<string, string> = {
	csv: 'CSV',
	tsv: 'TSV',
	txt: 'Text',
	parquet: 'Parquet',
	pq: 'Parquet',
	json: 'JSON',
	ndjson: 'NDJSON',
	jsonl: 'JSON Lines',
}

export function formatDataFileType(path: string): string {
	const ext = extensionOf(path)
	return FILE_TYPE_LABELS[ext] ?? ext.toUpperCase()
}

export function listDataFileEntries(paths: string[]): DataFileEntry[] {
	const taken = new Set<string>()

	return paths.map(function (path) {
		const viewName = viewNameForPath(path, taken)
		taken.add(viewName)
		return {
			path,
			fileType: formatDataFileType(path),
			viewName,
		}
	})
}
