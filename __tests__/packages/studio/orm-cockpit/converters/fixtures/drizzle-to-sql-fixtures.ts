import type { Dialect } from '@studio/features/orm-cockpit/converters/contract'

export type ConverterFixture = {
	name: string
	dialect: Dialect
	drizzle: string
	sql: string
}

/**
 * Shared fixtures for both converter directions. `sql` is EXACTLY what
 * `convertDrizzleToSql` emits, so the SQL→Drizzle round-trip can pivot on it.
 */
export const DRIZZLE_TO_SQL_FIXTURES: ConverterFixture[] = [
	{
		name: 'schema: postgres table with pk, notNull, unique, defaults',
		dialect: 'postgres',
		drizzle: `import { pgTable, serial, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	name: text('name'),
	isActive: boolean('is_active').notNull().default(true),
	createdAt: timestamp('created_at').defaultNow(),
})
`,
		sql: "CREATE TABLE \"users\" (\n    \"created_at\" TIMESTAMP DEFAULT NOW(),\n    \"email\" VARCHAR(255) NOT NULL,\n    \"id\" SERIAL PRIMARY KEY,\n    \"is_active\" BOOLEAN NOT NULL DEFAULT TRUE,\n    \"name\" TEXT\n);\n\nCREATE UNIQUE INDEX \"users_email_unique\" ON \"users\" (\"email\");",
	},
	{
		name: 'schema: postgres references with onDelete and an index',
		dialect: 'postgres',
		drizzle: `import { pgTable, serial, integer, text, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
	id: serial('id').primaryKey(),
})

export const posts = pgTable('posts', {
	id: serial('id').primaryKey(),
	authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
}, (t) => ({
	authorIdx: index('posts_author_idx').on(t.authorId),
}))
`,
		sql: "CREATE TABLE \"posts\" (\n    \"author_id\" INTEGER NOT NULL,\n    \"id\" SERIAL PRIMARY KEY,\n    \"title\" TEXT NOT NULL\n);\n\nCREATE TABLE \"users\" (\n    \"id\" SERIAL PRIMARY KEY\n);\n\nCREATE INDEX \"posts_author_idx\" ON \"posts\" (\"author_id\");\n\nALTER TABLE \"posts\" ADD CONSTRAINT \"posts_author_id_fkey\" FOREIGN KEY (\"author_id\") REFERENCES \"users\" (\"id\") ON DELETE cascade;",
	},
	{
		name: 'schema: postgres composite primary key',
		dialect: 'postgres',
		drizzle: `import { pgTable, integer, primaryKey } from 'drizzle-orm/pg-core'

export const memberships = pgTable('memberships', {
	userId: integer('user_id').notNull(),
	teamId: integer('team_id').notNull(),
}, (t) => ({
	pk: primaryKey({ columns: [t.userId, t.teamId] }),
}))
`,
		sql: "CREATE TABLE \"memberships\" (\n    \"team_id\" INTEGER NOT NULL,\n    \"user_id\" INTEGER NOT NULL,\n    PRIMARY KEY (\"user_id\", \"team_id\")\n);",
	},
	{
		name: 'schema: sqlite table with autoincrement pk and inline foreign key',
		dialect: 'sqlite',
		drizzle: `import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }).autoincrement(),
	name: text('name').notNull(),
})

export const notes = sqliteTable('notes', {
	id: integer('id').primaryKey().autoincrement(),
	userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'set null' }),
	body: text('body'),
})
`,
		sql: "CREATE TABLE \"notes\" (\n    \"body\" TEXT,\n    \"id\" INTEGER PRIMARY KEY AUTOINCREMENT,\n    \"user_id\" INTEGER NOT NULL,\n    FOREIGN KEY (\"user_id\") REFERENCES \"users\" (\"id\") ON DELETE set null\n);\n\nCREATE TABLE \"users\" (\n    \"id\" INTEGER PRIMARY KEY AUTOINCREMENT,\n    \"name\" TEXT NOT NULL\n);",
	},
	{
		name: 'schema: mysql table with backticks, varchar length and unique index',
		dialect: 'mysql',
		drizzle: `import { mysqlTable, int, varchar, uniqueIndex } from 'drizzle-orm/mysql-core'

export const customers = mysqlTable('customers', {
	id: int('id').primaryKey().autoincrement(),
	slug: varchar('slug', { length: 64 }).notNull(),
}, (t) => ({
	slugIdx: uniqueIndex('customers_slug_unique').on(t.slug),
}))
`,
		sql: "CREATE TABLE `customers` (\n    `id` INT AUTO_INCREMENT PRIMARY KEY,\n    `slug` VARCHAR(255) NOT NULL\n);\n\nCREATE UNIQUE INDEX `customers_slug_unique` ON `customers` (`slug`);",
	},
	{
		name: 'query: select star',
		dialect: 'postgres',
		drizzle: 'db.select().from(users)',
		sql: "SELECT * FROM \"users\";",
	},
	{
		name: 'query: select column list',
		dialect: 'postgres',
		drizzle: 'db.select({ id: users.id, email: users.email }).from(users)',
		sql: "SELECT \"id\", \"email\" FROM \"users\";",
	},
	{
		name: 'query: where eq with a number',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(eq(users.id, 1))',
		sql: "SELECT * FROM \"users\" WHERE \"id\" = 1;",
	},
	{
		name: 'query: where ne, gt, gte, lt, lte',
		dialect: 'postgres',
		drizzle:
			'db.select().from(users).where(and(ne(users.role, \'admin\'), gt(users.age, 18), gte(users.score, 10), lt(users.age, 65), lte(users.score, 100)))',
		sql: "SELECT * FROM \"users\" WHERE \"role\" <> 'admin' AND \"age\" > 18 AND \"score\" >= 10 AND \"age\" < 65 AND \"score\" <= 100;",
	},
	{
		name: 'query: where like with an escaped quote',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(like(users.name, "%O\'Brien%"))',
		sql: "SELECT * FROM \"users\" WHERE \"name\" LIKE '%O''Brien%';",
	},
	{
		name: 'query: where ilike on postgres',
		dialect: 'postgres',
		drizzle: "db.select().from(users).where(ilike(users.email, '%@dora.dev'))",
		sql: "SELECT * FROM \"users\" WHERE \"email\" ILIKE '%@dora.dev';",
	},
	{
		name: 'query: where ilike degrades to LIKE on sqlite',
		dialect: 'sqlite',
		drizzle: "db.select().from(users).where(ilike(users.email, '%@dora.dev'))",
		sql: "SELECT * FROM \"users\" WHERE \"email\" LIKE '%@dora.dev';",
	},
	{
		name: 'query: where inArray and notInArray',
		dialect: 'postgres',
		drizzle: "db.select().from(users).where(or(inArray(users.id, [1, 2, 3]), notInArray(users.role, ['admin', 'owner'])))",
		sql: "SELECT * FROM \"users\" WHERE \"id\" IN (1, 2, 3) OR \"role\" NOT IN ('admin', 'owner');",
	},
	{
		name: 'query: where between and notBetween',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(and(between(users.age, 18, 65), notBetween(users.score, 0, 10)))',
		sql: "SELECT * FROM \"users\" WHERE \"age\" BETWEEN 18 AND 65 AND \"score\" NOT BETWEEN 0 AND 10;",
	},
	{
		name: 'query: where isNull and isNotNull',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(and(isNull(users.deletedAt), isNotNull(users.email)))',
		sql: "SELECT * FROM \"users\" WHERE \"deletedAt\" IS NULL AND \"email\" IS NOT NULL;",
	},
	{
		name: 'query: where boolean literal on postgres',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(eq(users.isActive, true))',
		sql: "SELECT * FROM \"users\" WHERE \"isActive\" = TRUE;",
	},
	{
		name: 'query: where boolean literal on mysql',
		dialect: 'mysql',
		drizzle: 'db.select().from(users).where(eq(users.isActive, false))',
		sql: "SELECT * FROM `users` WHERE `isActive` = 0;",
	},
	{
		name: 'query: nested and/or with not',
		dialect: 'postgres',
		drizzle:
			"db.select().from(users).where(and(eq(users.role, 'admin'), or(eq(users.status, 'active'), not(isNull(users.email)))))",
		sql: "SELECT * FROM \"users\" WHERE \"role\" = 'admin' AND (\"status\" = 'active' OR NOT (\"email\" IS NULL));",
	},
	{
		name: 'query: where exists subquery',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).where(exists(db.select().from(posts).where(eq(posts.authorId, 1))))',
		sql: "SELECT * FROM \"users\" WHERE EXISTS (SELECT * FROM \"posts\" WHERE \"posts\".\"authorId\" = 1);",
	},
	{
		name: 'query: inner join',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).innerJoin(posts, eq(posts.authorId, users.id))',
		sql: "SELECT * FROM \"users\" INNER JOIN \"posts\" ON \"posts\".\"authorId\" = \"users\".\"id\";",
	},
	{
		name: 'query: left join',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).leftJoin(posts, eq(posts.authorId, users.id))',
		sql: "SELECT * FROM \"users\" LEFT JOIN \"posts\" ON \"posts\".\"authorId\" = \"users\".\"id\";",
	},
	{
		name: 'query: right join',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).rightJoin(posts, eq(posts.authorId, users.id))',
		sql: "SELECT * FROM \"users\" RIGHT JOIN \"posts\" ON \"posts\".\"authorId\" = \"users\".\"id\";",
	},
	{
		name: 'query: full join',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).fullJoin(posts, eq(posts.authorId, users.id))',
		sql: "SELECT * FROM \"users\" FULL JOIN \"posts\" ON \"posts\".\"authorId\" = \"users\".\"id\";",
	},
	{
		name: 'query: join with projection and where',
		dialect: 'postgres',
		drizzle:
			"db.select({ id: users.id, title: posts.title }).from(users).leftJoin(posts, eq(posts.authorId, users.id)).where(eq(users.role, 'admin'))",
		sql: "SELECT \"users\".\"id\", \"posts\".\"title\" FROM \"users\" LEFT JOIN \"posts\" ON \"posts\".\"authorId\" = \"users\".\"id\" WHERE \"users\".\"role\" = 'admin';",
	},
	{
		name: 'query: orderBy, limit and offset',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).orderBy(desc(users.createdAt), asc(users.id)).limit(10).offset(20)',
		sql: "SELECT * FROM \"users\" ORDER BY \"createdAt\" DESC, \"id\" ASC LIMIT 10 OFFSET 20;",
	},
	{
		name: 'query: orderBy bare column defaults to asc',
		dialect: 'postgres',
		drizzle: 'db.select().from(users).orderBy(users.id)',
		sql: "SELECT * FROM \"users\" ORDER BY \"id\" ASC;",
	},
	{
		name: 'query: groupBy',
		dialect: 'postgres',
		drizzle: 'db.select({ role: users.role }).from(users).groupBy(users.role)',
		sql: "SELECT \"role\" FROM \"users\" GROUP BY \"role\";",
	},
	{
		name: 'query: insert a single row',
		dialect: 'postgres',
		drizzle: "db.insert(users).values({ email: 'a@dora.dev', isActive: true })",
		sql: "INSERT INTO \"users\" (\"email\", \"isActive\") VALUES ('a@dora.dev', TRUE);",
	},
	{
		name: 'query: insert multiple rows',
		dialect: 'postgres',
		drizzle: "db.insert(users).values([{ email: 'a@dora.dev' }, { email: 'b@dora.dev' }])",
		sql: "INSERT INTO \"users\" (\"email\") VALUES ('a@dora.dev'), ('b@dora.dev');",
	},
	{
		name: 'query: insert with returning columns',
		dialect: 'postgres',
		drizzle: "db.insert(users).values({ email: 'a@dora.dev' }).returning({ id: users.id })",
		sql: "INSERT INTO \"users\" (\"email\") VALUES ('a@dora.dev') RETURNING \"id\";",
	},
	{
		name: 'query: insert with bare returning',
		dialect: 'postgres',
		drizzle: "db.insert(users).values({ email: 'a@dora.dev' }).returning()",
		sql: "INSERT INTO \"users\" (\"email\") VALUES ('a@dora.dev') RETURNING *;",
	},
	{
		name: 'query: insert on sqlite maps booleans and nulls',
		dialect: 'sqlite',
		drizzle: "db.insert(users).values({ name: 'ada', isActive: true, deletedAt: null })",
		sql: "INSERT INTO \"users\" (\"name\", \"isActive\", \"deletedAt\") VALUES ('ada', 1, NULL);",
	},
	{
		name: 'query: update set and where',
		dialect: 'postgres',
		drizzle: "db.update(users).set({ name: 'Ada', isActive: false }).where(eq(users.id, 7))",
		sql: "UPDATE \"users\" SET \"name\" = 'Ada', \"isActive\" = FALSE WHERE \"id\" = 7;",
	},
	{
		name: 'query: update with returning',
		dialect: 'postgres',
		drizzle: "db.update(users).set({ name: 'Ada' }).where(eq(users.id, 7)).returning({ id: users.id })",
		sql: "UPDATE \"users\" SET \"name\" = 'Ada' WHERE \"id\" = 7 RETURNING \"id\";",
	},
	{
		name: 'query: delete with where',
		dialect: 'postgres',
		drizzle: 'db.delete(users).where(eq(users.id, 7))',
		sql: "DELETE FROM \"users\" WHERE \"id\" = 7;",
	},
	{
		name: 'query: delete everything on mysql',
		dialect: 'mysql',
		drizzle: 'db.delete(users)',
		sql: "DELETE FROM `users`;",
	},
]
