import {
	BaseEdge,
	EdgeLabelRenderer,
	getBezierPath,
	type Edge,
	type EdgeProps,
} from '@xyflow/react'
import { cn } from '@/shared/utils/cn'
import type { RelationshipEdgeData } from '../hooks/use-schema-graph'

type Props = EdgeProps<Edge<RelationshipEdgeData, 'relationshipEdge'>>

function getEdgeVisuals(data: RelationshipEdgeData | undefined) {
	if (!data) {
		return {
			strokeColor: 'hsl(246 68% 64%)',
			strokeWidth: 1.8,
			strokeDasharray: undefined as string | undefined,
			strokeOpacity: 0.7,
			badgeClass: 'sv-edge-badge--primary',
			iconChar: '→',
		}
	}

	const searchFade =
		data.searchState === 'dim'
			? 0.18
			: data.searchState === 'context'
				? 0.55
				: 1

	if (data.relationKind === 'many-to-many') {
		return {
			strokeColor: 'hsl(246 68% 64%)',
			strokeWidth: 1.8,
			strokeDasharray: '7 5',
			strokeOpacity: 0.58 * searchFade,
			badgeClass: 'sv-edge-badge--warning',
			iconChar: '⇔',
		}
	}

	if (data.relationKind === 'one-to-one') {
		return {
			strokeColor: 'hsl(246 68% 64%)',
			strokeWidth: 1.8,
			strokeDasharray: undefined as string | undefined,
			strokeOpacity: 0.7 * searchFade,
			badgeClass: 'sv-edge-badge--success',
			iconChar: '↔',
		}
	}

	return {
		strokeColor: 'hsl(246 68% 64%)',
		strokeWidth: 1.7,
		strokeDasharray: data.isOptional ? '6 4 2 4' : (undefined as string | undefined),
		strokeOpacity: (data.isOptional ? 0.42 : 0.66) * searchFade,
		badgeClass: data.isOptional
			? 'sv-edge-badge--primary sv-edge-badge--optional'
			: 'sv-edge-badge--primary',
		iconChar: '→',
	}
}

export function RelationshipEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style,
	markerEnd,
	data,
	selected,
}: Props) {
	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		curvature: data?.isSelfReference ? 0.8 : 0.35,
	})
	const vis = getEdgeVisuals(data)

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				markerEnd={markerEnd}
				style={{
					...style,
					stroke: vis.strokeColor,
					strokeOpacity: vis.strokeOpacity,
					strokeLinecap: 'round',
					strokeLinejoin: 'round',
					strokeWidth: vis.strokeWidth,
					strokeDasharray: vis.strokeDasharray,
				}}
			/>

			{data && selected && (
				<EdgeLabelRenderer>
					<div
						className='pointer-events-none absolute'
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
							opacity:
								data.searchState === 'dim'
									? 0.2
									: data.searchState === 'context'
										? 0.65
										: 1,
						}}
					>
						<div className={cn('sv-edge-badge', vis.badgeClass)}>
							<span className='sv-edge-badge__cardinality'>
								{data.cardinality}
							</span>
							{selected && (
								<span className='sv-edge-badge__detail'>
									<span className='sv-edge-badge__col'>{data.sourceColumn}</span>
									<span className='sv-edge-badge__arrow'>{vis.iconChar}</span>
									<span className='sv-edge-badge__col'>{data.targetColumn}</span>
								</span>
							)}
						</div>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	)
}
