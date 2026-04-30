import { Copy, Download } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/shared/ui/dialog'

const SQL_KEYWORDS = new Set([
	'alter',
	'boolean',
	'constraint',
	'create',
	'default',
	'delete',
	'foreign',
	'from',
	'index',
	'insert',
	'integer',
	'into',
	'key',
	'not',
	'null',
	'numeric',
	'primary',
	'references',
	'select',
	'serial',
	'table',
	'text',
	'timestamp',
	'unique',
	'update',
	'values',
	'varchar',
])

const TS_KEYWORDS = new Set([
	'boolean',
	'const',
	'default',
	'export',
	'from',
	'import',
	'integer',
	'notNull',
	'numeric',
	'primaryKey',
	'references',
	'serial',
	'text',
	'timestamp',
	'varchar',
])

type PreviewLanguage = 'json' | 'sql' | 'typescript'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description: string
	filename: string
	language: PreviewLanguage
	source: string
	isLoading?: boolean
	onCopy: () => void
	onDownload: () => void
}

function renderJsonLine(line: string, lineIndex: number) {
	const regex =
		/("(?:\\.|[^"])*"(?=\s*:)|"(?:\\.|[^"])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
	const parts: ReactNode[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null = regex.exec(line)

	while (match) {
		if (match.index > lastIndex) {
			parts.push(line.slice(lastIndex, match.index))
		}
		const token = match[0]
		let className = 'sv-code-token--string'
		if (token.startsWith('"') && line.slice(match.index + token.length).trimStart().startsWith(':')) {
			className = 'sv-code-token--property'
		} else if (/^(true|false|null)$/.test(token)) {
			className = 'sv-code-token--literal'
		} else if (!token.startsWith('"')) {
			className = 'sv-code-token--number'
		}
		parts.push(
			<span className={className} key={`${token}-${match.index}`}>
				{token}
			</span>,
		)
		lastIndex = match.index + token.length
		match = regex.exec(line)
	}

	if (lastIndex < line.length) {
		parts.push(line.slice(lastIndex))
	}

	return (
		<span key={`json-${lineIndex}`}>
			{parts}
			{'\n'}
		</span>
	)
}

function renderHighlightedCode(source: string, language: PreviewLanguage) {
	if (language === 'json') {
		return source.split('\n').map(renderJsonLine)
	}

	const keywords = language === 'sql' ? SQL_KEYWORDS : TS_KEYWORDS
	const lines = source.split('\n')
	return lines.map((line, lineIndex) => {
		const isComment = line.trimStart().startsWith('--') || line.trimStart().startsWith('//')
		const parts: ReactNode[] = isComment
			? [<span className='sv-code-token--comment' key='comment'>{line}</span>]
			: line
				.split(/(\b[\w]+\b|'[^']*'|"[^"]*"|`[^`]*`)/g)
				.map((part, partIndex) => {
					if (!part) return null
					if (/^(['"`]).*\1$/.test(part)) {
						return (
							<span className='sv-code-token--string' key={partIndex}>
								{part}
							</span>
						)
					}
					if (/^-?\d+(?:\.\d+)?$/.test(part)) {
						return (
							<span className='sv-code-token--number' key={partIndex}>
								{part}
							</span>
						)
					}
					if (keywords.has(part.toLowerCase())) {
						return (
							<span className='sv-code-token--keyword' key={partIndex}>
								{part}
							</span>
						)
					}
					return part
				})

		return (
			<span key={`${line}-${lineIndex}`}>
				{parts}
				{lineIndex < lines.length - 1 ? '\n' : null}
			</span>
		)
	})
}

export function SchemaExportPreviewDialog({
	open,
	onOpenChange,
	title,
	description,
	filename,
	language,
	source,
	isLoading = false,
	onCopy,
	onDownload,
}: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sv-export-preview-dialog'>
				<DialogHeader className='pr-8'>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className='sv-export-preview-dialog__meta'>
					<span>{filename}</span>
					<span>{language}</span>
				</div>

				<div className='sv-export-preview-dialog__actions'>
					<Button
						variant='outline'
						className='gap-2'
						disabled={isLoading || !source}
						onClick={onCopy}
					>
						<Copy className='h-4 w-4' />
						Copy
					</Button>
					<Button
						className='gap-2'
						disabled={isLoading || !source}
						onClick={onDownload}
					>
						<Download className='h-4 w-4' />
						Download
					</Button>
				</div>

				<pre className='sv-export-preview-dialog__code'>
					<code>
						{isLoading
							? 'Loading preview...'
							: renderHighlightedCode(source, language)}
					</code>
				</pre>
			</DialogContent>
		</Dialog>
	)
}
