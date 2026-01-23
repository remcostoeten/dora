import { colors, emoji } from "./colors";

type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug'

/**
 * Unified logging function with color and emoji support
 */
export function log(msg: string, color: string = colors.reset): void {
	console.log(`${color}${msg}${colors.reset}`)
}

/**
 * Structured logging with automatic color and emoji
 */
export function logLevel(level: LogLevel, msg: string): void {
	const levelConfig: Record<LogLevel, { color: string; prefix: string }> = {
		info: { color: colors.blue, prefix: emoji.info },
		success: { color: colors.green, prefix: emoji.success },
		warning: { color: colors.yellow, prefix: emoji.warning },
		error: { color: colors.red, prefix: emoji.error },
		debug: { color: colors.gray, prefix: emoji.gear }
	}

	const config = levelConfig[level]
	console.log(`${config.color}${config.prefix} ${msg}${colors.reset}`)
}

/**
 * Print a section header
 */
export function logHeader(title: string): void {
	console.log(`\n${colors.bold}--- ${title} ---${colors.reset}`)
}

/**
 * Print a key-value pair
 */
export function logKeyValue(key: string, value: string): void {
	console.log(`${colors.cyan}${key}:${colors.reset} ${value}`)
}
