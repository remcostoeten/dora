import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function getRepoRoot(): string {
	return path.resolve(__dirname, '../../..')
}

function readRepoFile(relativePath: string): string {
	return readFileSync(path.join(getRepoRoot(), relativePath), 'utf8')
}

function listSourceFiles(dirPath: string): string[] {
	const entries = readdirSync(dirPath)
	const files: string[] = []

	for (const entry of entries) {
		if (entry === 'node_modules' || entry === 'dist' || entry === 'target' || entry === 'vendor') {
			continue
		}

		const fullPath = path.join(dirPath, entry)
		const stat = statSync(fullPath)

		if (stat.isDirectory()) {
			files.push(...listSourceFiles(fullPath))
			continue
		}

		if (/\.(ts|tsx)$/.test(fullPath)) {
			files.push(fullPath)
		}
	}

	return files
}

function extractBindingMethodNames(bindingsSource: string): string[] {
	const names = new Set<string>()
	const regex = /async\s+([A-Za-z0-9_]+)\s*\(/g

	for (const match of bindingsSource.matchAll(regex)) {
		names.add(match[1])
	}

	return Array.from(names).sort()
}

function extractInvokeNames(bindingsSource: string): string[] {
	const names = new Set<string>()
	const regex = /TAURI_INVOKE\("([a-z0-9_]+)"/g

	for (const match of bindingsSource.matchAll(regex)) {
		names.add(match[1])
	}

	return Array.from(names).sort()
}

function extractGenerateHandlerNames(libSource: string): string[] {
	const names = new Set<string>()
	const regex = /::([a-zA-Z0-9_]+)\s*,/g

	for (const match of libSource.matchAll(regex)) {
		names.add(match[1])
	}

	return Array.from(names).sort()
}

function extractFrontendCommandUsages(sourceRoot: string): string[] {
	const names = new Set<string>()
	const files = listSourceFiles(sourceRoot)
	const regex = /commands\.([A-Za-z0-9_]+)\s*\(/g

	for (const file of files) {
		if (file.endsWith(path.join('src', 'lib', 'bindings.ts'))) {
			continue
		}

		const source = readFileSync(file, 'utf8')
		for (const match of source.matchAll(regex)) {
			names.add(match[1])
		}
	}

	return Array.from(names).sort()
}

describe('Tauri invoke contract', function () {
	it('keeps every generated invoke registered in Rust generate_handler', function () {
		const bindingsSource = readRepoFile('apps/desktop/src/lib/bindings.ts')
		const libSource = readRepoFile('apps/desktop/src-tauri/src/lib.rs')

		const invokeNames = extractInvokeNames(bindingsSource)
		const handlerNames = extractGenerateHandlerNames(libSource)
		const missing = invokeNames.filter(function (name) {
			return !handlerNames.includes(name)
		})

		expect(missing).toEqual([])
	})

	it('keeps every frontend commands.* call backed by a generated binding', function () {
		const bindingsSource = readRepoFile('apps/desktop/src/lib/bindings.ts')
		const bindingMethodNames = extractBindingMethodNames(bindingsSource)
		const frontendCommandNames = extractFrontendCommandUsages(
			path.join(getRepoRoot(), 'apps/desktop/src')
		)
		const missing = frontendCommandNames.filter(function (name) {
			return !bindingMethodNames.includes(name)
		})

		expect(missing).toEqual([])
	})
})
