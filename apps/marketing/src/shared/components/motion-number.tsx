'use client'

import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from 'react'
import {
	AnimatePresence,
	motion,
	useReducedMotion,
	type Transition,
} from 'framer-motion'
import { cn } from '@/lib/utils'
import { useInView } from '@/shared/hooks/use-in-view'

/**
 * MotionNumber — an animated number display inspired by number-flow.
 *
 * Each digit/character is rendered in its own slot. When the value changes,
 * digits that differ slide vertically (up for increases, down for decreases),
 * non-numeric separators (commas, decimals, currency symbols) cross-fade.
 *
 * @example Basic
 * ```tsx
 * <MotionNumber value={2355} />
 * <MotionNumber>{2355}</MotionNumber>
 * ```
 *
 * @example Currency / locale
 * ```tsx
 * <MotionNumber
 *   value={1234.56}
 *   format={{ style: "currency", currency: "USD" }}
 *   locale="en-US"
 * />
 * ```
 *
 * @example Percent with explicit sign
 * ```tsx
 * <MotionNumber
 *   value={0.0421}
 *   format={{ style: "percent", minimumFractionDigits: 2 }}
 *   showPositiveSign
 * />
 * ```
 *
 * @example Custom prefix / suffix + trend lock
 * ```tsx
 * <MotionNumber
 *   value={ticker}
 *   prefix={<span className="text-muted-foreground mr-1">$</span>}
 *   suffix={<span className="text-muted-foreground ml-2 text-sm">USD</span>}
 *   trend="auto"   // "up" | "down" | "none" to lock direction
 * />
 * ```
 *
 * @example Custom spring + stagger
 * ```tsx
 * <MotionNumber
 *   value={count}
 *   transition={{ type: "spring", stiffness: 260, damping: 28 }}
 *   stagger={0.03}
 *   animateOnMount
 * />
 * ```
 *
 * @example Animate when scrolled into view
 * ```tsx
 * <ScrollMotionNumber value={2355} />
 * <ScrollMotionNumber value="Jun 5, 2026" />
 * ```
 */

export type MotionNumberTrend = 'auto' | 'up' | 'down' | 'none'

/** Shorthand format presets — expanded to Intl.NumberFormatOptions internally. */
export type MotionNumberFormatShorthand =
	| 'decimal'
	| 'currency'
	| 'percent'
	| 'compact'

export interface MotionNumberProps {
	/** Numeric or string value to display. If omitted, `children` is used. */
	value?: number | string
	/** Alternative to `value`. */
	children?: ReactNode
	/**
	 * Intl.NumberFormat options applied when value is numeric.
	 * May also be a shorthand string: "decimal" | "currency" | "percent" | "compact".
	 * When using "currency" shorthand, pass `currency` prop (defaults to "USD").
	 */
	format?: Intl.NumberFormatOptions | MotionNumberFormatShorthand
	/** Currency code used by the "currency" shorthand. Default "USD". */
	currency?: string
	/** BCP 47 locale tag, e.g. "en-US", "de-DE". */
	locale?: string | string[]
	/** Starting value for the very first render (enables "count up from N" on mount). */
	from?: number
	/** Minimum integer digits — pads with leading zeros to keep width stable (e.g. 9→10→100). */
	minIntegerDigits?: number
	/** Content rendered before the number (not animated as digits). */
	prefix?: ReactNode
	/** Content rendered after the number (not animated as digits). */
	suffix?: ReactNode
	/** Direction digits slide on change. "auto" = derived from numeric delta. */
	trend?: MotionNumberTrend
	/** Show explicit + sign for positive numbers. */
	showPositiveSign?: boolean
	/** Spring/tween transition for digit slides. */
	transition?: Transition
	/** Shortcut for tween duration (seconds). Ignored if `transition` is set. */
	duration?: number
	/** Shortcut for tween easing. Ignored if `transition` is set. */
	easing?: Transition['ease']
	/** Stagger between digits in seconds. */
	stagger?: number
	/** Animate on first mount instead of snapping. */
	animateOnMount?: boolean
	/** Called whenever the value finishes animating to a new formatted string. */
	onAnimationComplete?: (value: string) => void
	/** className applied to the outer wrapper. */
	className?: string
	/** className applied to each character slot. */
	digitClassName?: string
	/** Inline style for the wrapper. */
	style?: CSSProperties
	/** Use tabular-nums so digits keep a constant width. Default true. */
	tabular?: boolean
	/** ARIA live region politeness. Default "polite". Set "off" to disable announcements. */
	ariaLive?: 'off' | 'polite' | 'assertive'
	/** Accessible label override. Defaults to the formatted value. */
	'aria-label'?: string
}

/** Default spring used for digit slides. Exported so users can extend it. */
export const defaultTransition: Transition = {
	type: 'spring',
	stiffness: 380,
	damping: 32,
	mass: 0.9,
}

// ---------------------------------------------------------------------------
// Group context — share trend across sibling MotionNumbers (e.g. price + Δ%)
// ---------------------------------------------------------------------------

interface MotionNumberGroupContext {
	trend?: MotionNumberTrend
	transition?: Transition
}
const GroupContext = createContext<MotionNumberGroupContext | null>(null)

/**
 * Share a `trend` and/or `transition` across a group of nested MotionNumbers.
 *
 * @example
 * ```tsx
 * <MotionNumberGroup trend="up">
 *   <MotionNumber value={price} />
 *   <MotionNumber value={delta} showPositiveSign />
 * </MotionNumberGroup>
 * ```
 */
export function MotionNumberGroup({
	trend,
	transition,
	children,
}: MotionNumberGroupContext & { children: ReactNode }) {
	const value = useMemo(() => ({ trend, transition }), [trend, transition])
	return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function resolveFormat(
	format: MotionNumberProps['format'],
	currency: string
): Intl.NumberFormatOptions | undefined {
	if (!format) return undefined
	if (typeof format !== 'string') return format
	switch (format) {
		case 'currency':
			return { style: 'currency', currency }
		case 'percent':
			return { style: 'percent', maximumFractionDigits: 2 }
		case 'compact':
			return { notation: 'compact' }
		case 'decimal':
		default:
			return { style: 'decimal' }
	}
}

function formatValue(
	raw: number | string | ReactNode,
	format?: Intl.NumberFormatOptions,
	locale?: string | string[],
	showPositiveSign?: boolean,
	minIntegerDigits?: number
): string {
	if (raw === null || raw === undefined) return ''
	if (typeof raw === 'number') {
		const opts: Intl.NumberFormatOptions = { ...format }
		if (showPositiveSign && !opts.signDisplay) opts.signDisplay = 'exceptZero'
		if (minIntegerDigits && !opts.minimumIntegerDigits) {
			opts.minimumIntegerDigits = minIntegerDigits
		}
		try {
			return new Intl.NumberFormat(locale, opts).format(raw)
		} catch {
			return String(raw)
		}
	}
	if (typeof raw === 'string') {
		const n = Number(raw)
		if (!Number.isNaN(n) && raw.trim() !== '') {
			return formatValue(n, format, locale, showPositiveSign, minIntegerDigits)
		}
		return raw
	}
	return String(raw)
}

function isDigit(ch: string) {
	return ch >= '0' && ch <= '9'
}

interface SlotProps {
	char: string
	/** Stable key — when the same char keeps the same key, AnimatePresence skips it. */
	slotKey: string
	direction: 1 | -1
	transition: Transition
	delay: number
	digitClassName?: string
	reduceMotion: boolean
}

function CharSlot({
	char,
	direction,
	transition,
	delay,
	digitClassName,
	reduceMotion,
}: SlotProps) {
	const numeric = isDigit(char)
	const t: Transition = reduceMotion ? { duration: 0 } : { ...transition, delay }

	return (
		<span
			className={cn(
				'relative inline-flex overflow-hidden align-baseline',
				digitClassName
			)}
			aria-hidden="true"
			style={{
				height: '1em',
				lineHeight: 1,
				willChange: 'transform',
				contain: 'layout paint',
			}}
		>
			{/* invisible sizer keeps width correct for proportional fonts */}
			<span className="invisible" aria-hidden="true">
				{char === ' ' ? ' ' : char}
			</span>
			<AnimatePresence initial={false} mode="popLayout">
				<motion.span
					key={char}
					className="absolute inset-0 flex items-center justify-center"
					initial={
						numeric
							? { y: `${direction * 100}%`, opacity: 0 }
							: { opacity: 0, scale: 0.8 }
					}
					animate={numeric ? { y: '0%', opacity: 1 } : { opacity: 1, scale: 1 }}
					exit={
						numeric
							? { y: `${direction * -100}%`, opacity: 0 }
							: { opacity: 0, scale: 0.8 }
					}
					transition={t}
				>
					{char === ' ' ? ' ' : char}
				</motion.span>
			</AnimatePresence>
		</span>
	)
}

export function MotionNumber({
	value,
	children,
	format,
	currency = 'USD',
	locale,
	from,
	minIntegerDigits,
	prefix,
	suffix,
	trend = 'auto',
	showPositiveSign,
	transition,
	duration,
	easing,
	stagger = 0.015,
	animateOnMount = false,
	onAnimationComplete,
	className,
	digitClassName,
	style,
	tabular = true,
	ariaLive = 'polite',
	...rest
}: MotionNumberProps) {
	const group = useContext(GroupContext)
	const resolvedTransition: Transition =
		transition ??
		group?.transition ??
		(duration !== undefined || easing
			? { type: 'tween', duration: duration ?? 0.4, ease: easing }
			: defaultTransition)
	const resolvedTrend: MotionNumberTrend = trend ?? group?.trend ?? 'auto'

	const source = value !== undefined ? value : children
	const resolvedFormat = useMemo(
		() => resolveFormat(format, currency),
		[format, currency]
	)

	const formatted = useMemo(
		() =>
			formatValue(
				source as number | string,
				resolvedFormat,
				locale,
				showPositiveSign,
				minIntegerDigits
			),
		[source, resolvedFormat, locale, showPositiveSign, minIntegerDigits]
	)

	// Initial value used on first paint — supports `from` for count-up effect.
	const initialFormatted = useMemo(() => {
		if (from === undefined) return formatted
		return formatValue(
			from,
			resolvedFormat,
			locale,
			showPositiveSign,
			minIntegerDigits
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const numericValue = typeof source === 'number' ? source : Number(source)
	const prevNumeric = useRef<number>(
		from !== undefined ? from : Number.isFinite(numericValue) ? numericValue : 0
	)
	const mounted = useRef(false)
	const [direction, setDirection] = useState<1 | -1>(1)
	const [displayed, setDisplayed] = useState(initialFormatted)

	useEffect(() => {
		if (!Number.isFinite(numericValue)) return
		if (numericValue > prevNumeric.current) setDirection(1)
		else if (numericValue < prevNumeric.current) setDirection(-1)
		prevNumeric.current = numericValue
	}, [numericValue])

	useEffect(() => {
		// After mount we can show the real target value (kicks off the animation when `from` was set).
		setDisplayed(formatted)
	}, [formatted])

	useEffect(() => {
		mounted.current = true
	}, [])

	const reduceMotion = useReducedMotion() ?? false
	const shouldAnimate = animateOnMount || mounted.current

	const resolvedDirection: 1 | -1 =
		resolvedTrend === 'up'
			? 1
			: resolvedTrend === 'down'
				? -1
				: resolvedTrend === 'none'
					? 1
					: direction

	// Right-align indexing so digits in the same place keep stable keys when
	// length changes (9 → 10 only animates the new leading digit).
	const chars = useMemo(() => {
		const arr = Array.from(displayed)
		const total = arr.length
		return arr.map((char, i) => ({
			char,
			// Negative index from the right; "d:" prefix for digits, "s:" for separators
			slotKey: `${isDigit(char) ? 'd' : 's'}:${total - i}:${char}`,
		}))
	}, [displayed])

	const ariaLabel = rest['aria-label'] ?? displayed

	// Fire onAnimationComplete after the formatted value settles.
	useEffect(() => {
		if (!onAnimationComplete) return
		const id = window.setTimeout(
			() => onAnimationComplete(displayed),
			(chars.length * stagger + 0.6) * 1000
		)
		return () => window.clearTimeout(id)
	}, [displayed, chars.length, stagger, onAnimationComplete])

	return (
		<span
			className={cn(
				'inline-flex items-baseline',
				tabular && 'tabular-nums',
				className
			)}
			style={style}
			aria-label={ariaLabel}
			aria-live={ariaLive}
			aria-atomic="true"
			role="text"
		>
			{prefix !== undefined && (
				<span className="inline-flex items-baseline" aria-hidden="true">
					{prefix}
				</span>
			)}
			<span className="inline-flex items-baseline">
				{chars.map(({ char, slotKey }, i) => (
					<CharSlot
						key={slotKey}
						slotKey={slotKey}
						char={char}
						direction={resolvedDirection}
						transition={resolvedTransition}
						delay={shouldAnimate ? i * stagger : 0}
						digitClassName={digitClassName}
						reduceMotion={reduceMotion}
					/>
				))}
			</span>
			{/* Screen-reader-only mirror so updates are reliably announced. */}
			<span className="sr-only">{displayed}</span>
			{suffix !== undefined && (
				<span className="inline-flex items-baseline" aria-hidden="true">
					{suffix}
				</span>
			)}
		</span>
	)
}

// ---------------------------------------------------------------------------
// ScrollMotionNumber — defer the animation until the value scrolls into view
// ---------------------------------------------------------------------------

/** Swap every digit in a string for a "0" so the placeholder keeps the same
 *  slot layout — only the digits slide when the real value reveals. */
function maskDigits(input: string): string {
	return input.replace(/[0-9]/g, '0')
}

export interface ScrollMotionNumberProps extends MotionNumberProps {
	/** IntersectionObserver rootMargin for the reveal trigger. */
	rootMargin?: string
	/** IntersectionObserver threshold for the reveal trigger. */
	threshold?: number
}

/**
 * Wraps {@link MotionNumber} so the slide/count animation only runs once the
 * element scrolls into view. Until then it renders a same-width placeholder
 * (`0` for numbers, digit-masked for strings) so layout never shifts.
 *
 * Numbers count up from 0; date/text strings flip their digits into place.
 */
export function ScrollMotionNumber({
	value,
	rootMargin = '-40px 0px',
	threshold = 0.2,
	minIntegerDigits,
	...props
}: ScrollMotionNumberProps) {
	const [ref, inView] = useInView<HTMLSpanElement>({
		once: true,
		rootMargin,
		threshold,
	})

	const isNumber = typeof value === 'number'
	const placeholder = isNumber ? 0 : maskDigits(String(value ?? ''))
	const display = inView ? value : placeholder

	// Pad numeric placeholders to the target width so every digit slot exists
	// up front and animates (otherwise leading digits would just pop in).
	const pad =
		isNumber && minIntegerDigits === undefined
			? String(Math.trunc(Math.abs(value as number))).length
			: minIntegerDigits

	return (
		<span ref={ref} className="inline-flex items-baseline">
			<MotionNumber value={display} minIntegerDigits={pad} {...props} />
		</span>
	)
}

export default MotionNumber
