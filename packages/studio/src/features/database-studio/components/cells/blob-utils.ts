import type { ColumnDefinition } from '../../types'

/**
 * Backend (`blob_display.rs`) renders binary cells as one of two string forms:
 *  - small blobs (<=64 bytes): an inline uppercase hex string, e.g. `0xDEADBEEF`
 *  - large blobs: a `<type — size>` summary, e.g. `<PNG image — 12.3 KB>`
 * We re-detect these on the frontend so the data grid can render them as a
 * dedicated blob cell (and expose hex/base64/save actions) instead of plain text.
 */

/** Matches the large-blob summary form `<… — …>` produced by `describe_blob`. */
const SUMMARY_RE = /^<.+ — .+>$/

/** Matches the inline hex form `0x` followed by an even count of hex digits. */
const HEX_RE = /^0x([0-9A-Fa-f]{2})*$/

export type TBlobInfo = { kind: 'hex'; hex: string } | { kind: 'summary'; label: string }

/** Column types that store binary data, used as a hint alongside value shape. */
function isBinaryColumnType(column?: ColumnDefinition): boolean {
	const type = column?.type?.toLowerCase() ?? ''
	return (
		type === 'blob' ||
		type === 'bytea' ||
		type.includes('blob') ||
		type.includes('bytea') ||
		type.includes('binary') ||
		type.includes('varbinary')
	)
}

/**
 * Detects whether a cell value is a rendered blob. Returns the parsed shape, or
 * `null` for everything else so normal text/numeric cells are never affected.
 */
export function detectBlob(value: unknown, column?: ColumnDefinition): TBlobInfo | null {
	if (typeof value !== 'string') return null

	const binaryColumn = isBinaryColumnType(column)

	if (HEX_RE.test(value)) {
		// A bare `0x…` is only treated as a blob when the column is binary, so
		// hex-looking text in normal columns is left untouched.
		if (binaryColumn) return { kind: 'hex', hex: value }
		return null
	}

	if (SUMMARY_RE.test(value)) {
		// The summary form is unambiguous (no real text value looks like
		// `<binary — 4.9 KB>`), so accept it with or without column type info.
		return { kind: 'summary', label: value }
	}

	return null
}

/** Strips the `0x` prefix from a rendered hex string. */
export function hexBody(hex: string): string {
	return hex.startsWith('0x') ? hex.slice(2) : hex
}

/** Converts a byte array (the raw-bytes command result) to an uppercase hex string. */
export function bytesToHex(bytes: number[]): string {
	let out = ''
	for (const b of bytes) out += (b & 0xff).toString(16).padStart(2, '0')
	return out.toUpperCase()
}

/** Converts a byte array to a base64 string. */
export function bytesToBase64(bytes: number[]): string {
	let binary = ''
	for (const b of bytes) binary += String.fromCharCode(b & 0xff)
	return btoa(binary)
}
