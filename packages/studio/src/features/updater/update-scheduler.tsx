import { useEffect } from 'react'
import { isTauriRuntime } from '@studio/core/platform'
import { CHECK_INTERVAL_MS, LAUNCH_CHECK_DELAY_MS, isCheckDue } from './update-policy'
import { readInstalledVersion, useUpdaterStore } from './updater-store'

export function UpdateScheduler() {
	const autoCheck = useUpdaterStore((state) => state.autoCheck)

	useEffect(function surfaceWhatsNewAfterRestart() {
		let cancelled = false
		void readInstalledVersion().then((version) => {
			if (!cancelled && version) useUpdaterStore.getState().surfaceWhatsNew(version)
		})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(
		function runScheduledChecks() {
			if (!autoCheck || !isTauriRuntime()) return

			function runIfDue() {
				const { lastCheckedAt, check } = useUpdaterStore.getState()
				if (isCheckDue(lastCheckedAt, Date.now())) void check()
			}

			const launchTimer = setTimeout(
				() => void useUpdaterStore.getState().check(),
				LAUNCH_CHECK_DELAY_MS
			)
			const interval = setInterval(runIfDue, CHECK_INTERVAL_MS)
			window.addEventListener('focus', runIfDue)
			return () => {
				clearTimeout(launchTimer)
				clearInterval(interval)
				window.removeEventListener('focus', runIfDue)
			}
		},
		[autoCheck]
	)

	return null
}
