import { getGlobalBus, sendEvt } from '../analytics-dispatcher'

export function useTrack() {
	return function track(name: string, data?: Record<string, unknown>) {
		const bus = getGlobalBus()
		if (!bus) return
		sendEvt(bus, { name, data })
	}
}

export function usePageView() {
	const track = useTrack()

	return function trackPage(path: string, title?: string) {
		track('page_view', { path, title })
	}
}

export function useIdentify() {
	const track = useTrack()

	return function identify(userId: string, data?: Record<string, unknown>) {
		track('identify', { userId, ...data })
	}
}