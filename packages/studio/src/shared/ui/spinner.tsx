import { cn } from '@studio/shared/utils/cn'

type Props = {
	className?: string
}

/**
 * App-wide loading spinner. A clean two-tone ring with a rotating accent arc.
 * Size and spacing come from `className` (e.g. `h-4 w-4 mr-2`); defaults to `h-4 w-4`.
 * Colour follows `currentColor`, so set text colour on the element or a parent.
 */
export function Spinner({ className }: Props) {
	return (
		<svg
			role='status'
			aria-label='Loading'
			viewBox='0 0 24 24'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={cn('h-4 w-4 animate-spin text-current', className)}
		>
			<circle
				cx='12'
				cy='12'
				r='9'
				stroke='currentColor'
				strokeWidth='2.5'
				className='opacity-20'
			/>
			<path
				d='M21 12a9 9 0 0 0-9-9'
				stroke='currentColor'
				strokeWidth='2.5'
				strokeLinecap='round'
			/>
		</svg>
	)
}
