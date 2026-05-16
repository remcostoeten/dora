import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { TabsProvider, useTabs } from '@/core/tabs/tabs-store'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(TabsProvider, null, children)
)

describe('useTabs', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    expect(result.current.tabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })

  it('openTab adds a new tab and makes it active', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
    })
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
  })

  it('openTab focuses existing tab instead of duplicating', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
    })
    expect(result.current.tabs).toHaveLength(1)
  })

  it('closeTab removes tab and activates adjacent', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.orders', tableName: 'orders', label: 'orders' })
    })
    const firstId = result.current.tabs[0].id
    const secondId = result.current.tabs[1].id
    act(() => { result.current.closeTab(firstId) })
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe(secondId)
  })

  it('closeTab on last tab sets activeTabId to null', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
    })
    const id = result.current.tabs[0].id
    act(() => { result.current.closeTab(id) })
    expect(result.current.tabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })

  it('caps at 12 tabs, replacing the oldest', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      for (let i = 0; i < 13; i++) {
        result.current.openTab({ connectionId: 'c1', tableId: `public.t${i}`, tableName: `t${i}`, label: `t${i}` })
      }
    })
    expect(result.current.tabs).toHaveLength(12)
  })
})
