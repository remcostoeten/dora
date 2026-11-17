import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Copy, FileCode2, TerminalSquare } from 'lucide-react'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import {
	statementMatchesRef,
	type MigrationPlan
} from '@studio/features/orm-cockpit/components/migration-plan'
import type { DiffRef } from '@studio/features/orm-cockpit/components/drift-view'

type Props = {
	plan: MigrationPlan
	sourceLabel: string
	hovered: DiffRef | null
	pinned: DiffRef | null
	includeDestructive: boolean
	includeReview: boolean
	onIncludeDestructiveChange: (include: boolean) => void
	onIncludeReviewChange: (include: boolean) => void
	onStatementHover: (ref: DiffRef | null) => void
	onOpenInSqlConsole?: (sql: string) => void
}

const KEYWORDS = new Set(
	'CREATE TABLE ALTER ADD COLUMN DROP SET DATA TYPE NOT NULL DEFAULT PRIMARY KEY UNIQUE INDEX ON USING CONSTRAINT FOREIGN REFERENCES CASCADE UPDATE AS ENUM BEGIN COMMIT WITH TIME ZONE IF EXISTS INSERT INTO VALUES DELETE RENAME TO MODIFY CHANGE RESTRICT ACTION NO AUTO_INCREMENT AUTOINCREMENT'.split(
		' '
	)
)

// Matches, in order: a line comment, a single-quoted string, a quoted identifier, a backticked identifier, a number, a word.
const TOKEN = /(--.*$)|('(?:[^']|'')*')|("[^"]*")|(`[^`]*`)|(\b\d+\b)|(\b[A-Za-z_]+\b)/g

function highlightLine(line: string): ReactNode[] {
	const out: ReactNode[] = []
	let last = 0
	for (const match of line.matchAll(TOKEN)) {
		const index = match.index ?? 0
		if (index > last) out.push(line.slice(last, index))
		const [token, comment, str, quoted, backticked, num, word] = match
		let cls = ''
		if (comment) cls = 'sd-k-cm'
		else if (str) cls = 'sd-k-st'
		else if (quoted || backticked || num) cls = 'sd-k-id'
		else if (word && KEYWORDS.has(word.toUpperCase()) && word === word.toUpperCase())
			cls = 'sd-k-kw'
		out.push(
			cls ? (
				<span key={index} className={cls}>
					{token}
				</span>
			) : (
				token
			)
		)
		last = index + token.length
	}
	if (last < line.length) out.push(line.slice(last))
	return out
}

export function MigrationPreview({
	plan,
	sourceLabel,
	hovered,
	pinned,
	includeDestructive,
	includeReview,
	onIncludeDestructiveChange,
	onIncludeReviewChange,
	onStatementHover,
	onOpenInSqlConsole
}: Props) {
	const [copied, setCopied] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)
	const statementCount = plan.statements.length
	const destructiveCount = plan.statements.filter(
		(s) => s.section === 'destructive' && s.review === null
	).length

	useEffect(
		function () {
			if (!pinned || !scrollRef.current) return
			const box = scrollRef.current
			const target = Array.from(box.querySelectorAll<HTMLElement>('[data-stmt]')).find((el) =>
				statementMatchesRef(
					{ table: el.dataset.table ?? null, target: el.dataset.target || null },
					pinned
				)
			)
			if (!target) return
			const tr = target.getBoundingClientRect()
			const br = box.getBoundingClientRect()
			if (tr.top < br.top + 8 || tr.bottom > br.bottom - 8) {
				const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
				box.scrollTo({
					top: box.scrollTop + tr.top - br.top - 48,
					behavior: reduced ? 'auto' : 'smooth'
				})
			}
		},
		[pinned, plan]
	)

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(plan.text)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 1400)
		} catch {
			toast.error('Could not copy to clipboard')
		}
	}

	const lineStarts: number[] = []
	let lineCount = 0
	for (const block of plan.blocks) {
		lineStarts.push(lineCount)
		if (block.kind !== 'gap') lineCount += block.sql.split('\n').length
	}

	return (
		<div className='sd-sql'>
			<div className='sd-sql-h'>
				<span className='sd-eyebrow'>SQL preview</span>
				<span className='sd-live'>
					<span key={plan.text} className='sd-dot' />
					live
				</span>
				<span className='sd-fn'>
					<FileCode2 />
					<span>{sourceLabel}</span>
				</span>
				<span className='sd-grow' />
				<button
					type='button'
					className='sd-btn is-ghost'
					onClick={handleCopy}
					disabled={statementCount === 0}
				>
					{copied ? <Check /> : <Copy />}
					{copied ? 'Copied' : 'Copy SQL'}
				</button>
			</div>
			<div
				ref={scrollRef}
				className='sd-sql-scroll'
				aria-live='polite'
				onMouseLeave={() => onStatementHover(null)}
			>
				{plan.blocks.length === 0 ? (
					<div className='sd-sql-empty'>
						<div>
							<p className='sd-sql-empty-t'>No statements</p>
							<p className='sd-sql-empty-s'>
								{plan.heldBackDestructive + plan.heldBackReview > 0
									? 'Everything included is held back. Allow the statements below to add them.'
									: 'Include at least one table on the left and its SQL appears here as you go.'}
							</p>
						</div>
					</div>
				) : (
					plan.blocks.map(function (block, blockIndex) {
						if (block.kind === 'gap') return <div key={block.key} className='sd-gap' />
						const ref =
							block.table !== null
								? { table: block.table, target: block.target }
								: null
						const isHl =
							block.kind === 'statement' && statementMatchesRef(block, hovered)
						const isPin =
							block.kind === 'statement' && statementMatchesRef(block, pinned)
						return (
							<div
								key={block.key}
								data-stmt={block.kind === 'statement' ? '' : undefined}
								data-table={block.table ?? undefined}
								data-target={block.target ?? undefined}
								className={cn(
									'sd-stmt',
									block.destructive && 'is-destructive',
									isHl && 'is-hl',
									isPin && 'is-pin'
								)}
								onMouseEnter={() => onStatementHover(ref)}
							>
								{block.sql.split('\n').map(function (line, i) {
									return (
										<div key={i} className='sd-ln'>
											<span className='sd-no'>
												{lineStarts[blockIndex] + i + 1}
											</span>
											<span className='sd-code'>{highlightLine(line)}</span>
										</div>
									)
								})}
								{block.destructive ? (
									<span className='sd-tag'>destructive</span>
								) : block.review ? (
									<span className='sd-tag is-review'>check</span>
								) : null}
							</div>
						)
					})
				)}
			</div>
			{plan.heldBackDestructive > 0 ||
			plan.heldBackReview > 0 ||
			includeDestructive ||
			includeReview ? (
				<div className='sd-gate'>
					{plan.heldBackReview > 0 || includeReview ? (
						<label className='sd-gate-opt'>
							<input
								type='checkbox'
								checked={includeReview}
								onChange={(event) => onIncludeReviewChange(event.target.checked)}
							/>
							<span>
								Enable statements that need a check
								{plan.heldBackReview > 0 ? (
									<span className='sd-quiet'>
										{' '}
										· {plan.heldBackReview} held back
									</span>
								) : null}
							</span>
						</label>
					) : null}
					{plan.heldBackDestructive > 0 || includeDestructive ? (
						<label className='sd-gate-opt'>
							<input
								type='checkbox'
								checked={includeDestructive}
								onChange={(event) =>
									onIncludeDestructiveChange(event.target.checked)
								}
							/>
							<span>
								Allow destructive statements
								{plan.heldBackDestructive > 0 ? (
									<span className='sd-quiet'>
										{' '}
										· {plan.heldBackDestructive} held back
									</span>
								) : null}
							</span>
						</label>
					) : null}
				</div>
			) : null}
			<div className='sd-sql-f'>
				<span className='sd-info'>
					{statementCount > 0 ? (
						<>
							<b>{statementCount}</b> statement{statementCount === 1 ? '' : 's'} ·{' '}
							{destructiveCount > 0 ? (
								<span className='sd-x'>{destructiveCount} destructive</span>
							) : (
								'nothing destructive'
							)}
						</>
					) : (
						'Nothing to run'
					)}
				</span>
				{onOpenInSqlConsole ? (
					<button
						type='button'
						className='sd-btn is-primary'
						disabled={statementCount === 0}
						onClick={() => onOpenInSqlConsole(plan.text)}
					>
						<TerminalSquare />
						Open in SQL console
					</button>
				) : null}
			</div>
		</div>
	)
}
