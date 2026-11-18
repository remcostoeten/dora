import { useEffect, useId, useState } from 'react'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { resolveGoToTarget, type GoToContext, type GoToResult } from './grid-go-to'

type Props = {
	context: GoToContext
	onGo: (target: Extract<GoToResult, { status: 'ok' }>) => void
	onClose: (restoreGridFocus: boolean) => void
	onAnnounce: (text: string) => void
}

const HINT = 'Row (120), column (email), or both (120:email, 120,3)'

function describeResult(result: GoToResult): string {
	if (result.status === 'empty') return HINT
	if (result.status === 'error') return result.message
	return result.isLoaded ? result.label : `${result.label} (loads another page)`
}

export function GoToCellPrompt({ context, onGo, onClose, onAnnounce }: Props) {
	const [query, setQuery] = useState('')
	const hintId = useId()
	const result = resolveGoToTarget(query, context)
	const hint = describeResult(result)

	useEffect(() => {
		onAnnounce(hint)
	}, [hint, onAnnounce])

	return (
		<div
			role='dialog'
			aria-label='Go to cell'
			className='absolute right-3 top-11 z-40 w-72 rounded-md border border-sidebar-border bg-popover p-2 shadow-md'
		>
			<Input
				autoFocus
				value={query}
				placeholder='Go to cell'
				aria-label='Go to cell'
				aria-describedby={hintId}
				aria-invalid={result.status === 'error'}
				data-no-shortcuts='true'
				spellCheck={false}
				autoComplete='off'
				className='font-mono'
				onChange={(event) => setQuery(event.target.value)}
				onBlur={() => onClose(false)}
				onKeyDown={(event) => {
					event.stopPropagation()
					if (event.key === 'Escape') {
						event.preventDefault()
						onClose(true)
						return
					}
					if (event.key !== 'Enter') return
					event.preventDefault()
					if (result.status === 'ok') onGo(result)
				}}
			/>
			<p
				id={hintId}
				className={cn(
					'mt-1.5 px-1 text-xs text-muted-foreground',
					result.status === 'error' && 'text-red-500'
				)}
			>
				{hint}
			</p>
		</div>
	)
}
