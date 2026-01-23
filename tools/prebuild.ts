import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd()
const appsDir = join(root, 'apps')
const requiredFiles = [
	join(root, 'vitest.config.ts'),
	join(root, 'tests', 'setup', 'vitest.setup.ts')
]
const ignoredDirs = new Set(['.git', '.turbo', 'dist', 'node_modules', 'target'])
const colocatedTests: string[] = []
const missingFiles: string[] = []

function walk(dir: string): void {
	const entries = readdirSync(dir)
	for (const entry of entries) {
		if (ignoredDirs.has(entry)) continue
		const fullPath = join(dir, entry)
		const stats = statSync(fullPath)
		if (stats.isDirectory()) {
			walk(fullPath)
			continue
		}
		if (stats.isFile() && /\.test\.(ts|tsx|js|jsx)$/.test(entry)) {
			colocatedTests.push(fullPath)
		}
	}
}

for (const file of requiredFiles) {
	if (!existsSync(file)) missingFiles.push(file)
}

if (existsSync(appsDir)) {
	walk(appsDir)
}

if (missingFiles.length > 0) {
	console.error('Prebuild checks failed: required files are missing.')
	for (const file of missingFiles) {
		console.error(`- Missing: ${file}`)
	}
}

if (colocatedTests.length > 0) {
	console.error('Prebuild checks failed: colocated tests detected under apps/.')
	for (const file of colocatedTests) {
		console.error(`- ${file}`)
	}
}

if (missingFiles.length > 0 || colocatedTests.length > 0) {
	process.exit(1)
}

console.log('Prebuild checks passed.')
