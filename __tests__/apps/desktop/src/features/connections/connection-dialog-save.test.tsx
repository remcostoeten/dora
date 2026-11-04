import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionDialog } from '@/features/connections/components/connection-dialog'

vi.mock('@studio/core/data-provider', () => ({
	useIsTauri: () => true
}))

describe('ConnectionDialog save', () => {
	it('shows the validation error and focuses the invalid field', async () => {
		const onSave = vi.fn()
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={onSave} />)

		await userEvent.click(screen.getByRole('button', { name: /save connection/i }))

		expect(screen.getByRole('alert')).toHaveTextContent(/connection name is required/i)
		const nameInput = screen.getByLabelText(/connection name/i)
		expect(nameInput).toHaveFocus()
		expect(nameInput).toHaveAttribute('aria-invalid', 'true')
		expect(onSave).not.toHaveBeenCalled()
	})

	it('waits for the save to finish before re-enabling Save', async () => {
		let resolveSave: () => void = () => {}
		const onSave = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSave = resolve
				})
		)
		render(<ConnectionDialog open onOpenChange={vi.fn()} onSave={onSave} />)

		await userEvent.type(screen.getByLabelText(/connection name/i), 'Local')
		await userEvent.click(screen.getByRole('button', { name: /save connection/i }))

		expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Local' }))
		expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()

		resolveSave()
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /save connection/i })).toBeEnabled()
		})
	})
})
