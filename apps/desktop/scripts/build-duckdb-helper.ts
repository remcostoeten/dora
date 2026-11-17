import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const UNIVERSAL_MACOS = 'universal-apple-darwin'
const UNIVERSAL_PARTS = ['aarch64-apple-darwin', 'x86_64-apple-darwin']

const srcTauri = join(import.meta.dir, '..', 'src-tauri')

function run(command: string, args: string[]): string {
	const result = spawnSync(command, args, {
		cwd: srcTauri,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	})
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(' ')} failed`)
	}
	return result.stdout.trim()
}

function hostTriple(): string {
	const output = run('rustc', ['-vV'])
	const hostLine = output.split('\n').find((line) => line.startsWith('host: '))
	if (!hostLine) {
		throw new Error('Could not determine Rust host target triple')
	}
	return hostLine.slice('host: '.length).trim()
}

function buildHelper(target: string, host: string, explicitTarget: boolean): string {
	const exe = target.includes('windows') ? '.exe' : ''
	const cargoArgs = [
		'build',
		'--release',
		'--bin',
		'duckdb_helper',
		'--features',
		'duckdb-engine'
	]
	const useTarget = explicitTarget || target !== host
	if (useTarget) {
		cargoArgs.push('--target', target)
	}
	run('cargo', cargoArgs)

	const releaseDir = useTarget ? join('target', target, 'release') : join('target', 'release')
	const source = join(srcTauri, releaseDir, `duckdb_helper${exe}`)
	if (!existsSync(source)) {
		throw new Error(`Expected helper binary missing at ${source}`)
	}
	return source
}

const host = hostTriple()
const target =
	process.env.TAURI_ENV_TARGET_TRIPLE ||
	process.env.TARGET ||
	process.env.CARGO_BUILD_TARGET ||
	host
const exe = target.includes('windows') ? '.exe' : ''
const binariesDir = join(srcTauri, 'binaries')
const dest = join(binariesDir, `duckdb_helper-${target}${exe}`)

mkdirSync(binariesDir, { recursive: true })
if (!existsSync(dest)) {
	writeFileSync(dest, '')
}

if (target === UNIVERSAL_MACOS) {
	const parts = UNIVERSAL_PARTS.map((part) => buildHelper(part, host, true))
	run('lipo', ['-create', '-output', dest, ...parts])
	console.log(`Merged ${parts.length} helper slices into ${dest}`)
} else {
	const source = buildHelper(target, host, false)
	copyFileSync(source, dest)
	console.log(`Copied ${basename(source)} to ${dest}`)
}
