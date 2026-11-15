import { useLayoutEffect, useRef } from 'react'

type Handler = (...args: never[]) => unknown
type HandlerMap = Record<string, Handler | undefined>

/**
 * @name useStableHandlers
 * @description Returns the given handlers behind functions whose identity never
 * changes but which always call the latest handler. A handler that is absent
 * stays `undefined`, because callers branch on presence. Passing the result to
 * a memoized child keeps its memo when the parent re-creates its handlers on
 * every render.
 *
 * @example
 * const stable = useStableHandlers({ onSave: handleSave, onCancel })
 * return <MemoizedForm onSave={stable.onSave} onCancel={stable.onCancel} />
 */
export function useStableHandlers<Handlers extends HandlerMap>(handlers: Handlers): Handlers {
	const latest = useRef(handlers)
	const proxies = useRef<HandlerMap>({})

	useLayoutEffect(function syncLatest() {
		latest.current = handlers
	})

	const stable: HandlerMap = {}
	for (const name of Object.keys(handlers)) {
		if (!handlers[name]) {
			stable[name] = undefined
			continue
		}
		proxies.current[name] ??= function stableHandler(...args: never[]) {
			return latest.current[name]?.(...args)
		}
		stable[name] = proxies.current[name]
	}
	// Every key of `handlers` was copied above with a function of the same signature.
	return stable as Handlers
}
