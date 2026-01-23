import { MOCK_TABLE_DATA, MOCK_TABLE_COLUMNS } from "./database-data";
import { TableItem, Schema, Database } from "./types";

export const MOCK_DATABASES: Database[] = [
	{
		id: 'ecommerce_db',
		name: 'ecommerce_db',
		type: 'postgres',
		schemas: ['public', 'auth', 'analytics', 'inventory', 'reporting']
	},
	{
		id: 'user_service',
		name: 'user_service',
		type: 'mysql',
		schemas: ['main', 'auth', 'profiles', 'notifications', 'audit']
	},
	{
		id: 'content_cms',
		name: 'content_cms',
		type: 'postgres',
		schemas: ['public', 'media', 'drafts', 'published', 'archived']
	},
	{
		id: 'analytics_warehouse',
		name: 'analytics_warehouse',
		type: 'postgres',
		schemas: ['raw', 'staging', 'analytics', 'ml_features', 'dashboards']
	},
	{
		id: 'task_manager',
		name: 'task_manager',
		type: 'sqlite',
		schemas: ['main', 'settings', 'logs']
	}
]

export const MOCK_SCHEMAS: Schema[] = MOCK_DATABASES.flatMap((db) =>
	db.schemas.map((schema) => ({
		id: `${db.id}.${schema}`,
		name: schema,
		databaseId: db.id
	}))
)

export function getTablesBySchema(databaseId: string, schemaName: string): TableItem[] {
const schemaKey = `${databaseId}.${schemaName}`
return (SCHEMA_TABLES as Record<string, TableItem[]>)[schemaKey] || []
}

const SCHEMA_TABLES: Record<string, TableItem[]> = {
	'ecommerce_db.public': [
		{ id: 'customers', name: 'customers', rowCount: 12543, type: 'table' },
		{ id: 'orders', name: 'orders', rowCount: 45678, type: 'table' },
		{ id: 'order_items', name: 'order_items', rowCount: 152341, type: 'table' },
		{ id: 'products', name: 'products', rowCount: 8765, type: 'table' },
		{ id: 'categories', name: 'categories', rowCount: 48, type: 'table' },
		{ id: 'addresses', name: 'addresses', rowCount: 25000, type: 'table' },
		{ id: 'customer_segments', name: 'customer_segments', rowCount: 125, type: 'table' },
		{ id: 'order_stats', name: 'order_stats', rowCount: 365, type: 'view' }
	],
	'ecommerce_db.auth': [
		{ id: 'users', name: 'users', rowCount: 15000, type: 'table' },
		{ id: 'user_sessions', name: 'user_sessions', rowCount: 45000, type: 'table' },
		{ id: 'password_resets', name: 'password_resets', rowCount: 2340, type: 'table' },
		{ id: 'mfa_devices', name: 'mfa_devices', rowCount: 8900, type: 'table' },
		{ id: 'api_keys', name: 'api_keys', rowCount: 567, type: 'table' }
	],
	'ecommerce_db.analytics': [
		{ id: 'page_views', name: 'page_views', rowCount: 5432100, type: 'table' },
		{ id: 'click_events', name: 'click_events', rowCount: 8765432, type: 'table' },
		{
			id: 'funnel_analytics',
			name: 'funnel_analytics',
			rowCount: 1250000,
			type: 'materialized-view'
		},
		{ id: 'user_behaviors', name: 'user_behaviors', rowCount: 2345678, type: 'table' },
		{ id: 'conversion_rates', name: 'conversion_rates', rowCount: 730, type: 'view' }
	],
	'ecommerce_db.inventory': [
		{ id: 'inventory_items', name: 'inventory_items', rowCount: 45000, type: 'table' },
		{ id: 'stock_movements', name: 'stock_movements', rowCount: 234567, type: 'table' },
		{ id: 'warehouses', name: 'warehouses', rowCount: 25, type: 'table' },
		{ id: 'suppliers', name: 'suppliers', rowCount: 450, type: 'table' },
		{ id: 'purchase_orders', name: 'purchase_orders', rowCount: 8900, type: 'table' }
	],
	'ecommerce_db.reporting': [
		{ id: 'daily_sales', name: 'daily_sales', rowCount: 1825, type: 'table' },
		{ id: 'monthly_revenue', name: 'monthly_revenue', rowCount: 60, type: 'view' },
		{ id: 'top_products', name: 'top_products', rowCount: 100, type: 'view' },
		{
			id: 'customer_lifetime_value',
			name: 'customer_lifetime_value',
			rowCount: 12543,
			type: 'materialized-view'
		}
	],
	'user_service.main': [
		{ id: 'users', name: 'users', rowCount: 89000, type: 'table' },
		{ id: 'user_emails', name: 'user_emails', rowCount: 234000, type: 'table' },
		{ id: 'user_phones', name: 'user_phones', rowCount: 125000, type: 'table' },
		{ id: 'user_preferences', name: 'user_preferences', rowCount: 89000, type: 'table' }
	],
	'user_service.auth': [
		{ id: 'credentials', name: 'credentials', rowCount: 89000, type: 'table' },
		{ id: 'login_history', name: 'login_history', rowCount: 567000, type: 'table' },
		{ id: 'auth_tokens', name: 'auth_tokens', rowCount: 123000, type: 'table' }
	],
	'user_service.profiles': [
		{ id: 'user_profiles', name: 'user_profiles', rowCount: 89000, type: 'table' },
		{ id: 'social_links', name: 'social_links', rowCount: 45000, type: 'table' },
		{ id: 'profile_views', name: 'profile_views', rowCount: 3450000, type: 'table' }
	],
	'user_service.notifications': [
		{ id: 'notifications', name: 'notifications', rowCount: 2345000, type: 'table' },
		{
			id: 'notification_preferences',
			name: 'notification_preferences',
			rowCount: 89000,
			type: 'table'
		},
		{ id: 'notification_queue', name: 'notification_queue', rowCount: 12500, type: 'table' }
	],
	'user_service.audit': [
		{ id: 'audit_logs', name: 'audit_logs', rowCount: 5432100, type: 'table' },
		{ id: 'security_events', name: 'security_events', rowCount: 890000, type: 'table' }
	],
	'content_cms.public': [
		{ id: 'articles', name: 'articles', rowCount: 5600, type: 'table' },
		{ id: 'tags', name: 'tags', rowCount: 450, type: 'table' },
		{ id: 'categories', name: 'categories', rowCount: 85, type: 'table' },
		{ id: 'authors', name: 'authors', rowCount: 120, type: 'table' }
	],
	'content_cms.media': [
		{ id: 'media_files', name: 'media_files', rowCount: 89000, type: 'table' },
		{ id: 'media_collections', name: 'media_collections', rowCount: 1200, type: 'table' },
		{ id: 'media_tags', name: 'media_tags', rowCount: 560, type: 'table' }
	],
	'content_cms.drafts': [
		{ id: 'drafts', name: 'drafts', rowCount: 3400, type: 'table' },
		{ id: 'draft_versions', name: 'draft_versions', rowCount: 23400, type: 'table' }
	],
	'content_cms.published': [
		{ id: 'published_articles', name: 'published_articles', rowCount: 5600, type: 'view' },
		{ id: 'scheduled_posts', name: 'scheduled_posts', rowCount: 340, type: 'table' }
	],
	'content_cms.archived': [
		{ id: 'archived_content', name: 'archived_content', rowCount: 12000, type: 'table' }
	],
	'analytics_warehouse.raw': [
		{ id: 'raw_events', name: 'raw_events', rowCount: 54321000, type: 'table' },
		{ id: 'raw_logs', name: 'raw_logs', rowCount: 234567000, type: 'table' },
		{ id: 'raw_transactions', name: 'raw_transactions', rowCount: 8765432, type: 'table' }
	],
	'analytics_warehouse.staging': [
		{ id: 'stg_users', name: 'stg_users', rowCount: 150000, type: 'table' },
		{ id: 'stg_events', name: 'stg_events', rowCount: 87654320, type: 'table' },
		{ id: 'stg_transactions', name: 'stg_transactions', rowCount: 2345678, type: 'table' }
	],
	'analytics_warehouse.analytics': [
		{ id: 'fct_orders', name: 'fct_orders', rowCount: 2345678, type: 'table' },
		{ id: 'fct_sessions', name: 'fct_sessions', rowCount: 34567890, type: 'table' },
		{ id: 'dim_users', name: 'dim_users', rowCount: 150000, type: 'table' },
		{ id: 'dim_products', name: 'dim_products', rowCount: 8765, type: 'table' },
		{ id: 'dim_locations', name: 'dim_locations', rowCount: 450, type: 'table' }
	],
	'analytics_warehouse.ml_features': [
		{ id: 'user_features', name: 'user_features', rowCount: 150000, type: 'table' },
		{ id: 'product_features', name: 'product_features', rowCount: 8765, type: 'table' },
		{ id: 'training_labels', name: 'training_labels', rowCount: 500000, type: 'table' }
	],
	'analytics_warehouse.dashboards': [
		{ id: 'daily_metrics', name: 'daily_metrics', rowCount: 1825, type: 'materialized-view' },
		{ id: 'weekly_kpis', name: 'weekly_kpis', rowCount: 260, type: 'view' },
		{ id: 'realtime_stats', name: 'realtime_stats', rowCount: 1440, type: 'materialized-view' }
	],
	'task_manager.main': [
		{ id: 'tasks', name: 'tasks', rowCount: 45000, type: 'table' },
		{ id: 'projects', name: 'projects', rowCount: 1200, type: 'table' },
		{ id: 'team_members', name: 'team_members', rowCount: 150, type: 'table' },
		{ id: 'comments', name: 'comments', rowCount: 234000, type: 'table' },
		{ id: 'attachments', name: 'attachments', rowCount: 56000, type: 'table' }
	],
	'task_manager.settings': [
		{ id: 'user_settings', name: 'user_settings', rowCount: 150, type: 'table' },
		{ id: 'project_settings', name: 'project_settings', rowCount: 1200, type: 'table' }
	],
	'task_manager.logs': [
		{ id: 'activity_logs', name: 'activity_logs', rowCount: 890000, type: 'table' },
		{ id: 'error_logs', name: 'error_logs', rowCount: 23000, type: 'table' }
	]
}

export const MOCK_TABLES: TableItem[] = Object.values(SCHEMA_TABLES).flat()
