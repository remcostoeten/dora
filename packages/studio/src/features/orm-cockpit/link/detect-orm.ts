/**
 * Project folder linking + ORM detection. Given a linked folder, work out
 * whether it's a Drizzle or Prisma project and locate the schema file(s) so the
 * parsers (plans 02/03) can turn them into a SchemaIR.
 *
 * Detection is a pure function over an injected {@link ProjectReader} so it can
 * be unit-tested with fixture folders; the Tauri-backed reader lives in
 * `link-api.ts`. Everything degrades gracefully — a missing/unreadable path
 * just yields fewer files, never a throw.
 *
 * Monorepos: the linked folder is scanned both at its top level and across its
 * workspace packages (`apps/*`, `packages/*`, plus anything declared in
 * `package.json` `workspaces` or `pnpm-workspace.yaml`), so a Drizzle/Prisma
 * project nested under e.g. `apps/api` is found when the repo root is linked.
 */

export type SchemaFile = { path: string; text: string }

export type DetectedOrm = 'drizzle' | 'prisma'

export type OrmLink = {
	orm: DetectedOrm
	schemaFiles: SchemaFile[]
	/** The drizzle.config.* path, when detection went through it. */
	configPath?: string
	/**
	 * The folder this link was detected in — the linked folder itself, or a
	 * workspace package under it (e.g. `<root>/apps/api`). Downstream uses it to
	 * resolve migration journals and to disambiguate `choice` options.
	 */
	rootDir: string
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
	'drizzle.config.cjs'
]

// Best-effort fallbacks when there's no config or its schema path doesn't resolve.
const DRIZZLE_FALLBACK_FILES = ['src/db/schema.ts', 'src/schema.ts', 'db/schema.ts']
const DRIZZLE_FALLBACK_DIRS = ['src/db/schema', 'db/schema', 'src/schema']

const PRISMA_FILES = ['prisma/schema.prisma', 'schema.prisma']
const PRISMA_SCHEMA_DIR = 'prisma/schema'

// Workspace package globs tried even without an explicit declaration — covers
// the common Turborepo/pnpm monorepo layout.
const DEFAULT_WORKSPACE_GLOBS = ['apps/*', 'packages/*']

// Never descend into these while walking `**` globs or resolving workspaces.
const IGNORE_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'.turbo',
	'.cache',
	'coverage',
	'out',
	'.svelte-kit',
	'.output',
	'.vercel'
])

// Depth guard for recursive `**` walks — feature trees are shallow; this just
// stops a symlink loop or a pathological tree from spinning.
const MAX_WALK_DEPTH = 12

export async function detectOrm(folder: string, reader: ProjectReader): Promise<DetectOrmResult> {
	const roots = [cleanDir(folder), ...(await workspaceRoots(folder, reader))]

	const perRoot = await Promise.all(
		roots.map(async function (root) {
			const [drizzle, prisma] = await Promise.all([
				detectDrizzle(root, reader),
				detectPrisma(root, reader)
			])
			return { root, drizzle, prisma }
		})
	)

	const links: OrmLink[] = []
	for (const { root, drizzle, prisma } of perRoot) {
		if (drizzle) {
			links.push({ ...drizzle, rootDir: root })
		}
		if (prisma) {
			links.push({ ...prisma, rootDir: root })
		}
	}

	if (links.length === 0) {
		return {
			kind: 'none',
			message:
				'No Drizzle or Prisma schema found in this folder (or its apps/* and packages/* workspaces). Expected a drizzle.config.* with a schema file, or a prisma/schema.prisma.'
		}
	}
	if (links.length === 1) {
		return { kind: 'linked', link: links[0] }
	}
	return { kind: 'choice', options: links }
}

/** Resolve workspace package directories under the linked folder (one level). */
async function workspaceRoots(folder: string, reader: ProjectReader): Promise<string[]> {
	const base = cleanDir(folder)
	const globs = await workspaceGlobs(base, reader)
	const dirs = new Set<string>()

	for (const glob of globs) {
		if (glob.includes('*')) {
			const prefix = glob.slice(0, glob.indexOf('*')).replace(/\/+$/, '')
			const entries = await reader.listDir(joinPath(base, prefix))
			for (const path of entries) {
				const name = basename(path)
				if (IGNORE_DIRS.has(name) || looksLikeFile(name)) {
					continue
				}
				dirs.add(cleanDir(path))
			}
		} else {
			dirs.add(cleanDir(joinPath(base, glob)))
		}
	}

	dirs.delete(base)
	return Array.from(dirs)
}

/** Collect workspace globs from package.json / pnpm-workspace.yaml plus defaults. */
async function workspaceGlobs(folder: string, reader: ProjectReader): Promise<string[]> {
	const globs = new Set<string>(DEFAULT_WORKSPACE_GLOBS)

	const pkgText = await reader.readFile(joinPath(folder, 'package.json'))
	if (pkgText !== null) {
		for (const glob of readPackageWorkspaces(pkgText)) {
			globs.add(glob)
		}
	}

	const pnpmText = await reader.readFile(joinPath(folder, 'pnpm-workspace.yaml'))
	if (pnpmText !== null) {
		for (const glob of readPnpmWorkspaces(pnpmText)) {
			globs.add(glob)
		}
	}

	return Array.from(globs)
}

function readPackageWorkspaces(pkgText: string): string[] {
	try {
		const pkg = JSON.parse(pkgText) as { workspaces?: unknown }
		const ws = pkg.workspaces
		const list = Array.isArray(ws)
			? ws
			: ws && typeof ws === 'object' && Array.isArray((ws as { packages?: unknown }).packages)
				? (ws as { packages: unknown[] }).packages
				: []
		return list.filter(function (g): g is string {
			return typeof g === 'string'
		})
	} catch {
		return []
	}
}

function readPnpmWorkspaces(yamlText: string): string[] {
	const globs: string[] = []
	let inPackages = false
	for (const rawLine of yamlText.split('\n')) {
		const line = rawLine.replace(/#.*$/, '')
		if (/^packages\s*:/.test(line)) {
			inPackages = true
			continue
		}
		if (inPackages) {
			const item = line.match(/^\s*-\s*["']?([^"'\s]+)["']?\s*$/)
			if (item) {
				globs.push(item[1])
				continue
			}
			// A non-list, non-indented line ends the `packages:` block.
			if (line.trim() !== '' && !/^\s/.test(line)) {
				inPackages = false
			}
		}
	}
	return globs
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
			collected.addAll(await collectFiles(folder, entry, reader, '.ts'))
		}
	}

	if (collected.isEmpty()) {
		for (const rel of DRIZZLE_FALLBACK_FILES) {
			collected.addAll(await collectFiles(folder, rel, reader, '.ts'))
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
	return {
		orm: 'drizzle',
		schemaFiles: collected.values(),
		configPath,
		rootDir: cleanDir(folder)
	}
}

async function detectPrisma(folder: string, reader: ProjectReader): Promise<OrmLink | null> {
	const collected = new FileSet()

	for (const rel of PRISMA_FILES) {
		collected.addAll(await collectFiles(folder, rel, reader, '.prisma'))
	}

	const pkgText = await reader.readFile(joinPath(folder, 'package.json'))
	if (pkgText !== null) {
		const schemaField = readPrismaSchemaField(pkgText)
		if (schemaField !== null) {
			collected.addAll(await collectFiles(folder, schemaField, reader, '.prisma'))
		}
	}

	// Newer Prisma supports a multi-file `prisma/schema/` directory.
	collected.addAll(await readFilesInDir(joinPath(folder, PRISMA_SCHEMA_DIR), reader, '.prisma'))

	if (collected.isEmpty()) {
		return null
	}
	return { orm: 'prisma', schemaFiles: collected.values(), rootDir: cleanDir(folder) }
}

/**
 * Resolve a single schema entry (file path, glob, or directory) into files.
 * Globs are matched against the trailing filename pattern; a `**` segment walks
 * subdirectories recursively. A plain path is tried as a file first, then as a
 * (shallow) directory of schema files.
 */
async function collectFiles(
	folder: string,
	entry: string,
	reader: ProjectReader,
	ext: string
): Promise<SchemaFile[]> {
	const glob = parseGlob(entry)
	if (glob) {
		return walkGlob(joinPath(folder, glob.baseRel), glob.fileRe, ext, reader, glob.recursive, 0)
	}

	const abs = joinPath(folder, entry)
	const text = await reader.readFile(abs)
	if (text !== null) {
		return [{ path: abs, text }]
	}
	// Not a file — it may be a directory of schema files.
	return readFilesInDir(abs, reader, ext)
}

type ParsedGlob = { baseRel: string; recursive: boolean; fileRe: RegExp }

/**
 * Split a glob entry into its literal base directory, whether it spans
 * subdirectories (`**`), and a matcher for the trailing filename pattern.
 * Returns null when the entry has no glob character.
 */
function parseGlob(entry: string): ParsedGlob | null {
	const norm = entry.replace(/^\.\//, '')
	if (!norm.includes('*')) {
		return null
	}
	const segments = norm.split('/')
	const base: string[] = []
	let i = 0
	for (; i < segments.length; i++) {
		if (segments[i].includes('*')) {
			break
		}
		base.push(segments[i])
	}
	const rest = segments.slice(i)
	const recursive = rest.includes('**')
	const filePattern = rest[rest.length - 1]
	return { baseRel: base.join('/'), recursive, fileRe: globToRegExp(filePattern) }
}

/** Compile a single-segment glob (`*.schema.ts`) into an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
	return new RegExp(`^${escaped}$`)
}

/** Walk a directory matching `fileRe`, descending into subdirs when recursive. */
async function walkGlob(
	dir: string,
	fileRe: RegExp,
	ext: string,
	reader: ProjectReader,
	recursive: boolean,
	depth: number
): Promise<SchemaFile[]> {
	if (depth > MAX_WALK_DEPTH) {
		return []
	}
	const entries = await reader.listDir(dir)
	const files: SchemaFile[] = []
	for (const path of entries) {
		const name = basename(path)
		if (name.toLowerCase().endsWith(ext) && fileRe.test(name)) {
			const text = await reader.readFile(path)
			if (text !== null) {
				files.push({ path, text })
			}
			continue
		}
		if (!recursive || IGNORE_DIRS.has(name) || looksLikeFile(name)) {
			continue
		}
		files.push(...(await walkGlob(path, fileRe, ext, reader, recursive, depth + 1)))
	}
	return files
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

function cleanDir(path: string): string {
	return path.replace(/\/+$/, '')
}

function basename(path: string): string {
	const i = path.lastIndexOf('/')
	return i >= 0 ? path.slice(i + 1) : path
}

/** Heuristic: an entry with a trailing `.ext` is a file, not a directory. */
function looksLikeFile(name: string): boolean {
	return /\.[^./\\]+$/.test(name)
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
