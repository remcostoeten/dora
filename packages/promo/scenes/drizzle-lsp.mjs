/** @type {import("../src/runner.mjs").Scene} */
export default {
	name: 'drizzle-lsp',
	url: { view: 'sql-console', connection: 'demo-ecommerce-001' },
	mode: 'drizzle',
	size: { width: 1600, height: 900 },
	editor: { fontSize: 18, lineHeight: 30 },
	closeRightSidebar: true,
	leadInMs: 600,
	defaultDelay: 95,
	steps: [
		{ type: 'db.select().from(', holdAfter: 1300, caption: 'Schema-aware table completion' },
		{ type: 'ord', delay: 150, holdAfter: 1500 },
		{ key: 'Enter', holdAfter: 700 },
		{ type: 'w', delay: 160, holdAfter: 1500, caption: 'Chain-method completion' },
		{ key: 'Enter', holdAfter: 700 },
		{
			type: 'eq(orders.',
			delay: 100,
			holdAfter: 1600,
			caption: 'Type-aware column completion'
		},
		{ type: 'tot', delay: 150, holdAfter: 1400 },
		{ key: 'Enter', holdAfter: 700 },
		{ type: ', 100)', delay: 100, holdAfter: 900 },
		{ key: 'Escape', holdAfter: 2400 }
	],
	expect: 'db.select().from(orders).where(eq(orders.total, 100))'
}
