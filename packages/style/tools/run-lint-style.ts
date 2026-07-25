import { Project, SyntaxKind } from 'ts-morph'

/**
 * Read-only counterpart to `run-lint-style-fix.ts`.
 *
 * Reports the two project style rules oxlint does not cover:
 *   1. standalone functions must be `function` declarations, not arrows
 *      assigned to a `const`;
 *   2. a file's single non-exported type is named `Props`.
 *
 * Exits non-zero only with `--strict`, so CI can surface the count while the
 * existing backlog of violations is worked down. See issue #201.
 */

type Violation = {
	file: string
	line: number
	rule: 'arrow-const' | 'props-naming'
	detail: string
}

function collectViolations(): Violation[] {
	const project = new Project()
	project.addSourceFilesAtPaths([
		'**/*.{ts,tsx}',
		'!**/node_modules/**',
		'!**/dist/**',
		'!**/build/**',
		'!**/.next/**',
		'!**/.turbo/**',
		'!**/out/**',
		'!**/*.d.ts',
		'!packages/style/tools/**'
	])

	const violations: Violation[] = []

	for (const sourceFile of project.getSourceFiles()) {
		const file = sourceFile.getFilePath()

		for (const arrowFunction of sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction)) {
			const varDecl = arrowFunction.getParent()
			if (varDecl.getKind() !== SyntaxKind.VariableDeclaration) continue

			const varDeclList = varDecl.getParent()
			if (!varDeclList || varDeclList.getKind() !== SyntaxKind.VariableDeclarationList) continue

			const varStmt = varDeclList.getParent()
			if (!varStmt || varStmt.getKind() !== SyntaxKind.VariableStatement) continue
			if (varDeclList.getDeclarations().length !== 1) continue

			violations.push({
				file,
				line: arrowFunction.getStartLineNumber(),
				rule: 'arrow-const',
				detail: `${varDecl.getName()} is an arrow assigned to a const; use a function declaration`
			})
		}

		const nonExported = [
			...sourceFile.getInterfaces().filter(function (i) { return !i.isExported() }),
			...sourceFile.getTypeAliases().filter(function (t) { return !t.isExported() })
		]

		if (nonExported.length === 1) {
			const decl = nonExported[0]
			const name = decl.getName()
			if (name !== 'Props') {
				violations.push({
					file,
					line: decl.getStartLineNumber(),
					rule: 'props-naming',
					detail: `single non-exported type is named ${name}; rename to Props`
				})
			}
		}
	}

	return violations
}

function main(): void {
	const strict = process.argv.includes('--strict')
	const violations = collectViolations()

	if (violations.length === 0) {
		console.log('run-lint-style: clean')
		return
	}

	const byRule = new Map<string, number>()
	for (const violation of violations) {
		byRule.set(violation.rule, (byRule.get(violation.rule) ?? 0) + 1)
	}

	if (strict) {
		for (const violation of violations) {
			console.error(`${violation.file}:${violation.line}  [${violation.rule}] ${violation.detail}`)
		}
	}

	const summary = [...byRule.entries()]
		.map(function ([rule, count]) { return `${rule}: ${count}` })
		.join(', ')

	console.error(`run-lint-style: ${violations.length} violation(s) (${summary})`)

	if (strict) {
		process.exit(1)
	}

	console.error('run-lint-style: non-blocking (see issue #201); run with --strict to fail')
}

main()
