import { useStoreApi, type Transform } from '@xyflow/react'
import { useEffect, useRef } from 'react'

const GAP = 20
const MIN_SCALED_GAP = 10

function getScaledGap(zoom: number) {
	let gap = GAP * zoom
	while (gap < MIN_SCALED_GAP) gap *= 2
	return gap
}

export function SchemaDots() {
	const store = useStoreApi()
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		function apply([x, y, zoom]: Transform) {
			const element = ref.current
			if (!element) return
			const gap = getScaledGap(zoom)
			element.style.setProperty('--sv-dot-radius', `${Math.max(0.6, zoom * 0.5)}px`)
			element.style.backgroundSize = `${gap}px ${gap}px`
			element.style.backgroundPosition = `${x - gap / 2}px ${y - gap / 2}px`
		}

		apply(store.getState().transform)
		return store.subscribe((state, previous) => {
			if (state.transform !== previous.transform) apply(state.transform)
		})
	}, [store])

	return <div ref={ref} className='sv-dots' aria-hidden='true' />
}
