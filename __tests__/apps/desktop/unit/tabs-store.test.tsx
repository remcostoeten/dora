import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import React from 'react'
import { TabsProvider, useTabs } from '@/core/tabs/tabs-store'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TabsProvider>{children}</TabsProvider>
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
    expect(result.current.activeTabId).toBe(result.current.tabs[0].id)
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

  it('closeTab on active tab activates the previous tab', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.orders', tableName: 'orders', label: 'orders' })
    })
    const firstId = result.current.tabs[0].id
    const secondId = result.current.tabs[1].id
    // second tab is currently active (last opened)
    expect(result.current.activeTabId).toBe(secondId)
    act(() => { result.current.closeTab(secondId) })
    expect(result.current.tabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe(firstId)
  })

  it('caps at 12 tabs, replacing the oldest', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      for (let i = 0; i < 13; i++) {
        result.current.openTab({ connectionId: 'c1', tableId: `public.t${i}`, tableName: `t${i}`, label: `t${i}` })
      }
    })
    expect(result.current.tabs).toHaveLength(12)
    expect(result.current.tabs[0].label).toBe('t1')
  })

  it('pins a tab and moves it before unpinned tabs', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.orders', tableName: 'orders', label: 'orders' })
    })
    const secondId = result.current.tabs[1].id
    act(() => { result.current.togglePinTab(secondId) })
    expect(result.current.tabs[0].id).toBe(secondId)
    expect(result.current.tabs[0].pinned).toBe(true)
  })

  it('closeOtherTabs keeps pinned tabs and the selected tab', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.orders', tableName: 'orders', label: 'orders' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.products', tableName: 'products', label: 'products' })
    })
    const usersId = result.current.tabs[0].id
    const ordersId = result.current.tabs[1].id
    act(() => {
      result.current.togglePinTab(usersId)
      result.current.closeOtherTabs(ordersId)
    })
    expect(result.current.tabs.map((tab) => tab.id)).toEqual([usersId, ordersId])
    expect(result.current.activeTabId).toBe(ordersId)
  })

  it('closes unpinned tabs to the left and right of a tab', () => {
    const { result } = renderHook(() => useTabs(), { wrapper })
    act(() => {
      result.current.openTab({ connectionId: 'c1', tableId: 'public.t1', tableName: 't1', label: 't1' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.t2', tableName: 't2', label: 't2' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.t3', tableName: 't3', label: 't3' })
      result.current.openTab({ connectionId: 'c1', tableId: 'public.t4', tableName: 't4', label: 't4' })
    })
    const secondId = result.current.tabs[1].id
    act(() => { result.current.closeTabsToLeft(secondId) })
    expect(result.current.tabs.map((tab) => tab.label)).toEqual(['t2', 't3', 't4'])
    act(() => { result.current.closeTabsToRight(secondId) })
    expect(result.current.tabs.map((tab) => tab.label)).toEqual(['t2'])
  })
})
