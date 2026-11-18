import { useId, useState } from 'react'
import { Input } from '@studio/shared/ui/input'
import { cn } from '@studio/shared/utils/cn'
import { resolveGoToTarget, type GoToContext, type GoToResult } from './grid-go-to'

type Props = {
	context: GoToContext
	onGo: (target: Extract<GoToResult, { status: 'ok' }>) => void
	onClose: (restoreGridFocus: boolean) => void
}

const HINT = 'Row (120), column (email), or both (120:email, 120,3)'

export function GoToCellPrompt({ context, onGo, onClose }: Props) {
	const [query, setQuery] = useState('')
	const hintId = useId()
	const result = resolveGoToTarget(query, context)

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
				role='status'
				className={cn(
					'mt-1.5 px-1 text-xs text-muted-foreground',
					result.status === 'error' && 'text-red-500'
				)}
			>
				{result.status === 'empty' && HINT}
				{result.status === 'error' && result.message}
				{result.status === 'ok' &&
					(result.isLoaded ? result.label : `${result.label} (loads another page)`)}
			</p>
		</div>
	)
}
