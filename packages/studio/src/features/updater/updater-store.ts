import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { isDesktopOnlyError, isTauriRuntime } from '@studio/core/platform'
import {
	readStorageItem,
	removeStorageItem,
	writeStorageItem
} from '@studio/shared/lib/safe-storage'
import { SNOOZE_MS, type Snooze } from './update-policy'
import {
	checkForUpdate,
	downloadAndInstall,
	restartApp,
	type TAvailableUpdate,
	type TDownloadProgress,
	type TUpdateHandle
} from './updater-api'

export type TUpdaterStatus =
	| 'idle'
	| 'checking'
	| 'up-to-date'
	| 'available'
	| 'downloading'
	| 'installed'
	| 'error'

export type TUpdateErrorSource = 'check' | 'download'

export type TWhatsNew = {
	version: string
	notes?: string
	date?: string
}

type State = {
	status: TUpdaterStatus
	available: TAvailableUpdate | null
	progress: TDownloadProgress | null
	error: string | null
	errorSource: TUpdateErrorSource | null
	lastCheckedAt: number | null
	autoCheck: boolean
	snooze: Snooze | null
	pendingWhatsNew: TWhatsNew | null
	whatsNew: TWhatsNew | null
	check: () => Promise<void>
	install: () => Promise<void>
	snoozeUpdate: () => void
	clearSnooze: () => void
	setAutoCheck: (enabled: boolean) => void
	dismissWhatsNew: () => void
	surfaceWhatsNew: (currentVersion: string) => void
}

const pendingHandle: { current: TUpdateHandle | null } = { current: null }

const storage: StateStorage = {
	getItem: readStorageItem,
	removeItem: removeStorageItem,
	setItem(name, value) {
		writeStorageItem(name, value, { label: 'Update preferences' })
	}
}

function messageOf(caught: unknown): string {
	return caught instanceof Error ? caught.message : String(caught)
}

export const useUpdaterStore = create<State>()(
	persist(
		(set, get) => ({
			status: 'idle',
			available: null,
			progress: null,
			error: null,
			errorSource: null,
			lastCheckedAt: null,
			autoCheck: true,
			snooze: null,
			pendingWhatsNew: null,
			whatsNew: null,

			async check() {
				const { status } = get()
				if (status === 'checking' || status === 'downloading' || status === 'installed')
					return
				set({ status: 'checking', error: null, errorSource: null })
				try {
					const update = await checkForUpdate()
					const lastCheckedAt = Date.now()
					if (!update) {
						pendingHandle.current = null
						set({ available: null, status: 'up-to-date', lastCheckedAt })
						return
					}
					pendingHandle.current = update
					set({ available: update.info, status: 'available', lastCheckedAt })
				} catch (caught) {
					if (isDesktopOnlyError(caught)) {
						set({ status: 'up-to-date' })
						return
					}
					set({ error: messageOf(caught), errorSource: 'check', status: 'error' })
				}
			},

			async install() {
				const pending = pendingHandle.current
				if (!pending) return
				set({
					status: 'downloading',
					error: null,
					errorSource: null,
					progress: { downloaded: 0 },
					pendingWhatsNew: {
						version: pending.info.version,
						notes: pending.info.notes,
						date: pending.info.date
					}
				})
				try {
					await downloadAndInstall(pending, (progress) => set({ progress }))
					set({ status: 'installed' })
					await restartApp()
				} catch (caught) {
					set({
						error: messageOf(caught),
						errorSource: 'download',
						status: 'error',
						pendingWhatsNew: null
					})
				}
			},

			snoozeUpdate() {
				const { available } = get()
				if (!available) return
				set({ snooze: { version: available.version, until: Date.now() + SNOOZE_MS } })
			},

			clearSnooze() {
				set({ snooze: null })
			},

			setAutoCheck(enabled) {
				set({ autoCheck: enabled })
			},

			dismissWhatsNew() {
				set({ whatsNew: null })
			},

			surfaceWhatsNew(currentVersion) {
				const { pendingWhatsNew } = get()
				if (!pendingWhatsNew) return
				if (pendingWhatsNew.version === currentVersion) {
					set({ whatsNew: pendingWhatsNew, pendingWhatsNew: null })
					return
				}
				set({ pendingWhatsNew: null })
			}
		}),
		{
			name: 'dora.updater',
			version: 1,
			storage: createJSONStorage(() => storage),
			partialize: (state) => ({
				lastCheckedAt: state.lastCheckedAt,
				autoCheck: state.autoCheck,
				snooze: state.snooze,
				pendingWhatsNew: state.pendingWhatsNew
			})
		}
	)
)

/**
 * @name readInstalledVersion
 * @description Resolves the running app version from the Tauri runtime, or
 * null on the web where there is no installed build to compare against.
 *
 * @example
 * const version = await readInstalledVersion()
 */
export async function readInstalledVersion(): Promise<string | null> {
	if (!isTauriRuntime()) return null
	const { getVersion } = await import('@tauri-apps/api/app')
	return getVersion()
}
