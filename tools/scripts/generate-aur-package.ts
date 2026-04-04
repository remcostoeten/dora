import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Config = {
	version: string
	pkgrel: string
	appImageFile: string
	appImageSha256: string
	outDir: string
	repoUrl: string
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

function readChecksumFromFile(checksumsPath: string, targetFile: string): string {
	const contents = fs.readFileSync(checksumsPath, 'utf8')
	const lines = contents
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	for (const line of lines) {
		const [hash, relativePath] = line.split(/\s{2,}/)
		if (!hash || !relativePath) {
			continue
		}

		if (relativePath === targetFile || relativePath.endsWith(`/${targetFile}`)) {
			return hash.toUpperCase()
		}
	}

	throw new Error(`Could not find ${targetFile} in ${checksumsPath}`)
}

function writeFile(filePath: string, contents: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
	fs.writeFileSync(filePath, contents)
	logLevel('success', `Wrote ${filePath}`)
}

function createPkgbuild(config: Config): string {
	return `pkgname=dora-bin
pkgver=${config.version}
pkgrel=${config.pkgrel}
pkgdesc="A clean, fast desktop database studio for PostgreSQL, SQLite, and LibSQL"
arch=('x86_64')
url="${config.repoUrl}"
license=('GPL3')
depends=('glibc' 'zlib' 'hicolor-icon-theme')
provides=('dora')
conflicts=('dora')
options=(!strip)
_appimage="${config.appImageFile}"
source=("\${_appimage}::${config.repoUrl}/releases/download/v\${pkgver}/\${_appimage}")
sha256sums=('${config.appImageSha256}')

package() {
  install -dm755 "\${pkgdir}/opt/dora"
  install -Dm755 "\${srcdir}/\${_appimage}" "\${pkgdir}/opt/dora/dora.AppImage"

  install -Dm755 /dev/stdin "\${pkgdir}/usr/bin/dora" <<'EOF'
#!/bin/sh
exec /opt/dora/dora.AppImage --appimage-extract-and-run "$@"
EOF

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
	return `pkgbase = dora-bin
	pkgdesc = A clean, fast desktop database studio for PostgreSQL, SQLite, and LibSQL
	pkgver = ${config.version}
	pkgrel = ${config.pkgrel}
	url = ${config.repoUrl}
	arch = x86_64
	license = GPL3
	depends = glibc
	depends = zlib
	depends = hicolor-icon-theme
	provides = dora
	conflicts = dora
	options = !strip
	source = ${config.appImageFile}::${config.repoUrl}/releases/download/v${config.version}/${config.appImageFile}
	sha256sums = ${config.appImageSha256}

pkgname = dora-bin
`
}

function main() {
	const version = requireFlag('version')
	const appImageFile =
		getFlagValue('appimage-file') || `Dora_${version}_amd64.AppImage`
	const checksumsFile = getFlagValue('checksums-file')
	const explicitSha = getFlagValue('appimage-sha256')

	if (!explicitSha && !checksumsFile) {
		throw new Error('Provide --appimage-sha256=... or --checksums-file=...')
	}

	const config: Config = {
		version,
		pkgrel: getFlagValue('pkgrel') || '1',
		appImageFile,
		appImageSha256: explicitSha
			? explicitSha.toUpperCase()
			: readChecksumFromFile(path.resolve(checksumsFile as string), appImageFile),
		outDir: path.resolve(getFlagValue('out-dir') || path.join('packaging', 'aur')),
		repoUrl: getFlagValue('repo-url') || 'https://github.com/remcostoeten/dora'
	}

	logHeader('Generating AUR Package Files')
	logKeyValue('Version', config.version)
	logKeyValue('pkgrel', config.pkgrel)
	logKeyValue('AppImage', config.appImageFile)
	logKeyValue('Output', config.outDir)

	writeFile(path.join(config.outDir, 'PKGBUILD'), createPkgbuild(config))
	writeFile(path.join(config.outDir, '.SRCINFO'), createSrcInfo(config))
}

try {
	main()
} catch (error) {
	logLevel('error', error instanceof Error ? error.message : String(error))
	process.exit(1)
}
