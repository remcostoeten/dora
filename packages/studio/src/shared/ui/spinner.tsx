import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@studio/shared/utils/cn'

type Props = ComponentPropsWithoutRef<'span'>

const BLADES = Array.from({ length: 12 }, (_, index) => index)

/**
 * Radial blade spinner: tapered bars fanned around a circle with an opacity
 * ramp, rotated as a group so the brightest blade chases around. Inherits
 * color via `currentColor` and scales with any `size-*` utility.
 *
 * @example
 * ```tsx
 * <Spinner />
 * <Spinner className='size-8 text-[var(--color-accent)]' />
 * ```
 */
export function Spinner({ className, ...props }: Props) {
	return (
		<span
			role='status'
			aria-label='Loading'
			{...props}
			className={cn(
				'relative inline-flex size-4 shrink-0 animate-spin',
				className
			)}
		>
			{BLADES.map((index) => (
				<span
					key={index}
					className='absolute left-1/2 top-1/2 h-[28%] w-[14%] rounded-full bg-current'
					style={{
						opacity: (index + 1) / BLADES.length,
						transform: `translate(-50%, -50%) rotate(${index * 30}deg) translateY(-130%)`,
					}}
				/>
			))}
		</span>
	)
}
