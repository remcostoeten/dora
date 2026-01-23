import { Project, SyntaxKind, VariableDeclarationKind } from "ts-morph";

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

for (const sourceFile of project.getSourceFiles()) {
	const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)
	for (const af of arrowFunctions.reverse()) {
		const parent = af.getParent()
		if (parent.getKind() === SyntaxKind.VariableDeclaration) {
			const varDecl = parent
			const varDeclList = varDecl.getParent()
			if (varDeclList && varDeclList.getKind() === SyntaxKind.VariableDeclarationList) {
				const varStmt = varDeclList.getParent()
				if (varStmt && varStmt.getKind() === SyntaxKind.VariableStatement) {
					const name = varDecl.getName()
					const isExported = varStmt.getModifiers().some(function (m) {
						return m.getKind() === SyntaxKind.ExportKeyword
					})
					const params = af
						.getParameters()
						.map(function (p) {
							return p.getText()
						})
						.join(', ')
					const returnTypeNode = af.getReturnTypeNode()
					const returnType = returnTypeNode ? `: ${returnTypeNode.getText()}` : ''
					const isAsync = af.isAsync() ? 'async ' : ''
					let bodyText = af.getBodyText() || ''
					const body = af.getBody()
					if (body.getKind() !== SyntaxKind.Block) {
						bodyText = `return ${bodyText};`
					}

					const declarations = varDeclList.getDeclarations()
					if (declarations.length === 1) {
						const funcText = `${isExported ? 'export ' : ''}${isAsync}function ${name}(${params})${returnType} {\n${bodyText}\n}`
						varStmt.replaceWithText(funcText)
						continue
					}
				}
			}
		}
	}

	const interfaces = sourceFile.getInterfaces()
	const typeAliases = sourceFile.getTypeAliases()
	const nonExportedInterfaces = interfaces.filter(function (i) {
		return !i.isExported()
	})
	const nonExportedTypes = typeAliases.filter(function (t) {
		return !t.isExported()
	})
	const allNonExported = [...nonExportedInterfaces, ...nonExportedTypes]

	if (allNonExported.length === 1) {
		const decl = allNonExported[0]
		const name = decl.getName()

		if (decl.getKind() === SyntaxKind.InterfaceDeclaration && name === 'IProps') {
			const interfaceDecl = decl
			const properties = interfaceDecl.getProperties()
			const propsText = properties
				.map(function (p) {
					return p.getText()
				})
				.join('\n\t')
			interfaceDecl.replaceWithText(`type Props = {\n\t${propsText}\n}`)
		}
	}

	sourceFile.saveSync()
}
