import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
			'A 30-second tour of the essentials. Skip any time, everything here is discoverable later.'
	},
	{
		title: 'Data Viewer',
		description:
			'Browse and edit tables in a spreadsheet-like grid, with filters, sorting, and undo.',
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
		description: 'Themes, keyboard shortcuts, privacy mode, and more live here. Enjoy Dora!',
		anchor: '[data-nav-id="settings"]'
	}
]

const SPOTLIGHT_PADDING = 6
const CARD_GAP = 14
const VIEWPORT_MARGIN = 16

type Rect = {
	top: number
	left: number
	width: number
	height: number
}

type CardPosition = {
	x: number
	y: number
	arrowY: number | null
}

function measureAnchor(selector: string): Rect | null {
	const element = document.querySelector(selector)
	if (!element) return null
	const rect = element.getBoundingClientRect()
	return {
		top: rect.top - SPOTLIGHT_PADDING,
		left: rect.left - SPOTLIGHT_PADDING,
		width: rect.width + SPOTLIGHT_PADDING * 2,
		height: rect.height + SPOTLIGHT_PADDING * 2
	}
}

function placeCard(spotlight: Rect | null, cardWidth: number, cardHeight: number): CardPosition {
	const viewportWidth = window.innerWidth
	const viewportHeight = window.innerHeight
	if (!spotlight) {
		return {
			x: (viewportWidth - cardWidth) / 2,
			y: (viewportHeight - cardHeight) / 2,
			arrowY: null
		}
	}
	const anchorCenterY = spotlight.top + spotlight.height / 2
	const maxY = viewportHeight - cardHeight - VIEWPORT_MARGIN
	const y = Math.min(Math.max(anchorCenterY - cardHeight / 2, VIEWPORT_MARGIN), maxY)
	const rightX = spotlight.left + spotlight.width + CARD_GAP
	const fitsRight = rightX + cardWidth + VIEWPORT_MARGIN <= viewportWidth
	const x = fitsRight ? rightX : Math.max(VIEWPORT_MARGIN, spotlight.left - CARD_GAP - cardWidth)
	const arrowY = Math.min(Math.max(anchorCenterY - y, 16), cardHeight - 16)
	return { x, y, arrowY: fitsRight ? arrowY : null }
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
	const [spotlight, setSpotlight] = useState<Rect | null>(null)
	const [cardPosition, setCardPosition] = useState<CardPosition | null>(null)
	const cardRef = useRef<HTMLDivElement>(null)

	const step = TOUR_STEPS[stepIndex]
	const isLastStep = stepIndex === TOUR_STEPS.length - 1
	const anchor = step?.anchor

	const { present, state } = usePresence(open, 200)

	useEffect(
		function trackAnchorPosition() {
			if (!open || !anchor) {
				setSpotlight(null)
				return
			}
			const selector = anchor
			function measure() {
				setSpotlight(measureAnchor(selector))
			}
			measure()
			window.addEventListener('resize', measure)
			return function () {
				window.removeEventListener('resize', measure)
			}
		},
		[open, anchor]
	)

	useLayoutEffect(
		function positionCard() {
			if (!present || !cardRef.current) return
			const card = cardRef.current
			function update() {
				setCardPosition(placeCard(spotlight, card.offsetWidth, card.offsetHeight))
			}
			update()
			window.addEventListener('resize', update)
			return function () {
				window.removeEventListener('resize', update)
			}
		},
		[present, spotlight, stepIndex]
	)

	function finish() {
		markTourCompleted()
		setOpen(false)
	}

	function goTo(index: number) {
		if (index < 0) return
		if (index >= TOUR_STEPS.length) {
			finish()
			return
		}
		setStepIndex(index)
	}

	useEffect(
		function bindKeyboard() {
			if (!open) return
			function onKeyDown(event: KeyboardEvent) {
				if (event.key === 'Escape') finish()
				if (event.key === 'ArrowRight') goTo(stepIndex + 1)
				if (event.key === 'ArrowLeft') goTo(stepIndex - 1)
			}
			window.addEventListener('keydown', onKeyDown)
			return function () {
				window.removeEventListener('keydown', onKeyDown)
			}
		},
		[open, stepIndex]
	)

	if (!present || !step) return null

	const holeRect = spotlight ?? {
		top: window.innerHeight / 2,
		left: window.innerWidth / 2,
		width: 0,
		height: 0
	}

	return (
		<>
			<div
				aria-hidden='true'
				data-state={state}
				className='pointer-events-none fixed inset-0 z-[90] opacity-0 transition-opacity duration-200 ease-[var(--ease-out)] data-[state=open]:opacity-100'
			>
				<div
					className={cn(
						'absolute rounded-xl shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]',
						'transition-[top,left,width,height] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none',
						spotlight && 'border border-foreground/25 bg-foreground/[0.04]'
					)}
					style={holeRect}
				/>
			</div>
			<div
				ref={cardRef}
				data-state={state}
				className={cn(
					'fixed left-0 top-0 z-[91] w-[min(340px,calc(100vw-2rem))]',
					'opacity-0 data-[state=open]:opacity-100',
					'transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-opacity',
					!cardPosition && 'invisible'
				)}
				style={{
					transform: cardPosition
						? `translate3d(${cardPosition.x}px, ${cardPosition.y}px, 0)`
						: undefined
				}}
			>
				<div
					role='dialog'
					aria-label='Onboarding tour'
					className='relative overflow-hidden rounded-xl border border-border/80 bg-popover/95 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)] backdrop-blur-md'
				>
					<div className='h-0.5 w-full bg-foreground/[0.06]'>
						<div
							className='h-full bg-foreground/60 transition-[width] duration-300 ease-[var(--ease-out)]'
							style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
						/>
					</div>
					<div className='p-4'>
						<div key={stepIndex} className='animate-in fade-in duration-200'>
							<div className='mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground'>
								Step {stepIndex + 1} of {TOUR_STEPS.length}
							</div>
							<div className='mb-1 text-sm font-semibold text-popover-foreground'>
								{step.title}
							</div>
							<p className='text-[13px] leading-relaxed text-muted-foreground'>
								{step.description}
							</p>
						</div>
						<div className='mt-4 flex items-center justify-between'>
							<div className='flex items-center gap-1.5'>
								{TOUR_STEPS.map(function (tourStep, index) {
									return (
										<button
											key={tourStep.title}
											type='button'
											aria-label={`Go to step ${index + 1}`}
											onClick={function () {
												goTo(index)
											}}
											className={cn(
												'h-1.5 rounded-full transition-[width,background-color] duration-200 ease-[var(--ease-out)]',
												index === stepIndex
													? 'w-4 bg-foreground/80'
													: 'w-1.5 bg-foreground/20 hover:bg-foreground/40'
											)}
										/>
									)
								})}
							</div>
							<div className='flex items-center gap-1.5'>
								{stepIndex === 0 ? (
									<Button
										variant='ghost'
										size='sm'
										className='h-7 text-xs text-muted-foreground'
										onClick={finish}
									>
										Skip
									</Button>
								) : (
									<Button
										variant='ghost'
										size='sm'
										className='h-7 text-xs'
										onClick={function () {
											goTo(stepIndex - 1)
										}}
									>
										Back
									</Button>
								)}
								<Button
									size='sm'
									className='h-7 px-3 text-xs'
									onClick={function () {
										goTo(stepIndex + 1)
									}}
								>
									{isLastStep ? 'Get started' : 'Next'}
								</Button>
							</div>
						</div>
					</div>
				</div>
				{cardPosition?.arrowY != null && (
					<div
						aria-hidden='true'
						className='absolute -left-[5px] size-2.5 rotate-45 border-b border-l border-border/80 bg-popover transition-[top] duration-300 ease-[var(--ease-out)]'
						style={{ top: cardPosition.arrowY - 5 }}
					/>
				)}
			</div>
		</>
	)
}
