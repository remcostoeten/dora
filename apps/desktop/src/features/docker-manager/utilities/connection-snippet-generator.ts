import type { DockerContainer } from '../types'
import { buildConnectionEnvVars } from './connection-string-builder'

export type SnippetLanguage = 'terminal' | 'nodejs' | 'python' | 'prisma'

export function generateSnippet(container: DockerContainer, language: SnippetLanguage): string {
	const passwordEnv = container.env.find((e) => e.startsWith('POSTGRES_PASSWORD='))
	const password = passwordEnv
		? passwordEnv.split('=')[1]
		: container.labels['POSTGRES_PASSWORD'] || 'postgres'

	const primaryPort = container.ports.find((p) => p.containerPort === 5432)
	const host = 'localhost'
	const port = primaryPort?.hostPort ?? 5432
	const user = container.labels['POSTGRES_USER'] || 'postgres'
	const database = container.labels['POSTGRES_DB'] || 'postgres'

	const envVars = buildConnectionEnvVars(host, port, user, password, database)
	const url = envVars.DATABASE_URL

	switch (language) {
		case 'terminal':
			return `PGPASSWORD='${password}' psql -h ${host} -p ${port} -U ${user} -d ${database}`

		case 'nodejs':
			return `import { Client } from 'pg';

const client = new Client({
  connectionString: '${url}'
});

await client.connect();
console.log('Connected!');`

		case 'python':
			return `import psycopg2

conn = psycopg2.connect("${url}")
cur = conn.cursor()
print("Connected!")`

		case 'prisma':
			return `datasource db {
  provider = "postgresql"
  url      = "${url}"
}`

		default:
			return url
	}
}
