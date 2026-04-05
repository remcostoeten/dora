import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(function () {
	return {
		startLiveMonitor: vi.fn(),
		stopLiveMonitor: vi.fn()
	}
})

vi.mock('@/lib/bindings', function () {
	return {
		commands: {
			startLiveMonitor: mocks.startLiveMonitor,
			stopLiveMonitor: mocks.stopLiveMonitor
		}
	}
})

describe('useLiveMonitor', function () {
	let backendListener: ((event: { payload: any }) => void) | null = null

	beforeEach(function () {
		backendListener = null
		vi.resetModules()
		mocks.startLiveMonitor.mockResolvedValue({
			status: 'ok',
			data: {
				monitorId: 'monitor-1',
				eventName: 'live-monitor-update'
			}
		})
		mocks.stopLiveMonitor.mockResolvedValue({ status: 'ok', data: null })

		Object.defineProperty(window, '__TAURI_INTERNALS__', {
			value: {
				transformCallback(handler: (event: { payload: any }) => void) {
					backendListener = handler
					return 1
				},
				unregisterCallback: vi.fn(),
				invoke: vi.fn(async function (command: string) {
					if (command === 'plugin:event|listen') {
						return 1
					}
					if (command === 'plugin:event|unlisten') {
						backendListener = null
						return null
					}
					return null
				})
			},
			configurable: true
		})
		Object.defineProperty(window, '__TAURI_EVENT_PLUGIN_INTERNALS__', {
			value: {
				unregisterListener: vi.fn()
			},
			configurable: true
		})
		vi.useFakeTimers()
	})

	afterEach(function () {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	it('batches backend change events into a single refresh callback', async function () {
		const { useLiveMonitor } = await import('@/features/database-studio/hooks/use-live-monitor')
		const onDataChanged = vi.fn()

		const { result } = renderHook(function () {
			return useLiveMonitor({
				connectionId: 'conn-1',
				tableName: 'public.users',
				isPaused: false,
				onDataChanged
			})
		})

		act(function () {
			result.current.setConfig(function (prev) {
				return {
					...prev,
					enabled: true
				}
			})
		})

		await act(async function () {
			await Promise.resolve()
		})

		expect(mocks.startLiveMonitor).toHaveBeenCalledTimes(1)

		await act(async function () {
			backendListener?.({
				payload: {
					monitorId: 'monitor-1',
					connectionId: 'conn-1',
					tableName: 'public.users',
					polledAt: 100,
					events: [
						{
							id: 'event-1',
							timestamp: 100,
							changeType: 'update',
							tableName: 'public.users',
							summary: 'Row updated',
							rowCount: 1
						}
					],
					error: null
				}
			})
			backendListener?.({
				payload: {
					monitorId: 'monitor-1',
					connectionId: 'conn-1',
					tableName: 'public.users',
					polledAt: 130,
					events: [
						{
							id: 'event-2',
							timestamp: 130,
							changeType: 'insert',
							tableName: 'public.users',
							summary: 'Row inserted',
							rowCount: 1
						}
					],
					error: null
				}
			})
		})

		expect(onDataChanged).not.toHaveBeenCalled()

		await act(async function () {
			vi.advanceTimersByTime(149)
		})

		expect(onDataChanged).not.toHaveBeenCalled()

		await act(async function () {
			vi.advanceTimersByTime(1)
		})

		expect(onDataChanged).toHaveBeenCalledTimes(1)
		expect(result.current.unreadCount).toBe(2)
		expect(result.current.changeEvents).toHaveLength(2)
	})
})
