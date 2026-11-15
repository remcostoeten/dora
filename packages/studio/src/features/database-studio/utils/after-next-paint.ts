const PAINT_FALLBACK_MS = 120

/**
 * @name afterNextPaint
 * @description Resolves once the frame that is about to be painted has reached
 * the screen, so follow-up work never competes with that paint. Falls back to
 * a timer when the window is hidden and no frame is produced.
 *
 * @example
 * setRows(snapshot.rows)
 * await afterNextPaint()
 * const fresh = await fetchRows()
 */
export function afterNextPaint(): Promise<void> {
	return new Promise(function (resolve) {
		let settled = false
		function settle() {
			if (settled) return
			settled = true
			resolve()
		}
		const fallback = setTimeout(settle, PAINT_FALLBACK_MS)
		requestAnimationFrame(function () {
			setTimeout(function () {
				clearTimeout(fallback)
				settle()
			}, 0)
		})
	})
}
