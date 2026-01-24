import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, RefObject } from 'react'
import { ArrowLeft, ArrowRight, MousePointer2 } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

type Props = {
	containerRef: RefObject<HTMLElement>
	className?: string
}

const STORAGE_KEY = 'dora_has_seen_scroll_hint'

export function ScrollHint({ containerRef, className }: Props) {
	const [isVisible, setIsVisible] = useState(false)
	const [hasOverflow, setHasOverflow] = useState(false)

	useEffect(
		function () {
			const container = containerRef.current
			if (!container) return

			function checkOverflow() {
				if (container) {
					const hasHorizontalScroll = container.scrollWidth > container.clientWidth
					setHasOverflow(hasHorizontalScroll)
				}
			}

			// Check initially
			checkOverflow()

			// check on resize
			const resizeObserver = new ResizeObserver(checkOverflow)
			resizeObserver.observe(container)

			return function () {
				resizeObserver.disconnect()
			}
		},
		[containerRef]
	)

	useEffect(
		function () {
			const hasSeen = localStorage.getItem(STORAGE_KEY)
			if (!hasSeen && hasOverflow) {
				// Small delay to let UI settle before showing hint
				const timer = setTimeout(function () {
					setIsVisible(true)
				}, 1000)
				return function () {
					clearTimeout(timer)
				}
			} else {
				setIsVisible(false)
			}
		},
		[hasOverflow]
	)

	useEffect(
		function () {
			const container = containerRef.current
			if (!container || !isVisible) return

			function handleScroll() {
				if (container && container.scrollLeft > 20) {
					setIsVisible(false)
					localStorage.setItem(STORAGE_KEY, 'true')
				}
			}

			container.addEventListener('scroll', handleScroll)
			return function () {
				container.removeEventListener('scroll', handleScroll)
			}
		},
		[containerRef, isVisible]
	)

	function handleDismiss() {
		setIsVisible(false)
		localStorage.setItem(STORAGE_KEY, 'true')
	}

	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 20 }}
					transition={{ duration: 0.4, ease: 'easeOut' }}
					className={cn('absolute bottom-8 right-8 z-50 pointer-events-none', className)}
				>
					<div
						className='relative flex items-center gap-3 px-4 py-3 rounded-lg border border-border/50 bg-background/80 backdrop-blur-md shadow-xl select-none pointer-events-auto cursor-pointer group'
						onClick={handleDismiss}
					>
						<div className='absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg' />

						{/* Animation Icon */}
						<div className='relative flex items-center justify-center w-8 h-8 rounded-md bg-muted/50 border border-border/50'>
							<motion.div
								animate={{ y: [0, 4, 0] }}
								transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
							>
								<MousePointer2 className='w-4 h-4 text-primary' />
							</motion.div>
						</div>

						<div className='flex flex-col gap-1'>
							<div className='flex flex-col gap-0.5'>
								<span className='text-sm font-medium text-foreground'>
									Horizontal Scroll
								</span>
								<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
									<span className='px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-mono text-[10px]'>
										SHIFT
									</span>
									<span>+</span>
									<span className='px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-mono text-[10px]'>
										SCROLL
									</span>
								</div>
							</div>

							<div className='flex flex-col gap-0.5'>
								<span className='text-sm font-medium text-foreground'>
									or Drag to Scroll
								</span>
								<div className='flex items-center gap-1.5 text-xs text-muted-foreground'>
									<span className='px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-mono text-[10px]'>
										RIGHT-CLICK
									</span>
									<span>+</span>
									<span className='px-1.5 py-0.5 rounded bg-muted/50 border border-border/30 font-mono text-[10px]'>
										DRAG
									</span>
								</div>
							</div>
						</div>

						{/* Arrows Animation */}
						<div className='flex items-center gap-1 ml-2 text-primary/50'>
							<motion.div
								animate={{ x: [-2, 0, -2], opacity: [0.5, 1, 0.5] }}
								transition={{
									repeat: Infinity,
									duration: 2,
									ease: 'easeInOut',
									delay: 0
								}}
							>
								<ArrowLeft className='w-3 h-3' />
							</motion.div>
							<motion.div
								animate={{ x: [2, 0, 2], opacity: [0.5, 1, 0.5] }}
								transition={{
									repeat: Infinity,
									duration: 2,
									ease: 'easeInOut',
									delay: 0
								}}
							>
								<ArrowRight className='w-3 h-3' />
							</motion.div>
						</div>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
