'use client'

import { Project, ImportDeclaration } from "ts-morph";

const project = new Project()
project.addSourceFilesAtPaths([
	'**/*.{ts,tsx}',
	'!**/node_modules/**',
	'!**/dist/**',
	'!**/build/**',
	'!**/.next/**',
	'!**/.turbo/**',
	'!**/out/**'
])

function getImportOrder(moduleSpecifier: string): number {
	if (moduleSpecifier.startsWith('.')) {
		return 3
	}
	if (moduleSpecifier.startsWith('@/') || moduleSpecifier.startsWith('~')) {
		return 2
	}
	return 1
}

function sortImports(imports: ImportDeclaration[]): ImportDeclaration[] {
	return imports.slice().sort(function (a, b) {
		const orderA = getImportOrder(a.getModuleSpecifierValue())
		const orderB = getImportOrder(b.getModuleSpecifierValue())
		if (orderA !== orderB) {
			return orderA - orderB
		}
		return a.getModuleSpecifierValue().localeCompare(b.getModuleSpecifierValue())
	})
}
