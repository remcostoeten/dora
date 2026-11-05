import { describe, expect, it } from 'vitest'
import { detectOrm, type ProjectReader } from '@studio/features/orm-cockpit/link/detect-orm'

/**
 * Build a ProjectReader from a flat path→text map (paths are absolute). `listDir`
 * returns the immediate children at a level — synthesizing intermediate
 * directories from deeper file keys, like a real filesystem read_dir does.
 */
function makeReader(files: Record<string, string>): ProjectReader {
	return {
		async readFile(path) {
			return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null
		},
		async listDir(dir) {
			const prefix = `${dir.replace(/\/+$/, '')}/`
			const out = new Set<string>()
			for (const path of Object.keys(files)) {
				if (!path.startsWith(prefix)) {
					continue
				}
				const segment = path.slice(prefix.length).split('/')[0]
				out.add(prefix + segment)
			}
			return Array.from(out)
		}
	}
}

const ROOT = '/proj'

describe('detectOrm — prisma', function () {
	it('detects a prisma/schema.prisma project', async function () {
		const reader = makeReader({
			'/proj/prisma/schema.prisma': 'model User { id Int @id }'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.orm).toBe('prisma')
		expect(result.link.schemaFiles.map((f) => f.path)).toEqual(['/proj/prisma/schema.prisma'])
	})

	it('collects a multi-file prisma/schema directory', async function () {
		const reader = makeReader({
			'/proj/prisma/schema/user.prisma': 'model User { id Int @id }',
			'/proj/prisma/schema/post.prisma': 'model Post { id Int @id }',
			'/proj/prisma/schema/readme.md': 'ignore me'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.orm).toBe('prisma')
		expect(result.link.schemaFiles.map((f) => f.path).sort()).toEqual([
			'/proj/prisma/schema/post.prisma',
			'/proj/prisma/schema/user.prisma'
		])
	})

	it('honors a package.json prisma.schema field', async function () {
		const reader = makeReader({
			'/proj/package.json': JSON.stringify({ prisma: { schema: 'db/custom.prisma' } }),
			'/proj/db/custom.prisma': 'model User { id Int @id }'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.schemaFiles.map((f) => f.path)).toContain('/proj/db/custom.prisma')
	})
})

describe('detectOrm — drizzle', function () {
	it('reads the schema path out of drizzle.config.ts', async function () {
		const reader = makeReader({
			'/proj/drizzle.config.ts': "export default { schema: './src/db/schema.ts' }",
			'/proj/src/db/schema.ts': "export const users = pgTable('users', {})"
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.orm).toBe('drizzle')
		expect(result.link.configPath).toBe('/proj/drizzle.config.ts')
		expect(result.link.schemaFiles.map((f) => f.path)).toEqual(['/proj/src/db/schema.ts'])
	})

	it('expands a glob schema path into directory files', async function () {
		const reader = makeReader({
			'/proj/drizzle.config.ts': "export default { schema: './src/db/schema/*.ts' }",
			'/proj/src/db/schema/users.ts': 'export const users = {}',
			'/proj/src/db/schema/posts.ts': 'export const posts = {}'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.schemaFiles.map((f) => f.path).sort()).toEqual([
			'/proj/src/db/schema/posts.ts',
			'/proj/src/db/schema/users.ts'
		])
	})

	it('falls back to common locations when there is no config', async function () {
		const reader = makeReader({
			'/proj/src/db/schema.ts': "export const users = pgTable('users', {})"
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.orm).toBe('drizzle')
		expect(result.link.configPath).toBeUndefined()
		expect(result.link.schemaFiles.map((f) => f.path)).toEqual(['/proj/src/db/schema.ts'])
	})

	it('expands a recursive ** glob across nested feature folders', async function () {
		const reader = makeReader({
			'/proj/drizzle.config.ts': "export default { schema: './src/features/**/*.schema.ts' }",
			'/proj/src/features/auth/auth.schema.ts': 'export const users = {}',
			'/proj/src/features/entries/entries.schema.ts': 'export const entries = {}',
			'/proj/src/features/auth/auth.service.ts': 'ignore me',
			'/proj/src/db/client.ts': 'ignore me too'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.schemaFiles.map((f) => f.path).sort()).toEqual([
			'/proj/src/features/auth/auth.schema.ts',
			'/proj/src/features/entries/entries.schema.ts'
		])
	})
})

describe('detectOrm — monorepo workspaces', function () {
	it('finds a Drizzle project nested under apps/* when the repo root is linked', async function () {
		const reader = makeReader({
			'/proj/package.json': JSON.stringify({ workspaces: ['apps/*', 'packages/*'] }),
			'/proj/apps/api/drizzle.config.ts':
				"export default { schema: './src/features/**/*.schema.ts' }",
			'/proj/apps/api/src/features/auth/auth.schema.ts': 'export const users = {}',
			'/proj/apps/web/package.json': '{}'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.orm).toBe('drizzle')
		expect(result.link.rootDir).toBe('/proj/apps/api')
		expect(result.link.configPath).toBe('/proj/apps/api/drizzle.config.ts')
		expect(result.link.schemaFiles.map((f) => f.path)).toEqual([
			'/proj/apps/api/src/features/auth/auth.schema.ts'
		])
	})

	it('finds workspaces via pnpm-workspace.yaml', async function () {
		const reader = makeReader({
			'/proj/pnpm-workspace.yaml': 'packages:\n  - "services/*"\n',
			'/proj/services/db/drizzle.config.ts': "export default { schema: './schema.ts' }",
			'/proj/services/db/schema.ts': 'export const users = {}'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('linked')
		if (result.kind !== 'linked') return
		expect(result.link.rootDir).toBe('/proj/services/db')
	})

	it('offers a choice when multiple workspaces each have a schema', async function () {
		const reader = makeReader({
			'/proj/apps/api/drizzle.config.ts': "export default { schema: './schema.ts' }",
			'/proj/apps/api/schema.ts': 'export const a = {}',
			'/proj/apps/worker/prisma/schema.prisma': 'model B { id Int @id }'
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('choice')
		if (result.kind !== 'choice') return
		expect(result.options.map((o) => o.rootDir).sort()).toEqual([
			'/proj/apps/api',
			'/proj/apps/worker'
		])
	})
})

describe('detectOrm — ambiguous and empty', function () {
	it('offers a choice when both ORMs are present', async function () {
		const reader = makeReader({
			'/proj/prisma/schema.prisma': 'model User { id Int @id }',
			'/proj/drizzle.config.ts': "export default { schema: './src/db/schema.ts' }",
			'/proj/src/db/schema.ts': "export const users = pgTable('users', {})"
		})
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('choice')
		if (result.kind !== 'choice') return
		expect(result.options.map((o) => o.orm).sort()).toEqual(['drizzle', 'prisma'])
	})

	it('reports none with guidance when neither ORM is found', async function () {
		const reader = makeReader({ '/proj/README.md': 'hello' })
		const result = await detectOrm(ROOT, reader)
		expect(result.kind).toBe('none')
		if (result.kind !== 'none') return
		expect(result.message).toMatch(/Drizzle or Prisma/)
	})
})
