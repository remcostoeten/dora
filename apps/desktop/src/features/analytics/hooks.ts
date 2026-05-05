'use client'

import { useCallback } from 'react'
import { captureError, identify, page, track } from './client'

/** Returns a stable custom-event tracker for React components. */
export function useTrack() {
	return useCallback((name: string, data?: Record<string, unknown>) => {
		track(name, data)
	}, [])
}

/** Returns a stable manual page-view tracker for custom routers or edge cases. */
export function usePageView() {
	return useCallback((path: string, title?: string, data?: Record<string, unknown>) => {
		page(path, title, data)
	}, [])
}

/** Returns a stable identify helper for anonymized user/session metadata. */
export function useIdentify() {
	return useCallback((userId: string, data?: Record<string, unknown>) => {
		identify(userId, data)
	}, [])
}

/** Returns a stable error capture helper. */
export function useCaptureError() {
	return useCallback((error: Error, data?: Record<string, unknown>) => {
		captureError(error, data)
	}, [])
}
