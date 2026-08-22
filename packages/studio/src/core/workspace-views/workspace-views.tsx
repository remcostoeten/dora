import {
	Children,
	isValidElement,
	useEffect,
	useState,
	type ReactElement,
	type ReactNode
} from 'react'

type ViewProps = {
	id: string
	children: ReactNode
}

type Props = {
	activeViewId: string
	children: ReactElement<ViewProps> | ReactElement<ViewProps>[]
}

export function WorkspaceView(_props: ViewProps) {
	return null
}

export function WorkspaceViews({ activeViewId, children }: Props) {
	const [openedViewIds, setOpenedViewIds] = useState(() => {
		return new Set([activeViewId])
	})

	useEffect(() => {
		setOpenedViewIds((current) => {
			if (current.has(activeViewId)) return current
			const next = new Set(current)
			next.add(activeViewId)
			return next
		})
	}, [activeViewId])

	return Children.map(children, (child) => {
		if (!isValidElement<ViewProps>(child)) return null
		const viewId = child.props.id
		if (!openedViewIds.has(viewId) && viewId !== activeViewId) return null

		const isActive = viewId === activeViewId
		return (
			<section
				key={viewId}
				ref={(node) => {
					if (node) node.inert = !isActive
				}}
				data-workspace-view={viewId}
				className={isActive ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}
				hidden={!isActive}
				aria-hidden={!isActive}
			>
				{child.props.children}
			</section>
		)
	})
}
