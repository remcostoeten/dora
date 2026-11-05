import {
	useId,
	useRef,
	type ComponentPropsWithoutRef,
	type PointerEvent,
	type ReactNode
} from 'react'

export type EmptyStateAction = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
	id: string
	label: ReactNode
	icon?: ReactNode
	variant?: 'primary' | 'secondary'
}

type EmptyStateLoop = 'float' | 'spread' | 'pulse'

type Props = Omit<ComponentPropsWithoutRef<'section'>, 'title'> & {
	title: ReactNode
	description?: ReactNode
	illustration?: ReactNode
	actions?: readonly EmptyStateAction[]
	size?: 'xs' | 'sm' | 'md' | 'lg'
	animated?: boolean
	loop?: boolean | EmptyStateLoop
	pointer?: boolean
	headingLevel?: 'h1' | 'h2' | 'h3' | 'h4'
	children?: ReactNode
}

const root =
	'group/es box-border flex w-full min-w-0 flex-col items-center justify-center text-center text-(color:--es-foreground) **:box-border [--es-background:var(--color-background)] [--es-border:var(--color-border)] [--es-ease-out:cubic-bezier(0.23,1,0.32,1)] [--es-foreground:var(--color-foreground)] [--es-muted:var(--color-muted-foreground)] [--es-surface:var(--es-background)] [&_:is(button,a):focus-visible]:outline-3 [&_:is(button,a):focus-visible]:outline-offset-2 [&_:is(button,a):focus-visible]:outline-(color:--es-foreground)/25'
const entrance =
	'group-data-animated/es:transition-[opacity,translate] group-data-animated/es:duration-220 group-data-animated/es:ease-(--es-ease-out) starting:group-data-animated/es:opacity-0 starting:group-data-animated/es:translate-y-1.5 motion-reduce:transition-none'
const follow =
	'transition-transform duration-500 ease-(--es-ease-out) group-data-pointer/es:transform-[perspective(600px)_rotateX(calc(var(--es-py,0)*-10deg))_rotateY(calc(var(--es-px,0)*12deg))] motion-reduce:transform-none'
const sizes = {
	xs: {
		root: '@container gap-3 px-4 py-6',
		main: 'gap-3',
		illustration: '[zoom:0.55] @max-[160px]:hidden',
		title: 'text-xs/[1.4]',
		description: 'max-w-60 text-balance text-[11px]/relaxed'
	},
	sm: {
		root: 'min-h-[max(100%,200px)] gap-6 px-4 py-8',
		main: 'gap-4',
		illustration: '',
		title: 'text-sm/[1.4] tracking-[-0.01em]',
		description: 'max-w-80 text-balance text-xs/relaxed'
	},
	md: {
		root: 'min-h-[max(100%,300px)] gap-10 px-6 py-12',
		main: 'gap-5',
		illustration: '',
		title: 'text-base/[1.4] tracking-[-0.02em]',
		description: 'max-w-96 text-balance text-sm/relaxed'
	},
	lg: {
		root: 'min-h-full gap-24 px-5 py-12',
		main: 'gap-6',
		illustration: '',
		title: 'text-2xl/tight tracking-[-0.045em]',
		description: 'max-w-100 text-pretty text-sm/relaxed'
	}
}

function Action({
	label,
	icon,
	variant = 'primary',
	className = '',
	...action
}: Omit<EmptyStateAction, 'id'>) {
	return (
		<button
			type='button'
			{...action}
			data-variant={variant}
			className={`inline-flex min-h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent bg-(color:--es-foreground) px-3.5 py-1.5 font-[inherit] text-sm/none font-medium whitespace-nowrap text-(color:--es-background) group-data-[size=xs]/es:min-h-7 group-data-[size=xs]/es:px-2.5 group-data-[size=xs]/es:py-1 group-data-[size=xs]/es:text-xs/none group-data-[size=xs]/es:[--es-icon:0.875rem] transition-[background-color,scale] duration-[150ms,120ms] ease-[ease,var(--es-ease-out)] enabled:hover:bg-[color-mix(in_srgb,var(--es-foreground)_85%,var(--es-background))] enabled:active:scale-97 disabled:cursor-not-allowed disabled:opacity-50 data-[variant=secondary]:border-(color:--es-border) data-[variant=secondary]:bg-(color:--es-surface) data-[variant=secondary]:text-(color:--es-foreground) data-[variant=secondary]:enabled:hover:bg-[color-mix(in_srgb,var(--es-foreground)_4%,var(--es-surface))] ${className}`}
		>
			{icon && (
				<span
					className='inline-flex shrink-0 [&_svg]:size-(--es-icon,1rem)'
					aria-hidden='true'
				>
					{icon}
				</span>
			)}
			{label}
		</button>
	)
}

export function EmptyState({
	title,
	description,
	illustration,
	actions = [],
	size = 'md',
	animated = true,
	loop = false,
	pointer = false,
	headingLevel: Heading = 'h2',
	className = '',
	children,
	onPointerMove,
	onPointerLeave,
	...props
}: Props) {
	const titleId = useId()
	const descriptionId = useId()
	const followRef = useRef<HTMLDivElement>(null)
	const scale = sizes[size]

	function moveFollow(x: number, y: number) {
		followRef.current?.style.setProperty('--es-px', x.toFixed(3))
		followRef.current?.style.setProperty('--es-py', y.toFixed(3))
	}

	function handlePointerMove(event: PointerEvent<HTMLElement>) {
		onPointerMove?.(event)
		if (!pointer || event.pointerType !== 'mouse') return
		const bounds = event.currentTarget.getBoundingClientRect()
		moveFollow(
			((event.clientX - bounds.left) / bounds.width) * 2 - 1,
			((event.clientY - bounds.top) / bounds.height) * 2 - 1
		)
	}

	function handlePointerLeave(event: PointerEvent<HTMLElement>) {
		onPointerLeave?.(event)
		if (pointer) moveFollow(0, 0)
	}

	return (
		<section
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			{...props}
			className={`${root} ${scale.root} ${className}`}
			data-size={size}
			data-animated={animated || undefined}
			data-loop={loop === true ? 'float' : loop || undefined}
			data-pointer={pointer || undefined}
			onPointerMove={handlePointerMove}
			onPointerLeave={handlePointerLeave}
		>
			<div className={`flex w-full flex-col items-center ${scale.main}`}>
				{illustration && (
					<div className={`flex justify-center ${entrance}`}>
						<div ref={followRef} className={`${follow} ${scale.illustration}`}>
							{illustration}
						</div>
					</div>
				)}
				<div
					className={`flex flex-col items-center gap-2 group-data-animated/es:delay-40 ${entrance}`}
				>
					<Heading
						id={titleId}
						className={`m-0 font-semibold text-balance ${scale.title}`}
					>
						{title}
					</Heading>
					{description && (
						<div
							id={descriptionId}
							className={`text-(color:--es-muted) [&_strong]:font-normal [&_strong]:text-(color:--es-foreground)/85 ${scale.description}`}
						>
							{description}
						</div>
					)}
				</div>
				{(actions.length > 0 || Boolean(children)) && (
					<div
						className={`flex w-full flex-col items-center gap-3 group-data-animated/es:delay-80 ${entrance}`}
					>
						{actions.length > 0 && (
							<div className='flex flex-wrap justify-center gap-2'>
								{actions.map(({ id, ...action }) => (
									<Action key={id} {...action} />
								))}
							</div>
						)}
						{children}
					</div>
				)}
			</div>
		</section>
	)
}
