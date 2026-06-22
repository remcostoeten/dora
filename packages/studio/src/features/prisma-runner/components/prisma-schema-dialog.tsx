import { Check, Copy, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle
} from '@studio/shared/ui/dialog'
import { cn } from '@studio/shared/utils/cn'
import { tokenizePrisma, type PrismaTokenKind } from '../utils/highlight-prisma'

type Props = {
	open: boolean
	onOpenChange: (open: boolean) => void
	code: string
}

const TOKEN_CLASS: Record<PrismaTokenKind, string> = {
	keyword: 'text-violet-400',
	type: 'text-sky-400',
	attribute: 'text-amber-400',
	function: 'text-emerald-400',
	comment: 'italic text-muted-foreground/60',
	string: 'text-green-400',
	punctuation: 'text-muted-foreground',
	plain: 'text-foreground/90'
}

export function PrismaSchemaDialog({ open, onOpenChange, code }: Props) {
	const [copied, setCopied] = useState(false)
	const lines = useMemo(() => tokenizePrisma(code), [code])

	function handleCopy() {
		navigator.clipboard
			.writeText(code)
			.then(function () {
				setCopied(true)
				setTimeout(() => setCopied(false), 1500)
			})
			.catch(() => setCopied(false))
	}

	function handleDownload() {
		const blob = new Blob([code], { type: 'text/plain' })
		const url = URL.createObjectURL(blob)
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = 'schema.prisma'
		anchor.click()
		URL.revokeObjectURL(url)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-3xl'>
				<DialogHeader className='pr-8'>
					<DialogTitle>Prisma schema</DialogTitle>
					<DialogDescription>
						Generated from the live database schema — read-only preview.
					</DialogDescription>
				</DialogHeader>

				<div className='flex items-center justify-between gap-2'>
					<span className='font-mono text-xs text-muted-foreground'>schema.prisma</span>
					<div className='flex items-center gap-2'>
						<Button variant='outline' size='sm' className='gap-1.5' onClick={handleCopy}>
							{copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}
							{copied ? 'Copied' : 'Copy'}
						</Button>
						<Button size='sm' className='gap-1.5' onClick={handleDownload}>
							<Download className='h-3.5 w-3.5' />
							Download
						</Button>
					</div>
				</div>

				<pre className='max-h-[60vh] overflow-auto rounded-md border border-border/60 bg-black/30 p-4 text-xs leading-relaxed'>
					<code className='font-mono'>
						{lines.map(function (tokens, lineIndex) {
							return (
								<span className='block' key={lineIndex}>
									{tokens.length === 0
										? ' '
										: tokens.map(function (token, tokenIndex) {
												return (
													<span className={cn(TOKEN_CLASS[token.kind])} key={tokenIndex}>
														{token.text}
													</span>
												)
											})}
								</span>
							)
						})}
					</code>
				</pre>
			</DialogContent>
		</Dialog>
	)
}
