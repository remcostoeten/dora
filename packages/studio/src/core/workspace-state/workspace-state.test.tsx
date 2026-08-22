import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useWorkspaceState } from './workspace-state'

describe('useWorkspaceState', () => {
	it('reads the previously stored connection state synchronously', () => {
		const state = renderHook(
			({ connectionId }: { connectionId: string }) => {
				return useWorkspaceState(`${connectionId}:selection`, () => {
					return new Set<number>()
				})
			},
			{ initialProps: { connectionId: 'workspace-connection-a' } }
		)

		act(() => {
			state.result.current[1](new Set([3]))
		})
		state.rerender({ connectionId: 'workspace-connection-b' })
		expect(state.result.current[0].size).toBe(0)

		state.rerender({ connectionId: 'workspace-connection-a' })
		expect(state.result.current[0]).toEqual(new Set([3]))
	})
})
