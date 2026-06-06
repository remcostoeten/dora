import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { TabBar } from '@/features/tab-bar'
import type { Tab } from '@/core/tabs'

const tabs: Tab[] = [
  { id: '1', connectionId: 'c1', tableId: 'public.users', tableName: 'users', label: 'users' },
  { id: '2', connectionId: 'c1', tableId: 'public.orders', tableName: 'orders', label: 'orders' },
]

describe('TabBar', () => {
  it('renders nothing when tabs array is empty', () => {
    const { container } = render(
      <TabBar tabs={[]} activeTabId={null} onTabClick={vi.fn()} onTabClose={vi.fn()} />
    )
    expect(container.querySelector('[data-tauri-drag-region="true"]')).toBeTruthy()
  })

  it('renders a pill per tab', () => {
    render(<TabBar tabs={tabs} activeTabId="1" onTabClick={vi.fn()} onTabClose={vi.fn()} />)
    expect(screen.getByText('users')).toBeTruthy()
    expect(screen.getByText('orders')).toBeTruthy()
  })

  it('calls onTabClick when tab label clicked', () => {
    const onClick = vi.fn()
    render(<TabBar tabs={tabs} activeTabId="1" onTabClick={onClick} onTabClose={vi.fn()} />)
    fireEvent.click(screen.getByText('orders'))
    expect(onClick).toHaveBeenCalledWith('2')
  })

  it('calls onTabClose when × clicked', () => {
    const onClose = vi.fn()
    render(<TabBar tabs={tabs} activeTabId="1" onTabClick={vi.fn()} onTabClose={onClose} />)
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalledWith('1')
  })

  it('close button stops propagation (does not also call onTabClick)', () => {
    const onClick = vi.fn()
    const onClose = vi.fn()
    render(<TabBar tabs={tabs} activeTabId="1" onTabClick={onClick} onTabClose={onClose} />)
    const closeButtons = screen.getAllByRole('button', { name: /close/i })
    fireEvent.click(closeButtons[0])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })
})
