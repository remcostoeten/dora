/**
 * Builds the Tauri updater manifest (`latest.json`) from the signed bundle
 * artifacts produced by `tauri-action` with `createUpdaterArtifacts: true`.
 *
 * The desktop app's updater endpoint
 * (`https://github.com/remcostoeten/dora/releases/latest/download/latest.json`)
 * serves this file. For each platform it lists the download URL of the updater
 * artifact and the base64 signature read from the matching `.sig` file.
 *
 * Usage:
 *   bun tools/scripts/generate-latest-json.ts \
 *     --assets-dir=/tmp/release-assets \
 *     --version=v0.30.0 \
 *     --notes-file=/tmp/release-notes.md \
 *     --repo=remcostoeten/dora \
 *     --output=/tmp/latest.json \
 *     [--require-platforms=linux-x86_64,windows-x86_64,darwin-aarch64]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type PlatformEntry = { signature: string; url: string }

export type UpdaterManifest = {
	version: string
	notes: string
	pub_date: string
	platforms: Record<string, PlatformEntry>
}

/** Platforms every release must ship an updater artifact for. */
export const REQUIRED_PLATFORMS = ['linux-x86_64', 'windows-x86_64', 'darwin-aarch64'] as const

function arg(name: string, fallback = ''): string {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
	return hit ? hit.slice(name.length + 3) : fallback
}

export function walk(dir: string): string[] {
	const out: string[] = []
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry)
		if (statSync(full).isDirectory()) out.push(...walk(full))
		else out.push(full)
	}
	return out
}

/**
 * Maps an updater artifact filename to its platform key, or null when the file
 * is not an updater target (e.g. .deb, .rpm, .dmg, .msi installers).
 */
export function platformFor(file: string): string | null {
	if (file.endsWith('.AppImage')) return 'linux-x86_64'
	if (file.endsWith('.app.tar.gz')) return 'darwin-aarch64'
	if (file.endsWith('-setup.exe') || file.endsWith('.exe')) return 'windows-x86_64'
	return null
}

/**
 * Collects one updater entry per platform from the `.sig` files in `files`.
 * NSIS `-setup.exe` and bare `.exe` both map to windows — the first match wins
 * deterministically.
 */
export function collectPlatforms(
	files: string[],
	options: { repo: string; tag: string; readSignature?: (path: string) => string }
): Record<string, PlatformEntry> {
	const read = options.readSignature ?? ((path: string) => readFileSync(path, 'utf8'))
	const platforms: Record<string, PlatformEntry> = {}

	for (const sig of files.filter((f) => f.endsWith('.sig'))) {
		const artifact = sig.slice(0, -'.sig'.length)
		const platform = platformFor(artifact)
		if (!platform) continue
		if (platforms[platform]) continue
		const filename = artifact.split('/').pop() as string
		platforms[platform] = {
			signature: read(sig).trim(),
			url: `https://github.com/${options.repo}/releases/download/${options.tag}/${encodeURIComponent(filename)}`
		}
	}

	return platforms
}

/**
 * Throws with an actionable message when any expected platform has no updater
 * artifact, so a release never silently ships without a channel (see #223).
 */
export function assertPlatformsPresent(
	platforms: Record<string, PlatformEntry>,
	expected: readonly string[] = REQUIRED_PLATFORMS
): void {
	const missing = expected.filter((platform) => !platforms[platform])
	if (missing.length === 0) return

	const found = Object.keys(platforms)
	throw new Error(
		[
			`latest.json is missing updater platforms: ${missing.join(', ')}`,
			`Found: ${found.length > 0 ? found.join(', ') : '(none)'}`,
			'Each platform needs its signed updater artifact in the assets dir:',
			'  linux-x86_64   -> *.AppImage + *.AppImage.sig',
			'  windows-x86_64 -> *-setup.exe + *-setup.exe.sig',
			'  darwin-aarch64 -> *.app.tar.gz + *.app.tar.gz.sig (needs the "app" bundle target)'
		].join('\n')
	)
}

export function buildManifest(input: {
	files: string[]
	rawVersion: string
	repo: string
	notes: string
	expectedPlatforms?: readonly string[]
	readSignature?: (path: string) => string
	now?: Date
}): UpdaterManifest {
	const version = input.rawVersion.replace(/^v/, '')
	const tag = input.rawVersion.startsWith('v') ? input.rawVersion : `v${input.rawVersion}`
	const platforms = collectPlatforms(input.files, {
		repo: input.repo,
		tag,
		readSignature: input.readSignature
	})

	assertPlatformsPresent(platforms, input.expectedPlatforms)

	return {
		version,
		notes: input.notes,
		pub_date: (input.now ?? new Date()).toISOString(),
		platforms
	}
}

export function parseRequiredPlatforms(raw: string): readonly string[] {
	if (!raw) return REQUIRED_PLATFORMS
	if (raw === 'none') return []
	return raw
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
}

function main(): void {
	const assetsDir = arg('assets-dir')
	const rawVersion = arg('version')
	const notesFile = arg('notes-file')
	const repo = arg('repo', 'remcostoeten/dora')
	const output = arg('output', 'latest.json')

	if (!assetsDir || !rawVersion) {
		console.error('Missing required --assets-dir / --version')
		process.exit(2)
	}

	const files = walk(assetsDir)

	try {
		const manifest = buildManifest({
			files,
			rawVersion,
			repo,
			notes: notesFile ? readFileSync(notesFile, 'utf8').trim() : '',
			expectedPlatforms: parseRequiredPlatforms(arg('require-platforms'))
		})
		writeFileSync(output, JSON.stringify(manifest, null, 2))
		console.log(`Wrote ${output} with platforms: ${Object.keys(manifest.platforms).join(', ')}`)
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error))
		console.error(`Scanned ${files.length} files under ${assetsDir}`)
		process.exit(1)
	}
}

function isDirectInvocation(): boolean {
	return Boolean(process.argv[1]?.endsWith('generate-latest-json.ts'))
}

if (isDirectInvocation()) {
	main()
}
