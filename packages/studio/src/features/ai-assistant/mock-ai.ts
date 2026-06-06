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
			'I would start by indexing the columns used for joins and filters:',
			'',
			'```sql',
			'CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);',
			'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);',
			'```',
			'',
			'Check the query plan after adding them, because write-heavy tables pay a small cost for every extra index.'
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

	if (lower.includes('schema')) {
		return [
			`This demo connection exposes tables such as ${tables.join(', ')}.`,
			'',
			'The strongest next step is usually to identify high-traffic relationships, then add indexes around foreign keys and timestamp filters.'
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
