import { COMMENTS } from './tables/comments'
import { CUSTOMERS } from './tables/customers'
import {
	EMPLOYEES,
	TRANSACTIONS,
	PAGE_VIEWS,
	INVENTORY,
	AUDIT_LOGS,
	SUPPORT_TICKETS,
	EMAIL_CAMPAIGNS,
	API_LOGS,
	SUBSCRIPTIONS
} from './tables/extended'
import { ORDERS, ORDER_ITEMS } from './tables/orders'
import { POSTS } from './tables/posts'
import { PRODUCTS } from './tables/products'
import { USERS } from './tables/users'

import { MOCK_CONNECTIONS as DEMO_CONNECTIONS } from './connections'
import {
	buildPerfConnections,
	buildPerfSchemas,
	buildPerfScripts,
	buildPerfTableData
} from './perf-fixtures'
import { MOCK_SCHEMAS as DEMO_SCHEMAS } from './schemas'
import { MOCK_SCRIPTS as DEMO_SCRIPTS } from './scripts'

/**
 * The performance harness (`src/test/performance/`) needs a much larger dataset
 * than the demo: 200 tables, 100k rows, 10 connections. Loading it is opt-in so
 * the shipped demo is untouched — the harness sets `dora_perf_fixtures` before
 * the app boots, and `?perf=1` does the same by hand.
 */
function perfFixturesRequested(): boolean {
	if (typeof window === 'undefined') return false
	try {
		if (new URLSearchParams(window.location.search).get('perf') === '1') return true
		return window.localStorage.getItem('dora_perf_fixtures') === '1'
	} catch {
		return false
	}
}

const PERF_FIXTURES = perfFixturesRequested()

export const MOCK_CONNECTIONS = PERF_FIXTURES
	? [...DEMO_CONNECTIONS, ...buildPerfConnections()]
	: DEMO_CONNECTIONS

export const MOCK_SCHEMAS = PERF_FIXTURES
	? { ...DEMO_SCHEMAS, ...buildPerfSchemas() }
	: DEMO_SCHEMAS

export const MOCK_SCRIPTS = PERF_FIXTURES
	? [...DEMO_SCRIPTS, ...buildPerfScripts()]
	: DEMO_SCRIPTS
const TAGS: Record<string, unknown>[] = [
	{ id: 1, name: 'JavaScript', slug: 'javascript' },
	{ id: 2, name: 'TypeScript', slug: 'typescript' },
	{ id: 3, name: 'React', slug: 'react' },
	{ id: 4, name: 'Node.js', slug: 'nodejs' },
	{ id: 5, name: 'CSS', slug: 'css' },
	{ id: 6, name: 'DevOps', slug: 'devops' },
	{ id: 7, name: 'Testing', slug: 'testing' },
	{ id: 8, name: 'Database', slug: 'database' },
	{ id: 9, name: 'Security', slug: 'security' },
	{ id: 10, name: 'Performance', slug: 'performance' },
	{ id: 11, name: 'Architecture', slug: 'architecture' },
	{ id: 12, name: 'Best Practices', slug: 'best-practices' },
	{ id: 13, name: 'Tutorial', slug: 'tutorial' },
	{ id: 14, name: 'Git', slug: 'git' },
	{ id: 15, name: 'API', slug: 'api' }
]

const DEMO_TABLE_DATA: Record<string, Record<string, unknown>[]> = {
	'demo-ecommerce-001:customers': CUSTOMERS,
	'demo-ecommerce-001:products': PRODUCTS,
	'demo-ecommerce-001:orders': ORDERS,
	'demo-ecommerce-001:order_items': ORDER_ITEMS,
	'demo-ecommerce-001:inventory': INVENTORY,
	'demo-ecommerce-001:transactions': TRANSACTIONS,
	'demo-ecommerce-001:subscriptions': SUBSCRIPTIONS,
	'demo-blog-002:users': USERS,
	'demo-blog-002:posts': POSTS,
	'demo-blog-002:comments': COMMENTS,
	'demo-blog-002:tags': TAGS,
	'demo-blog-002:page_views': PAGE_VIEWS,
	'demo-analytics-003:page_views': PAGE_VIEWS,
	'demo-analytics-003:api_logs': API_LOGS,
	'demo-analytics-003:email_campaigns': EMAIL_CAMPAIGNS,
	'demo-hr-004:employees': EMPLOYEES,
	'demo-hr-004:audit_logs': AUDIT_LOGS,
	'demo-hr-004:support_tickets': SUPPORT_TICKETS
}

export const MOCK_TABLE_DATA: Record<string, Record<string, unknown>[]> = PERF_FIXTURES
	? { ...DEMO_TABLE_DATA, ...buildPerfTableData() }
	: DEMO_TABLE_DATA
