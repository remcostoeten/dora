import { Copy, Check } from 'lucide-react'
import React from 'react'
import { useClipboard } from '@/shared/hooks/use-clipboard'
import { cn } from '@/shared/utils/cn'

type Props = {
	value: string
}

export function TokenCell({ value }: Props) {
	const { hasCopied, copyToClipboard } = useClipboard()

	// Ensure value is a string
	const text = String(value)

	if (!text) return <span className='text-muted-foreground italic'>NULL</span>
	if (text.length < 20) return <span className='font-mono text-foreground'>{text}</span>

	const start = text.slice(0, 8)
	const end = text.slice(-8)

	function handleCopy(e: React.MouseEvent) {
		e.stopPropagation()
		copyToClipboard(text)
	}

	return (
		<div className='group flex items-center gap-2 min-w-0'>
			<div className='font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate'>
				<span className='text-foreground/80'>{start}</span>
				<span className='text-muted-foreground/40'>...</span>
				<span className='text-foreground/80'>{end}</span>
			</div>
			<button
				onClick={handleCopy}
				className={cn(
					'opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded shrink-0',
					hasCopied && 'opacity-100 text-emerald-500'
				)}
				title='Copy full token'
			>
				{hasCopied ? <Check className='w-3 h-3' /> : <Copy className='w-3 h-3' />}
			</button>
		</div>
	)
}
