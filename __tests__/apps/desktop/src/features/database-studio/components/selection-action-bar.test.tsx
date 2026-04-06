import { act, render, screen, waitFor } from '@testing-library/react'
import * as React from 'react'
import { forwardRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SelectionActionBar } from '@/features/database-studio/components/selection-action-bar'

vi.mock(
	'framer-motion',
	function () {
		function createMotionComponent(tag: keyof HTMLElementTagNameMap) {
			return forwardRef<HTMLElement, Record<string, unknown>>(function MotionComponent(
				props,
				ref
			) {
				const {
					children,
					layout,
					transition,
					initial,
					animate,
					exit,
					layoutId,
					variants,
					whileHover,
					whileTap,
					...domProps
				} = props
				void layout
				void transition
				void initial
				void animate
				void exit
				void layoutId
				void variants
				void whileHover
				void whileTap
				return React.createElement(tag, { ...domProps, ref }, children)
			})
		}

		return {
			AnimatePresence({ children }: { children: React.ReactNode }) {
				return children
			},
			motion: new Proxy(
				{},
				{
					get(_target, key: string) {
						return createMotionComponent(key as keyof HTMLElementTagNameMap)
					}
				}
			)
		}
	},
	{ virtual: true }
)

type ResizeObserverCallback = ConstructorParameters<typeof ResizeObserver>[0]

const resizeObservers = new Set<ResizeObserverMock>()

class ResizeObserverMock {
	private callback: ResizeObserverCallback

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback
		resizeObservers.add(this)
	}

	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn(() => {
		resizeObservers.delete(this)
	})

	trigger() {
		this.callback([], this as unknown as ResizeObserver)
	}
}

function setElementWidth(element: HTMLElement, width: number) {
	Object.defineProperty(element, 'offsetWidth', {
		configurable: true,
		get() {
			return width
		}
	})
}

function renderSelectionBar() {
	return render(
		<div data-testid='toolbar-host'>
			<SelectionActionBar
				selectedCount={1}
				onDelete={() => {}}
				onCopy={() => {}}
				onDuplicate={() => {}}
				onExportJson={() => {}}
				onExportCsv={() => {}}
				onBulkEdit={() => {}}
				onSetNull={() => {}}
				onClearSelection={() => {}}
				mode='floating'
			/>
		</div>
	)
}

describe('SelectionActionBar', function () {
	let originalResizeObserver: typeof ResizeObserver | undefined

	beforeEach(function () {
		originalResizeObserver = globalThis.ResizeObserver
		globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
	})

	afterEach(function () {
		resizeObservers.clear()
		if (originalResizeObserver) {
			globalThis.ResizeObserver = originalResizeObserver
			return
		}
		delete (globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver })
			.ResizeObserver
	})

	it('moves row actions into overflow when the toolbar host shrinks and restores them when it grows', async function () {
		renderSelectionBar()

		const host = screen.getByTestId('toolbar-host')

		setElementWidth(host, 1500)
		act(function () {
			resizeObservers.forEach(function (observer) {
				observer.trigger()
			})
		})

		await waitFor(function () {
			expect(screen.getByRole('button', { name: /bulk edit 1 row/i })).toBeInTheDocument()
		})
		expect(screen.queryByRole('button', { name: /show \d+ more actions/i })).not.toBeInTheDocument()

		setElementWidth(host, 680)
		act(function () {
			resizeObservers.forEach(function (observer) {
				observer.trigger()
			})
		})

		await waitFor(function () {
			expect(screen.getByRole('button', { name: /show 3 more actions/i })).toBeInTheDocument()
		})
		await waitFor(function () {
			expect(screen.queryByRole('button', { name: /bulk edit 1 row/i })).not.toBeInTheDocument()
			expect(screen.queryByRole('button', { name: /set null for 1 row/i })).not.toBeInTheDocument()
		})

		setElementWidth(host, 1500)
		act(function () {
			resizeObservers.forEach(function (observer) {
				observer.trigger()
			})
		})

		await waitFor(function () {
			expect(screen.getByRole('button', { name: /bulk edit 1 row/i })).toBeInTheDocument()
		})
	})
})
