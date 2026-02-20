import type { SavedQuery } from '@/lib/bindings'

export const MOCK_SCRIPTS: SavedQuery[] = [
	{
		id: 1,
		name: 'Welcome Query',
		description: 'A simple welcome query to get you started',
		query_text: "SELECT 'Hello from Mock Adapter!' as message;",
		connection_id: null,
		tags: 'intro,demo',
		category: 'General',
		created_at: Date.now() - 86400000,
		updated_at: Date.now() - 86400000,
		favorite: true,
		is_snippet: true,
		is_system: true,
		language: 'sql',
		folder_id: null
	},
	{
		id: 2,
		name: 'Get All Customers',
		description: 'Fetch all customers from the database',
		query_text: 'SELECT * FROM customers;',
		connection_id: 'demo-ecommerce-001',
		tags: 'ecommerce,query',
		category: 'Reports',
		created_at: Date.now() - 3600000,
		updated_at: Date.now() - 3600000,
		favorite: false,
		is_snippet: true,
		is_system: false,
		language: 'sql',
		folder_id: null
	},
	{
		id: 3,
		name: 'Expensive Products',
		description: 'List products with price > 100',
		query_text: 'SELECT * FROM products WHERE price > 100 ORDER BY price DESC;',
		connection_id: 'demo-ecommerce-001',
		tags: 'ecommerce,products',
		category: 'Analysis',
		created_at: Date.now() - 1800000,
		updated_at: Date.now() - 1800000,
		favorite: true,
		is_snippet: true,
		is_system: false,
		language: 'sql',
		folder_id: null
	}
]
