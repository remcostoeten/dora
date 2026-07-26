import { Node, Project, SyntaxKind } from 'ts-morph'

/**
 * Read-only counterpart to `run-lint-style-fix.ts`.
 *
 * Reports the two project style rules oxlint does not cover:
 *
 *   1. `arrow-const` — a standalone function must be a `function` declaration.
 *      Only module-scope arrows that are never passed as an argument count:
 *      a nested or passed-along arrow is a callback, which the rule says
 *      should stay an arrow.
 *
 *   2. `props-naming` — a component's props type is named `Props`. Only types
 *      whose name already ends in `Props` are flagged; a file's single
 *      non-exported type is not necessarily a props type (`LogLevel`,
 *      `TableCacheEntry`, …) and renaming those would be wrong.
 *
 * Both rules are deliberately narrow so the gate can block in CI without
 * false positives. See issue #201.
 */

type Violation = {
	file: string
	line: number
	rule: 'arrow-const' | 'props-naming'
	detail: string
}

function isPassedAsArgument(varDecl: Node): boolean {
	const nameNode = varDecl.asKind(SyntaxKind.VariableDeclaration)?.getNameNode()
	if (!nameNode || nameNode.getKind() !== SyntaxKind.Identifier) return false

	for (const reference of nameNode.asKindOrThrow(SyntaxKind.Identifier).findReferencesAsNodes()) {
		const parent = reference.getParent()
		if (!parent) continue
		if (parent.getKind() === SyntaxKind.CallExpression) {
			const call = parent.asKindOrThrow(SyntaxKind.CallExpression)
			if (call.getArguments().some(function (arg) { return arg === reference })) return true
		}
		if (parent.getKind() === SyntaxKind.JsxExpression) return true
	}

	return false
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

			// Nested arrows are closures over local state; converting them to
			// declarations changes nothing the rule cares about.
			if (varStmt.getParent()?.getKind() !== SyntaxKind.SourceFile) continue

			// A named arrow that is handed to something else is a callback.
			if (isPassedAsArgument(varDecl)) continue

			violations.push({
				file,
				line: arrowFunction.getStartLineNumber(),
				rule: 'arrow-const',
				detail: `${varDecl.getName()} is a module-scope arrow assigned to a const; use a function declaration`
			})
		}

		const nonExported = [
			...sourceFile.getInterfaces().filter(function (i) { return !i.isExported() }),
			...sourceFile.getTypeAliases().filter(function (t) { return !t.isExported() })
		]

		// Only a file whose *single* non-exported type is a props type must call
		// it `Props`. With several types the rule asks for descriptive names
		// instead, which `FooProps` / `BarProps` already are.
		if (nonExported.length === 1) {
			const decl = nonExported[0]
			const name = decl.getName()

			if (name !== 'Props' && name.endsWith('Props')) {
				violations.push({
					file,
					line: decl.getStartLineNumber(),
					rule: 'props-naming',
					detail: `single non-exported props type is named ${name}; rename to Props`
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
