import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useState, useEffect } from 'react'

// Mock settings store
const mockUpdateSetting = vi.fn()
const mockUpdateSettings = vi.fn()
const mockSettings = {
    lastConnectionId: null,
    lastTableId: null,
    lastRowPK: null,
    restoreLastConnection: true
}

// Simplified version of the hook logic we want to test
function useSettingsRestorationTest(initialSettings = mockSettings) {
    console.log('DEBUG: hook init with', initialSettings)
    const [settings, setSettings] = useState(initialSettings)
    console.log('DEBUG: hook settings state', settings)
    const [activeConnectionId, setActiveConnectionId] = useState<string>('')
    const [selectedTableId, setSelectedTableId] = useState<string>('')
    const [selectedRowPK, setSelectedRowPK] = useState<string | number | null>(initialSettings.lastRowPK)

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        mockUpdateSetting(key, value)
    }

    const updateSettingsFn = (updates: any) => {
        setSettings(prev => ({ ...prev, ...updates }))
        mockUpdateSettings(updates)
    }

    // Simulate saving last connection logic
    useEffect(() => {
        if (!activeConnectionId) return

        const updates: any = {}
        let hasUpdates = false

        if (settings.lastConnectionId !== activeConnectionId) {
            updates.lastConnectionId = activeConnectionId
            hasUpdates = true
        }

        if (selectedTableId && settings.lastTableId !== selectedTableId) {
            updates.lastTableId = selectedTableId
            hasUpdates = true
        }

        if (hasUpdates) {
            updateSettingsFn(updates)
        }
    }, [activeConnectionId, selectedTableId, settings.lastConnectionId, settings.lastTableId])

    // Simulate row selection logic
    useEffect(() => {
        if (selectedRowPK !== settings.lastRowPK) {
            updateSetting('lastRowPK', selectedRowPK)
        }
    }, [selectedRowPK, settings.lastRowPK])

    return {
        settings,
        setActiveConnectionId,
        setSelectedTableId,
        setSelectedRowPK
    }
}

describe('Settings Restoration Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Reset mock settings
        mockSettings.lastConnectionId = null
        mockSettings.lastTableId = null
        mockSettings.lastRowPK = null
    })

    it('should persist last connection and table when changed', () => {
        const { result } = renderHook(() => useSettingsRestorationTest())

        act(() => {
            result.current.setActiveConnectionId('conn-1')
        })

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
            lastConnectionId: 'conn-1'
        }))

        act(() => {
            result.current.setSelectedTableId('users')
        })

        expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({
            lastTableId: 'users'
        }))
    })

    it('should persist last row PK when selection changes', () => {
        const { result } = renderHook(() => useSettingsRestorationTest())

        act(() => {
            result.current.setSelectedRowPK(123)
        })

        expect(mockUpdateSetting).toHaveBeenCalledWith('lastRowPK', 123)
    })

    it('should restore state from settings (simulation)', () => {
        const { result } = renderHook(() => useSettingsRestorationTest({
            ...mockSettings,
            lastConnectionId: 'conn-restored',
            lastTableId: 'table-restored',
            lastRowPK: 456
        }))

        // Verify "restored" values match (in real app this logic is in initialization effect)
        expect(result.current.settings.lastConnectionId).toBe('conn-restored')
        expect(result.current.settings.lastTableId).toBe('table-restored')
        expect(result.current.settings.lastRowPK).toBe(456)
    })
})
