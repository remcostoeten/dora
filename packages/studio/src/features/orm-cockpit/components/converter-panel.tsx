/**
 * Drizzle ↔ SQL converter (#162) — a deterministic, offline two-pane translator.
 * Left pane is the input buffer, right pane the read-only result; conversion is
 * debounced on every edit and re-runs when the direction or dialect changes.
 * Failures render in place of the output (never as a toast) so the offending
 * construct stays next to the code that produced it.
 */

import { AlertCircle, ArrowLeftRight, Check, Copy, X } from 'lucide-react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Button } from '@studio/shared/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '@studio/shared/ui/select'
import { useClipboard } from '@studio/shared/hooks/use-clipboard'
import { cn } from '@studio/shared/utils/cn'
import type { ConvertError, Dialect } from '@studio/features/orm-cockpit/converters/contract'
import {
	CONVERTER_DIALECTS,
	type ConverterDirection
} from '@studio/features/orm-cockpit/components/converter-state'
import { useConverter } from '@studio/features/orm-cockpit/components/use-converter'
import { ConverterEditor } from '@studio/features/orm-cockpit/components/converter-editor'

const DIRECTION_LABELS: Record<ConverterDirection, { input: string; output: string }> = {
	'drizzle-to-sql': { input: 'Drizzle', output: 'SQL' },
	'sql-to-drizzle': { input: 'SQL', output: 'Drizzle' }
}

const DIALECT_LABELS: Record<Dialect, string> = {
	postgres: 'PostgreSQL',
	mysql: 'MySQL',
	sqlite: 'SQLite'
}

const INPUT_PLACEHOLDERS: Record<ConverterDirection, string> = {
	'drizzle-to-sql': "Paste Drizzle schema or query code, e.g. pgTable('users', { … })",
	'sql-to-drizzle': 'Paste SQL DDL or a statement, e.g. CREATE TABLE users (…)'
}

function ErrorList({ errors }: { errors: ConvertError[] }) {
	return (
		<div className='h-full overflow-auto p-3'>
			<ul className='space-y-2'>
				{errors.map((error, index) => (
					<li
						key={`${error.code}:${index}`}
						className='flex gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs'
					>
						<AlertCircle className='mt-px h-3.5 w-3.5 shrink-0 text-red-500' />
						<div className='min-w-0 space-y-1'>
							<p className='text-foreground'>{error.message}</p>
							<p className='font-mono text-[10px] uppercase tracking-wide text-muted-foreground'>
								{error.code}
								{error.line === undefined ? '' : ` · line ${error.line}`}
							</p>
						</div>
					</li>
				))}
			</ul>
		</div>
	)
}

function WarningStrip({ warnings, onDismiss }: { warnings: string[]; onDismiss: () => void }) {
	return (
		<div className='flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300'>
			<AlertCircle className='mt-px h-3.5 w-3.5 shrink-0' />
			<ul className='min-w-0 flex-1 space-y-0.5'>
				{warnings.map((warning, index) => (
					<li key={index}>{warning}</li>
				))}
			</ul>
			<button
				type='button'
				onClick={onDismiss}
				className='shrink-0 rounded p-0.5 hover:bg-amber-500/20'
				aria-label='Dismiss warnings'
			>
				<X className='h-3.5 w-3.5' />
			</button>
		</div>
	)
}

export function ConverterPanel() {
	const converter = useConverter()
	const { state, output, warnings, languages } = converter
	const labels = DIRECTION_LABELS[state.direction]
	const { hasCopied, copyToClipboard } = useClipboard()
	const failed = state.result !== null && !state.result.ok

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2'>
				<Select
					value={state.direction}
					onValueChange={(value) => {
						converter.setDirection(value as ConverterDirection)
					}}
				>
					<SelectTrigger className='h-7 w-[190px] text-xs'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='drizzle-to-sql'>Drizzle → SQL</SelectItem>
						<SelectItem value='sql-to-drizzle'>SQL → Drizzle</SelectItem>
					</SelectContent>
				</Select>

				<Button
					variant='ghost'
					size='sm'
					className='h-7 gap-1.5 text-xs'
					onClick={converter.swap}
					title='Flip the direction and move the output into the input'
				>
					<ArrowLeftRight className='h-3.5 w-3.5' />
					Swap
				</Button>

				<Select
					value={state.dialect}
					onValueChange={(value) => {
						converter.setDialect(value as Dialect)
					}}
				>
					<SelectTrigger className='h-7 w-[140px] text-xs'>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{CONVERTER_DIALECTS.map((dialect) => (
							<SelectItem key={dialect} value={dialect}>
								{DIALECT_LABELS[dialect]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<span className='ml-auto text-xs text-muted-foreground'>
					Deterministic — no AI, nothing leaves this machine
				</span>
			</div>

			<PanelGroup direction='horizontal' className='min-h-0 flex-1'>
				<Panel defaultSize={50} minSize={25}>
					<div className='flex h-full flex-col'>
						<div className='flex h-8 shrink-0 items-center border-b border-border/60 px-3 text-xs font-medium text-muted-foreground'>
							{labels.input}
						</div>
						<div className='min-h-0 flex-1'>
							<ConverterEditor
								value={state.input}
								language={languages.input}
								placeholder={INPUT_PLACEHOLDERS[state.direction]}
								onChange={converter.setInput}
							/>
						</div>
					</div>
				</Panel>

				<PanelResizeHandle className='w-1 bg-sidebar-border hover:bg-primary/20' />

				<Panel defaultSize={50} minSize={25}>
					<div className='flex h-full flex-col'>
						<div className='flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-3'>
							<span
								className={cn(
									'text-xs font-medium',
									failed ? 'text-red-500' : 'text-muted-foreground'
								)}
							>
								{failed ? `${labels.output} — conversion failed` : labels.output}
							</span>
							<Button
								variant='ghost'
								size='sm'
								className='h-6 gap-1.5 text-xs'
								disabled={output === ''}
								onClick={() => {
									copyToClipboard(output)
								}}
							>
								{hasCopied ? (
									<Check className='h-3.5 w-3.5 text-emerald-500' />
								) : (
									<Copy className='h-3.5 w-3.5' />
								)}
								{hasCopied ? 'Copied' : 'Copy'}
							</Button>
						</div>
						{warnings.length > 0 ? (
							<WarningStrip
								warnings={warnings}
								onDismiss={converter.dismissWarnings}
							/>
						) : null}
						<div className='min-h-0 flex-1'>
							{state.result !== null && !state.result.ok ? (
								<ErrorList errors={state.result.errors} />
							) : (
								<ConverterEditor
									value={output}
									language={languages.output}
									readOnly
								/>
							)}
						</div>
					</div>
				</Panel>
			</PanelGroup>
		</div>
	)
}
