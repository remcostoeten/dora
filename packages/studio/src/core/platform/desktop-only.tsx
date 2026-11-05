import type { ComponentProps, ReactNode } from 'react'
import { useCallback, useState } from 'react'
import { Download, Monitor } from 'lucide-react'
import { siteConfig } from '@studio/config/site'
import { useIsTauri } from '@studio/core/data-provider'
import { Button } from '@studio/shared/ui/button'
import { cn } from '@studio/shared/utils/cn'

type ButtonProps = ComponentProps<typeof Button>

type DesktopOnlyButtonProps = ButtonProps & {
	desktopHint?: string
}

export function DesktopOnlyButton({
	children,
	onClick,
	className,
	desktopHint = 'Desktop app only',
	disabled,
	...props
}: DesktopOnlyButtonProps) {
	const isTauri = useIsTauri()
	const [showHint, setShowHint] = useState(false)

	const handleClick = useCallback(
		function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
			if (isTauri) {
				onClick?.(event)
				return
			}

			event.preventDefault()
			setShowHint(true)
			window.setTimeout(function resetHint() {
				setShowHint(false)
			}, 2600)
		},
		[isTauri, onClick]
	)

	return (
		<Button
			{...props}
			disabled={disabled}
			onClick={handleClick}
			className={cn(className, !isTauri && 'cursor-default', showHint && 'desktop-only-hint')}
		>
			{showHint && !isTauri ? (
				<>
					<Monitor className='h-3.5 w-3.5' />
					{desktopHint}
				</>
			) : (
				children
			)}
		</Button>
	)
}

type DesktopOnlyNoticeProps = {
	title?: string
	description?: ReactNode
	className?: string
}

export function DesktopOnlyNotice({
	title = 'Desktop app required',
	description = 'This integration needs the desktop app for secure credential storage, OAuth, and native system access.',
	className
}: DesktopOnlyNoticeProps) {
	return (
		<div
			className={cn(
				'desktop-only-notice relative overflow-hidden border border-border/60 bg-card/35 p-4 shadow-sm',
				className
			)}
		>
			<div
				className='desktop-only-notice__shimmer pointer-events-none absolute inset-0'
				aria-hidden
			/>
			<div className='relative flex items-start gap-3'>
				<div className='flex h-9 w-9 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 text-primary'>
					<Monitor className='h-4 w-4' />
				</div>
				<div className='min-w-0 flex-1 space-y-2'>
					<div>
						<p className='text-sm font-medium text-foreground'>{title}</p>
						<p className='mt-1 text-xs leading-relaxed text-muted-foreground/80'>
							{description}
						</p>
					</div>
					<a
						href={siteConfig.links.releases}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:opacity-80'
					>
						<Download className='h-3.5 w-3.5' />
						Download Dora for desktop
					</a>
				</div>
			</div>
		</div>
	)
}
