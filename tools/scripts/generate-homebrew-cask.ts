import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	version: string
	tag: string
	dmgUrl: string
	dmgSha256: string
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
  sha256 "${config.dmgSha256}"

  url "${config.dmgUrl}"
  name "${config.name}"
  desc "${config.desc}"
  homepage "${config.homepage}"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :big_sur"

  app "Dora.app"

  # Dora is not notarized, so Gatekeeper would refuse to open a quarantined copy.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Dora.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.Dora.dev",
    "~/Library/Caches/com.Dora.dev",
    "~/Library/Preferences/com.Dora.dev.plist",
    "~/Library/Saved Application State/com.Dora.dev.savedState",
    "~/Library/WebKit/com.Dora.dev",
  ]
end
`
}

async function main() {
	const version = requireFlag('version')
	const tag = getFlagValue('tag') || `v${version}`

	const baseUrl =
		getFlagValue('base-url') || 'https://github.com/remcostoeten/dora/releases/download'

	const dmgUrl = getFlagValue('dmg-url') || `${baseUrl}/${tag}/Dora_${version}_universal.dmg`

	const explicitSha = getFlagValue('dmg-sha256')

	const config: Config = {
		version,
		tag,
		dmgUrl,
		dmgSha256: explicitSha || (await sha256FromUrl(dmgUrl)),
		outDir: path.resolve(
			getFlagValue('out-dir') || path.join('packaging', 'homebrew', 'Casks')
		),
		name: getFlagValue('name') || 'Dora',
		desc:
			getFlagValue('desc') ||
			'Database client for PostgreSQL, MySQL, SQLite, libSQL, D1 and DuckDB',
		homepage: getFlagValue('homepage') || 'https://github.com/remcostoeten/dora'
	}

	logHeader('Generating Homebrew Cask')
	logKeyValue('Version', config.version)
	logKeyValue('Tag', config.tag)
	logKeyValue('DMG', config.dmgUrl)
	logKeyValue('Output', config.outDir)

	writeFile(path.join(config.outDir, 'dora.rb'), createCaskFile(config))
}

try {
	await main()
} catch (error) {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
}
