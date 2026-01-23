import type { DatabaseSchema, TableInfo, ColumnInfo } from "@/lib/bindings";

function col(
	name: string,
	type: string,
	nullable: boolean = true,
	pk: boolean = false
): ColumnInfo {
	return {
		name,
		data_type: type,
		is_nullable: nullable,
		default_value: null,
		is_primary_key: pk,
		is_auto_increment: pk,
		foreign_key: null
	}
}

const ECOMMERCE_TABLES: TableInfo[] = [
	{
		name: 'customers',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('name', 'varchar(100)', false),
			col('email', 'varchar(255)', false),
			col('phone', 'varchar(20)', true),
			col('city', 'varchar(50)', true),
			col('country', 'varchar(50)', true),
			col('created_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 50
	},
	{
		name: 'products',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('name', 'varchar(200)', false),
			col('description', 'text', true),
			col('price', 'decimal(10,2)', false),
			col('stock', 'integer', false),
			col('category', 'varchar(50)', true),
			col('created_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 25
	},
	{
		name: 'orders',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('customer_id', 'integer', false),
			col('total', 'decimal(10,2)', false),
			col('status', 'varchar(20)', false),
			col('shipping_address', 'text', true),
			col('created_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 100
	},
	{
		name: 'order_items',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('order_id', 'integer', false),
			col('product_id', 'integer', false),
			col('quantity', 'integer', false),
			col('unit_price', 'decimal(10,2)', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 150
	},
	{
		name: 'inventory',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('sku', 'varchar(50)', false),
			col('product_name', 'varchar(200)', false),
			col('warehouse_id', 'varchar(20)', false),
			col('quantity', 'integer', false),
			col('reserved_quantity', 'integer', true),
			col('reorder_point', 'integer', true),
			col('unit_cost', 'decimal(10,2)', false),
			col('last_restocked', 'timestamp', true),
			col('last_counted', 'timestamp', true),
			col('location_aisle', 'varchar(5)', true),
			col('location_shelf', 'integer', true),
			col('location_bin', 'integer', true),
			col('updated_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 120
	},
	{
		name: 'transactions',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('transaction_id', 'varchar(50)', false),
			col('type', 'varchar(20)', false),
			col('amount', 'decimal(12,2)', false),
			col('currency', 'varchar(3)', false),
			col('status', 'varchar(20)', false),
			col('payment_method', 'varchar(30)', true),
			col('customer_id', 'integer', true),
			col('merchant_id', 'integer', true),
			col('description', 'text', true),
			col('fee_amount', 'decimal(10,2)', true),
			col('net_amount', 'decimal(12,2)', true),
			col('ip_address', 'varchar(45)', true),
			col('created_at', 'timestamp', false),
			col('processed_at', 'timestamp', true)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 250
	},
	{
		name: 'subscriptions',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('subscription_id', 'varchar(50)', false),
			col('customer_id', 'integer', false),
			col('plan_name', 'varchar(50)', false),
			col('price', 'decimal(10,2)', false),
			col('billing_cycle', 'varchar(20)', true),
			col('status', 'varchar(20)', false),
			col('current_period_start', 'timestamp', true),
			col('current_period_end', 'timestamp', true),
			col('trial_end', 'timestamp', true),
			col('cancelled_at', 'timestamp', true),
			col('stripe_subscription_id', 'varchar(100)', true),
			col('created_at', 'timestamp', false),
			col('updated_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 60
	}
]

const BLOG_TABLES: TableInfo[] = [
	{
		name: 'users',
		schema: 'main',
		columns: [
			col('id', 'integer', false, true),
			col('username', 'text', false),
			col('email', 'text', false),
			col('role', 'text', false),
			col('bio', 'text', true),
			col('avatar_url', 'text', true),
			col('created_at', 'text', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 20
	},
	{
		name: 'posts',
		schema: 'main',
		columns: [
			col('id', 'integer', false, true),
			col('title', 'text', false),
			col('slug', 'text', false),
			col('content', 'text', true),
			col('excerpt', 'text', true),
			col('author_id', 'integer', false),
			col('status', 'text', false),
			col('published_at', 'text', true),
			col('created_at', 'text', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 40
	},
	{
		name: 'comments',
		schema: 'main',
		columns: [
			col('id', 'integer', false, true),
			col('post_id', 'integer', false),
			col('user_id', 'integer', true),
			col('author_name', 'text', true),
			col('body', 'text', false),
			col('approved', 'integer', false),
			col('created_at', 'text', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 80
	},
	{
		name: 'tags',
		schema: 'main',
		columns: [
			col('id', 'integer', false, true),
			col('name', 'text', false),
			col('slug', 'text', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 15
	},
	{
		name: 'page_views',
		schema: 'main',
		columns: [
			col('id', 'integer', false, true),
			col('session_id', 'text', false),
			col('user_id', 'integer', true),
			col('page_path', 'text', false),
			col('referrer', 'text', true),
			col('browser', 'text', true),
			col('device_type', 'text', true),
			col('country', 'text', true),
			col('duration_seconds', 'integer', true),
			col('scroll_depth', 'integer', true),
			col('is_bounce', 'integer', true),
			col('timestamp', 'text', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 500
	}
]

const ANALYTICS_TABLES: TableInfo[] = [
	{
		name: 'page_views',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('session_id', 'varchar(50)', false),
			col('user_id', 'integer', true),
			col('page_path', 'varchar(255)', false),
			col('referrer', 'varchar(100)', true),
			col('browser', 'varchar(50)', true),
			col('device_type', 'varchar(20)', true),
			col('country', 'varchar(5)', true),
			col('duration_seconds', 'integer', true),
			col('scroll_depth', 'integer', true),
			col('is_bounce', 'boolean', true),
			col('timestamp', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 500
	},
	{
		name: 'api_logs',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('request_id', 'varchar(50)', false),
			col('method', 'varchar(10)', false),
			col('endpoint', 'varchar(255)', false),
			col('status_code', 'integer', false),
			col('response_time_ms', 'integer', true),
			col('request_body_size', 'integer', true),
			col('response_body_size', 'integer', true),
			col('user_id', 'integer', true),
			col('api_key_id', 'integer', true),
			col('ip_address', 'varchar(45)', true),
			col('user_agent', 'varchar(255)', true),
			col('error_message', 'text', true),
			col('timestamp', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 400
	},
	{
		name: 'email_campaigns',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('campaign_name', 'varchar(200)', false),
			col('type', 'varchar(30)', false),
			col('status', 'varchar(20)', false),
			col('subject_line', 'varchar(255)', true),
			col('from_email', 'varchar(100)', false),
			col('sent_count', 'integer', true),
			col('delivered_count', 'integer', true),
			col('open_count', 'integer', true),
			col('click_count', 'integer', true),
			col('unsubscribe_count', 'integer', true),
			col('bounce_count', 'integer', true),
			col('scheduled_at', 'timestamp', true),
			col('sent_at', 'timestamp', true),
			col('created_at', 'timestamp', false),
			col('updated_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 25
	}
]

const HR_TABLES: TableInfo[] = [
	{
		name: 'employees',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('employee_id', 'varchar(20)', false),
			col('full_name', 'varchar(100)', false),
			col('email', 'varchar(255)', false),
			col('department', 'varchar(50)', false),
			col('position', 'varchar(100)', false),
			col('salary', 'integer', true),
			col('hire_date', 'timestamp', false),
			col('manager_id', 'integer', true),
			col('status', 'varchar(20)', false),
			col('phone', 'varchar(20)', true),
			col('office_location', 'varchar(50)', true),
			col('created_at', 'timestamp', false),
			col('updated_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 30
	},
	{
		name: 'audit_logs',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('action', 'varchar(30)', false),
			col('resource_type', 'varchar(50)', false),
			col('resource_id', 'integer', true),
			col('user_id', 'integer', true),
			col('user_email', 'varchar(255)', true),
			col('ip_address', 'varchar(45)', true),
			col('user_agent', 'text', true),
			col('changes', 'jsonb', true),
			col('created_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 300
	},
	{
		name: 'support_tickets',
		schema: 'public',
		columns: [
			col('id', 'serial', false, true),
			col('ticket_number', 'varchar(20)', false),
			col('subject', 'varchar(255)', false),
			col('description', 'text', true),
			col('customer_id', 'integer', true),
			col('customer_email', 'varchar(255)', true),
			col('priority', 'varchar(10)', false),
			col('status', 'varchar(20)', false),
			col('category', 'varchar(30)', true),
			col('assigned_to', 'integer', true),
			col('first_response_at', 'timestamp', true),
			col('resolved_at', 'timestamp', true),
			col('satisfaction_rating', 'integer', true),
			col('created_at', 'timestamp', false),
			col('updated_at', 'timestamp', false)
		],
		primary_key_columns: ['id'],
		row_count_estimate: 80
	}
]

export const MOCK_SCHEMAS: Record<string, DatabaseSchema> = {
	'demo-ecommerce-001': {
		tables: ECOMMERCE_TABLES,
		schemas: ['public'],
		unique_columns: ['id']
	},
	'demo-blog-002': {
		tables: BLOG_TABLES,
		schemas: ['main'],
		unique_columns: ['id']
	},
	'demo-analytics-003': {
		tables: ANALYTICS_TABLES,
		schemas: ['public'],
		unique_columns: ['id']
	},
	'demo-hr-004': {
		tables: HR_TABLES,
		schemas: ['public'],
		unique_columns: ['id']
	}
}
