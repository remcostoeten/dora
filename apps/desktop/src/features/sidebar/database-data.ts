import { ColumnDefinition } from "../database-studio/types";

export const MOCK_TABLE_COLUMNS: Record<string, ColumnDefinition[]> = {
	// Ecommerce - Public schema
	'ecommerce_db.public.customers': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'email', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'first_name', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'last_name', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'phone', type: 'varchar(20)', nullable: true, primaryKey: false },
		{ name: 'city', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'country', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'total_orders', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'total_spent', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'last_login', type: 'timestamp', nullable: true, primaryKey: false }
	],
	'ecommerce_db.public.orders': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'customer_id', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'order_number', type: 'varchar(50)', nullable: false, primaryKey: false },
		{ name: 'status', type: 'varchar(20)', nullable: false, primaryKey: false },
		{ name: 'subtotal', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'tax', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'shipping', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'total', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'order_date', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'shipped_date', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'delivered_date', type: 'timestamp', nullable: true, primaryKey: false }
	],
	'ecommerce_db.public.products': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'sku', type: 'varchar(50)', nullable: false, primaryKey: false },
		{ name: 'name', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'description', type: 'text', nullable: true, primaryKey: false },
		{ name: 'category_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'price', type: 'decimal(10,2)', nullable: false, primaryKey: false },
		{ name: 'cost_price', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'stock_quantity', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'weight', type: 'decimal(8,2)', nullable: true, primaryKey: false },
		{ name: 'active', type: 'boolean', nullable: false, primaryKey: false }
	],
	'ecommerce_db.public.categories': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'name', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'slug', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'description', type: 'text', nullable: true, primaryKey: false },
		{ name: 'parent_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'sort_order', type: 'integer', nullable: true, primaryKey: false }
	],
	'ecommerce_db.auth.users': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'customer_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'email', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'password_hash', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'is_active', type: 'boolean', nullable: false, primaryKey: false },
		{ name: 'is_verified', type: 'boolean', nullable: false, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'last_login', type: 'timestamp', nullable: true, primaryKey: false }
	],
	'ecommerce_db.analytics.page_views': [
		{ name: 'id', type: 'bigint', nullable: false, primaryKey: true },
		{ name: 'session_id', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'user_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'page_url', type: 'varchar(500)', nullable: false, primaryKey: false },
		{ name: 'page_title', type: 'varchar(255)', nullable: true, primaryKey: false },
		{ name: 'referrer', type: 'varchar(500)', nullable: true, primaryKey: false },
		{ name: 'utm_source', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'utm_medium', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'device_type', type: 'varchar(50)', nullable: true, primaryKey: false },
		{ name: 'timestamp', type: 'timestamp', nullable: false, primaryKey: false }
	],
	'user_service.main.users': [
		{ name: 'id', type: 'bigint', nullable: false, primaryKey: true },
		{ name: 'uuid', type: 'char(36)', nullable: false, primaryKey: false },
		{ name: 'username', type: 'varchar(50)', nullable: false, primaryKey: false },
		{ name: 'email', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'avatar_url', type: 'varchar(500)', nullable: true, primaryKey: false },
		{ name: 'bio', type: 'text', nullable: true, primaryKey: false },
		{ name: 'followers_count', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'following_count', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'is_active', type: 'boolean', nullable: false, primaryKey: false },
		{ name: 'is_verified', type: 'boolean', nullable: false, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'updated_at', type: 'timestamp', nullable: false, primaryKey: false }
	],
	'user_service.audit.audit_logs': [
		{ name: 'id', type: 'bigint', nullable: false, primaryKey: true },
		{ name: 'user_id', type: 'bigint', nullable: true, primaryKey: false },
		{ name: 'action', type: 'varchar(100)', nullable: false, primaryKey: false },
		{ name: 'entity_type', type: 'varchar(50)', nullable: true, primaryKey: false },
		{ name: 'entity_id', type: 'bigint', nullable: true, primaryKey: false },
		{ name: 'ip_address', type: 'varchar(45)', nullable: true, primaryKey: false },
		{ name: 'user_agent', type: 'varchar(500)', nullable: true, primaryKey: false },
		{ name: 'metadata', type: 'jsonb', nullable: true, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false }
	],
	'content_cms.public.articles': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'slug', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'title', type: 'varchar(500)', nullable: false, primaryKey: false },
		{ name: 'excerpt', type: 'text', nullable: true, primaryKey: false },
		{ name: 'content', type: 'text', nullable: true, primaryKey: false },
		{ name: 'author_id', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'category_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'status', type: 'varchar(20)', nullable: false, primaryKey: false },
		{ name: 'published_at', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'view_count', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'featured', type: 'boolean', nullable: false, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'updated_at', type: 'timestamp', nullable: false, primaryKey: false }
	],
	'analytics_warehouse.analytics.dim_users': [
		{ name: 'user_id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'email', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'first_name', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'last_name', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'country', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'city', type: 'varchar(100)', nullable: true, primaryKey: false },
		{ name: 'signup_date', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'total_orders', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'total_revenue', type: 'decimal(10,2)', nullable: true, primaryKey: false },
		{ name: 'last_order_date', type: 'timestamp', nullable: true, primaryKey: false }
	],
	'analytics_warehouse.analytics.fct_orders': [
		{ name: 'order_id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'user_id', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'order_date', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'order_hour', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'status', type: 'varchar(20)', nullable: false, primaryKey: false },
		{ name: 'item_count', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'subtotal', type: 'decimal(10,2)', nullable: false, primaryKey: false },
		{ name: 'tax', type: 'decimal(10,2)', nullable: false, primaryKey: false },
		{ name: 'shipping', type: 'decimal(10,2)', nullable: false, primaryKey: false },
		{ name: 'total', type: 'decimal(10,2)', nullable: false, primaryKey: false },
		{ name: 'discount_amount', type: 'decimal(10,2)', nullable: true, primaryKey: false }
	],
	'task_manager.main.tasks': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'project_id', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'assignee_id', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'title', type: 'varchar(500)', nullable: false, primaryKey: false },
		{ name: 'description', type: 'text', nullable: true, primaryKey: false },
		{ name: 'status', type: 'varchar(50)', nullable: false, primaryKey: false },
		{ name: 'priority', type: 'varchar(20)', nullable: false, primaryKey: false },
		{ name: 'due_date', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'completed_at', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'estimated_hours', type: 'decimal(5,2)', nullable: true, primaryKey: false },
		{ name: 'actual_hours', type: 'decimal(5,2)', nullable: true, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
		{ name: 'updated_at', type: 'timestamp', nullable: false, primaryKey: false }
	],
	'task_manager.main.projects': [
		{ name: 'id', type: 'integer', nullable: false, primaryKey: true },
		{ name: 'name', type: 'varchar(255)', nullable: false, primaryKey: false },
		{ name: 'description', type: 'text', nullable: true, primaryKey: false },
		{ name: 'owner_id', type: 'integer', nullable: false, primaryKey: false },
		{ name: 'status', type: 'varchar(50)', nullable: false, primaryKey: false },
		{ name: 'start_date', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'end_date', type: 'timestamp', nullable: true, primaryKey: false },
		{ name: 'budget', type: 'decimal(12,2)', nullable: true, primaryKey: false },
		{ name: 'progress', type: 'integer', nullable: true, primaryKey: false },
		{ name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false }
	]
}

function generateCustomers(count: number): Record<string, unknown>[] {
const firstNames = [
	'James',
	'Mary',
	'John',
	'Patricia',
	'Robert',
	'Jennifer',
	'Michael',
	'Linda',
	'William',
	'Elizabeth',
	'David',
	'Barbara',
	'Richard',
	'Susan',
	'Joseph',
	'Jessica',
	'Thomas',
	'Sarah',
	'Charles',
	'Karen'
]
const lastNames = [
	'Smith',
	'Johnson',
	'Williams',
	'Brown',
	'Jones',
	'Garcia',
	'Miller',
	'Davis',
	'Rodriguez',
	'Martinez',
	'Hernandez',
	'Lopez',
	'Gonzalez',
	'Wilson',
	'Anderson',
	'Thomas',
	'Taylor',
	'Moore',
	'Jackson',
	'Martin'
]
const cities = [
	'New York',
	'Los Angeles',
	'Chicago',
	'Houston',
	'Phoenix',
	'Philadelphia',
	'San Antonio',
	'San Diego',
	'Dallas',
	'San Jose',
	'Austin',
	'Jacksonville',
	'Fort Worth',
	'Columbus',
	'San Francisco',
	'Charlotte',
	'Indianapolis',
	'Seattle',
	'Denver',
	'Washington'
]
const countries = [
	'USA',
	'Canada',
	'UK',
	'Germany',
	'France',
	'Australia',
	'Japan',
	'Spain',
	'Italy',
	'Netherlands'
]

return Array.from({ length: count }, (_, i) => {
	const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
	const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
	const totalOrders = Math.floor(Math.random() * 100)
	const avgOrderValue = 50 + Math.random() * 200

	return {
		id: i + 1,
		email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
		first_name: firstName,
		last_name: lastName,
		phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
		city: cities[Math.floor(Math.random() * cities.length)],
		country: countries[Math.floor(Math.random() * countries.length)],
		total_orders: totalOrders,
		total_spent: parseFloat((totalOrders * avgOrderValue).toFixed(2)),
		created_at: new Date(
			2020 + Math.floor(Math.random() * 5),
			Math.floor(Math.random() * 12),
			Math.floor(Math.random() * 28)
		).toISOString(),
		last_login: new Date(
			2024,
			Math.floor(Math.random() * 12),
			Math.floor(Math.random() * 28)
		).toISOString()
	}
})
}

function generateOrders(count: number, customerCount: number): Record<string, unknown>[] {
const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']

return Array.from({ length: count }, (_, i) => {
	const subtotal = 20 + Math.random() * 500
	const tax = subtotal * 0.1
	const shipping = Math.random() > 0.5 ? 0 : 5.99 + Math.random() * 15
	const orderDate = new Date(
		2024,
		Math.floor(Math.random() * 12),
		Math.floor(Math.random() * 28)
	)
	const status = statuses[Math.floor(Math.random() * statuses.length)]

	return {
		id: 10000 + i,
		customer_id: Math.floor(Math.random() * customerCount) + 1,
		order_number: `ORD-${(10000 + i).toString().padStart(6, '0')}`,
		status,
		subtotal: parseFloat(subtotal.toFixed(2)),
		tax: parseFloat(tax.toFixed(2)),
		shipping: parseFloat(shipping.toFixed(2)),
		total: parseFloat((subtotal + tax + shipping).toFixed(2)),
		order_date: orderDate.toISOString(),
		shipped_date:
			status === 'shipped' || status === 'delivered'
				? new Date(
						orderDate.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000
					).toISOString()
				: null,
		delivered_date:
			status === 'delivered'
				? new Date(
						orderDate.getTime() + (3 + Math.random() * 7) * 24 * 60 * 60 * 1000
					).toISOString()
				: null
	}
})
}

function generateProducts(count: number): Record<string, unknown>[] {
const categories = [
	{ id: 1, name: 'Electronics' },
	{ id: 2, name: 'Clothing' },
	{ id: 3, name: 'Home & Garden' },
	{ id: 4, name: 'Sports' },
	{ id: 5, name: 'Books' },
	{ id: 6, name: 'Toys' },
	{ id: 7, name: 'Food & Beverages' },
	{ id: 8, name: 'Beauty' }
]

const products = [
	'Wireless Headphones',
	'Smart Watch',
	'Laptop Stand',
	'USB-C Hub',
	'Mechanical Keyboard',
	'Running Shoes',
	'Yoga Mat',
	'Water Bottle',
	'Backpack',
	'T-Shirt',
	'Desk Lamp',
	'Plant Pot',
	'Wall Art',
	'Throw Pillow',
	'Coffee Maker',
	'Tennis Racket',
	'Basketball',
	'Soccer Ball',
	'Dumbbells',
	'Resistance Bands',
	'Fiction Novel',
	'Self-Help Book',
	'Cookbook',
	'Biography',
	'Science Fiction',
	'Building Blocks',
	'Board Game',
	'Stuffed Animal',
	'Art Kit',
	'Puzzle',
	'Coffee Beans',
	'Tea Set',
	'Chocolate Box',
	'Snack Pack',
	'Energy Bars',
	'Face Cream',
	'Shampoo',
	'Lipstick',
	'Perfume',
	'Hair Brush'
]

return Array.from({ length: count }, (_, i) => {
	const category = categories[Math.floor(Math.random() * categories.length)]
	const price = 10 + Math.random() * 200
	const costPrice = price * (0.3 + Math.random() * 0.3)

	return {
		id: i + 1,
		sku: `SKU-${(i + 1).toString().padStart(6, '0')}`,
		name: products[i % products.length],
		description: `High-quality ${products[i % products.length].toLowerCase()} with premium features`,
		category_id: category.id,
		price: parseFloat(price.toFixed(2)),
		cost_price: parseFloat(costPrice.toFixed(2)),
		stock_quantity: Math.floor(Math.random() * 500),
		weight: parseFloat((0.1 + Math.random() * 5).toFixed(2)),
		active: Math.random() > 0.1
	}
})
}

function generatePageViews(count: number, userCount: number): Record<string, unknown>[] {
const pages = [
	'/home',
	'/products',
	'/products/1',
	'/products/2',
	'/cart',
	'/checkout',
	'/about',
	'/contact',
	'/blog',
	'/blog/post-1',
	'/categories',
	'/search',
	'/account',
	'/account/orders',
	'/account/settings'
]
const referrers = [
	'https://google.com',
	'https://facebook.com',
	'https://twitter.com',
	null,
	'https://linkedin.com',
	'https://direct'
]
const utmSources = ['google', 'facebook', 'twitter', 'linkedin', 'email', null]
const utmMediums = ['organic', 'paid', 'social', 'referral', 'email', null]
const deviceTypes = ['desktop', 'mobile', 'tablet']

return Array.from({ length: count }, (_, i) => {
	const timestamp = new Date(
		Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
	)

	return {
		id: i + 1,
		session_id: `sess-${Math.random().toString(36).substring(2, 15)}`,
		user_id: Math.random() > 0.3 ? Math.floor(Math.random() * userCount) + 1 : null,
		page_url: pages[Math.floor(Math.random() * pages.length)],
		page_title:
			pages[Math.floor(Math.random() * pages.length)].replace('/', '').toUpperCase() ||
			'HOME',
		referrer: referrers[Math.floor(Math.random() * referrers.length)],
		utm_source: utmSources[Math.floor(Math.random() * utmSources.length)],
		utm_medium: utmMediums[Math.floor(Math.random() * utmMediums.length)],
		device_type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
		timestamp: timestamp.toISOString()
	}
})
}

function generateAuditLogs(count: number, userCount: number): Record<string, unknown>[] {
const actions = [
	'login',
	'logout',
	'update_profile',
	'change_password',
	'create_order',
	'delete_item',
	'export_data',
	'view_dashboard'
]
const entityTypes = ['user', 'order', 'product', 'category', 'settings']
const userAgents = [
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
	'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
]

return Array.from({ length: count }, (_, i) => ({
	id: i + 1,
	user_id: Math.random() > 0.2 ? Math.floor(Math.random() * userCount) + 1 : null,
	action: actions[Math.floor(Math.random() * actions.length)],
	entity_type: entityTypes[Math.floor(Math.random() * entityTypes.length)],
	entity_id: Math.floor(Math.random() * 10000),
	ip_address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
	user_agent: userAgents[Math.floor(Math.random() * userAgents.length)],
	metadata: JSON.stringify({ details: 'Additional context for this action' }),
	created_at: new Date(
		Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)
	).toISOString()
}))
}

function generateArticles(count: number, authorCount: number): Record<string, unknown>[] {
const titles = [
	'The Future of Web Development',
	'10 Tips for Better Productivity',
	'Understanding Modern Frameworks',
	'A Guide to Remote Work',
	'The Psychology of Design',
	'Best Practices for API Design',
	'Introduction to Machine Learning',
	'The Art of Debugging',
	'Cloud Computing Essentials',
	'Mobile Development Trends',
	'Security Best Practices',
	'Data Visualization Techniques'
]
const statuses = ['draft', 'published', 'archived']

return Array.from({ length: count }, (_, i) => {
	const status = statuses[Math.floor(Math.random() * statuses.length)]
	const publishedAt =
		status === 'published'
			? new Date(
					Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)
				).toISOString()
			: null

	return {
		id: i + 1,
		slug: `${titles[i % titles.length].toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
		title: titles[i % titles.length],
		excerpt:
			'A comprehensive guide covering all the essential aspects of this topic with practical examples.',
		content:
			'Full article content would go here with detailed explanations, code examples, and illustrations...',
		author_id: Math.floor(Math.random() * authorCount) + 1,
		category_id: Math.floor(Math.random() * 8) + 1,
		status,
		published_at: publishedAt,
		view_count: status === 'published' ? Math.floor(Math.random() * 10000) : 0,
		featured: status === 'published' && Math.random() > 0.8,
		created_at: new Date(
			Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000)
		).toISOString(),
		updated_at: new Date(
			Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
		).toISOString()
	}
})
}

function generateTasks(count: number, projectCount: number, assigneeCount: number): Record<string, unknown>[] {
const titles = [
	'Design new landing page',
	'Fix login bug',
	'Write documentation',
	'Code review PR #123',
	'Update dependencies',
	'Set up CI/CD pipeline',
	'Create database schema',
	'Implement user authentication',
	'Optimize query performance',
	'Write unit tests',
	'Deploy to production',
	'Monitor server logs',
	'Research new features',
	'Create wireframes',
	'User testing session',
	'Fix accessibility issues'
]
const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled']
const priorities = ['low', 'medium', 'high', 'critical']

return Array.from({ length: count }, (_, i) => {
	const status = statuses[Math.floor(Math.random() * statuses.length)]
	const dueDate =
		Math.random() > 0.3
			? new Date(
					Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
				).toISOString()
			: null
	const completedAt =
		status === 'done'
			? new Date(
					Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000
				).toISOString()
			: null

	return {
		id: i + 1,
		project_id: Math.floor(Math.random() * projectCount) + 1,
		assignee_id: Math.random() > 0.2 ? Math.floor(Math.random() * assigneeCount) + 1 : null,
		title: titles[i % titles.length],
		description: 'Detailed task description with requirements and acceptance criteria...',
		status,
		priority: priorities[Math.floor(Math.random() * priorities.length)],
		due_date: dueDate,
		completed_at: completedAt,
		estimated_hours: parseFloat((1 + Math.random() * 8).toFixed(2)),
		actual_hours: completedAt ? parseFloat((1 + Math.random() * 10).toFixed(2)) : null,
		created_at: new Date(
			Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000
		).toISOString(),
		updated_at: new Date(
			Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000
		).toISOString()
	}
})
}

function generateProjects(count: number, ownerCount: number): Record<string, unknown>[] {
const names = [
	'Website Redesign',
	'Mobile App Launch',
	'API Integration',
	'E-commerce Platform',
	'Marketing Campaign',
	'Data Migration',
	'Security Audit',
	'Performance Optimization'
]
const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']

return Array.from({ length: count }, (_, i) => {
	const status = statuses[Math.floor(Math.random() * statuses.length)]
	const startDate = new Date(
		Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000
	)
	const durationDays = 30 + Math.floor(Math.random() * 180)

	return {
		id: i + 1,
		name: names[i % names.length],
		description: 'Project description outlining goals, scope, and deliverables...',
		owner_id: Math.floor(Math.random() * ownerCount) + 1,
		status,
		start_date: startDate.toISOString(),
		end_date: new Date(
			startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
		).toISOString(),
		budget: parseFloat((10000 + Math.random() * 90000).toFixed(2)),
		progress: status === 'completed' ? 100 : Math.floor(Math.random() * 100),
		created_at: new Date(
			Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000
		).toISOString()
	}
})
}

export const MOCK_TABLE_DATA: Record<string, Record<string, unknown>[]> = {
	'ecommerce_db.public.customers': generateCustomers(1000),
	'ecommerce_db.public.orders': generateOrders(5000, 1000),
	'ecommerce_db.public.products': generateProducts(500),
	'ecommerce_db.public.categories': [
		{
			id: 1,
			name: 'Electronics',
			slug: 'electronics',
			description: 'Electronic devices and accessories',
			parent_id: null,
			sort_order: 1
		},
		{
			id: 2,
			name: 'Clothing',
			slug: 'clothing',
			description: 'Apparel and fashion items',
			parent_id: null,
			sort_order: 2
		},
		{
			id: 3,
			name: 'Home & Garden',
			slug: 'home-garden',
			description: 'Home improvement and garden supplies',
			parent_id: null,
			sort_order: 3
		},
		{
			id: 4,
			name: 'Sports',
			slug: 'sports',
			description: 'Sports equipment and activewear',
			parent_id: null,
			sort_order: 4
		},
		{
			id: 5,
			name: 'Books',
			slug: 'books',
			description: 'Books and educational materials',
			parent_id: null,
			sort_order: 5
		},
		{
			id: 6,
			name: 'Toys',
			slug: 'toys',
			description: 'Toys and games for all ages',
			parent_id: null,
			sort_order: 6
		},
		{
			id: 7,
			name: 'Food & Beverages',
			slug: 'food-beverages',
			description: 'Food and drink products',
			parent_id: null,
			sort_order: 7
		},
		{
			id: 8,
			name: 'Beauty',
			slug: 'beauty',
			description: 'Beauty and personal care products',
			parent_id: null,
			sort_order: 8
		}
	],
	'ecommerce_db.analytics.page_views': generatePageViews(50000, 1000),
	'user_service.main.users': Array.from({ length: 5000 }, (_, i) => ({
		id: i + 1,
		uuid: `${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`,
		username: `user_${i}`,
		email: `user${i}@example.com`,
		avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
		bio: `Bio for user ${i}`,
		followers_count: Math.floor(Math.random() * 10000),
		following_count: Math.floor(Math.random() * 1000),
		is_active: Math.random() > 0.1,
		is_verified: Math.random() > 0.8,
		created_at: new Date(
			2020 + Math.floor(Math.random() * 5),
			Math.floor(Math.random() * 12),
			Math.floor(Math.random() * 28)
		).toISOString(),
		updated_at: new Date(
			2024,
			Math.floor(Math.random() * 12),
			Math.floor(Math.random() * 28)
		).toISOString()
	})),
	'user_service.audit.audit_logs': generateAuditLogs(50000, 5000),
	'content_cms.public.articles': generateArticles(1000, 120),
	'analytics_warehouse.analytics.dim_users': generateCustomers(5000),
	'analytics_warehouse.analytics.fct_orders': generateOrders(25000, 5000),
	'task_manager.main.tasks': generateTasks(10000, 500, 150),
	'task_manager.main.projects': generateProjects(500, 150)
}
