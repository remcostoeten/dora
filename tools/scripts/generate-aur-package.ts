import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	version: string
	pkgrel: string
	outDir: string
	repoUrl: string
	sourceUrl: string
	sourceFile: string
	sourceSha256: string
}

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((value) => value.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function inferVersion(): string {
	const explicitVersion = getFlagValue('version')
	if (explicitVersion) {
		return explicitVersion
	}

	try {
		const latestTag = execSync('git describe --tags --abbrev=0', {
			encoding: 'utf8'
		}).trim()

		if (!latestTag) {
			throw new Error('No tags found')
		}

		return latestTag.startsWith('v') ? latestTag.slice(1) : latestTag
	} catch (error) {
		throw new Error(
			'Could not infer version from git tags. Provide --version=... or create a release tag first.'
		)
	}
}

async function sha256FromUrl(url: string): Promise<string> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
	}

	const buffer = Buffer.from(await response.arrayBuffer())
	return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase()
}

function writeFile(filePath: string, contents: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, contents)
	logLevel('success', `Wrote ${filePath}`)
}

function createPkgbuild(config: Config): string {
	return `pkgname=dora
pkgver=${config.version}
pkgrel=${config.pkgrel}
pkgdesc="A native-feeling desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL"
arch=('x86_64')
url="${config.repoUrl}"
license=('GPL-3.0-only')
depends=('glibc' 'gtk3' 'libayatana-appindicator' 'libsecret' 'webkit2gtk-4.1')
makedepends=('bun' 'cargo' 'pkgconf')
source=("${config.sourceFile}::${config.sourceUrl}")
sha256sums=('${config.sourceSha256}')

build() {
  cd "\${srcdir}/dora-\${pkgver}"

  export HOME="\${srcdir}/.home"
  export CARGO_HOME="\${srcdir}/.cargo"
  export BUN_INSTALL_CACHE_DIR="\${srcdir}/.bun-cache"

  bun install --frozen-lockfile
  bun run --cwd apps/desktop build
  cargo build --manifest-path apps/desktop/src-tauri/Cargo.toml --release --locked
}

package() {
  cd "\${srcdir}/dora-\${pkgver}"

  install -Dm755 "apps/desktop/src-tauri/target/release/app" "\${pkgdir}/usr/bin/dora"
  install -Dm644 "apps/desktop/src-tauri/icons/icon.png" "\${pkgdir}/usr/share/pixmaps/dora.png"
  install -Dm644 "LICENSE" "\${pkgdir}/usr/share/licenses/\${pkgname}/LICENSE"
  install -Dm644 /dev/stdin "\${pkgdir}/usr/share/applications/dora.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Dora
Comment=Desktop database studio
Exec=dora
Icon=dora
Categories=Development;Database;
Terminal=false
StartupNotify=true
EOF
}
`
}

function createSrcInfo(config: Config): string {
	return `pkgbase = dora
	pkgdesc = A native-feeling desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL
	pkgver = ${config.version}
	pkgrel = ${config.pkgrel}
	url = ${config.repoUrl}
	arch = x86_64
	license = GPL-3.0-only
	makedepends = bun
	makedepends = cargo
	makedepends = pkgconf
	depends = glibc
	depends = gtk3
	depends = libayatana-appindicator
	depends = libsecret
	depends = webkit2gtk-4.1
	source = ${config.sourceFile}::${config.sourceUrl}
	sha256sums = ${config.sourceSha256}

pkgname = dora
`
}

async function main() {
	const version = inferVersion()
	const repoUrl = getFlagValue('repo-url') || 'https://github.com/remcostoeten/dora'
	const sourceFile = getFlagValue('source-file') || `dora-${version}.tar.gz`
	const sourceUrl =
		getFlagValue('source-url') || `${repoUrl}/archive/refs/tags/v${version}.tar.gz`
	const explicitSha = getFlagValue('source-sha256')

	const config: Config = {
		version,
		pkgrel: getFlagValue('pkgrel') || '1',
		outDir: path.resolve(getFlagValue('out-dir') || path.join('packaging', 'aur')),
		repoUrl,
		sourceUrl,
		sourceFile,
		sourceSha256: explicitSha ? explicitSha.toUpperCase() : await sha256FromUrl(sourceUrl)
	}

	logHeader('Generating AUR Package Files')
	logKeyValue('Package', 'dora')
	logKeyValue('Version', config.version)
	logKeyValue('pkgrel', config.pkgrel)
	logKeyValue('Source', config.sourceUrl)
	logKeyValue('Output', config.outDir)

	writeFile(path.join(config.outDir, 'PKGBUILD'), createPkgbuild(config))
	writeFile(path.join(config.outDir, '.SRCINFO'), createSrcInfo(config))
}

main().catch((error) => {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
})
