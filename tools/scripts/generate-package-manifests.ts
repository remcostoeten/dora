import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Asset = { url: string; sha256: string }

const REPO = 'remcostoeten/dora'
const DESCRIPTION =
	'Free, open source database client for PostgreSQL, MySQL, SQLite, libSQL, D1 and DuckDB'

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((value) => value.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function requireFlag(flag: string): string {
	const value = getFlagValue(flag)
	if (!value) throw new Error(`Missing required flag --${flag}=...`)
	return value
}

function writeFile(filePath: string, contents: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, contents)
	logLevel('success', `Wrote ${filePath}`)
}

function findAsset(assetsDir: string, tag: string, file: string): Asset | null {
	const local = path.join(assetsDir, file)
	if (!fs.existsSync(local)) return null
	return {
		url: `https://github.com/${REPO}/releases/download/${tag}/${file}`,
		sha256: crypto.createHash('sha256').update(fs.readFileSync(local)).digest('hex')
	}
}

/**
 * @name nixRelease
 * @description Builds the release.json the dora-packages flake reads: one .deb per Nix system.
 * @example nixRelease('0.45.0', 'v0.45.0', { 'x86_64-linux': { url, sha256 } })
 */
export function nixRelease(version: string, tag: string, systems: Record<string, Asset>) {
	return { version, tag, systems }
}

/**
 * @name scoopManifest
 * @description Builds the Scoop manifest. Scoop unpacks the NSIS installer with 7-Zip
 * (the `#/dl.7z` suffix) instead of running it, so the install stays portable.
 * @example scoopManifest('0.45.0', { '64bit': { url, sha256 } })
 */
export function scoopManifest(version: string, architectures: Record<string, Asset>) {
	const setupName: Record<string, string> = { '64bit': 'x64', arm64: 'arm64' }
	const entries = Object.entries(architectures)
	return {
		version,
		description: DESCRIPTION,
		homepage: `https://github.com/${REPO}`,
		license: 'GPL-3.0-only',
		architecture: Object.fromEntries(
			entries.map(([arch, asset]) => [
				arch,
				{ url: `${asset.url}#/dl.7z`, hash: asset.sha256 }
			])
		),
		post_install: [
			"Remove-Item (Join-Path $dir '$PLUGINSDIR') -Recurse -Force -ErrorAction SilentlyContinue",
			"Remove-Item (Join-Path $dir 'uninstall.exe') -Force -ErrorAction SilentlyContinue"
		],
		shortcuts: [['dora.exe', 'Dora']],
		checkver: { github: `https://github.com/${REPO}` },
		autoupdate: {
			architecture: Object.fromEntries(
				entries.map(([arch]) => [
					arch,
					{
						url: `https://github.com/${REPO}/releases/download/v$version/Dora_$version_${setupName[arch]}-setup.exe#/dl.7z`
					}
				])
			)
		}
	}
}

function main() {
	const version = requireFlag('version')
	const tag = getFlagValue('tag') || `v${version}`
	const assetsDir = path.resolve(requireFlag('assets-dir'))
	const outDir = path.resolve(getFlagValue('out-dir') || 'dora-packages')

	const debs: Record<string, Asset | null> = {
		'x86_64-linux': findAsset(assetsDir, tag, `Dora_${version}_amd64.deb`),
		'aarch64-linux': findAsset(assetsDir, tag, `Dora_${version}_arm64.deb`)
	}
	const installers: Record<string, Asset | null> = {
		'64bit': findAsset(assetsDir, tag, `Dora_${version}_x64-setup.exe`),
		arm64: findAsset(assetsDir, tag, `Dora_${version}_arm64-setup.exe`)
	}
	if (!debs['x86_64-linux'] || !installers['64bit']) {
		throw new Error(`The x86_64 .deb and x64 setup.exe for ${version} must be in ${assetsDir}`)
	}

	function present(map: Record<string, Asset | null>): Record<string, Asset> {
		return Object.fromEntries(
			Object.entries(map).filter((entry): entry is [string, Asset] => entry[1] !== null)
		)
	}

	logHeader('Generating dora-packages manifests')
	logKeyValue('Version', version)
	logKeyValue('Nix systems', Object.keys(present(debs)).join(', '))
	logKeyValue('Scoop architectures', Object.keys(present(installers)).join(', '))

	writeFile(
		path.join(outDir, 'release.json'),
		`${JSON.stringify(nixRelease(version, tag, present(debs)), null, 2)}\n`
	)
	writeFile(
		path.join(outDir, 'bucket', 'dora.json'),
		`${JSON.stringify(scoopManifest(version, present(installers)), null, 4)}\n`
	)
}

if (process.argv[1]?.endsWith('generate-package-manifests.ts')) {
	try {
		main()
	} catch (error) {
		logLevel('error', error instanceof Error ? error.message : String(error))
		process.exit(1)
	}
}
