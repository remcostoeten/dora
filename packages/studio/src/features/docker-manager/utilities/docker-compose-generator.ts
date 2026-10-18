import type { DockerContainer } from '../types'
import { detectDatabaseProvider } from './container-connection'

export function generateDockerCompose(container: DockerContainer): string {
	const serviceName = container.name || 'postgres'
	const image = `${container.image}:${container.imageTag}`
	const provider = detectDatabaseProvider(container)

	// Filter out internal env vars if any (e.g. self-managed ones)
	// For now we include all, but formatted as object or list
	const envVars = container.env.reduce(
		(acc, env) => {
			const [key, value] = env.split('=')
			// Filter out empty keys
			if (key) {
				acc[key] = value || ''
			}
			return acc
		},
		{} as Record<string, string>
	)

	const ports = container.ports.map((p) => `"${p.hostPort}:${p.containerPort}"`)

	// Construct the YAML string manually to avoid heavy dependencies like 'js-yaml' for this simple use case
	// We use 2-space indentation

	let yaml = `version: '3.8'

services:
  ${serviceName}:
    image: ${image}
    container_name: ${container.name}
    restart: unless-stopped`

	// Ports
	if (ports.length > 0) {
		yaml += `\n    ports:`
		ports.forEach((p) => {
			yaml += `\n      - ${p}`
		})
	}

	// Environment
	const envKeys = Object.keys(envVars)
	if (envKeys.length > 0) {
		yaml += `\n    environment:`
		envKeys.forEach((key) => {
			yaml += `\n      ${key}: ${envVars[key]}`
		})
	}

	const volumePath =
		provider === 'redis' || provider === 'valkey'
			? '/data'
			: provider === 'mariadb' || provider === 'mysql'
				? '/var/lib/mysql'
				: provider === 'cockroach'
					? '/cockroach-data'
					: '/var/lib/postgresql/data'

	if (container.volumes.length > 0 || provider !== 'cockroach') {
		yaml += `\n    volumes:`
		yaml += `\n      - ${container.name}-data:${volumePath}`
	}

	if (provider === 'cockroach') {
		yaml += `\n    command:`
		yaml += `\n      - start-single-node`
		yaml += `\n      - --insecure`
		yaml += `\n      - --listen-addr=0.0.0.0:26257`
		yaml += `\n      - --http-addr=0.0.0.0:8080`
		yaml += `\n      - --store=/cockroach-data`
	} else if (provider === 'redis' || provider === 'valkey') {
		yaml += `\n    command:`
		yaml += `\n      - ${provider}-server`
		yaml += `\n      - --appendonly`
		yaml += `\n      - "yes"`
	}

	if (container.volumes.length > 0 || provider !== 'cockroach') {
		yaml += `\n\nvolumes:
  ${container.name}-data:`
	}

	return yaml
}
