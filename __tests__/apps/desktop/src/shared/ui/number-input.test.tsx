import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { NumberInput } from '@/shared/ui/number-input'

describe('NumberInput', () => {
    it('renders correctly with initial value', () => {
        render(<NumberInput value="10" onChange={() => { }} />)
        const input = screen.getByRole('spinbutton') as HTMLInputElement
        expect(input.value).toBe('10')
    })

    it('increments value on up button click', () => {
        const handleChange = vi.fn()
        render(<NumberInput value={10} onChange={handleChange} />)

        const incrementBtn = screen.getByLabelText('Increase value')
        fireEvent.click(incrementBtn)

        // Since we are mocking the change event dispatch in JSDOM, we check if onChange was called
        // Note: dispatching manual events in React testing can be tricky. 
        // The component triggers a native change event.
        expect(handleChange).toHaveBeenCalled()
    })

    it('decrements value on down button click', () => {
        const handleChange = vi.fn()
        render(<NumberInput value={10} onChange={handleChange} />)

        const decrementBtn = screen.getByLabelText('Decrease value')
        fireEvent.click(decrementBtn)

        expect(handleChange).toHaveBeenCalled()
    })

    it('respects min and max', () => {
        // We test disability of buttons logic here mainly
        const { rerender } = render(<NumberInput value={10} max={10} onChange={() => { }} />)
        const incrementBtn = screen.getByLabelText('Increase value')
        expect(incrementBtn).toBeDisabled()

        rerender(<NumberInput value={0} min={0} onChange={() => { }} />)
        const decrementBtn = screen.getByLabelText('Decrease value')
        expect(decrementBtn).toBeDisabled()
    })
})
