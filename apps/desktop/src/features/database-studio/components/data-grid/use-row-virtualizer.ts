import { useVirtualizer } from '@tanstack/react-virtual'
import { RefObject } from 'react'

const ROW_HEIGHT = 34 // px — matches the td py-1.5 + content height
const OVERSCAN = 12

type Options = {
	scrollContainerRef: RefObject<HTMLElement | null>
	rowCount: number
	enabled: boolean
}

export function useRowVirtualizer({ scrollContainerRef, rowCount, enabled }: Options) {
	const virtualizer = useVirtualizer({
		count: enabled ? rowCount : 0,
		getScrollElement: function () {
			return scrollContainerRef.current
		},
		estimateSize: function () {
			return ROW_HEIGHT
		},
		overscan: OVERSCAN,
		enabled,
	})

	return {
		virtualizer,
		virtualRows: enabled ? virtualizer.getVirtualItems() : null,
		totalSize: enabled ? virtualizer.getTotalSize() : null,
	}
}
