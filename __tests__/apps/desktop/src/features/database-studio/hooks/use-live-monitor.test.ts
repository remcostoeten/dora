import { renderHook, act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLiveMonitor } from '@/features/database-studio/hooks/use-live-monitor'

const mocks = vi.hoisted(function () {
	return {
		listen: vi.fn(),
		startLiveMonitor: vi.fn(),
		stopLiveMonitor: vi.fn()
	}
})

vi.mock('@tauri-apps/api/event', function () {
	return {
		listen: mocks.listen
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
		mocks.listen.mockImplementation(function (_eventName, handler) {
			backendListener = handler
			return Promise.resolve(function () {
				backendListener = null
			})
		})
		mocks.startLiveMonitor.mockResolvedValue({
			status: 'ok',
			data: {
				monitorId: 'monitor-1',
				eventName: 'live-monitor-update'
			}
		})
		mocks.stopLiveMonitor.mockResolvedValue({ status: 'ok', data: null })

		Object.defineProperty(window, '__TAURI__', {
			value: {},
			configurable: true
		})
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
		vi.useFakeTimers()
	})

	afterEach(function () {
		vi.runOnlyPendingTimers()
		vi.useRealTimers()
		delete (window as unknown as Record<string, unknown>).__TAURI__
		delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
		vi.clearAllMocks()
	})

	it('batches backend change events into a single refresh callback', async function () {
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

		await waitFor(function () {
			expect(mocks.startLiveMonitor).toHaveBeenCalledTimes(1)
		})

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
