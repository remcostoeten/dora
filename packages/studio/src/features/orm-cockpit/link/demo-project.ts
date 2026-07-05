/**
 * A canned Drizzle project used to drive the ORM cockpit in the web demo
 * (`/app`, mock mode). There is no filesystem in the browser, so instead of
 * hitting the Tauri `pick_folder`/`read_project_file` commands we hand the
 * cockpit a synthetic {@link OrmLink} whose schema text is designed to diff
 * meaningfully against the mock `demo-ecommerce-001` live schema:
 *
 *   - it adds a `slug` column to `products` (→ ADD COLUMN)
 *   - it adds a brand-new `reviews` table            (→ CREATE TABLE)
 *
 * Everything downstream (parse → diff → generate) is real; only the source of
 * the files is faked.
 */

import type { OrmLink } from '@studio/features/orm-cockpit/link/detect-orm'

/** Whether we're running outside Tauri (i.e. the web demo / mock mode). */
export function isWebDemo(): boolean {
	return (
		typeof window !== 'undefined' &&
		!('__TAURI__' in window) &&
		!('__TAURI_INTERNALS__' in window)
	)
}

export const DEMO_PROJECT_FOLDER = 'demo/acme-shop'

const SCHEMA_TEXT = `import {
	pgTable,
	serial,
	varchar,
	text,
	integer,
	decimal,
	timestamp,
} from 'drizzle-orm/pg-core'

export const customers = pgTable('customers', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 100 }).notNull(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	phone: varchar('phone', { length: 20 }),
	city: varchar('city', { length: 50 }),
	country: varchar('country', { length: 50 }),
	createdAt: timestamp('created_at').notNull(),
})

export const products = pgTable('products', {
	id: serial('id').primaryKey(),
	name: varchar('name', { length: 200 }).notNull(),
	slug: varchar('slug', { length: 200 }).notNull(),
	description: text('description'),
	price: decimal('price', { precision: 10, scale: 2 }).notNull(),
	stock: integer('stock').notNull(),
	category: varchar('category', { length: 50 }),
	createdAt: timestamp('created_at').notNull(),
})

export const orders = pgTable('orders', {
	id: serial('id').primaryKey(),
	customerId: integer('customer_id').notNull(),
	total: decimal('total', { precision: 10, scale: 2 }).notNull(),
	status: varchar('status', { length: 20 }).notNull(),
	shippingAddress: text('shipping_address'),
	createdAt: timestamp('created_at').notNull(),
})

export const orderItems = pgTable('order_items', {
	id: serial('id').primaryKey(),
	orderId: integer('order_id').notNull(),
	productId: integer('product_id').notNull(),
	quantity: integer('quantity').notNull(),
	unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
})

export const reviews = pgTable('reviews', {
	id: serial('id').primaryKey(),
	productId: integer('product_id').notNull(),
	customerId: integer('customer_id').notNull(),
	rating: integer('rating').notNull(),
	title: varchar('title', { length: 200 }),
	body: text('body'),
	createdAt: timestamp('created_at').notNull(),
})
`

/** The synthetic Drizzle link the cockpit analyzes in web-demo mode. */
export function demoDrizzleLink(): OrmLink {
	return {
		orm: 'drizzle',
		rootDir: DEMO_PROJECT_FOLDER,
		configPath: `${DEMO_PROJECT_FOLDER}/drizzle.config.ts`,
		schemaFiles: [
			{ path: `${DEMO_PROJECT_FOLDER}/src/db/schema.ts`, text: SCHEMA_TEXT },
		],
	}
}
