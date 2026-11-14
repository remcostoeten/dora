import { commands } from '@studio/lib/bindings'
import { isDesktopOnlyError } from '@studio/core/platform/runtime'
import { formatBackendError } from '@studio/shared/utils/backend-error'
import type { Connection } from '../../types'
import { frontendToBackendDatabaseInfo } from '../../utils/mapping'
import type { NewConnection } from './connection-mapping'
import type { TestOutcome } from './store'

/**
 * @name runConnectionTest
 * @description Asks the backend to open the connection described by the draft
 * and reports the outcome. The draft goes through the same mapping the save
 * path uses, so a passing test means the saved connection will open.
 *
 * @example
 * const outcome = await runConnectionTest(draft, null)
 * if (outcome.kind === 'failed') showError(outcome.message)
 */
export async function runConnectionTest(
	draft: NewConnection,
	editingId: string | null
): Promise<TestOutcome> {
	try {
		const info = frontendToBackendDatabaseInfo({
			...draft,
			id: editingId ?? '',
			createdAt: 0
		} satisfies Connection)
		const result = await commands.testConnection(info, editingId)
		if (result.status === 'ok' && result.data) return { kind: 'ok' }
		return {
			kind: 'failed',
			message:
				result.status === 'error' ? formatBackendError(result.error) : 'Connection failed'
		}
	} catch (error) {
		if (isDesktopOnlyError(error)) return { kind: 'desktop-only' }
		return {
			kind: 'failed',
			message: error instanceof Error ? error.message : 'Unexpected error'
		}
	}
}
