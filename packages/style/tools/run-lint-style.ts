import { Project, SyntaxKind } from 'ts-morph'

const project = new Project()
project.addSourceFilesAtPaths([
	'**/*.{ts,tsx}',
	'!**/node_modules/**',
	'!**/dist/**',
	'!**/build/**',
	'!**/.next/**',
	'!**/.turbo/**',
	'!**/out/**',
	'!packages/style/tools/**'
])

let hasErrors = false

for (const sourceFile of project.getSourceFiles()) {
	const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)
	for (const af of arrowFunctions) {
		console.error(
			`Error: Arrow function found in ${sourceFile.getFilePath()}:${af.getStartLineNumber()}`
		)
		hasErrors = true
	}

	const interfaces = sourceFile.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration)
	for (const intf of interfaces) {
		const name = intf.getName()
		if (!name.startsWith('I')) {
			console.error(
				`Error: Interface "${name}" does not start with "I" in ${sourceFile.getFilePath()}:${intf.getStartLineNumber()}. Prefer 'type'.`
			)
			hasErrors = true
		}
	}

	const typeDecls = sourceFile.getTypeAliases()
	const interfaceDecls = sourceFile.getInterfaces()
	const allDecls = [...typeDecls, ...interfaceDecls].filter(function (d) {
		return !d.isExported()
	})

	if (allDecls.length === 1) {
		const decl = allDecls[0]
		const name = decl.getName()
		if (name !== 'Props') {
			console.error(
				`Error: Single non-exported declaration must be named 'Props' (found '${name}') in ${sourceFile.getFilePath()}`
			)
			hasErrors = true
		}
		if (decl.getKind() === SyntaxKind.InterfaceDeclaration) {
			console.error(
				`Error: Single non-exported declaration must be a 'type', not 'interface' in ${sourceFile.getFilePath()}`
			)
			hasErrors = true
		}
	}
}

if (hasErrors) {
	process.exit(1)
}
