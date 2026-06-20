/**
 * Migration preview — shows the SQL generated from the current diff and hands it
 * off. v1 is preview-only (plan 06): nothing is applied here. The copy/console
 * actions emit exactly what's shown, and destructive/review statements are
 * gated behind explicit opt-in toggles (default off) so a careless copy can't
 * drop data.
 */

import { useMemo, useState } from 'react'
import { Copy, Check, TerminalSquare, AlertTriangle } from 'lucide-react'
import { Button } from '@studio/shared/ui/button'
import { Checkbox } from '@studio/shared/ui/checkbox'
import { toast } from '@studio/shared/ui/notifier'
import { cn } from '@studio/shared/utils/cn'
import type { MigrationResult } from '@studio/features/orm-cockpit/migration/generate-sql'
import {
	buildPreviewSql,
	migrationHasGatedSections,
} from '@studio/features/orm-cockpit/components/migration-sections'

type Props = {
	migration: MigrationResult
	/** Hand the generated SQL to the SQL console (preview → run there). */
	onOpenInSqlConsole?: (sql: string) => void
}

export function MigrationPreview({ migration, onOpenInSqlConsole }: Props) {
	const [includeDestructive, setIncludeDestructive] = useState(false)
	const [includeReview, setIncludeReview] = useState(false)
	const [copied, setCopied] = useState(false)

	const gated = useMemo(
		function () {
			return migrationHasGatedSections(migration.up)
		},
		[migration.up],
	)

	const sql = useMemo(
		function () {
			return buildPreviewSql(migration.up, { includeDestructive, includeReview })
		},
		[migration.up, includeDestructive, includeReview],
	)

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(sql)
			setCopied(true)
			window.setTimeout(function () {
				setCopied(false)
			}, 1500)
		} catch {
			toast.error('Could not copy to clipboard')
		}
	}

	return (
		<div className='flex h-full flex-col'>
			<div className='flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2'>
				<span className='text-xs font-medium text-muted-foreground'>
					Generated SQL — review and run in the SQL console
				</span>
				<div className='ml-auto flex items-center gap-1'>
					<Button
						variant='ghost'
						size='sm'
						className='h-7 gap-1.5 text-xs'
						onClick={handleCopy}
					>
						{copied ? (
							<Check className='h-3.5 w-3.5 text-emerald-500' />
						) : (
							<Copy className='h-3.5 w-3.5' />
						)}
						{copied ? 'Copied' : 'Copy'}
					</Button>
					{onOpenInSqlConsole ? (
						<Button
							variant='outline'
							size='sm'
							className='h-7 gap-1.5 text-xs'
							onClick={function () {
								onOpenInSqlConsole(sql)
							}}
						>
							<TerminalSquare className='h-3.5 w-3.5' />
							Open in SQL console
						</Button>
					) : null}
				</div>
			</div>

			{(gated.hasDestructive || gated.hasReview) && (
				<div className='flex flex-wrap items-center gap-4 border-b border-border/60 bg-muted/30 px-3 py-2'>
					{gated.hasReview ? (
						<label className='flex cursor-pointer items-center gap-2 text-xs text-foreground'>
							<Checkbox
								checked={includeReview}
								onCheckedChange={function (v) {
									setIncludeReview(v === true)
								}}
							/>
							Include review statements
						</label>
					) : null}
					{gated.hasDestructive ? (
						<label className='flex cursor-pointer items-center gap-2 text-xs'>
							<Checkbox
								checked={includeDestructive}
								onCheckedChange={function (v) {
									setIncludeDestructive(v === true)
								}}
							/>
							<span
								className={cn(
									'flex items-center gap-1 font-medium',
									includeDestructive
										? 'text-red-600 dark:text-red-400'
										: 'text-muted-foreground',
								)}
							>
								<AlertTriangle className='h-3.5 w-3.5' />
								Include destructive statements
							</span>
						</label>
					) : null}
				</div>
			)}

			<pre className='flex-1 overflow-auto whitespace-pre bg-background p-3 font-mono text-xs leading-relaxed text-foreground'>
				{sql}
			</pre>
		</div>
	)
}
