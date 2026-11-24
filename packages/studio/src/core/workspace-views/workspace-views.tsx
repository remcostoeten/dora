import {
	Children,
	createContext,
	isValidElement,
	useContext,
	useEffect,
	useRef,
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

export type ViewActivity = {
	isActive: () => boolean
	subscribe: (listener: () => void) => () => void
}

type ViewActivitySource = {
	activity: ViewActivity
	setActive: (active: boolean) => void
}

type ViewEffect = () => (() => void) | void

const ALWAYS_ACTIVE: ViewActivity = {
	isActive: () => true,
	subscribe: () => () => undefined
}

const ViewActivityContext = createContext<ViewActivity>(ALWAYS_ACTIVE)

function createViewActivity(initiallyActive: boolean): ViewActivitySource {
	let active = initiallyActive
	const listeners = new Set<() => void>()
	return {
		activity: {
			isActive: () => active,
			subscribe(listener) {
				listeners.add(listener)
				return () => {
					listeners.delete(listener)
				}
			}
		},
		setActive(next) {
			if (next === active) return
			active = next
			listeners.forEach((listener) => listener())
		}
	}
}

/**
 * @name useViewActivity
 * @description Returns the activity of the workspace view this component is rendered in. The object is stable, so
 * reading it never re-renders the view; call `isActive()` or `subscribe()` for the current state. Outside a workspace
 * view it always reports active.
 *
 * @example
 * const activity = useViewActivity()
 * useEffect(() => activity.subscribe(() => console.log(activity.isActive())), [activity])
 */
export function useViewActivity(): ViewActivity {
	return useContext(ViewActivityContext)
}

/**
 * @name useWhileViewActive
 * @description Runs an effect while the surrounding workspace view is shown and cleans it up when the view is hidden,
 * without re-rendering the view on a switch. The latest effect is used each time the view becomes active.
 *
 * @example
 * useWhileViewActive(() => {
 *   $.enableScope('data-grid')
 *   return () => $.disableScope('data-grid')
 * })
 */
export function useWhileViewActive(effect: ViewEffect) {
	const activity = useViewActivity()
	const effectRef = useRef(effect)
	effectRef.current = effect

	useEffect(() => {
		let running = false
		let cleanup: (() => void) | void = undefined

		function sync() {
			const active = activity.isActive()
			if (active === running) return
			running = active
			if (active) {
				cleanup = effectRef.current()
				return
			}
			cleanup?.()
			cleanup = undefined
		}

		sync()
		const unsubscribe = activity.subscribe(sync)
		return () => {
			unsubscribe()
			if (running) cleanup?.()
		}
	}, [activity])
}

export function WorkspaceView(_props: ViewProps) {
	return null
}

export function WorkspaceViews({ activeViewId, children }: Props) {
	const [openedViewIds, setOpenedViewIds] = useState(() => {
		return new Set([activeViewId])
	})
	const sourcesRef = useRef(new Map<string, ViewActivitySource>())

	useEffect(() => {
		setOpenedViewIds((current) => {
			if (current.has(activeViewId)) return current
			const next = new Set(current)
			next.add(activeViewId)
			return next
		})
	}, [activeViewId])

	useEffect(() => {
		const sources = sourcesRef.current
		sources.forEach((source, viewId) => {
			if (viewId !== activeViewId) source.setActive(false)
		})
		sources.get(activeViewId)?.setActive(true)
	}, [activeViewId])

	function sourceFor(viewId: string): ViewActivitySource {
		const existing = sourcesRef.current.get(viewId)
		if (existing) return existing
		const created = createViewActivity(viewId === activeViewId)
		sourcesRef.current.set(viewId, created)
		return created
	}

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
				<ViewActivityContext.Provider value={sourceFor(viewId).activity}>
					{child.props.children}
				</ViewActivityContext.Provider>
			</section>
		)
	})
}
