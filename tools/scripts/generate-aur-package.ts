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
	appImageUrl: string
	appImageFile: string
	appImageSha256: string
}

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((value) => value.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function inferVersion(): string {
	const explicitVersion = getFlagValue('version')
	if (explicitVersion) return explicitVersion

	try {
		const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
		if (!latestTag) throw new Error('No tags found')
		return latestTag.startsWith('v') ? latestTag.slice(1) : latestTag
	} catch {
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
	return crypto.createHash('sha256').update(buffer).digest('hex')
}

function writeFile(filePath: string, contents: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, contents)
	logLevel('success', `Wrote ${filePath}`)
}

// Binary package: downloads the pre-built AppImage from the GitHub release.
// Users install with:  sudo pacman -S dora  (via AUR helper like yay/paru)
// or:                  yay -S dora
function createPkgbuild(config: Config): string {
	return `# Maintainer: Remco Stoeten <aukjestoetencrypto@gmail.com>
pkgname=dora
pkgver=${config.version}
pkgrel=${config.pkgrel}
pkgdesc="A native-feeling desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL"
arch=('x86_64')
url="${config.repoUrl}"
license=('GPL-3.0-only')
depends=('fuse2' 'gtk3' 'libayatana-appindicator' 'libsecret' 'webkit2gtk-4.1')
options=('!strip')
source=("${config.appImageFile}::${config.appImageUrl}")
sha256sums=('${config.appImageSha256}')

prepare() {
  chmod +x "${config.appImageFile}"
}

package() {
  install -Dm755 "\${srcdir}/${config.appImageFile}" "\${pkgdir}/usr/lib/dora/dora.AppImage"

  install -dm755 "\${pkgdir}/usr/bin"
  cat > "\${pkgdir}/usr/bin/dora" <<'WRAPPER'
#!/usr/bin/env bash
exec /usr/lib/dora/dora.AppImage "$@"
WRAPPER
  chmod 755 "\${pkgdir}/usr/bin/dora"

  if "\${srcdir}/${config.appImageFile}" --appimage-extract usr/share/pixmaps/dora.png &>/dev/null; then
    install -Dm644 squashfs-root/usr/share/pixmaps/dora.png \\
      "\${pkgdir}/usr/share/pixmaps/dora.png"
  elif "\${srcdir}/${config.appImageFile}" --appimage-extract dora.png &>/dev/null; then
    install -Dm644 squashfs-root/dora.png "\${pkgdir}/usr/share/pixmaps/dora.png"
  fi

  install -Dm644 /dev/stdin "\${pkgdir}/usr/share/applications/dora.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Dora
Comment=Desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL
Exec=dora
Icon=dora
Categories=Development;Database;
Terminal=false
StartupNotify=true
Keywords=database;sql;postgres;mysql;sqlite;
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
	depends = fuse2
	depends = gtk3
	depends = libayatana-appindicator
	depends = libsecret
	depends = webkit2gtk-4.1
	options = !strip
	source = ${config.appImageFile}::${config.appImageUrl}
	sha256sums = ${config.appImageSha256}

pkgname = dora
`
}

async function main() {
	const version = inferVersion()
	const repoUrl = getFlagValue('repo-url') || 'https://github.com/remcostoeten/dora'
	const appImageFile =
		getFlagValue('appimage-file') || `Dora_${version}_amd64.AppImage`
	const appImageUrl =
		getFlagValue('appimage-url') ||
		`${repoUrl}/releases/download/v${version}/${appImageFile}`
	const explicitSha = getFlagValue('source-sha256')

	const config: Config = {
		version,
		pkgrel: getFlagValue('pkgrel') || '1',
		outDir: path.resolve(getFlagValue('out-dir') || path.join('packaging', 'aur')),
		repoUrl,
		appImageUrl,
		appImageFile,
		appImageSha256: explicitSha || (await sha256FromUrl(appImageUrl))
	}

	logHeader('Generating AUR Package Files')
	logKeyValue('Package', 'dora (binary)')
	logKeyValue('Version', config.version)
	logKeyValue('pkgrel', config.pkgrel)
	logKeyValue('AppImage', config.appImageUrl)
	logKeyValue('Output', config.outDir)

	writeFile(path.join(config.outDir, 'PKGBUILD'), createPkgbuild(config))
	writeFile(path.join(config.outDir, '.SRCINFO'), createSrcInfo(config))
}

main().catch((error) => {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
})
