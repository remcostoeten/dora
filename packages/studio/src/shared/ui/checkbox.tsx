import { Check } from 'lucide-react'
import * as React from 'react'
import { cn } from '@studio/shared/utils/cn'

type CheckedState = boolean | 'indeterminate'

type Props = Omit<
	React.ComponentPropsWithoutRef<'button'>,
	'checked' | 'defaultChecked' | 'onChange' | 'name' | 'value' | 'form' | 'type' | 'role'
> & {
	checked?: CheckedState
	defaultChecked?: CheckedState
	onCheckedChange?: (checked: CheckedState) => void
}

function stateOf(checked: CheckedState) {
	if (checked === 'indeterminate') return 'indeterminate'
	return checked ? 'checked' : 'unchecked'
}

const Checkbox = React.forwardRef<HTMLButtonElement, Props>(function Checkbox(
	{
		className,
		checked: checkedProp,
		defaultChecked = false,
		onCheckedChange,
		onClick,
		onKeyDown,
		disabled,
		...props
	},
	ref
) {
	const [uncontrolledChecked, setUncontrolledChecked] = React.useState(defaultChecked)
	const checked = checkedProp ?? uncontrolledChecked
	const state = stateOf(checked)

	return (
		<button
			{...props}
			ref={ref}
			type='button'
			role='checkbox'
			aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
			data-state={state}
			data-disabled={disabled ? '' : undefined}
			disabled={disabled}
			className={cn(
				'peer h-4 w-4 shrink-0 rounded-sm border border-muted-foreground bg-background transition-colors duration-75 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:bg-focus-strong data-[state=checked]:focus-visible:bg-primary/75 disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			onKeyDown={(event) => {
				onKeyDown?.(event)
				if (event.key === 'Enter') event.preventDefault()
			}}
			onClick={(event) => {
				onClick?.(event)
				if (event.defaultPrevented) return
				const next = checked === 'indeterminate' ? true : !checked
				if (checkedProp === undefined) setUncontrolledChecked(next)
				onCheckedChange?.(next)
			}}
		>
			{checked === false ? null : (
				<span
					data-state={state}
					data-disabled={disabled ? '' : undefined}
					className='pointer-events-none flex items-center justify-center text-current'
				>
					<Check className='h-3 w-3' />
				</span>
			)}
		</button>
	)
})

export { Checkbox }
