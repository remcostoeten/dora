import { cleanup } from '@testing-library/react'
import { expect, afterEach } from 'vitest'

// Cleanup after each test
afterEach(() => {
	cleanup()
})

// Custom matchers can be added here
