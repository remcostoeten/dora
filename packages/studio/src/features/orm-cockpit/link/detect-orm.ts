/**
 * Project folder linking + ORM detection. Given a linked folder, work out
 * whether it's a Drizzle or Prisma project and locate the schema file(s) so the
 * parsers (plans 02/03) can turn them into a SchemaIR.
 *
 * Detection is a pure function over an injected {@link ProjectReader} so it can
 * be unit-tested with fixture folders; the Tauri-backed reader lives in
 * `link-api.ts`. Everything degrades gracefully — a missing/unreadable path
 * just yields fewer files, never a throw.
 */

export type SchemaFile = { path: string; text: string }

export type DetectedOrm = 'drizzle' | 'prisma'

export type OrmLink = {
	orm: DetectedOrm
	schemaFiles: SchemaFile[]
	/** The drizzle.config.* path, when detection went through it. */
	configPath?: string
}

export type DetectOrmResult =
	| { kind: 'linked'; link: OrmLink }
	| { kind: 'choice'; options: OrmLink[] }
	| { kind: 'none'; message: string }

/**
 * Reads the linked project. `readFile` returns null when the path is missing or
 * unreadable; `listDir` returns absolute entry paths (shallow) or [].
 */
export type ProjectReader = {
	readFile(path: string): Promise<string | null>
	listDir(path: string): Promise<string[]>
}

const DRIZZLE_CONFIG_NAMES = [
	'drizzle.config.ts',
	'drizzle.config.js',
	'drizzle.config.mjs',
	'drizzle.config.cjs',
]

// Best-effort fallbacks when there's no config or its schema path doesn't resolve.
const DRIZZLE_FALLBACK_FILES = ['src/db/schema.ts', 'src/schema.ts', 'db/schema.ts']
const DRIZZLE_FALLBACK_DIRS = ['src/db/schema', 'db/schema', 'src/schema']

const PRISMA_FILES = ['prisma/schema.prisma', 'schema.prisma']
const PRISMA_SCHEMA_DIR = 'prisma/schema'

export async function detectOrm(folder: string, reader: ProjectReader): Promise<DetectOrmResult> {
	const [drizzle, prisma] = await Promise.all([
		detectDrizzle(folder, reader),
		detectPrisma(folder, reader),
	])

	if (drizzle && prisma) {
		return { kind: 'choice', options: [drizzle, prisma] }
	}
	if (drizzle) {
		return { kind: 'linked', link: drizzle }
	}
	if (prisma) {
		return { kind: 'linked', link: prisma }
	}
	return {
		kind: 'none',
		message:
			'No Drizzle or Prisma schema found in this folder. Expected a drizzle.config.* with a schema file, or a prisma/schema.prisma.',
	}
}

async function detectDrizzle(folder: string, reader: ProjectReader): Promise<OrmLink | null> {
	let configPath: string | undefined
	let configText: string | null = null
	for (const name of DRIZZLE_CONFIG_NAMES) {
		const candidate = joinPath(folder, name)
		const text = await reader.readFile(candidate)
		if (text !== null) {
			configPath = candidate
			configText = text
			break
		}
	}

	const collected = new FileSet()

	if (configText !== null) {
		for (const entry of extractDrizzleSchemaEntries(configText)) {
			collected.addAll(await readSchemaPath(folder, entry, reader, '.ts'))
		}
	}

	if (collected.isEmpty()) {
		for (const rel of DRIZZLE_FALLBACK_FILES) {
			collected.addAll(await readSchemaPath(folder, rel, reader, '.ts'))
		}
		for (const dir of DRIZZLE_FALLBACK_DIRS) {
			collected.addAll(await readFilesInDir(joinPath(folder, dir), reader, '.ts'))
		}
	}

	// A config alone is enough to call it Drizzle (UI can ask for the file);
	// otherwise we need at least one schema file.
	if (configPath === undefined && collected.isEmpty()) {
		return null
	}
	return { orm: 'drizzle', schemaFiles: collected.values(), configPath }
}

async function detectPrisma(folder: string, reader: ProjectReader): Promise<OrmLink | null> {
	const collected = new FileSet()

	for (const rel of PRISMA_FILES) {
		collected.addAll(await readSchemaPath(folder, rel, reader, '.prisma'))
	}

	const pkgText = await reader.readFile(joinPath(folder, 'package.json'))
	if (pkgText !== null) {
		const schemaField = readPrismaSchemaField(pkgText)
		if (schemaField !== null) {
			collected.addAll(await readSchemaPath(folder, schemaField, reader, '.prisma'))
		}
	}

	// Newer Prisma supports a multi-file `prisma/schema/` directory.
	collected.addAll(await readFilesInDir(joinPath(folder, PRISMA_SCHEMA_DIR), reader, '.prisma'))

	if (collected.isEmpty()) {
		return null
	}
	return { orm: 'prisma', schemaFiles: collected.values() }
}

/**
 * Resolve a single schema entry (file path, glob, or directory) into files. A
 * `*` glob reads the matching extension in its directory; a plain path is tried
 * as a file first, then as a directory.
 */
async function readSchemaPath(
	folder: string,
	entry: string,
	reader: ProjectReader,
	ext: string
): Promise<SchemaFile[]> {
	if (entry.includes('*')) {
		return readFilesInDir(joinPath(folder, globDir(entry)), reader, ext)
	}

	const abs = joinPath(folder, entry)
	const text = await reader.readFile(abs)
	if (text !== null) {
		return [{ path: abs, text }]
	}
	// Not a file — it may be a directory of schema files.
	return readFilesInDir(abs, reader, ext)
}

async function readFilesInDir(
	dir: string,
	reader: ProjectReader,
	ext: string
): Promise<SchemaFile[]> {
	const entries = await reader.listDir(dir)
	const files: SchemaFile[] = []
	for (const path of entries) {
		if (!path.toLowerCase().endsWith(ext)) {
			continue
		}
		const text = await reader.readFile(path)
		if (text !== null) {
			files.push({ path, text })
		}
	}
	return files
}

function extractDrizzleSchemaEntries(configText: string): string[] {
	// Best-effort static read of `schema: '...'` or `schema: ['...', '...']`.
	// A computed/dynamic value won't match — callers fall back to common paths.
	const match = configText.match(/schema\s*:\s*(\[[^\]]*\]|["'`][^"'`]+["'`])/)
	if (!match) {
		return []
	}
	const raw = match[1]
	if (raw.startsWith('[')) {
		return Array.from(raw.matchAll(/["'`]([^"'`]+)["'`]/g)).map(function (m) {
			return m[1]
		})
	}
	return [raw.slice(1, -1)]
}

function readPrismaSchemaField(pkgText: string): string | null {
	try {
		const pkg = JSON.parse(pkgText) as { prisma?: { schema?: unknown } }
		const schema = pkg.prisma?.schema
		return typeof schema === 'string' ? schema : null
	} catch {
		return null
	}
}

function joinPath(base: string, rel: string): string {
	const cleanBase = base.replace(/\/+$/, '')
	const cleanRel = rel.replace(/^\.\//, '').replace(/^\/+/, '')
	return `${cleanBase}/${cleanRel}`
}

function globDir(entry: string): string {
	const star = entry.indexOf('*')
	const prefix = entry.slice(0, star)
	const slash = prefix.lastIndexOf('/')
	return slash >= 0 ? prefix.slice(0, slash) : '.'
}

/** De-duplicating ordered set of schema files keyed by path. */
class FileSet {
	private readonly seen = new Set<string>()
	private readonly files: SchemaFile[] = []

	addAll(items: SchemaFile[]): void {
		for (const item of items) {
			if (!this.seen.has(item.path)) {
				this.seen.add(item.path)
				this.files.push(item)
			}
		}
	}

	isEmpty(): boolean {
		return this.files.length === 0
	}

	values(): SchemaFile[] {
		return this.files
	}
}
