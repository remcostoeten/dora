import { SqlSnippet, SqlQueryResult, TableInfo } from './types'

// Mock snippets data
export const MOCK_SNIPPETS: SqlSnippet[] = [
	{
		id: 'playground',
		name: 'Playground',
		content: 'SELECT * FROM customers LIMIT 10;',
		createdAt: new Date(),
		updatedAt: new Date()
	},
	{
		id: 'folder-1',
		name: 'German Customers',
		content: '',
		createdAt: new Date(),
		updatedAt: new Date(),
		isFolder: true,
		parentId: null
	},
	{
		id: 'scratch-1',
		name: 'SQL scratch #1',
		content: "SELECT id, company_name, city FROM customers WHERE country = 'Germany';",
		createdAt: new Date(),
		updatedAt: new Date(),
		parentId: 'folder-1'
	},
	{
		id: 'scratch-2',
		name: 'SQL scratch #2',
		content: 'SELECT * FROM orders WHERE freight > 50 ORDER BY order_date DESC;',
		createdAt: new Date(),
		updatedAt: new Date()
	}
]

// Mock tables for the schema browser
export const MOCK_TABLES: TableInfo[] = [
	{
		name: 'categories',
		type: 'table',
		rowCount: 8,
		columns: [
			{ name: 'category_id', type: 'serial', primaryKey: true },
			{ name: 'category_name', type: 'varchar(15)', nullable: false },
			{ name: 'description', type: 'text', nullable: true },
			{ name: 'picture', type: 'bytea', nullable: true }
		]
	},
	{
		name: 'customers',
		type: 'table',
		rowCount: 93,
		columns: [
			{ name: 'id', type: 'serial', nullable: false, primaryKey: true },
			{ name: 'company_name', type: 'varchar(40)', nullable: false },
			{ name: 'contact_name', type: 'varchar(30)', nullable: true },
			{ name: 'contact_title', type: 'varchar(30)', nullable: true },
			{ name: 'address', type: 'varchar(60)', nullable: true },
			{ name: 'city', type: 'varchar(15)', nullable: true },
			{ name: 'region', type: 'varchar(15)', nullable: true },
			{ name: 'postal_code', type: 'varchar(10)', nullable: true },
			{ name: 'country', type: 'varchar(15)', nullable: true },
			{ name: 'phone', type: 'varchar(24)', nullable: true },
			{ name: 'fax', type: 'varchar(24)', nullable: true }
		]
	},
	{
		name: 'employee_territories',
		type: 'table',
		rowCount: 49,
		columns: [
			{ name: 'employee_id', type: 'integer', nullable: false, primaryKey: true },
			{ name: 'territory_id', type: 'varchar(20)', nullable: false, primaryKey: true }
		]
	},
	{
		name: 'employees',
		type: 'table',
		rowCount: 9,
		columns: [
			{ name: 'employee_id', type: 'serial', primaryKey: true },
			{ name: 'last_name', type: 'varchar(20)', nullable: false },
			{ name: 'first_name', type: 'varchar(10)', nullable: false },
			{ name: 'title', type: 'varchar(30)', nullable: true },
			{ name: 'title_of_courtesy', type: 'varchar(25)', nullable: true },
			{ name: 'birth_date', type: 'date', nullable: true },
			{ name: 'hire_date', type: 'date', nullable: true },
			{ name: 'address', type: 'varchar(60)', nullable: true },
			{ name: 'city', type: 'varchar(15)', nullable: true }
		]
	},
	{
		name: 'order_details',
		type: 'table',
		rowCount: 2155,
		columns: [
			{ name: 'order_id', type: 'integer', nullable: false, primaryKey: true },
			{ name: 'product_id', type: 'integer', nullable: false, primaryKey: true },
			{ name: 'unit_price', type: 'decimal(10,2)', nullable: false },
			{ name: 'quantity', type: 'smallint', nullable: false },
			{ name: 'discount', type: 'real', nullable: false }
		]
	},
	{
		name: 'orders',
		type: 'table',
		rowCount: 830,
		columns: [
			{ name: 'id', type: 'serial', nullable: false, primaryKey: true },
			{ name: 'customer_id', type: 'integer', nullable: false },
			{ name: 'employee_id', type: 'integer', nullable: true },
			{ name: 'order_date', type: 'timestamp', nullable: true },
			{ name: 'required_date', type: 'timestamp', nullable: true },
			{ name: 'shipped_date', type: 'timestamp', nullable: true },
			{ name: 'ship_via', type: 'integer', nullable: true },
			{ name: 'freight', type: 'decimal(10,2)', nullable: true }
		]
	},
	{
		name: 'products',
		type: 'table',
		rowCount: 77,
		columns: [
			{ name: 'id', type: 'serial', nullable: false, primaryKey: true },
			{ name: 'name', type: 'varchar(40)', nullable: false },
			{ name: 'supplier_id', type: 'integer', nullable: true },
			{ name: 'category_id', type: 'integer', nullable: true },
			{ name: 'quantity_per_unit', type: 'varchar(20)', nullable: true },
			{ name: 'unit_price', type: 'decimal(10,2)', nullable: true },
			{ name: 'units_in_stock', type: 'smallint', nullable: true },
			{ name: 'discontinued', type: 'boolean', nullable: false, defaultValue: 'false' }
		]
	},
	{
		name: 'regions',
		type: 'table',
		rowCount: 4,
		columns: [
			{ name: 'region_id', type: 'integer', primaryKey: true },
			{ name: 'region_description', type: 'varchar(50)' }
		]
	},
	{
		name: 'shippers',
		type: 'table',
		rowCount: 3,
		columns: [
			{ name: 'shipper_id', type: 'serial', primaryKey: true },
			{ name: 'company_name', type: 'varchar(40)' }
		]
	},
	{
		name: 'suppliers',
		type: 'table',
		rowCount: 29,
		columns: [
			{ name: 'supplier_id', type: 'serial', primaryKey: true },
			{ name: 'company_name', type: 'varchar(40)' }
		]
	},
	{
		name: 'territories',
		type: 'table',
		rowCount: 53,
		columns: [
			{ name: 'territory_id', type: 'varchar(20)', primaryKey: true },
			{ name: 'territory_description', type: 'varchar(50)' }
		]
	},
	{ name: 'customer_and_supplie...', type: 'view', rowCount: 122, columns: [] },
	{ name: 'invoices', type: 'view', rowCount: 2155, columns: [] }
]

export const DEFAULT_SQL = `-- Write your SQL query here
-- Select a table from the sidebar to get started`

// Simulate SQL query execution
export async function executeSqlQuery(sql: string): Promise<SqlQueryResult> {
	await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500))

	const upperSql = sql.toUpperCase().trim()

	// Detect query type
	let queryType: SqlQueryResult['queryType'] = 'OTHER'
	if (upperSql.startsWith('SELECT')) queryType = 'SELECT'
	else if (upperSql.startsWith('INSERT')) queryType = 'INSERT'
	else if (upperSql.startsWith('UPDATE')) queryType = 'UPDATE'
	else if (upperSql.startsWith('DELETE')) queryType = 'DELETE'

	// Handle syntax errors
	if (!sql.trim() || sql.trim() === '--') {
		return {
			columns: [],
			rows: [],
			rowCount: 0,
			executionTime: 0,
			error: 'Empty query',
			queryType: 'OTHER'
		}
	}

	// Mock responses based on query content
	if (upperSql.includes('FROM CUSTOMERS')) {
		return {
			columns: ['id', 'company_name', 'contact_name', 'city', 'country', 'phone'],
			rows: [
				{
					id: 'ALFKI',
					company_name: 'Alfreds Futterkiste',
					contact_name: 'Maria Anders',
					city: 'Berlin',
					country: 'Germany',
					phone: '030-0074321'
				},
				{
					id: 'ANATR',
					company_name: 'Ana Trujillo Emparedados',
					contact_name: 'Ana Trujillo',
					city: 'México D.F.',
					country: 'Mexico',
					phone: '(5) 555-4729'
				},
				{
					id: 'ANTON',
					company_name: 'Antonio Moreno Taquería',
					contact_name: 'Antonio Moreno',
					city: 'México D.F.',
					country: 'Mexico',
					phone: '(5) 555-3932'
				},
				{
					id: 'AROUT',
					company_name: 'Around the Horn',
					contact_name: 'Thomas Hardy',
					city: 'London',
					country: 'UK',
					phone: '(171) 555-7788'
				},
				{
					id: 'BERGS',
					company_name: 'Berglunds snabbköp',
					contact_name: 'Christina Berglund',
					city: 'Luleå',
					country: 'Sweden',
					phone: '0921-12 34 65'
				},
				{
					id: 'BLAUS',
					company_name: 'Blauer See Delikatessen',
					contact_name: 'Hanna Moos',
					city: 'Mannheim',
					country: 'Germany',
					phone: '0621-08460'
				},
				{
					id: 'BLONP',
					company_name: 'Blondesddsl père et fils',
					contact_name: 'Frédérique Citeaux',
					city: 'Strasbourg',
					country: 'France',
					phone: '88.60.15.31'
				},
				{
					id: 'BOLID',
					company_name: 'Bólido Comidas preparadas',
					contact_name: 'Martín Sommer',
					city: 'Madrid',
					country: 'Spain',
					phone: '(91) 555 22 82'
				}
			],
			rowCount: 8,
			executionTime: 13,
			queryType
		}
	}

	if (upperSql.includes('FROM ORDERS')) {
		return {
			columns: [
				'order_id',
				'customer_id',
				'employee_id',
				'order_date',
				'shipped_date',
				'freight'
			],
			rows: [
				{
					order_id: 10248,
					customer_id: 'VINET',
					employee_id: 5,
					order_date: '1996-07-04',
					shipped_date: '1996-07-16',
					freight: 32.38
				},
				{
					order_id: 10249,
					customer_id: 'TOMSP',
					employee_id: 6,
					order_date: '1996-07-05',
					shipped_date: '1996-07-10',
					freight: 11.61
				},
				{
					order_id: 10250,
					customer_id: 'HANAR',
					employee_id: 4,
					order_date: '1996-07-08',
					shipped_date: '1996-07-12',
					freight: 65.83
				},
				{
					order_id: 10251,
					customer_id: 'VICTE',
					employee_id: 3,
					order_date: '1996-07-08',
					shipped_date: '1996-07-15',
					freight: 41.34
				},
				{
					order_id: 10252,
					customer_id: 'SUPRD',
					employee_id: 4,
					order_date: '1996-07-09',
					shipped_date: '1996-07-11',
					freight: 51.3
				}
			],
			rowCount: 5,
			executionTime: 8,
			queryType
		}
	}

	if (upperSql.includes('FROM PRODUCTS')) {
		return {
			columns: ['product_id', 'product_name', 'unit_price', 'units_in_stock', 'discontinued'],
			rows: [
				{
					product_id: 1,
					product_name: 'Chai',
					unit_price: 18.0,
					units_in_stock: 39,
					discontinued: false
				},
				{
					product_id: 2,
					product_name: 'Chang',
					unit_price: 19.0,
					units_in_stock: 17,
					discontinued: false
				},
				{
					product_id: 3,
					product_name: 'Aniseed Syrup',
					unit_price: 10.0,
					units_in_stock: 13,
					discontinued: false
				}
			],
			rowCount: 3,
			executionTime: 6,
			queryType
		}
	}

	// Default empty response
	return {
		columns: [],
		rows: [],
		rowCount: 0,
		executionTime: 5,
		queryType
	}
}

// Format SQL for prettify
export function prettifySql(sql: string): string {
	const keywords = [
		'SELECT',
		'FROM',
		'WHERE',
		'AND',
		'OR',
		'ORDER BY',
		'GROUP BY',
		'HAVING',
		'LIMIT',
		'OFFSET',
		'JOIN',
		'LEFT JOIN',
		'RIGHT JOIN',
		'INNER JOIN',
		'ON',
		'AS',
		'INSERT INTO',
		'VALUES',
		'UPDATE',
		'SET',
		'DELETE FROM'
	]

	let formatted = sql.trim()

	// Add newlines before major keywords
	keywords.forEach((kw) => {
		const regex = new RegExp(`\\b${kw}\\b`, 'gi')
		formatted = formatted.replace(regex, `\n${kw}`)
	})

	// Clean up multiple newlines
	formatted = formatted.replace(/\n\n+/g, '\n').trim()

	return formatted
}
