import type { ComponentType, ReactNode } from 'react'
import { cn } from '@studio/shared/utils/cn'
import './rail-icons.css'

export type RailIcon = ComponentType<{ className?: string }>

type Props = {
	className?: string
}

type SvgProps = Props & {
	children: ReactNode
}

function buildGearPath() {
	const teeth = 8
	const outer = 9.25
	const inner = 7.1
	const center = 12
	const outerHalf = (Math.PI / teeth) * 0.42
	const innerHalf = (Math.PI / teeth) * 0.64
	const step = (2 * Math.PI) / teeth

	function point(radius: number, angle: number) {
		const x = (center + radius * Math.cos(angle)).toFixed(2)
		const y = (center + radius * Math.sin(angle)).toFixed(2)
		return `${x} ${y}`
	}

	let path = ''
	for (let index = 0; index < teeth; index++) {
		const angle = index * step - Math.PI / 2
		const start = index === 0 ? 'M' : 'L'
		path += `${start}${point(inner, angle - innerHalf)}`
		path += `L${point(outer, angle - outerHalf)}L${point(outer, angle + outerHalf)}`
		path += `L${point(inner, angle + innerHalf)}`
		path += `A${inner} ${inner} 0 0 1 ${point(inner, angle + step - innerHalf)}`
	}
	return `${path}Z`
}

const GEAR_PATH = buildGearPath()

function RailSvg({ className, children }: SvgProps) {
	return (
		<svg
			className={cn('rail-icon', className)}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth={1.5}
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden='true'
		>
			{children}
		</svg>
	)
}

export function SqlConsoleIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<rect className='ri-fill' x='3' y='4' width='18' height='16' rx='3.5' />
			<rect x='3' y='4' width='18' height='16' rx='3.5' />
			<path className='ri-sub' d='M3 8.5h18' />
			<path d='M7.5 11.75 10 13.75l-2.5 2' />
			<path d='M12.5 15.75h4' />
		</RailSvg>
	)
}

export function DataViewerIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path
				className='ri-fill'
				d='M3 9.5V7.5A3.5 3.5 0 0 1 6.5 4h11A3.5 3.5 0 0 1 21 7.5v2Z'
			/>
			<rect x='3' y='4' width='18' height='16' rx='3.5' />
			<path d='M3 9.5h18' />
			<path className='ri-sub' d='M9.5 9.5V20M3 14.75h18' />
		</RailSvg>
	)
}

export function KvStudioIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<circle className='ri-fill' cx='8' cy='16' r='4.25' />
			<circle cx='8' cy='16' r='4.25' />
			<path d='M11 13 19.5 4.5' />
			<path d='M16.75 7.25 19 9.5M14.25 9.75 16 11.5' />
			<circle className='ri-dot ri-sub' cx='8' cy='16' r='1.1' />
		</RailSvg>
	)
}

export function AnalyticsIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path className='ri-fill' d='M4 16.5 9 11l4 3 6.5-7.5V20H4Z' />
			<path className='ri-sub' d='M4 20h16' />
			<path d='M4 16.5 9 11l4 3 6.5-7.5' />
			<circle className='ri-dot' cx='19.5' cy='6.5' r='1.6' />
		</RailSvg>
	)
}

export function SchemaIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path
				className='ri-fill'
				d='M8.5 4.25v4.25c0 .83 1.57 1.5 3.5 1.5s3.5-.67 3.5-1.5V4.25Z'
			/>
			<ellipse cx='12' cy='4.25' rx='3.5' ry='1.5' />
			<path d='M8.5 4.25v4.25c0 .83 1.57 1.5 3.5 1.5s3.5-.67 3.5-1.5V4.25' />
			<path
				className='ri-sub'
				d='M12 10v2.25M6.5 15.5v-1.25a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1.25'
			/>
			<rect x='3' y='15.5' width='7' height='5' rx='1.75' />
			<rect x='14' y='15.5' width='7' height='5' rx='1.75' />
		</RailSvg>
	)
}

export function SchemaDiffIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<g className='ri-sub'>
				<ellipse cx='9' cy='5.5' rx='5' ry='2' />
				<path d='M4 5.5v8a5 2 0 0 0 5 2M14 5.5v2.75' />
			</g>
			<path className='ri-fill' d='M10 10.5v8a5 2 0 0 0 10 0v-8a5 2 0 0 0-10 0Z' />
			<ellipse cx='15' cy='10.5' rx='5' ry='2' />
			<path d='M10 10.5v8a5 2 0 0 0 10 0v-8' />
			<path d='M15 14.25v3.5M13.25 16h3.5' />
		</RailSvg>
	)
}

export function DockerIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path
				className='ri-fill'
				d='M4.5 9.5h15v8A2.5 2.5 0 0 1 17 20H7a2.5 2.5 0 0 1-2.5-2.5Z'
			/>
			<path d='M4.5 9.5v8A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-8' />
			<path className='ri-sub' d='M9 12.75v4.25M12 12.75v4.25M15 12.75v4.25' />
			<rect x='3' y='5' width='18' height='4.5' rx='1.5' />
		</RailSvg>
	)
}

export function PerformanceIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path className='ri-fill' d='M4 19.5v-6h4v6ZM10 19.5v-10h4v10ZM16 19.5V5h4v14.5Z' />
			<path d='M4 19.5v-6h4v6M10 19.5v-10h4v10M16 19.5V5h4v14.5M3 19.5h18' />
		</RailSvg>
	)
}

export function AiAssistantIcon({ className }: Props) {
	const star =
		'M10 6c.45 3.85 2.15 5.55 6 6-3.85.45-5.55 2.15-6 6-.45-3.85-2.15-5.55-6-6 3.85-.45 5.55-2.15 6-6Z'

	return (
		<RailSvg className={className}>
			<path className='ri-fill' d={star} />
			<path d={star} />
			<path
				className='ri-spark'
				d='M17.75 3c.18 1.32.68 1.82 2 2-1.32.18-1.82.68-2 2-.18-1.32-.68-1.82-2-2 1.32-.18 1.82-.68 2-2Z'
			/>
			<circle className='ri-dot ri-spark-dot' cx='18.5' cy='18' r='0.9' />
		</RailSvg>
	)
}

export function PanelIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<path
				className='ri-fill ri-panel-fill'
				d='M6.5 4.5h3v15h-3A3.5 3.5 0 0 1 3 16V8a3.5 3.5 0 0 1 3.5-3.5Z'
			/>
			<rect x='3' y='4.5' width='18' height='15' rx='3.5' />
			<path d='M9.5 4.5v15' />
			<path className='ri-panel-rows' d='M5.5 8.5h1.5M5.5 11h1.5M5.5 13.5h1.5' />
		</RailSvg>
	)
}

export function SettingsIcon({ className }: Props) {
	return (
		<RailSvg className={className}>
			<g className='ri-gear'>
				<path className='ri-fill' d={GEAR_PATH} />
				<path d={GEAR_PATH} />
				<circle cx='12' cy='12' r='2.75' />
			</g>
		</RailSvg>
	)
}
