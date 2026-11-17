import { useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react'
import { memo, type CSSProperties } from 'react'
import { cn } from '@studio/shared/utils/cn'
import {
	NODE_HEADER_HEIGHT,
	NODE_LIST_PADDING_TOP,
	NODE_ROW_HEIGHT,
	type RelationshipEdgeData
} from '../hooks/use-schema-graph'

type Props = EdgeProps<Edge<RelationshipEdgeData, 'relationshipEdge'>>

type Geometry = {
	path: string
	start: [number, number]
	end: [number, number]
}

function getBox(node: InternalNode) {
	const position = node.internals.positionAbsolute
	return {
		x: position.x,
		y: position.y,
		width: node.measured.width ?? (node.data as { width?: number }).width ?? 240
	}
}

function rowCenter(y: number, index: number) {
	return y + 1 + NODE_HEADER_HEIGHT + NODE_LIST_PADDING_TOP + index * NODE_ROW_HEIGHT + 12
}

function getGeometry(
	source: InternalNode,
	target: InternalNode,
	data: RelationshipEdgeData
): Geometry {
	const a = getBox(source)
	const b = getBox(target)
	const ay = rowCenter(a.y, data.sourceColumnIndex)
	const by = rowCenter(b.y, data.targetColumnIndex)

	if (source.id === target.id) {
		const x = a.x + a.width
		return {
			path: `M${x} ${ay} C${x + 60} ${ay}, ${x + 60} ${by}, ${x} ${by}`,
			start: [x, ay],
			end: [x, by]
		}
	}

	let sx: number
	let ex: number
	let sd: number
	let ed: number
	if (b.x > a.x + a.width + 20) {
		sx = a.x + a.width
		ex = b.x
		sd = 1
		ed = -1
	} else if (b.x + b.width + 20 < a.x) {
		sx = a.x
		ex = b.x + b.width
		sd = -1
		ed = 1
	} else {
		sx = a.x + a.width
		ex = b.x + b.width
		sd = 1
		ed = 1
	}
	const curve = sd === ed ? 56 + Math.abs(by - ay) * 0.12 : Math.max(44, Math.abs(ex - sx) * 0.45)
	return {
		path: `M${sx} ${ay} C${sx + sd * curve} ${ay}, ${ex + ed * curve} ${by}, ${ex} ${by}`,
		start: [sx, ay],
		end: [ex, by]
	}
}

function RelationshipEdgeInner({ id, source, target, data }: Props) {
	const sourceNode = useInternalNode(source)
	const targetNode = useInternalNode(target)
	if (!sourceNode || !targetNode || !data) return null

	const geometry = getGeometry(sourceNode, targetNode, data)
	const travel = Math.hypot(
		geometry.end[0] - geometry.start[0],
		geometry.end[1] - geometry.start[1]
	)
	const duration = Math.min(3.4, Math.max(1.3, travel / 130)).toFixed(2)
	const style = data.hue ? ({ '--sv-edge-color': `var(--sv-${data.hue})` } as CSSProperties) : {}

	return (
		<g
			className={cn(
				'sv-edge',
				data.isActive && 'sv-edge--active',
				(data.isDimmed || data.searchState === 'dim') && 'sv-edge--dim',
				data.searchState === 'context' && 'sv-edge--context'
			)}
			style={style}
			data-edge-id={id}
		>
			<path className='sv-edge__rail' d={geometry.path} />
			<path className='sv-edge__line' d={geometry.path} />
			<circle
				className='sv-edge__end'
				cx={geometry.start[0]}
				cy={geometry.start[1]}
				r={2.5}
			/>
			<circle className='sv-edge__end' cx={geometry.end[0]} cy={geometry.end[1]} r={2.5} />
			{data.isActive && (
				<circle className='sv-edge__packet' r={3}>
					<animateMotion
						dur={`${duration}s`}
						repeatCount='indefinite'
						path={geometry.path}
					/>
				</circle>
			)}
		</g>
	)
}

/**
 * React Flow re-renders every edge on any node position change (drag). Memoize
 * so only edges whose geometry or data actually changed re-run their path math.
 */
export const RelationshipEdge = memo(RelationshipEdgeInner)
