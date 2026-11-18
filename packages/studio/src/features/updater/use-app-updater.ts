import { useUpdaterStore } from './updater-store'

export type { TUpdaterStatus } from './updater-store'

export function useAppUpdater() {
	return useUpdaterStore()
}
