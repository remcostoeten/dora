export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
export const LAUNCH_CHECK_DELAY_MS = 4000
export const SNOOZE_MS = 24 * 60 * 60 * 1000

export type Snooze = {
	version: string
	until: number
}

export type IndicatorMode =
	| 'hidden'
	| 'available'
	| 'snoozed'
	| 'downloading'
	| 'installed'
	| 'error'

type IndicatorInput = {
	status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'downloading' | 'installed' | 'error'
	errorSource: 'check' | 'download' | null
	availableVersion: string | null
	snooze: Snooze | null
	now: number
}

/**
 * @name isSnoozed
 * @description Tells whether the reminder for a given version is currently
 * paused. A newer version than the snoozed one always breaks the snooze.
 *
 * @example
 * isSnoozed({ version: '0.46.0', until: Date.now() + 1000 }, '0.46.0', Date.now())
 */
export function isSnoozed(snooze: Snooze | null, version: string | null, now: number): boolean {
	if (!snooze || !version) return false
	return snooze.version === version && snooze.until > now
}

/**
 * @name deriveIndicatorMode
 * @description Maps updater state to the single mode the app-wide indicator
 * renders. Failed background checks stay hidden; only a failed download needs
 * the user's attention outside Settings.
 *
 * @example
 * deriveIndicatorMode({ status: 'available', errorSource: null, availableVersion: '0.46.0', snooze: null, now: Date.now() })
 */
export function deriveIndicatorMode(input: IndicatorInput): IndicatorMode {
	switch (input.status) {
		case 'available':
			return isSnoozed(input.snooze, input.availableVersion, input.now)
				? 'snoozed'
				: 'available'
		case 'downloading':
			return 'downloading'
		case 'installed':
			return 'installed'
		case 'error':
			return input.errorSource === 'download' ? 'error' : 'hidden'
		default:
			return 'hidden'
	}
}

/**
 * @name isCheckDue
 * @description Tells whether enough time has passed since the last successful
 * check for a scheduled check to run again.
 *
 * @example
 * isCheckDue(lastCheckedAt, Date.now())
 */
export function isCheckDue(lastCheckedAt: number | null, now: number): boolean {
	if (lastCheckedAt === null) return true
	return now - lastCheckedAt >= CHECK_INTERVAL_MS
}

/**
 * @name parseReleaseNotes
 * @description Extracts bullet lines from release notes markdown, stripping
 * list markers. Falls back to the non-empty, non-heading lines when the notes
 * contain no bullets.
 *
 * @example
 * parseReleaseNotes('## 0.46.0\n\n- Faster open\n- Fixes paste') // ['Faster open', 'Fixes paste']
 */
export function parseReleaseNotes(markdown: string | undefined): string[] {
	if (!markdown) return []
	const lines = markdown
		.split('\n')
		.map((line) => line.trim())
		.filter(Boolean)
	const bullets = lines.filter((line) => /^[-*] /.test(line)).map((line) => line.slice(2).trim())
	if (bullets.length > 0) return bullets
	return lines.filter((line) => !line.startsWith('#'))
}

/**
 * @name formatLastChecked
 * @description Renders a last-checked timestamp as a short relative phrase.
 *
 * @example
 * formatLastChecked(Date.now() - 5 * 60_000, Date.now()) // '5 minutes ago'
 */
export function formatLastChecked(lastCheckedAt: number | null, now: number): string {
	if (lastCheckedAt === null) return 'never'
	const minutes = Math.floor((now - lastCheckedAt) / 60_000)
	if (minutes < 1) return 'just now'
	if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
	const days = Math.floor(hours / 24)
	return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

/**
 * @name formatBytes
 * @description Formats a byte count with a binary unit.
 *
 * @example
 * formatBytes(71722598) // '68.4 MB'
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	const units = ['KB', 'MB', 'GB']
	let value = bytes / 1024
	let unit = 0
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024
		unit += 1
	}
	return `${value.toFixed(1)} ${units[unit]}`
}
