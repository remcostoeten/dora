import crypto from 'crypto'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { logHeader, logKeyValue, logLevel } from './_shared'

function getFlagValue(flag: string): string | undefined {
	const prefix = `--${flag}=`
	const arg = process.argv.find((v) => v.startsWith(prefix))
	return arg ? arg.slice(prefix.length) : undefined
}

function inferVersion(): string {
	const explicit = getFlagValue('version')
	if (explicit) return explicit
	try {
		const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim()
		if (!tag) throw new Error('no tags')
		return tag.startsWith('v') ? tag.slice(1) : tag
	} catch {
		throw new Error('Could not infer version. Provide --version=...')
	}
}

async function fetchBuffer(url: string): Promise<Buffer> {
	const res = await fetch(url)
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
	return Buffer.from(await res.arrayBuffer())
}

function sha256hex(buf: Buffer): string {
	return crypto.createHash('sha256').update(buf).digest('hex')
}

function sha256base64(buf: Buffer): string {
	return crypto.createHash('sha256').update(buf).digest('base64')
}

function md5hex(buf: Buffer): string {
	return crypto.createHash('md5').update(buf).digest('hex')
}

function sha1hex(buf: Buffer): string {
	return crypto.createHash('sha1').update(buf).digest('hex')
}

function writeFile(p: string, content: string | Buffer) {
	fs.mkdirSync(path.dirname(p), { recursive: true })
	fs.writeFileSync(p, content)
	logLevel('success', `Wrote ${p}`)
}

async function main() {
	const version = inferVersion()
	const repoUrl = getFlagValue('repo-url') || 'https://github.com/remcostoeten/dora'
	const pagesBase =
		getFlagValue('pages-base') || 'https://remcostoeten.github.io/dora'
	const outDir = path.resolve(getFlagValue('out-dir') || 'packaging/apt')
	const debFile = getFlagValue('deb-file') || `Dora_${version}_amd64.deb`
	const debUrl =
		getFlagValue('deb-url') ||
		`${repoUrl}/releases/download/v${version}/${debFile}`

	logHeader('Generating APT Repository Files')
	logKeyValue('Version', version)
	logKeyValue('.deb URL', debUrl)
	logKeyValue('Output', outDir)

	// Download the .deb to compute sizes and hashes
	logLevel('info', 'Downloading .deb to compute hashes…')
	const debBuf = await fetchBuffer(debUrl)
	const debSize = debBuf.length
	const debSha256 = sha256hex(debBuf)
	const debSha1 = sha1hex(debBuf)
	const debMd5 = md5hex(debBuf)

	logKeyValue('Size', String(debSize))
	logKeyValue('SHA-256', debSha256)

	// Write the .deb into the pool
	const poolPath = path.join(outDir, 'pool', 'main', debFile)
	writeFile(poolPath, debBuf)

	// ── Packages index ───────────────────────────────────────────────────────
	const packagesContent = [
		'Package: dora',
		`Version: ${version}`,
		'Architecture: amd64',
		'Maintainer: Remco Stoeten <aukjestoetencrypto@gmail.com>',
		`Installed-Size: ${Math.ceil(debSize / 1024)}`,
		'Depends: libgtk-3-0, libwebkit2gtk-4.1-0, libayatana-appindicator3-1, libsecret-1-0',
		`Filename: pool/main/${debFile}`,
		`Size: ${debSize}`,
		`MD5sum: ${debMd5}`,
		`SHA1: ${debSha1}`,
		`SHA256: ${debSha256}`,
		'Section: utils',
		'Priority: optional',
		'Homepage: https://github.com/remcostoeten/dora',
		'Description: Desktop database studio for PostgreSQL, MySQL, SQLite, and LibSQL',
		' A native-feeling desktop database client built with Tauri.',
		'',
	].join('\n')

	const packagesBuf = Buffer.from(packagesContent, 'utf8')

	// Gzip compress
	const { gzipSync } = await import('zlib')
	const packagesGzBuf = gzipSync(packagesBuf)

	writeFile(path.join(outDir, 'dists', 'stable', 'main', 'binary-amd64', 'Packages'), packagesContent)
	writeFile(path.join(outDir, 'dists', 'stable', 'main', 'binary-amd64', 'Packages.gz'), packagesGzBuf)

	// ── Release file ─────────────────────────────────────────────────────────
	const now = new Date().toUTCString()

	const pMd5 = md5hex(packagesBuf)
	const pSha1 = sha1hex(packagesBuf)
	const pSha256 = sha256hex(packagesBuf)
	const pSize = packagesBuf.length

	const pgzMd5 = md5hex(packagesGzBuf)
	const pgzSha1 = sha1hex(packagesGzBuf)
	const pgzSha256 = sha256hex(packagesGzBuf)
	const pgzSize = packagesGzBuf.length

	const releaseContent = [
		'Origin: Dora',
		'Label: Dora',
		'Suite: stable',
		'Codename: stable',
		`Date: ${now}`,
		'Architectures: amd64',
		'Components: main',
		'Description: Dora apt repository',
		'MD5Sum:',
		` ${pMd5} ${pSize} main/binary-amd64/Packages`,
		` ${pgzMd5} ${pgzSize} main/binary-amd64/Packages.gz`,
		'SHA1:',
		` ${pSha1} ${pSize} main/binary-amd64/Packages`,
		` ${pgzSha1} ${pgzSize} main/binary-amd64/Packages.gz`,
		'SHA256:',
		` ${pSha256} ${pSize} main/binary-amd64/Packages`,
		` ${pgzSha256} ${pgzSize} main/binary-amd64/Packages.gz`,
		'',
	].join('\n')

	writeFile(path.join(outDir, 'dists', 'stable', 'Release'), releaseContent)

	// ── GPG signing (if key available) ───────────────────────────────────────
	const gpgKey = process.env.GPG_PRIVATE_KEY
	if (gpgKey) {
		logLevel('info', 'Signing Release with GPG…')
		try {
			// Import key into temp keyring
			execSync(`echo "${gpgKey}" | gpg --batch --import`, { stdio: 'pipe' })
			const releasePath = path.join(outDir, 'dists', 'stable', 'Release')
			execSync(
				`gpg --batch --yes --armor --detach-sign --output "${releasePath}.gpg" "${releasePath}"`,
				{ stdio: 'pipe' }
			)
			execSync(
				`gpg --batch --yes --clearsign --output "${path.join(outDir, 'dists', 'stable', 'InRelease')}" "${releasePath}"`,
				{ stdio: 'pipe' }
			)
			// Export public key
			const pubKey = execSync('gpg --armor --export', { encoding: 'utf8' })
			writeFile(path.join(outDir, 'KEY.gpg'), pubKey)
			logLevel('success', 'Release signed')
		} catch (err) {
			logLevel('warn', `GPG signing failed (skipping): ${err instanceof Error ? err.message : err}`)
		}
	} else {
		logLevel('warn', 'GPG_PRIVATE_KEY not set — Release will be unsigned (users need [trusted=yes])')
	}

	// ── User install instructions ─────────────────────────────────────────────
	const keyLine = gpgKey
		? `curl -fsSL ${pagesBase}/KEY.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/dora.gpg`
		: `# (unsigned repo — add [trusted=yes] if prompted)`
	const sourceEntry = gpgKey
		? `echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/dora.gpg] ${pagesBase} stable main" | sudo tee /etc/apt/sources.list.d/dora.list`
		: `echo "deb [arch=amd64 trusted=yes] ${pagesBase} stable main" | sudo tee /etc/apt/sources.list.d/dora.list`

	logHeader('Install instructions for users')
	logLevel('info', keyLine)
	logLevel('info', sourceEntry)
	logLevel('info', 'sudo apt update && sudo apt install dora')
}

main().catch((err) => {
	logLevel('error', err instanceof Error ? err.message : String(err))
	process.exit(1)
})
