/**
 * Live verification harness for the token-paste hosted-provider integrations
 * (Turso, Neon).
 *
 * These integrations are wired and compile-green, but their request shapes and
 * response parsing are mirrored by hand from each provider's docs and have not
 * been exercised against the real APIs. A wrong header or renamed field fails
 * silently for an end user who installed the binary and cannot rebuild. This
 * script replicates EXACTLY what the Rust integrations in
 * `apps/desktop/src-tauri/src/integrations/<p>.rs` do, against the live APIs,
 * and reports any shape mismatch before release.
 *
 * Usage:
 *   TURSO_TOKEN=... NEON_TOKEN=... bun tools/scripts/verify-providers.ts
 *
 *   # also exercise the credential-mint step (CREATES a real token):
 *   bun tools/scripts/verify-providers.ts --mint
 *
 * Only providers with a token set are checked; the rest are skipped.
 */

type TCheck = { name: string; ok: boolean; detail: string }

const MINT = process.argv.includes('--mint')

function expect(cond: boolean, name: string, detail: string): TCheck {
	return { name, ok: cond, detail }
}

function preview(value: unknown): string {
	const text = typeof value === 'string' ? value : JSON.stringify(value)
	if (!text) return '(empty)'
	return text.length > 240 ? `${text.slice(0, 240)}…` : text
}

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text()
	try {
		return JSON.parse(text)
	} catch {
		return text
	}
}

function get<T = unknown>(obj: unknown, key: string): T | undefined {
	if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
		return (obj as Record<string, unknown>)[key] as T
	}
	return undefined
}

// ---------------------------------------------------------------- Turso ------
async function verifyTurso(token: string): Promise<TCheck[]> {
	const base = 'https://api.turso.tech/v1'
	const auth = { Authorization: `Bearer ${token}` }
	const checks: TCheck[] = []

	const orgsRes = await fetch(`${base}/organizations`, { headers: auth })
	const orgs = await readJson(orgsRes)
	checks.push(
		expect(
			orgsRes.ok,
			'turso GET /organizations → 2xx',
			`HTTP ${orgsRes.status} ${preview(orgs)}`
		)
	)
	const slug = Array.isArray(orgs) ? get<string>(orgs[0], 'slug') : undefined
	checks.push(
		expect(
			!!slug,
			'turso org has { slug }',
			`first org: ${preview(Array.isArray(orgs) ? orgs[0] : orgs)}`
		)
	)
	if (!slug) return checks

	const dbRes = await fetch(`${base}/organizations/${slug}/databases`, { headers: auth })
	const dbBody = await readJson(dbRes)
	const databases = get<unknown[]>(dbBody, 'databases')
	checks.push(
		expect(
			dbRes.ok && Array.isArray(databases),
			'turso databases → { databases: [...] }',
			`HTTP ${dbRes.status} ${preview(dbBody)}`
		)
	)
	const db0 = databases?.[0]
	if (db0) {
		// PascalCase fields are the historical landmine here.
		checks.push(
			expect(
				!!get(db0, 'Name') && !!get(db0, 'Hostname'),
				'turso db has PascalCase { Name, Hostname }',
				preview(db0)
			)
		)
	}

	if (MINT && db0) {
		const name = get<string>(db0, 'Name')
		const tokRes = await fetch(`${base}/organizations/${slug}/databases/${name}/auth/tokens`, {
			method: 'POST',
			headers: auth
		})
		const tokBody = await readJson(tokRes)
		checks.push(
			expect(
				tokRes.ok && !!get(tokBody, 'jwt'),
				'turso mint token → { jwt }',
				`HTTP ${tokRes.status} ${preview(tokBody)}`
			)
		)
	}
	return checks
}

// ----------------------------------------------------------------- Neon ------
async function verifyNeon(token: string): Promise<TCheck[]> {
	const base = 'https://console.neon.tech/api/v2'
	const auth = { Authorization: `Bearer ${token}` }
	const checks: TCheck[] = []

	const projRes = await fetch(`${base}/projects`, { headers: auth })
	const projBody = await readJson(projRes)
	const projects = get<unknown[]>(projBody, 'projects')
	checks.push(
		expect(
			projRes.ok && Array.isArray(projects),
			'neon GET /projects → { projects: [...] }',
			`HTTP ${projRes.status} ${preview(projBody)}`
		)
	)
	const projectId = projects?.[0] ? get<string>(projects[0], 'id') : undefined
	if (!projectId) return checks

	const brRes = await fetch(`${base}/projects/${projectId}/branches`, { headers: auth })
	const brBody = await readJson(brRes)
	const branches = get<Array<Record<string, unknown>>>(brBody, 'branches')
	checks.push(
		expect(
			brRes.ok && Array.isArray(branches),
			'neon branches → { branches: [...] }',
			`HTTP ${brRes.status} ${preview(brBody)}`
		)
	)
	// Rust picks the branch flagged `default` (alias `primary`).
	const defaultBranch =
		branches?.find((b) => b.default === true || b.primary === true) ?? branches?.[0]
	const branchId = defaultBranch ? get<string>(defaultBranch, 'id') : undefined
	checks.push(
		expect(!!branchId, 'neon has a default/primary branch with { id }', preview(defaultBranch))
	)
	if (!branchId) return checks

	const dbRes = await fetch(`${base}/projects/${projectId}/branches/${branchId}/databases`, {
		headers: auth
	})
	const dbBody = await readJson(dbRes)
	const databases = get<Array<Record<string, unknown>>>(dbBody, 'databases')
	const db0 = databases?.[0]
	checks.push(
		expect(
			dbRes.ok && !!db0 && !!get(db0, 'name') && !!get(db0, 'owner_name'),
			'neon db has { name, owner_name }',
			`HTTP ${dbRes.status} ${preview(dbBody)}`
		)
	)

	if (MINT && db0) {
		const params = new URLSearchParams({
			branch_id: branchId,
			database_name: String(get(db0, 'name')),
			role_name: String(get(db0, 'owner_name')),
			pooled: 'true'
		})
		const uriRes = await fetch(`${base}/projects/${projectId}/connection_uri?${params}`, {
			headers: auth
		})
		const uriBody = await readJson(uriRes)
		checks.push(
			expect(
				uriRes.ok && !!get(uriBody, 'uri'),
				'neon connection_uri → { uri }',
				`HTTP ${uriRes.status} ${preview(uriBody)}`
			)
		)
	}
	return checks
}

// ----------------------------------------------------------------- main ------
async function main() {
	const providers: Array<{
		name: string
		token?: string
		run: (t: string) => Promise<TCheck[]>
	}> = [
		{ name: 'Turso', token: process.env.TURSO_TOKEN, run: verifyTurso },
		{ name: 'Neon', token: process.env.NEON_TOKEN, run: verifyNeon }
	]

	console.log(
		`\nProvider verification harness${MINT ? ' (--mint: will create real credentials)' : ' (read-only; pass --mint to test credential creation)'}\n`
	)
	let anyRun = false
	let anyFail = false

	for (const provider of providers) {
		if (!provider.token) {
			console.log(`• ${provider.name}: skipped (no token)`)
			continue
		}
		anyRun = true
		console.log(`\n=== ${provider.name} ===`)
		let checks: TCheck[]
		try {
			checks = await provider.run(provider.token)
		} catch (error) {
			anyFail = true
			console.log(`  ✗ threw: ${error instanceof Error ? error.message : String(error)}`)
			continue
		}
		for (const check of checks) {
			if (!check.ok) anyFail = true
			console.log(`  ${check.ok ? '✓' : '✗'} ${check.name}`)
			if (!check.ok) console.log(`      ↳ ${check.detail}`)
		}
	}

	if (!anyRun) {
		console.log('\nNo tokens provided. Set TURSO_TOKEN / NEON_TOKEN.\n')
		process.exit(2)
	}
	console.log(
		anyFail
			? '\nRESULT: mismatches found — see ✗ lines above.\n'
			: '\nRESULT: all checks passed.\n'
	)
	process.exit(anyFail ? 1 : 0)
}

void main()
