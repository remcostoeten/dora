/**
 * Shared helpers for the project-local agent skill infrastructure.
 *
 * Canonical source of truth: `.agent-skills/<skill-name>/SKILL.md`.
 *
 * Claude Code and Codex cannot read one shared directory (verified in
 * `.agent-skills/FINDINGS.md` section 7: Claude Code reads only
 * `.claude/skills/`, Codex reads `.codex/skills/` and `.agents/skills/`, and
 * neither reads the other's root). Symlinks are not an option because Dora
 * ships on Windows. So the canonical tree is copied byte-for-byte into both
 * agent roots by `skills:sync` and verified by `skills:check`.
 *
 * Only directories starting with `MANAGED_PREFIX` are owned by this repo. Both
 * agent roots may also contain locally installed third-party skills, which are
 * gitignored and must never be rewritten or pruned by these scripts.
 */

import fs from 'fs'
import path from 'path'

export const CANONICAL_DIR = '.agent-skills'

/** Skill directories this repo owns. Anything else in an agent root is left alone. */
export const MANAGED_PREFIX = 'dora-'

export const SKILL_FILE = 'SKILL.md'

export type SkillTarget = {
	agent: string
	dir: string
}

/**
 * Generated copy locations, one per agent. Both were verified to load a
 * project-local skill in `.agent-skills/FINDINGS.md` section 7.
 */
export const TARGETS: SkillTarget[] = [
	{ agent: 'Claude Code', dir: path.join('.claude', 'skills') },
	{ agent: 'Codex', dir: path.join('.codex', 'skills') }
]

/** Repo root, derived from this file's location (tools/scripts/_shared). */
export function repoRoot(): string {
	return path.resolve(import.meta.dir, '..', '..', '..')
}

export function canonicalRoot(): string {
	return path.join(repoRoot(), CANONICAL_DIR)
}

/** Every canonical skill name, sorted. A skill is a directory holding a SKILL.md. */
export function listCanonicalSkills(): string[] {
	const root = canonicalRoot()
	if (!fs.existsSync(root)) {
		return []
	}

	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter(function (entry) {
			return entry.isDirectory() && fs.existsSync(path.join(root, entry.name, SKILL_FILE))
		})
		.map(function (entry) {
			return entry.name
		})
		.sort()
}

/** Managed skill directories currently present in a target root, sorted. */
export function listManagedSkillsIn(targetDir: string): string[] {
	const root = path.join(repoRoot(), targetDir)
	if (!fs.existsSync(root)) {
		return []
	}

	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter(function (entry) {
			return entry.isDirectory() && entry.name.startsWith(MANAGED_PREFIX)
		})
		.map(function (entry) {
			return entry.name
		})
		.sort()
}

/** Relative paths of every file inside a skill directory, sorted. */
export function listSkillFiles(skillDir: string): string[] {
	const files: string[] = []

	function walk(dir: string, prefix: string): void {
		const entries = fs.readdirSync(dir, { withFileTypes: true })
		for (const entry of entries) {
			const relative = prefix ? path.join(prefix, entry.name) : entry.name
			if (entry.isDirectory()) {
				walk(path.join(dir, entry.name), relative)
				continue
			}
			files.push(relative)
		}
	}

	if (fs.existsSync(skillDir)) {
		walk(skillDir, '')
	}

	return files.sort()
}

export function readIfExists(file: string): Buffer | null {
	return fs.existsSync(file) ? fs.readFileSync(file) : null
}

/**
 * Canonical skills whose directory name is missing `MANAGED_PREFIX`. Their
 * generated copies would land in the agent roots but stay gitignored, so they
 * would work locally and silently vanish for everyone else.
 */
export function unmanagedCanonicalSkills(): string[] {
	return listCanonicalSkills().filter(function (name) {
		return !name.startsWith(MANAGED_PREFIX)
	})
}

// ---------------------------------------------------------------------------
// Reference extraction
//
// Both extractors read only backtick-quoted spans and fenced shell blocks,
// because that is how every tracked doc in this repo writes paths and commands.
// ---------------------------------------------------------------------------

const SHELL_FENCE_LANGUAGES = new Set(['bash', 'sh', 'shell', 'console', 'zsh'])

/** Runners that mean "this is a project command" rather than generic shell. */
const PROJECT_RUNNERS = new Set([
	'bun',
	'bunx',
	'turbo',
	'cargo',
	'npm',
	'npx',
	'pnpm',
	'yarn',
	'node',
	'docker'
])

const GLOB_CHARACTERS = ['*', '?', '[', '{', '<', '(']

export function normalizeCommand(command: string): string {
	return command.trim().replace(/\s+/g, ' ')
}

/** Backtick-quoted spans in a markdown document. */
function backtickSpans(markdown: string): string[] {
	const spans: string[] = []
	const pattern = /`([^`\n]+)`/g
	let match = pattern.exec(markdown)

	while (match !== null) {
		spans.push(match[1])
		match = pattern.exec(markdown)
	}

	return spans
}

/**
 * True when a backticked span looks like a repository path rather than an
 * identifier, an import specifier, a URL, or a command.
 */
function looksLikeRepoPath(span: string): boolean {
	if (!span.includes('/')) return false
	if (/\s/.test(span)) return false
	if (span.startsWith('@')) return false
	if (span.startsWith('-')) return false
	if (span.startsWith('/')) return false
	if (span.startsWith('~')) return false
	if (span.includes('://')) return false
	if (span.includes('::')) return false
	if (span.endsWith('()')) return false
	return true
}

/**
 * Reduce a referenced path to the longest concrete prefix that must exist.
 * `apps/*​/src` becomes `apps`; `packages/studio/src/core/` stays as-is. Returns
 * null when nothing concrete is left to check.
 */
export function concretePrefix(reference: string): string | null {
	const cleaned = reference.replace(/[.,;:]+$/, '').replace(/\/+$/, '')
	const segments = cleaned.split('/')
	const concrete: string[] = []

	for (const segment of segments) {
		const isPattern = GLOB_CHARACTERS.some(function (character) {
			return segment.includes(character)
		})
		if (isPattern) break
		concrete.push(segment)
	}

	if (concrete.length === 0) return null
	// A bare filename with no separator left is not a path reference.
	if (concrete.length === 1 && !cleaned.startsWith(concrete[0] + '/')) return null

	return concrete.join('/')
}

/** Every repository path referenced by a markdown document. */
export function extractPathReferences(markdown: string): string[] {
	const references = new Set<string>()

	for (const span of backtickSpans(markdown)) {
		if (!looksLikeRepoPath(span)) continue
		const prefix = concretePrefix(span)
		if (prefix) {
			references.add(prefix)
		}
	}

	return [...references].sort()
}

/** Every project command referenced by a markdown document's shell fences. */
export function extractCommandReferences(markdown: string): string[] {
	const commands = new Set<string>()
	const lines = markdown.split('\n')

	let insideShellFence = false
	let insideAnyFence = false
	let pending = ''

	for (const rawLine of lines) {
		const fence = rawLine.match(/^\s*```+\s*([A-Za-z0-9_-]*)/)
		if (fence) {
			if (insideAnyFence) {
				insideAnyFence = false
				insideShellFence = false
			} else {
				insideAnyFence = true
				insideShellFence = SHELL_FENCE_LANGUAGES.has(fence[1].toLowerCase())
			}
			continue
		}

		if (!insideShellFence) continue

		let line = rawLine.trim()
		if (!line || line.startsWith('#')) continue
		line = line.replace(/^\$\s+/, '')

		// Join shell line continuations before splitting.
		if (line.endsWith('\\')) {
			pending += line.slice(0, -1) + ' '
			continue
		}
		line = pending + line
		pending = ''

		for (const segment of line.split(/&&|\|\||;/)) {
			const normalized = normalizeCommand(segment)
			if (!normalized) continue
			const runner = normalized.split(' ')[0]
			if (!PROJECT_RUNNERS.has(runner)) continue
			commands.add(normalized)
		}
	}

	return [...commands].sort()
}

// ---------------------------------------------------------------------------
// Known-command index
// ---------------------------------------------------------------------------

function readJson(file: string): Record<string, unknown> | null {
	if (!fs.existsSync(file)) return null
	try {
		return JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch {
		return null
	}
}

function workspacePackageJsonPaths(): { dir: string; file: string }[] {
	const root = repoRoot()
	const found: { dir: string; file: string }[] = [
		{ dir: '', file: path.join(root, 'package.json') }
	]

	for (const group of ['apps', 'packages']) {
		const groupDir = path.join(root, group)
		if (!fs.existsSync(groupDir)) continue

		for (const entry of fs.readdirSync(groupDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue
			const file = path.join(groupDir, entry.name, 'package.json')
			if (fs.existsSync(file)) {
				found.push({ dir: `${group}/${entry.name}`, file })
			}
		}
	}

	return found
}

/** Every `run:` line in every workflow, including block scalars. */
function workflowRunLines(): string[] {
	const workflowDir = path.join(repoRoot(), '.github', 'workflows')
	if (!fs.existsSync(workflowDir)) return []

	const lines: string[] = []

	for (const name of fs.readdirSync(workflowDir)) {
		if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue
		const content = fs.readFileSync(path.join(workflowDir, name), 'utf8').split('\n')

		for (let index = 0; index < content.length; index++) {
			const match = content[index].match(/^(\s*)-?\s*run:\s*(\|-?|>-?)?\s*(.*)$/)
			if (!match) continue

			const indent = match[1].length
			const inlineValue = match[3]

			if (inlineValue) {
				lines.push(inlineValue)
				continue
			}

			for (let cursor = index + 1; cursor < content.length; cursor++) {
				const blockLine = content[cursor]
				if (!blockLine.trim()) continue
				const blockIndent = blockLine.length - blockLine.trimStart().length
				if (blockIndent <= indent) break
				lines.push(blockLine.trim())
			}
		}
	}

	return lines
}

/**
 * Every command form the repo actually defines, normalized. Built from
 * package.json scripts (root and every workspace), turbo.json tasks, and
 * workflow `run:` lines — the three sources a SKILL.md may cite.
 */
export function buildKnownCommands(): Set<string> {
	const known = new Set<string>()

	function add(command: string): void {
		const normalized = normalizeCommand(command)
		if (normalized) {
			known.add(normalized)
		}
	}

	function addScriptBody(body: string): void {
		add(body)
		for (const segment of body.split(/&&|\|\||;/)) {
			add(segment)
		}
	}

	for (const workspace of workspacePackageJsonPaths()) {
		const manifest = readJson(workspace.file)
		const scripts = (manifest?.scripts ?? {}) as Record<string, string>

		for (const [name, body] of Object.entries(scripts)) {
			add(`bun run ${name}`)
			add(`bun ${name}`)
			add(`npm run ${name}`)
			if (workspace.dir) {
				add(`bun run --cwd ${workspace.dir} ${name}`)
				add(`bun --cwd ${workspace.dir} run ${name}`)
			}
			addScriptBody(body)
		}
	}

	const turbo = readJson(path.join(repoRoot(), 'turbo.json'))
	const tasks = (turbo?.tasks ?? {}) as Record<string, unknown>
	for (const task of Object.keys(tasks)) {
		add(`turbo ${task}`)
		add(`turbo run ${task}`)
		add(`bunx turbo ${task}`)
	}

	for (const line of workflowRunLines()) {
		addScriptBody(line)
	}

	return known
}

/**
 * A referenced command is known when it matches a defined command exactly, or
 * when it is a defined command plus extra arguments (`bun run desktop:build
 * --bundles deb`).
 */
export function isKnownCommand(command: string, known: Set<string>): boolean {
	if (known.has(command)) return true

	for (const candidate of known) {
		if (command.startsWith(candidate + ' ')) return true
	}

	return false
}
