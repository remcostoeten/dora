import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	version: string
	tag: string
	dmgUrlArm: string
	dmgSha256Arm: string
	outDir: string
	name: string
	desc: string
	homepage: string
}

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((value) => value.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function requireFlag(flag: string): string {
	const value = getFlagValue(flag)
	if (!value) {
		throw new Error(`Missing required flag --${flag}=...`)
	}
	return value
}

async function sha256FromUrl(url: string): Promise<string> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
	}
	const buffer = Buffer.from(await response.arrayBuffer())
	return crypto.createHash('sha256').update(buffer).digest('hex')
}

function writeFile(filePath: string, contents: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, contents)
	logLevel('success', `Wrote ${filePath}`)
}

function createCaskFile(config: Config): string {
	return `cask "dora" do
  version "${config.version}"
  sha256 "${config.dmgSha256Arm}"

  url "https://github.com/remcostoeten/dora/releases/download/v\#{version}/Dora_\#{version}_aarch64.dmg"
  name "${config.name}"
  desc "${config.desc}"
  homepage "${config.homepage}"

  depends_on arch: :arm64

  app "Dora.app"
end
`
}

async function main() {
	const version = requireFlag('version')
	const tag = getFlagValue('tag') || `v${version}`

	const baseUrl = getFlagValue('base-url') || 'https://github.com/remcostoeten/dora/releases/download'

	const dmgUrlArm =
		getFlagValue('dmg-url-arm') || `${baseUrl}/${tag}/Dora_${version}_aarch64.dmg`

	const explicitShaArm = getFlagValue('dmg-sha256-arm')

	const config: Config = {
		version,
		tag,
		dmgUrlArm,
		dmgSha256Arm: explicitShaArm || (await sha256FromUrl(dmgUrlArm)),
		outDir: path.resolve(getFlagValue('out-dir') || path.join('packaging', 'homebrew', 'Casks')),
		name: getFlagValue('name') || 'Dora',
		desc:
			getFlagValue('desc') ||
			'Lightweight Rust database manager for PostgreSQL, LibSQL, SQLite, and MySQL',
		homepage: getFlagValue('homepage') || 'https://github.com/remcostoeten/dora'
	}

	logHeader('Generating Homebrew Cask')
	logKeyValue('Version', config.version)
	logKeyValue('Tag', config.tag)
	logKeyValue('DMG ARM', config.dmgUrlArm)
	logKeyValue('Output', config.outDir)

	writeFile(path.join(config.outDir, 'dora.rb'), createCaskFile(config))
}

try {
	await main()
} catch (error) {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
}
