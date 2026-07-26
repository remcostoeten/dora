import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './error-boundary'

type Props = {
	shouldThrow: boolean
}

function Bomb({ shouldThrow }: Props) {
	if (shouldThrow) {
		throw new Error('boom')
	}
	return <div>recovered</div>
}

describe('ErrorBoundary resetKeys', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('renders the fallback when a child throws', () => {
		render(
			<ErrorBoundary feature="Test" resetKeys={['table-a']}>
				<Bomb shouldThrow />
			</ErrorBoundary>
		)
		expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument()
	})

	it('clears the fallback when a reset key changes', () => {
		const { rerender } = render(
			<ErrorBoundary feature="Test" resetKeys={['table-a']}>
				<Bomb shouldThrow />
			</ErrorBoundary>
		)
		expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument()

		rerender(
			<ErrorBoundary feature="Test" resetKeys={['table-b']}>
				<Bomb shouldThrow={false} />
			</ErrorBoundary>
		)
		expect(screen.getByText('recovered')).toBeInTheDocument()
	})

	it('keeps the fallback when reset keys are unchanged', () => {
		const { rerender } = render(
			<ErrorBoundary feature="Test" resetKeys={['table-a']}>
				<Bomb shouldThrow />
			</ErrorBoundary>
		)

		rerender(
			<ErrorBoundary feature="Test" resetKeys={['table-a']}>
				<Bomb shouldThrow={false} />
			</ErrorBoundary>
		)
		expect(screen.getByText(/Something Went Wrong/i)).toBeInTheDocument()
	})
})
