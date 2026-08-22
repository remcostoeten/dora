import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePendingEdits } from './pending-edits-store'

describe('usePendingEdits', () => {
	it('isolates edits by connection id', () => {
		const first = renderHook(() => {
			return usePendingEdits('pending-edits-connection-a')
		})
		const second = renderHook(() => {
			return usePendingEdits('pending-edits-connection-b')
		})

		act(() => {
			first.result.current.addEdit('users', {
				primaryKeyColumn: 'id',
				primaryKeyValue: 1,
				columnName: 'name',
				oldValue: 'Ada',
				newValue: 'Grace'
			})
		})

		expect(first.result.current.getEditCount('users')).toBe(1)
		expect(second.result.current.getEditCount('users')).toBe(0)
	})
})
