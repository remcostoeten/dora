import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { FKNavigateIcon } from '@/features/database-studio/components/data-grid/fk-icon'

const fk = { referencedTable: 'users', referencedColumn: 'id', referencedSchema: 'public' }

describe('FKNavigateIcon', () => {
	it('renders when cellValue is not null', () => {
		render(<FKNavigateIcon foreignKey={fk} cellValue={42} onNavigate={vi.fn()} />)
		expect(screen.getByRole('button', { name: /navigate to users/i })).toBeTruthy()
	})

	it('renders nothing when cellValue is null', () => {
		const { container } = render(<FKNavigateIcon foreignKey={fk} cellValue={null} onNavigate={vi.fn()} />)
		expect(container.firstChild).toBeNull()
	})

	it('renders nothing when cellValue is undefined', () => {
		const { container } = render(<FKNavigateIcon foreignKey={fk} cellValue={undefined} onNavigate={vi.fn()} />)
		expect(container.firstChild).toBeNull()
	})

	it('calls onNavigate with correct args on click', () => {
		const onNavigate = vi.fn()
		render(<FKNavigateIcon foreignKey={fk} cellValue={42} onNavigate={onNavigate} />)
		fireEvent.click(screen.getByRole('button'))
		expect(onNavigate).toHaveBeenCalledWith('users', 'id', 42, 'public')
	})

	it('stops propagation on click', () => {
		const parentClick = vi.fn()
		render(
			<div onClick={parentClick}>
				<FKNavigateIcon foreignKey={fk} cellValue={42} onNavigate={vi.fn()} />
			</div>
		)
		fireEvent.click(screen.getByRole('button'))
		expect(parentClick).not.toHaveBeenCalled()
	})
})
