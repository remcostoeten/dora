import crypto from 'crypto'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { gzipSync } from 'zlib'
import { logHeader, logKeyValue, logLevel } from './_shared'

type Deb = {
	file: string
	buffer: Buffer
	arch: string
	control: string
}

const PAGES_BASE = 'https://remcostoeten.github.io/dora'

function getFlagValues(flag: string): string[] {
	const prefix = `--${flag}=`
	return process.argv.filter((v) => v.startsWith(prefix)).map((v) => v.slice(prefix.length))
}

function getFlagValue(flag: string): string | undefined {
	return getFlagValues(flag)[0]
}

function hash(algorithm: string, buf: Buffer): string {
	return crypto.createHash(algorithm).update(buf).digest('hex')
}

function writeFile(p: string, content: string | Buffer) {
	fs.mkdirSync(path.dirname(p), { recursive: true })
	fs.writeFileSync(p, content)
	logLevel('success', `Wrote ${p}`)
}

async function loadDeb(source: string, tmpDir: string): Promise<Deb> {
	let localPath = source
	if (/^https?:\/\//.test(source)) {
		const res = await fetch(source)
		if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source}`)
		localPath = path.join(tmpDir, decodeURIComponent(source.split('/').pop() as string))
		fs.writeFileSync(localPath, Buffer.from(await res.arrayBuffer()))
	}
	const control = execFileSync('dpkg-deb', ['-f', localPath], { encoding: 'utf8' }).trimEnd()
	const arch = execFileSync('dpkg-deb', ['-f', localPath, 'Architecture'], {
		encoding: 'utf8'
	}).trim()
	return { file: path.basename(localPath), buffer: fs.readFileSync(localPath), arch, control }
}

function packagesEntry(deb: Deb): string {
	return [
		deb.control,
		`Filename: pool/main/${deb.file}`,
		`Size: ${deb.buffer.length}`,
		`MD5sum: ${hash('md5', deb.buffer)}`,
		`SHA1: ${hash('sha1', deb.buffer)}`,
		`SHA256: ${hash('sha256', deb.buffer)}`,
		''
	].join('\n')
}

function releaseFile(indexes: { name: string; buf: Buffer }[], archs: string[]): string {
	const section = (label: string, algorithm: string) => [
		`${label}:`,
		...indexes.map((i) => ` ${hash(algorithm, i.buf)} ${i.buf.length} ${i.name}`)
	]
	return [
		'Origin: Dora',
		'Label: Dora',
		'Suite: stable',
		'Codename: stable',
		`Date: ${new Date().toUTCString()}`,
		`Architectures: ${archs.join(' ')}`,
		'Components: main',
		'Description: Dora apt repository',
		...section('MD5Sum', 'md5'),
		...section('SHA1', 'sha1'),
		...section('SHA256', 'sha256'),
		''
	].join('\n')
}

function sign(outDir: string) {
	const gpgKey = process.env.GPG_PRIVATE_KEY
	if (!gpgKey) {
		logLevel('warning', 'GPG_PRIVATE_KEY not set, the Release file stays unsigned')
		return
	}
	const home = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'dora-apt-gpg-'))
	fs.chmodSync(home, 0o700)
	function gpg(args: string[], input?: string): string {
		return execFileSync('gpg', ['--homedir', home, '--batch', '--yes', ...args], {
			input,
			encoding: 'utf8'
		})
	}
	gpg(['--import'], gpgKey)
	const releasePath = path.join(outDir, 'dists', 'stable', 'Release')
	gpg(['--armor', '--detach-sign', '--output', `${releasePath}.gpg`, releasePath])
	gpg(['--clearsign', '--output', path.join(outDir, 'dists', 'stable', 'InRelease'), releasePath])
	writeFile(path.join(outDir, 'KEY.gpg'), gpg(['--armor', '--export']))
	fs.rmSync(home, { recursive: true, force: true })
	logLevel('success', 'Release signed')
}

async function latestReleaseDebUrls(): Promise<string[]> {
	const res = await fetch('https://api.github.com/repos/remcostoeten/dora/releases/latest')
	if (!res.ok) throw new Error(`HTTP ${res.status} reading the latest release`)
	const release = (await res.json()) as {
		assets: { name: string; browser_download_url: string }[]
	}
	const urls = release.assets
		.filter((asset) => asset.name.endsWith('.deb'))
		.map((asset) => asset.browser_download_url)
	if (urls.length === 0) throw new Error('The latest release has no .deb assets')
	return urls
}

async function main() {
	const outDir = path.resolve(getFlagValue('out-dir') || 'packaging/apt')
	const explicit = [...getFlagValues('deb'), ...getFlagValues('deb-url')]
	const sources = explicit.length > 0 ? explicit : await latestReleaseDebUrls()

	logHeader('Generating APT Repository Files')
	logKeyValue('Output', outDir)

	const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'dora-apt-'))
	const debs = await Promise.all(sources.map((source) => loadDeb(source, tmpDir)))
	const names = debs.map((deb) => deb.file)
	const duplicate = names.find((name, index) => names.indexOf(name) !== index)
	if (duplicate) {
		throw new Error(`Two packages share the pool filename ${duplicate}`)
	}

	const indexes: { name: string; buf: Buffer }[] = []
	const archs = [...new Set(debs.map((deb) => deb.arch))].sort()
	for (const arch of archs) {
		const forArch = debs.filter((deb) => deb.arch === arch)
		const packages = Buffer.from(forArch.map(packagesEntry).join('\n'), 'utf8')
		const packagesGz = gzipSync(packages)
		const dir = path.join(outDir, 'dists', 'stable', 'main', `binary-${arch}`)
		writeFile(path.join(dir, 'Packages'), packages)
		writeFile(path.join(dir, 'Packages.gz'), packagesGz)
		indexes.push({ name: `main/binary-${arch}/Packages`, buf: packages })
		indexes.push({ name: `main/binary-${arch}/Packages.gz`, buf: packagesGz })
	}

	for (const deb of debs) {
		logKeyValue(deb.arch, deb.file)
		writeFile(path.join(outDir, 'pool', 'main', deb.file), deb.buffer)
	}

	writeFile(path.join(outDir, 'dists', 'stable', 'Release'), releaseFile(indexes, archs))
	sign(outDir)

	logHeader('Install instructions for users')
	logLevel(
		'info',
		`curl -fsSL ${PAGES_BASE}/KEY.gpg | sudo gpg --dearmor -o /etc/apt/keyrings/dora.gpg`
	)
	logLevel(
		'info',
		`echo "deb [signed-by=/etc/apt/keyrings/dora.gpg] ${PAGES_BASE} stable main" | sudo tee /etc/apt/sources.list.d/dora.list`
	)
	logLevel('info', 'sudo apt update && sudo apt install dora')
}

main().catch((err) => {
	logLevel('error', err instanceof Error ? err.message : String(err))
	process.exit(1)
})
