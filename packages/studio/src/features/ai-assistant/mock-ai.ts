type StreamTextOptions = {
	text: string
	onToken: (token: string) => void
	isCancelled?: () => boolean
	delayMs?: number
	chunkSize?: number
}

const DEMO_TABLES: Record<string, string[]> = {
	'demo-ecommerce-001': ['customers', 'orders', 'order_items', 'products', 'inventory'],
	'demo-blog-002': ['users', 'posts', 'comments', 'tags', 'page_views'],
	'demo-analytics-003': ['page_views', 'api_logs', 'email_campaigns'],
	'demo-hr-004': ['employees', 'audit_logs', 'support_tickets']
}

function wait(ms: number): Promise<void> {
	return new Promise(function (resolve) {
		window.setTimeout(resolve, ms)
	})
}

export async function streamMockText({
	text,
	onToken,
	isCancelled,
	delayMs = 22,
	chunkSize = 12
}: StreamTextOptions): Promise<void> {
	for (let index = 0; index < text.length; index += chunkSize) {
		if (isCancelled?.()) return
		onToken(text.slice(index, index + chunkSize))
		await wait(delayMs)
	}
}

export function buildMockChatResponse(prompt: string, connectionId: string | null): string {
	const lower = prompt.toLowerCase()
	const tables = DEMO_TABLES[connectionId ?? ''] ?? DEMO_TABLES['demo-ecommerce-001']
	const primaryTable = tables[0]

	if (lower.includes('join')) {
		return [
			'Here is a schema-aware join you can try in the demo database:',
			'',
			'```sql',
			'SELECT',
			'  c.id,',
			'  c.email,',
			'  COUNT(o.id) AS order_count,',
			'  SUM(o.total_amount) AS lifetime_value',
			'FROM customers c',
			'LEFT JOIN orders o ON o.customer_id = c.id',
			'GROUP BY c.id, c.email',
			'ORDER BY lifetime_value DESC NULLS LAST',
			'LIMIT 25;',
			'```',
			'',
			'In the web demo this is mocked, so it is meant to demonstrate the assistant flow and generated SQL actions.'
		].join('\n')
	}

	if (lower.includes('index') || lower.includes('optimize') || lower.includes('faster')) {
		return [
			'Before adding indexes, check what already exists on the table (PK/unique constraints create indexes too).',
			'',
			'If a slow query is proven, start with diagnostics:',
			'',
			'```sql',
			'EXPLAIN ANALYZE',
			'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50;',
			'```',
			'',
			'Only add a new index when the plan shows a sequential scan on a large table and no existing index covers the filter/order columns.'
		].join('\n')
	}

	if (lower.includes('insert') || lower.includes('seed')) {
		return [
			'Here is a compact seed example for the demo data:',
			'',
			'```sql',
			"INSERT INTO products (name, sku, price, status) VALUES",
			"  ('Desk Lamp Pro', 'LAMP-PRO-001', 89.00, 'active'),",
			"  ('Cable Organizer', 'ORG-CBL-002', 19.50, 'active'),",
			"  ('Notebook Stand', 'STAND-NB-003', 54.25, 'active');",
			'```'
		].join('\n')
	}

	if (lower.includes('schema') || lower.includes('efficient') || lower.includes('improve')) {
		return [
			`From the connected schema (${tables.join(', ')}), a quick review:`,
			'',
			'**Already reasonable** — normalized FK relationships and typical PK/index patterns are fine for an app database.',
			'**Worth investigating** — run `EXPLAIN ANALYZE` on your slowest list/search queries before changing structure.',
			'**Probably skip** — partitioning, message queues, removing denormalized summary columns, or splitting JSONB settings into many tables unless you have measured pain.',
			'',
			'In the web demo this is mocked; in desktop Dora the assistant sees indexes from your live schema and avoids duplicate index advice.'
		].join('\n')
	}

	return [
		'Here is a useful starting query for the current demo connection:',
		'',
		'```sql',
		`SELECT * FROM ${primaryTable} LIMIT 10;`,
		'```',
		'',
		'The browser demo uses a deterministic mock response, so no API key or network model call is required.'
	].join('\n')
}

export function buildMockAiStatus(): import('@studio/lib/bindings').AiStatus {
	return {
		active_provider: 'mock',
		active_model: 'demo-assistant',
		ready: true,
		providers: [
			{
				provider: 'mock',
				ready: true,
				detail: 'Deterministic web demo responses',
				key_count: null
			},
			{
				provider: 'groq',
				ready: true,
				detail: 'Simulated in browser demo',
				key_count: 1
			},
			{
				provider: 'openai',
				ready: true,
				detail: 'Simulated in browser demo',
				key_count: 1
			},
			{
				provider: 'anthropic',
				ready: true,
				detail: 'Simulated in browser demo',
				key_count: 1
			},
			{
				provider: 'ollama',
				ready: true,
				detail: 'Simulated local model catalog',
				key_count: null
			},
			{
				provider: 'gemini',
				ready: false,
				detail: 'Not configured in demo',
				key_count: null
			}
		]
	}
}

type MockModelEntry = [id: string, label: string, tier: string]

const MOCK_OPENAI: MockModelEntry[] = [
	['gpt-5.5', 'GPT-5.5', 'flagship'],
	['gpt-5.5-pro', 'GPT-5.5 Pro', 'flagship'],
	['gpt-5.2', 'GPT-5.2', 'balanced'],
	['gpt-5.4', 'GPT-5.4', 'balanced'],
	['gpt-4.1', 'GPT-4.1', 'balanced'],
	['gpt-5.4-mini', 'GPT-5.4 mini', 'fast'],
	['gpt-4o-mini', 'GPT-4o mini', 'fast']
]

const MOCK_ANTHROPIC: MockModelEntry[] = [
	['claude-opus-4-8', 'Claude Opus 4.8', 'flagship'],
	['claude-opus-4-7', 'Claude Opus 4.7', 'flagship'],
	['claude-opus-4-6', 'Claude Opus 4.6', 'flagship'],
	['claude-sonnet-4-6', 'Claude Sonnet 4.6', 'balanced'],
	['claude-sonnet-4-5', 'Claude Sonnet 4.5', 'balanced'],
	['claude-haiku-4-5', 'Claude Haiku 4.5', 'fast']
]

const MOCK_GROQ: MockModelEntry[] = [
	['llama-3.3-70b-versatile', 'Llama 3.3 70B', 'flagship'],
	['llama-3.1-70b-versatile', 'Llama 3.1 70B', 'balanced'],
	['llama-3.1-8b-instant', 'Llama 3.1 8B', 'fast']
]

const MOCK_GEMINI: MockModelEntry[] = [
	['gemini-2.5-pro', 'Gemini 2.5 Pro', 'flagship'],
	['gemini-2.5-flash', 'Gemini 2.5 Flash', 'balanced'],
	['gemini-2.0-flash', 'Gemini 2.0 Flash', 'fast']
]

function entriesToOptions(entries: MockModelEntry[]): import('@studio/lib/bindings').AiModelOption[] {
	return entries.map(function ([id, label, tier]) {
		return { id, label, tier }
	})
}

export function buildMockProviderModels(
	provider: string
): import('@studio/lib/bindings').AiModelOption[] {
	switch (provider) {
		case 'openai':
			return entriesToOptions(MOCK_OPENAI)
		case 'anthropic':
			return entriesToOptions(MOCK_ANTHROPIC)
		case 'groq':
			return entriesToOptions(MOCK_GROQ)
		case 'gemini':
			return entriesToOptions(MOCK_GEMINI)
		case 'ollama':
			return buildMockOllamaCatalog().map(function (entry) {
				return {
					id: entry.name,
					label: entry.label,
					tier: entry.installed ? 'installed' : 'available'
				}
			})
		case 'mock':
			return [{ id: 'demo-assistant', label: 'Demo assistant', tier: 'flagship' }]
		default:
			return []
	}
}

export function buildMockAiUsageSummary(): import('@studio/lib/bindings').AiUsageSummary {
	const now = Math.floor(Date.now() / 1000)
	return {
		total_requests: 6,
		input_tokens: 18_400,
		output_tokens: 6_250,
		total_tokens: 24_650,
		estimated_cost_usd: 0.42,
		providers: [
			{
				provider: 'anthropic',
				request_count: 3,
				input_tokens: 10_200,
				output_tokens: 3_800,
				total_tokens: 14_000,
				estimated_cost_usd: 0.28
			},
			{
				provider: 'openai',
				request_count: 2,
				input_tokens: 6_900,
				output_tokens: 1_950,
				total_tokens: 8_850,
				estimated_cost_usd: 0.12
			},
			{
				provider: 'groq',
				request_count: 1,
				input_tokens: 1_300,
				output_tokens: 500,
				total_tokens: 1_800,
				estimated_cost_usd: 0.02
			}
		],
		recent: [
			{
				id: 3,
				provider: 'anthropic',
				model: 'claude-sonnet-4-6',
				source: 'chat',
				input_tokens: 4200,
				output_tokens: 980,
				total_tokens: 5180,
				estimated_cost_usd: 0.09,
				estimated: true,
				created_at: now - 3600
			},
			{
				id: 2,
				provider: 'openai',
				model: 'gpt-5.5',
				source: 'sql_gen',
				input_tokens: 1800,
				output_tokens: 420,
				total_tokens: 2220,
				estimated_cost_usd: 0.05,
				estimated: true,
				created_at: now - 7200
			},
			{
				id: 1,
				provider: 'groq',
				model: 'llama-3.3-70b-versatile',
				source: 'key_test',
				input_tokens: 12,
				output_tokens: 2,
				total_tokens: 14,
				estimated_cost_usd: 0.0,
				estimated: true,
				created_at: now - 86400
			}
		]
	}
}

export function buildMockOllamaCatalog(): import('@studio/lib/bindings').OllamaCatalogEntry[] {
	return [
		{
			name: 'llama3.2',
			label: 'Llama 3.2',
			description: 'Simulated recommended model in the web demo.',
			installed: true,
			size_bytes: 1_500_000_000
		},
		{
			name: 'qwen2.5-coder:7b',
			label: 'Qwen 2.5 Coder',
			description: 'Simulated SQL-focused model.',
			installed: false,
			size_bytes: null
		},
		{
			name: 'deepseek-r1:7b',
			label: 'DeepSeek R1',
			description: 'Simulated reasoning model.',
			installed: false,
			size_bytes: null
		}
	]
}

export function buildMockOllamaStatus(): import('@studio/lib/bindings').OllamaStatus {
	return {
		running: true,
		endpoint: 'http://127.0.0.1:11434',
		version: 'demo',
		installed_count: 1,
		managed: false,
		install_path: null,
		binary_ready: false
	}
}

type MockOllamaPullOptions = {
	model: string
	onEvent: (event: import('@studio/lib/bindings').OllamaPullEvent) => void
	isCancelled?: () => boolean
}

export async function streamMockOllamaPull({
	model,
	onEvent,
	isCancelled
}: MockOllamaPullOptions): Promise<void> {
	const total = 1_500_000_000
	onEvent({ type: 'status', message: `Pulling ${model}…` })

	for (let completed = 0; completed < total; completed += 75_000_000) {
		if (isCancelled?.()) return
		const next = Math.min(total, completed + 75_000_000)
		onEvent({
			type: 'progress',
			completed: next,
			total,
			percent: (next / total) * 100,
			eta_seconds: Math.max(0, Math.round((total - next) / 120_000_000))
		})
		await wait(180)
	}

	onEvent({ type: 'done', model })
}

export function buildMockSqlJson(prompt: string, connectionId: string | null): string {
	const lower = prompt.toLowerCase()
	const tables = DEMO_TABLES[connectionId ?? ''] ?? DEMO_TABLES['demo-ecommerce-001']

	if (lower.includes('last week') || lower.includes('signed up')) {
		return JSON.stringify({
			sql: [
				'SELECT id, email, created_at, last_login_at',
				'FROM customers',
				"WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'",
				'  AND last_login_at IS NULL',
				'ORDER BY created_at DESC',
				'LIMIT 50;'
			].join('\n'),
			explanation:
				'Finds recently created customers who have not logged in yet, sorted newest first.',
			warnings: ['Mock result generated in the web demo. Review column names before running.']
		})
	}

	if (lower.includes('join')) {
		return JSON.stringify({
			sql: [
				'SELECT c.email, COUNT(o.id) AS order_count, SUM(o.total_amount) AS total_spend',
				'FROM customers c',
				'JOIN orders o ON o.customer_id = c.id',
				'GROUP BY c.email',
				'ORDER BY total_spend DESC',
				'LIMIT 25;'
			].join('\n'),
			explanation: 'Aggregates customer order activity and total spend.',
			warnings: ['Mock result generated in the web demo.']
		})
	}

	if (lower.includes('count')) {
		return JSON.stringify({
			sql: tables
				.slice(0, 3)
				.map(function (table) {
					return `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM ${table}`
				})
				.join('\nUNION ALL\n'),
			explanation: 'Compares row counts across the first few demo tables.',
			warnings: []
		})
	}

	return JSON.stringify({
		sql: `SELECT * FROM ${tables[0]} LIMIT 10;`,
		explanation: 'Returns a small sample from the current demo table.',
		warnings: ['Mock result generated in the web demo.']
	})
}
