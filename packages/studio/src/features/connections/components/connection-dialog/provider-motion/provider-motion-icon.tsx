import { memo, useEffect, useRef, type CSSProperties } from 'react'
import type { IconSpec } from './motion'
import { playIconMotion } from './play'
import { PROVIDER_ICONS, type ProviderIconName } from './registry'

type Props = {
	name: ProviderIconName
	className?: string
}

const HOVER_HOST_SELECTOR = "button, a[href], label, [role='button'], [role='option']"

function originStyle(spec: IconSpec, partId: string): CSSProperties | undefined {
	const owner = spec.tracks.find((candidate) => candidate.parts.includes(partId))
	if (!owner) return undefined
	const [x, y] = owner.origin
	return { transformBox: 'view-box', transformOrigin: `${x}px ${y}px` }
}

export const ProviderMotionIcon = memo(function ProviderMotionIcon({ name, className }: Props) {
	const spec: IconSpec = PROVIDER_ICONS[name]
	const svgRef = useRef<SVGSVGElement | null>(null)

	useEffect(() => {
		const svg = svgRef.current
		if (!svg) return
		const host = svg.closest(HOVER_HOST_SELECTOR) ?? svg.parentElement ?? svg
		function play() {
			if (svg) playIconMotion(svg, spec)
		}
		host.addEventListener('pointerenter', play)
		return () => host.removeEventListener('pointerenter', play)
	}, [spec])

	return (
		<svg
			ref={svgRef}
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			className={className}
			fill='none'
			stroke='currentColor'
			strokeWidth={1.75}
			strokeLinecap='round'
			strokeLinejoin='round'
			overflow='visible'
			aria-hidden='true'
			focusable='false'
		>
			{spec.parts.map((part) => (
				<g key={part.id} data-icon-part={part.id} style={originStyle(spec, part.id)}>
					<path d={part.d} />
				</g>
			))}
		</svg>
	)
})
