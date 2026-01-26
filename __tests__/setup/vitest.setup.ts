import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { expect, afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Custom matchers can be added here
