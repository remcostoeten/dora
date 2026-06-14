import fs from 'node:fs'

const version = process.argv[2]
if (!version) {
	console.error('Usage: bun scripts/bump-version.mjs <version>')
	process.exit(1)
}

const jsonFiles = [
	'package.json',
	'apps/desktop/package.json',
	'apps/desktop/src-tauri/tauri.conf.json',
]

for (const file of jsonFiles) {
	const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
	pkg.version = version
	fs.writeFileSync(file, `${JSON.stringify(pkg, null, '\t')}\n`)
}

const cargoToml = fs.readFileSync('apps/desktop/src-tauri/Cargo.toml', 'utf8')
fs.writeFileSync(
	'apps/desktop/src-tauri/Cargo.toml',
	cargoToml.replace(/^version = ".*"/m, `version = "${version}"`),
)

const cargoLock = fs.readFileSync('apps/desktop/src-tauri/Cargo.lock', 'utf8')
fs.writeFileSync(
	'apps/desktop/src-tauri/Cargo.lock',
	cargoLock.replace(
		/(^name = "dora"\nversion = ")[^"]+(")/m,
		`$1${version}$2`,
	),
)

console.log(version)
