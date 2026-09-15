import { useEffect } from 'react'
import { notify } from '@remcostoeten/notifier'
import { subscribeToStorageQuota } from '@studio/shared/lib/safe-storage'

/**
 * Surfaces a full localStorage once, as a single toast, so persistence failing
 * is visible without every store shouting about it. Renders nothing.
 */
export function StorageQuotaNotice() {
	useEffect(function watchStorageQuota() {
		return subscribeToStorageQuota(function onQuotaExceeded({ label, recovered }) {
			if (recovered) {
				notify.info(`Local storage is full — older ${label} was trimmed to make room.`)
				return
			}
			notify.error(
				`Local storage is full — ${label} will not be saved. Clear query history or AI chats to free space.`
			)
		})
	}, [])

	return null
}
