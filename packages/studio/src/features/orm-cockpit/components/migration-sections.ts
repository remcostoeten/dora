/**
 * Pure helpers that re-derive what the cockpit actually copies from the single
 * `up` string `generateMigrationSql` returns (plan 06). The generator always
 * emits a safe-by-default script: destructive ops live under a banner, review
 * ops are commented out. The cockpit makes including either an explicit,
 * deliberate toggle, so we split the script back into sections and reassemble
 * only the parts the user opted into.
 *
 * The split keys off the two stable marker strings the generator writes. If
 * those banners ever change, update the constants here in lockstep (the unit
 * tests pin the round-trip).
 */

/** Must match `DESTRUCTIVE_BANNER` in `migration/generate-sql.ts`. */
export const DESTRUCTIVE_BANNER =
	'-- ⚠ DESTRUCTIVE: drops or rewrites data — review before running'

/** Must match the review header in `migration/generate-sql.ts` `renderUp`. */
export const REVIEW_HEADER =
	'-- The following changes need review and are commented out. Enable them deliberately.'

export type MigrationSections = {
	/** `true` when the script is transaction-wrapped (postgres). */
	wrapped: boolean
	/** Creates + additive ALTERs — always safe to apply. */
	safe: string
	/** Destructive block (banner + statements), or '' when none. */
	destructive: string
	/** Review block (header + commented statements), or '' when none. */
	review: string
}

function stripWrapper(up: string): { wrapped: boolean; body: string } {
	const trimmed = up.trim()
	if (trimmed.startsWith('BEGIN;') && trimmed.endsWith('COMMIT;')) {
		const body = trimmed.slice('BEGIN;'.length, trimmed.length - 'COMMIT;'.length).trim()
		return { wrapped: true, body }
	}
	return { wrapped: false, body: trimmed }
}

/** Split a generated `up` script into its safe / destructive / review sections. */
export function splitMigrationSql(up: string): MigrationSections {
	const { wrapped, body } = stripWrapper(up)

	const destructiveIdx = body.indexOf(DESTRUCTIVE_BANNER)
	const reviewIdx = body.indexOf(REVIEW_HEADER)

	// The safe section runs up to the first marker present (if any).
	const markerIdxs = [destructiveIdx, reviewIdx].filter((i) => i >= 0)
	const safeEnd = markerIdxs.length > 0 ? Math.min(...markerIdxs) : body.length
	const safe = body.slice(0, safeEnd).trim()

	let destructive = ''
	if (destructiveIdx >= 0) {
		const end = reviewIdx > destructiveIdx ? reviewIdx : body.length
		destructive = body.slice(destructiveIdx, end).trim()
	}

	let review = ''
	if (reviewIdx >= 0) {
		review = body.slice(reviewIdx).trim()
	}

	return { wrapped, safe, destructive, review }
}

/** Uncomment a review block so its statements become runnable SQL. */
function uncommentReview(review: string): string {
	const lines = review.split('\n')
	const out: string[] = []
	for (const line of lines) {
		if (line === REVIEW_HEADER) {
			out.push('-- Review changes (enabled below):')
			continue
		}
		if (line.startsWith('-- REVIEW:')) {
			// Keep the reason as an annotation comment.
			out.push(line)
			continue
		}
		if (line.startsWith('-- ')) {
			out.push(line.slice('-- '.length))
			continue
		}
		out.push(line)
	}
	return out.join('\n').trim()
}

export type PreviewOptions = {
	includeDestructive: boolean
	includeReview: boolean
}

/**
 * Build the exact SQL the cockpit will display *and* copy, honoring the
 * destructive/review opt-ins. Display and clipboard use the same text so what
 * the user sees is what they run.
 */
export function buildPreviewSql(up: string, options: PreviewOptions): string {
	const sections = splitMigrationSql(up)
	const blocks: string[] = []

	if (sections.safe && sections.safe !== '-- No changes.') {
		blocks.push(sections.safe)
	}
	if (options.includeDestructive && sections.destructive) {
		blocks.push(sections.destructive)
	}
	if (options.includeReview && sections.review) {
		blocks.push(uncommentReview(sections.review))
	}

	if (blocks.length === 0) {
		// Everything is gated off (or there were no safe changes at all).
		return sections.safe || '-- No changes selected.'
	}

	const body = blocks.join('\n\n')
	return sections.wrapped ? `BEGIN;\n\n${body}\n\nCOMMIT;` : body
}

/** Whether the script carries destructive / review sections at all. */
export function migrationHasGatedSections(up: string): {
	hasDestructive: boolean
	hasReview: boolean
} {
	const sections = splitMigrationSql(up)
	return {
		hasDestructive: sections.destructive.length > 0,
		hasReview: sections.review.length > 0,
	}
}
