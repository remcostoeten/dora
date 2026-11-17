import { useReactFlow, useViewport } from '@xyflow/react'
import { Maximize, Minus, Plus } from 'lucide-react'

export type EdgeStyle = 'flow' | 'dashed' | 'solid'

type Props = {
	edgeStyle: EdgeStyle
	onCycleEdgeStyle: () => void
	editMode: boolean
	onResetLayout: () => void
	onFit: () => void
}

const EDGE_STYLE_LABEL: Record<EdgeStyle, string> = {
	flow: 'Flow',
	dashed: 'Dashed',
	solid: 'Solid'
}

export function SchemaZoombar({
	edgeStyle,
	onCycleEdgeStyle,
	editMode,
	onResetLayout,
	onFit
}: Props) {
	const { zoom } = useViewport()
	const reactFlow = useReactFlow()

	return (
		<div className='sv-zoombar'>
			<button
				type='button'
				className='sv-ibtn sv-ibtn--sm'
				title='Zoom out (-)'
				aria-label='Zoom out'
				onClick={() => reactFlow.zoomOut({ duration: 200 })}
			>
				<Minus className='h-3.5 w-3.5' />
			</button>
			<button
				type='button'
				className='sv-zoombar__pct'
				title='Reset to 100% (0)'
				onClick={() => reactFlow.zoomTo(1, { duration: 200 })}
			>
				{Math.round(zoom * 100)}%
			</button>
			<button
				type='button'
				className='sv-ibtn sv-ibtn--sm'
				title='Zoom in (+)'
				aria-label='Zoom in'
				onClick={() => reactFlow.zoomIn({ duration: 200 })}
			>
				<Plus className='h-3.5 w-3.5' />
			</button>
			<button
				type='button'
				className='sv-ibtn sv-ibtn--sm'
				title='Fit view (F)'
				aria-label='Fit view'
				onClick={onFit}
			>
				<Maximize className='h-3.5 w-3.5' />
			</button>
			<span className='sv-zoombar__divider' />
			<button
				type='button'
				className='sv-zoombar__pct'
				title='Connector style (L)'
				onClick={onCycleEdgeStyle}
			>
				{EDGE_STYLE_LABEL[edgeStyle]}
			</button>
			<span className='sv-zoombar__divider' />
			{editMode ? (
				<span className='sv-zoombar__mode'>
					<span className='sv-zoombar__mode-label'>
						<b>Arranging</b> · drag tables
					</span>
					<button type='button' className='sv-zoombar__reset' onClick={onResetLayout}>
						Reset layout
					</button>
				</span>
			) : (
				<span className='sv-zoombar__mode'>
					<span className='sv-zoombar__mode-label'>
						<b>Read only</b> · drag to pan
					</span>
				</span>
			)}
		</div>
	)
}
