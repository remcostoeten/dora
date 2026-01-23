import { useState, useCallback } from "react";

export function useClipboard(timeout = 2000) {
	const [hasCopied, setHasCopied] = useState(false)

	const copyToClipboard = useCallback(
		function (text: string) {
			if (!navigator?.clipboard) {
				console.warn('Clipboard not supported')
				return
			}

			navigator.clipboard.writeText(text).then(function () {
				setHasCopied(true)
				setTimeout(function () {
					setHasCopied(false)
				}, timeout)
			})
		},
		[timeout]
	)

	return { hasCopied, copyToClipboard }
}
