/**
 * SQL → Drizzle conversion fixtures: every supported schema construct across the
 * three dialects, every query shape, and every operator in the contract's
 * COMPARISON_OPERATORS + LOGICAL_OPERATORS sets.
 *
 * `drizzle` is the byte-exact output of `convertSqlToDrizzle(sql, { dialect })`.
 * Regenerating it by hand is a mistake — change the emitter, then update these.
 */

import type { Dialect } from '@studio/features/orm-cockpit/ir/types'

export type TConverterFixture = {
	name: string
	dialect: Dialect
	sql: string
	/** Byte-exact converter output, tabs and all. */
	drizzle: string
	/** Expected non-fatal notes, when the case produces any. */
	warnings?: string[]
}

export const SQL_TO_DRIZZLE_FIXTURES: TConverterFixture[] = [
	{
		name: 'postgres: serial pk, unique, defaults, fk, index, composite pk',
		dialect: 'postgres',
		sql: "CREATE TABLE users (\n\tid SERIAL PRIMARY KEY,\n\temail VARCHAR(255) NOT NULL UNIQUE,\n\tfull_name TEXT,\n\tis_active BOOLEAN NOT NULL DEFAULT TRUE,\n\tbalance NUMERIC(10,2) DEFAULT 0,\n\trole TEXT DEFAULT 'member',\n\tcreated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n\nCREATE TABLE posts (\n\tid SERIAL PRIMARY KEY,\n\ttitle VARCHAR(200) NOT NULL,\n\tauthor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n\tpublished_at TIMESTAMP\n);\n\nCREATE INDEX posts_author_id_idx ON posts (author_id);\n\nCREATE TABLE post_tags (\n\tpost_id INTEGER NOT NULL,\n\ttag TEXT NOT NULL,\n\tPRIMARY KEY (post_id, tag)\n);",
		drizzle:
			"import { boolean, index, integer, numeric, pgTable, primaryKey, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'\n\nexport const users = pgTable('users', {\n\tid: serial().primaryKey(),\n\temail: varchar({ length: 255 }).notNull().unique(),\n\tfullName: text('full_name'),\n\tisActive: boolean('is_active').notNull().default(true),\n\tbalance: numeric({ precision: 10, scale: 2 }).default('0'),\n\trole: text().default('member'),\n\tcreatedAt: timestamp('created_at').defaultNow(),\n})\n\nexport const posts = pgTable('posts', {\n\tid: serial().primaryKey(),\n\ttitle: varchar({ length: 200 }).notNull(),\n\tauthorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),\n\tpublishedAt: timestamp('published_at'),\n}, (t) => [\n\tindex('posts_author_id_idx').on(t.authorId),\n])\n\nexport const postTags = pgTable('post_tags', {\n\tpostId: integer('post_id').notNull(),\n\ttag: text().notNull(),\n}, (t) => [\n\tprimaryKey({ columns: [t.postId, t.tag] }),\n])\n"
	},
	{
		name: 'postgres: the wider type vocabulary',
		dialect: 'postgres',
		sql: 'CREATE TABLE documents (\n\tid UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n\trevision BIGINT NOT NULL,\n\tweight DOUBLE PRECISION,\n\tratio REAL,\n\tflags SMALLINT,\n\tcode CHAR(3),\n\tpayload JSONB NOT NULL,\n\tmeta JSON,\n\tembedding VECTOR(1536),\n\tchecksum BYTEA,\n\tstarts_on DATE,\n\tstarts_at TIME,\n\tupdated_at TIMESTAMPTZ\n);',
		drizzle:
			"import { bigint, char, date, doublePrecision, json, jsonb, pgTable, real, smallint, text, time, timestamp, uuid, vector } from 'drizzle-orm/pg-core'\n\nexport const documents = pgTable('documents', {\n\tid: uuid().primaryKey().defaultRandom(),\n\trevision: bigint({ mode: 'number' }).notNull(),\n\tweight: doublePrecision(),\n\tratio: real(),\n\tflags: smallint(),\n\tcode: char({ length: 3 }),\n\tpayload: jsonb().notNull(),\n\tmeta: json(),\n\tembedding: vector({ dimensions: 1536 }),\n\tchecksum: text(),\n\tstartsOn: date('starts_on'),\n\tstartsAt: time('starts_at'),\n\tupdatedAt: timestamp('updated_at', { withTimezone: true }),\n})\n",
		warnings: [
			'line 11: column "checksum": Postgres BYTEA has no drizzle-orm/pg-core builder; emitted text() — define a customType for binary data'
		]
	},
	{
		name: 'postgres: composite foreign key and multi-column unique index',
		dialect: 'postgres',
		sql: 'CREATE TABLE tenants (\n\tid INTEGER PRIMARY KEY,\n\tregion TEXT NOT NULL\n);\n\nCREATE TABLE memberships (\n\ttenant_id INTEGER NOT NULL,\n\ttenant_region TEXT NOT NULL,\n\tuser_email TEXT NOT NULL,\n\tCONSTRAINT memberships_tenant_fk FOREIGN KEY (tenant_id, tenant_region) REFERENCES tenants (id, region) ON DELETE CASCADE\n);\n\nCREATE UNIQUE INDEX memberships_tenant_user_unique ON memberships (tenant_id, user_email);',
		drizzle:
			"import { foreignKey, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'\n\nexport const tenants = pgTable('tenants', {\n\tid: integer().primaryKey(),\n\tregion: text().notNull(),\n})\n\nexport const memberships = pgTable('memberships', {\n\ttenantId: integer('tenant_id').notNull(),\n\ttenantRegion: text('tenant_region').notNull(),\n\tuserEmail: text('user_email').notNull(),\n}, (t) => [\n\tforeignKey({ columns: [t.tenantId, t.tenantRegion], foreignColumns: [tenants.id, tenants.region] }).onDelete('cascade'),\n\tuniqueIndex('memberships_tenant_user_unique').on(t.tenantId, t.userEmail),\n])\n"
	},
	{
		name: 'postgres: ALTER TABLE ADD column and foreign key',
		dialect: 'postgres',
		sql: 'CREATE TABLE teams (id SERIAL PRIMARY KEY);\nCREATE TABLE players (id SERIAL PRIMARY KEY);\nALTER TABLE players ADD COLUMN team_id INTEGER NOT NULL;\nALTER TABLE players ADD CONSTRAINT players_team_fk FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL;',
		drizzle:
			"import { integer, pgTable, serial } from 'drizzle-orm/pg-core'\n\nexport const teams = pgTable('teams', {\n\tid: serial().primaryKey(),\n})\n\nexport const players = pgTable('players', {\n\tid: serial().primaryKey(),\n\tteamId: integer('team_id').notNull().references(() => teams.id, { onDelete: 'set null' }),\n})\n"
	},
	{
		name: 'mysql: auto_increment, tinyint(1) boolean, table-level key and unique key',
		dialect: 'mysql',
		sql: 'CREATE TABLE `accounts` (\n\t`id` INT NOT NULL AUTO_INCREMENT,\n\t`login` VARCHAR(120) NOT NULL,\n\t`verified` TINYINT(1) NOT NULL DEFAULT 0,\n\t`quota` BIGINT DEFAULT 10,\n\t`created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,\n\tPRIMARY KEY (`id`),\n\tUNIQUE KEY `accounts_login_unique` (`login`),\n\tKEY `accounts_created_idx` (`created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
		drizzle:
			"import { bigint, boolean, datetime, index, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core'\n\nexport const accounts = mysqlTable('accounts', {\n\tid: int().autoincrement().primaryKey(),\n\tlogin: varchar({ length: 120 }).notNull().unique(),\n\tverified: boolean().notNull().default(false),\n\tquota: bigint({ mode: 'number' }).default(10),\n\tcreatedAt: datetime('created_at').defaultNow(),\n}, (t) => [\n\tindex('accounts_created_idx').on(t.createdAt),\n])\n",
		warnings: [
			'line 10: table options (ENGINE = InnoDB DEFAULT CHARSET = utf8mb4) dropped — Drizzle has no IR for them'
		]
	},
	{
		name: 'mysql: composite primary key with a referencing table',
		dialect: 'mysql',
		sql: 'CREATE TABLE `regions` (\n\t`country` CHAR(2) NOT NULL,\n\t`code` VARCHAR(10) NOT NULL,\n\tPRIMARY KEY (`country`, `code`)\n);\nCREATE TABLE `offices` (\n\t`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,\n\t`label` TEXT,\n\t`region_code` VARCHAR(10) NOT NULL,\n\tCONSTRAINT `offices_region_fk` FOREIGN KEY (`region_code`) REFERENCES `regions` (`code`)\n);',
		drizzle:
			"import { char, int, mysqlTable, primaryKey, text, varchar } from 'drizzle-orm/mysql-core'\n\nexport const regions = mysqlTable('regions', {\n\tcountry: char({ length: 2 }).notNull(),\n\tcode: varchar({ length: 10 }).notNull(),\n}, (t) => [\n\tprimaryKey({ columns: [t.country, t.code] }),\n])\n\nexport const offices = mysqlTable('offices', {\n\tid: int().autoincrement().primaryKey(),\n\tlabel: text(),\n\tregionCode: varchar('region_code', { length: 10 }).notNull().references(() => regions.code),\n})\n"
	},
	{
		name: 'sqlite: rowid primary key, affinity types, unique index',
		dialect: 'sqlite',
		sql: 'CREATE TABLE notes (\n\tid INTEGER PRIMARY KEY AUTOINCREMENT,\n\tbody TEXT NOT NULL,\n\tpinned BOOLEAN DEFAULT 0,\n\tscore REAL DEFAULT 0,\n\tattachment BLOB,\n\tcreated_at TIMESTAMP\n);\nCREATE UNIQUE INDEX notes_body_unique ON notes (body);',
		drizzle:
			"import { blob, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'\n\nexport const notes = sqliteTable('notes', {\n\tid: integer().primaryKey({ autoIncrement: true }),\n\tbody: text().notNull().unique(),\n\tpinned: integer().default(0),\n\tscore: real().default(0),\n\tattachment: blob(),\n\tcreatedAt: text('created_at'),\n})\n",
		warnings: [
			'line 4: column "pinned": SQLite has no BOOLEAN; mapped to integer()',
			'line 7: column "created_at": SQLite stores TIMESTAMP as TEXT; emitted text()'
		]
	},
	{
		name: 'sqlite: inline foreign key with referential actions',
		dialect: 'sqlite',
		sql: 'CREATE TABLE authors (\n\tid INTEGER PRIMARY KEY,\n\tname TEXT NOT NULL\n);\nCREATE TABLE books (\n\tid INTEGER PRIMARY KEY,\n\tauthor_id INTEGER NOT NULL,\n\tFOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE ON UPDATE RESTRICT\n);',
		drizzle:
			"import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'\n\nexport const authors = sqliteTable('authors', {\n\tid: integer().primaryKey(),\n\tname: text().notNull(),\n})\n\nexport const books = sqliteTable('books', {\n\tid: integer().primaryKey(),\n\tauthorId: integer('author_id').notNull().references(() => authors.id, { onDelete: 'cascade', onUpdate: 'restrict' }),\n})\n"
	},
	{
		name: 'sqlite: unknown column type degrades to text() with a warning',
		dialect: 'sqlite',
		sql: 'CREATE TABLE odd (\n\tid INTEGER PRIMARY KEY,\n\tshape GEOMETRY\n);',
		drizzle:
			"import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'\n\nexport const odd = sqliteTable('odd', {\n\tid: integer().primaryKey(),\n\tshape: text(),\n})\n",
		warnings: [
			'line 3: column "shape" has type GEOMETRY which has no Drizzle builder in the sqlite dialect; emitted text() — review it'
		]
	},
	{
		name: 'select: bare star',
		dialect: 'postgres',
		sql: 'SELECT * FROM users',
		drizzle: 'db.select().from(users)\n'
	},
	{
		name: 'select: explicit columns',
		dialect: 'postgres',
		sql: 'SELECT id, email, full_name FROM users',
		drizzle:
			'db.select({ id: users.id, email: users.email, fullName: users.fullName }).from(users)\n'
	},
	{
		name: 'select: inner join with aliases, where, order by, limit and offset',
		dialect: 'postgres',
		sql: "SELECT u.id, u.email FROM users u INNER JOIN posts p ON p.author_id = u.id WHERE u.is_active = TRUE AND p.title LIKE '%draft%' ORDER BY u.id DESC, p.title ASC LIMIT 10 OFFSET 5",
		drizzle:
			"import { and, asc, desc, eq, like } from 'drizzle-orm'\n\ndb.select({ id: users.id, email: users.email }).from(users)\n\t.innerJoin(posts, eq(posts.authorId, users.id))\n\t.where(and(eq(users.isActive, true), like(posts.title, '%draft%')))\n\t.orderBy(desc(users.id), asc(posts.title))\n\t.limit(10)\n\t.offset(5)\n",
		warnings: [
			'table alias "u" resolved to "users"; Drizzle query-builder code references the table export directly',
			'table alias "p" resolved to "posts"; Drizzle query-builder code references the table export directly'
		]
	},
	{
		name: 'select: left, right and full joins',
		dialect: 'postgres',
		sql: 'SELECT * FROM users LEFT JOIN posts ON posts.author_id = users.id RIGHT OUTER JOIN teams ON teams.id = users.team_id FULL OUTER JOIN players ON players.id = users.player_id',
		drizzle:
			"import { eq } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.leftJoin(posts, eq(posts.authorId, users.id))\n\t.rightJoin(teams, eq(teams.id, users.teamId))\n\t.fullJoin(players, eq(players.id, users.playerId))\n"
	},
	{
		name: 'select: every comparison operator',
		dialect: 'postgres',
		sql: "SELECT * FROM users WHERE id = 1 AND age != 2 AND score > 3 AND rank >= 4 AND tier < 5 AND level <= 6 AND email LIKE 'a%' AND name ILIKE 'b%'",
		drizzle:
			"import { and, eq, gt, gte, ilike, like, lt, lte, ne } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.where(and(eq(users.id, 1), ne(users.age, 2), gt(users.score, 3), gte(users.rank, 4), lt(users.tier, 5), lte(users.level, 6), like(users.email, 'a%'), ilike(users.name, 'b%')))\n"
	},
	{
		name: 'select: inArray, notInArray, between and notBetween',
		dialect: 'postgres',
		sql: "SELECT * FROM users WHERE id IN (1, 2, 3) AND role NOT IN ('admin', 'owner') AND age BETWEEN 18 AND 30 AND score NOT BETWEEN 0 AND 10",
		drizzle:
			"import { and, between, inArray, notBetween, notInArray } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.where(and(inArray(users.id, [1, 2, 3]), notInArray(users.role, ['admin', 'owner']), between(users.age, 18, 30), notBetween(users.score, 0, 10)))\n"
	},
	{
		name: 'select: isNull, isNotNull and a NOT-wrapped LIKE',
		dialect: 'postgres',
		sql: "SELECT * FROM users WHERE deleted_at IS NULL AND email IS NOT NULL AND name NOT LIKE 'test%'",
		drizzle:
			"import { and, isNotNull, isNull, like, not } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.where(and(isNull(users.deletedAt), isNotNull(users.email), not(like(users.name, 'test%'))))\n"
	},
	{
		name: 'select: nested and/or/not precedence',
		dialect: 'postgres',
		sql: 'SELECT * FROM users WHERE (id = 1 OR id = 2) AND NOT (is_active = FALSE OR banned = TRUE)',
		drizzle:
			"import { and, eq, not, or } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.where(and(or(eq(users.id, 1), eq(users.id, 2)), not(or(eq(users.isActive, false), eq(users.banned, true)))))\n"
	},
	{
		name: 'select: correlated EXISTS and NOT EXISTS',
		dialect: 'postgres',
		sql: 'SELECT * FROM users WHERE EXISTS (SELECT 1 FROM posts WHERE posts.author_id = users.id) AND NOT EXISTS (SELECT 1 FROM bans WHERE bans.user_id = users.id)',
		drizzle:
			"import { and, eq, exists, notExists } from 'drizzle-orm'\n\ndb.select().from(users)\n\t.where(and(exists(db.select().from(posts).where(eq(posts.authorId, users.id))), notExists(db.select().from(bans).where(eq(bans.userId, users.id)))))\n"
	},
	{
		name: 'select: group by with numbered placeholders',
		dialect: 'postgres',
		sql: 'SELECT team_id FROM users WHERE created_at > $1 AND team_id = $2 GROUP BY team_id ORDER BY team_id ASC',
		drizzle:
			"import { and, asc, eq, gt } from 'drizzle-orm'\n\ndb.select({ teamId: users.teamId }).from(users)\n\t.where(and(gt(users.createdAt, p1), eq(users.teamId, p2)))\n\t.groupBy(users.teamId)\n\t.orderBy(asc(users.teamId))\n"
	},
	{
		name: 'select: mysql positional placeholders and LIMIT offset, count',
		dialect: 'mysql',
		sql: 'SELECT id FROM accounts WHERE login = ? AND verified = ? LIMIT 20, 10',
		drizzle:
			"import { and, eq } from 'drizzle-orm'\n\ndb.select({ id: accounts.id }).from(accounts)\n\t.where(and(eq(accounts.login, p1), eq(accounts.verified, p2)))\n\t.limit(10)\n\t.offset(20)\n"
	},
	{
		name: 'select: sqlite named parameter',
		dialect: 'sqlite',
		sql: 'SELECT * FROM notes WHERE id = :noteId',
		drizzle:
			"import { eq } from 'drizzle-orm'\n\ndb.select().from(notes)\n\t.where(eq(notes.id, noteId))\n"
	},
	{
		name: 'insert: single row',
		dialect: 'postgres',
		sql: "INSERT INTO users (email, full_name) VALUES ('a@b.c', 'Ada')",
		drizzle: "db.insert(users).values({ email: 'a@b.c', fullName: 'Ada' })\n"
	},
	{
		name: 'insert: multi-row with returning columns',
		dialect: 'postgres',
		sql: "INSERT INTO users (email, is_active, score) VALUES ('a@b.c', TRUE, 1), ($1, FALSE, NULL) RETURNING id, email",
		drizzle:
			"db.insert(users).values([{ email: 'a@b.c', isActive: true, score: 1 }, { email: p1, isActive: false, score: null }])\n\t.returning({ id: users.id, email: users.email })\n"
	},
	{
		name: 'insert: returning star',
		dialect: 'sqlite',
		sql: "INSERT INTO notes (body, pinned) VALUES ('hello', 0) RETURNING *",
		drizzle: "db.insert(notes).values({ body: 'hello', pinned: 0 })\n\t.returning()\n"
	},
	{
		name: 'update: set with where and returning',
		dialect: 'postgres',
		sql: 'UPDATE users SET full_name = $1, is_active = FALSE WHERE id = $2 RETURNING id',
		drizzle:
			"import { eq } from 'drizzle-orm'\n\ndb.update(users).set({ fullName: p1, isActive: false })\n\t.where(eq(users.id, p2))\n\t.returning({ id: users.id })\n"
	},
	{
		name: 'update: mysql placeholders without returning',
		dialect: 'mysql',
		sql: 'UPDATE accounts SET verified = ?, quota = ? WHERE login = ?',
		drizzle:
			"import { eq } from 'drizzle-orm'\n\ndb.update(accounts).set({ verified: p1, quota: p2 })\n\t.where(eq(accounts.login, p3))\n"
	},
	{
		name: 'delete: with where',
		dialect: 'postgres',
		sql: 'DELETE FROM users WHERE id = $1',
		drizzle: "import { eq } from 'drizzle-orm'\n\ndb.delete(users).where(eq(users.id, p1))\n"
	},
	{
		name: 'delete: compound predicate with returning star',
		dialect: 'postgres',
		sql: 'DELETE FROM users WHERE is_active = FALSE OR email IS NULL RETURNING *',
		drizzle:
			"import { eq, isNull, or } from 'drizzle-orm'\n\ndb.delete(users).where(or(eq(users.isActive, false), isNull(users.email)))\n\t.returning()\n"
	}
]
