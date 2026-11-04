import { commands } from '@studio/lib/bindings'
import { getKeyValueConnectionUrl } from '@studio/features/docker-manager/utilities/container-connection'
import type { DockerContainer } from '@studio/features/docker-manager/types'
import { formatBackendError } from '@studio/shared/utils/backend-error'

type OpenResult = { status: 'ok' } | { status: 'error'; message: string }

let requestedConnectionId: string | null = null

/**
 * @name openContainerInKvStudio
 * @description Saves and connects a key-value connection for a running Redis
 * or Valkey container, reusing an existing one with the same name and URL, and
 * marks it as the connection the KV view should select when it next opens.
 *
 * @example
 * const result = await openContainerInKvStudio(container);
 * if (result.status === 'ok') setActiveNav('kv-studio');
 */
export async function openContainerInKvStudio(container: DockerContainer): Promise<OpenResult> {
	const url = getKeyValueConnectionUrl(container)

	const saved = await commands.kvGetConnections()
	const existing =
		saved.status === 'ok'
			? saved.data.find(function (connection) {
					return connection.name === container.name && connection.config.url === url
				})
			: undefined

	if (existing) {
		if (!existing.connected) {
			const connected = await commands.kvConnect(existing.id)
			if (connected.status === 'error') {
				return { status: 'error', message: formatBackendError(connected.error) }
			}
		}
		requestedConnectionId = existing.id
		return { status: 'ok' }
	}

	const added = await commands.kvAddConnection(container.name, { url })
	if (added.status === 'error') {
		return { status: 'error', message: formatBackendError(added.error) }
	}
	requestedConnectionId = added.data.id
	return { status: 'ok' }
}

/**
 * @name takeRequestedKvConnection
 * @description Returns the connection id queued by openContainerInKvStudio and
 * clears it, so the KV view selects it exactly once.
 *
 * @example
 * const requestedId = takeRequestedKvConnection();
 */
export function takeRequestedKvConnection(): string | null {
	const connectionId = requestedConnectionId
	requestedConnectionId = null
	return connectionId
}
