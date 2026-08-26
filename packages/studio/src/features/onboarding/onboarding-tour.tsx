import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@studio/shared/ui/button'
import { usePresence } from '@studio/shared/hooks/use-presence'
import { cn } from '@studio/shared/utils/cn'
import { markTourCompleted, recordLaunch, shouldShowTour } from './launch-state'

type TourStep = {
	title: string
	description: string
	/** CSS selector of the element to spotlight; omit for a centered step. */
	anchor?: string
}

const TOUR_STEPS: TourStep[] = [
	{
		title: 'Welcome to Dora',
		description:
			'A 30-second tour of the essentials. Skip any time — everything here is discoverable later.'
	},
	{
		title: 'Data Viewer',
		description: 'Browse and edit tables in a spreadsheet-like grid, with filters, sorting, and undo.',
		anchor: '[data-nav-id="database-studio"]'
	},
	{
		title: 'SQL Console',
		description: 'Write and run SQL or Drizzle queries with autocomplete, history, and charts.',
		anchor: '[data-nav-id="sql-console"]'
	},
	{
		title: 'Schema',
		description: 'Visualize your tables and relationships as a diagram.',
		anchor: '[data-nav-id="schema-visualizer"]'
	},
	{
		title: 'Settings',
		description:
			'Themes, keyboard shortcuts, privacy mode, and more live here. Enjoy Dora!',
		anchor: '[data-nav-id="settings"]'
	}
]

type SpotlightRect = {
	top: number
	left: number
	width: number
	height: number
}

export function OnboardingTour() {
	const launchCountRef = useRef<number | null>(null)
	if (launchCountRef.current === null) {
		launchCountRef.current = recordLaunch()
	}
	const [open, setOpen] = useState(function () {
		return shouldShowTour(launchCountRef.current ?? 0)
	})
	const [stepIndex, setStepIndex] = useState(0)
	const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)

	const step = TOUR_STEPS[stepIndex]
	const isLastStep = stepIndex === TOUR_STEPS.length - 1

	const anchor = step?.anchor
	useEffect(
		function trackAnchorPosition() {
			if (!open || !anchor) {
				setSpotlight(null)
				return
			}
			function measure() {
				const element = document.querySelector(anchor as string)
				if (!element) {
					setSpotlight(null)
					return
				}
				const rect = element.getBoundingClientRect()
				setSpotlight({
					top: rect.top - 4,
					left: rect.left - 4,
					width: rect.width + 8,
					height: rect.height + 8
				})
			}
			measure()
			window.addEventListener('resize', measure)
			return function () {
				window.removeEventListener('resize', measure)
			}
		},
		[open, anchor, stepIndex]
	)

	const progressLabel = useMemo(
		function () {
			return `${stepIndex + 1} of ${TOUR_STEPS.length}`
		},
		[stepIndex]
	)

	function finish() {
		markTourCompleted()
		setOpen(false)
	}

	const { present, state } = usePresence(open, 150)

	if (!present || !step) return null

	return (
		<>
			{spotlight && (
				<div
					aria-hidden='true'
					data-state={state}
					className='pointer-events-none fixed z-[90] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background transition-all duration-200 opacity-100 data-[state=closed]:opacity-0'
					style={{
						top: spotlight.top,
						left: spotlight.left,
						width: spotlight.width,
						height: spotlight.height
					}}
				/>
			)}
			<div
				data-state={state}
				className='fixed bottom-6 left-1/2 z-[91] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 transition-opacity duration-150 ease-[var(--ease-out)] data-[state=closed]:opacity-0'
			>
				<div
					role='dialog'
					aria-label='Onboarding tour'
					className={cn(
						'rounded-lg border border-border bg-popover p-4 shadow-xl',
						'animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200',
						'motion-reduce:zoom-in-100 motion-reduce:slide-in-from-bottom-0'
					)}
				>
					<div
						key={stepIndex}
						className='animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:slide-in-from-bottom-0'
					>
						<div className='mb-1 flex items-center justify-between'>
							<div className='text-sm font-medium text-popover-foreground'>{step.title}</div>
							<div className='text-xs text-muted-foreground'>{progressLabel}</div>
						</div>
						<p className='mb-3 text-xs leading-relaxed text-muted-foreground'>{step.description}</p>
					</div>
					<div className='flex items-center justify-between'>
					<Button variant='ghost' size='sm' className='h-7 text-xs' onClick={finish}>
						Skip tour
					</Button>
					<div className='flex gap-2'>
						{stepIndex > 0 && (
							<Button
								variant='outline'
								size='sm'
								className='h-7 text-xs'
								onClick={function () {
									setStepIndex(stepIndex - 1)
								}}
							>
								Back
							</Button>
						)}
						<Button
							size='sm'
							className='h-7 text-xs'
							onClick={function () {
								if (isLastStep) {
									finish()
								} else {
									setStepIndex(stepIndex + 1)
								}
							}}
						>
							{isLastStep ? 'Done' : 'Next'}
						</Button>
					</div>
				</div>
				</div>
			</div>
		</>
	)
}
