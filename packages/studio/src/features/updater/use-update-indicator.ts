import { useEffect, useState } from 'react'
import { deriveIndicatorMode, type IndicatorMode } from './update-policy'
import { useUpdaterStore } from './updater-store'

export function useUpdateIndicatorMode(): IndicatorMode {
	const status = useUpdaterStore((state) => state.status)
	const errorSource = useUpdaterStore((state) => state.errorSource)
	const availableVersion = useUpdaterStore((state) => state.available?.version ?? null)
	const snooze = useUpdaterStore((state) => state.snooze)
	const [now, setNow] = useState(Date.now)

	useEffect(
		function refreshWhenSnoozeEnds() {
			if (!snooze) return
			const remaining = snooze.until - Date.now()
			if (remaining <= 0) return
			const timer = setTimeout(() => setNow(Date.now()), remaining + 50)
			return () => clearTimeout(timer)
		},
		[snooze]
	)

	return deriveIndicatorMode({ status, errorSource, availableVersion, snooze, now })
}

export function useDownloadFraction(): number {
	const progress = useUpdaterStore((state) => state.progress)
	if (!progress?.contentLength) return 0
	return Math.min(1, progress.downloaded / progress.contentLength)
}
