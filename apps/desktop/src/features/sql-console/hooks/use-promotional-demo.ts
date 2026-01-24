import type { editor } from 'monaco-editor'
import { useState, useEffect, useRef, useCallback } from 'react'

// Define the steps for our script
const DEMO_SCRIPT = [
	'db.',
	'db.select',
	'db.select().from(users)',
	'db.select()\n  .from(users)\n  .where(eq(users.id, 1))'
]

export function usePromotionalDemo(editorInstance: editor.IStandaloneCodeEditor | null) {
	const [isActive, setIsActive] = useState(false)
	const [stepIndex, setStepIndex] = useState(0)
	const isTypingRef = useRef(false)

	const toggleDemoMode = useCallback(() => {
		setIsActive((prev) => {
			const next = !prev
			if (next) {
				setStepIndex(0)
				if (editorInstance) {
					editorInstance.setValue('')
					editorInstance.focus()
				}
			}
			return next
		})
	}, [editorInstance])

	const advanceScript = useCallback(async () => {
		if (!editorInstance || isTypingRef.current) return

		const nextStepIndex = stepIndex + 1
		if (nextStepIndex > DEMO_SCRIPT.length) return // Script finished

		const targetText = DEMO_SCRIPT[Math.min(nextStepIndex, DEMO_SCRIPT.length - 1)]
		const currentText = editorInstance.getValue()

		// Simple "fast typing" simulation
		// We can make this smarter (diffing) later if needed, but for now
		// replacing the content creates the "snap" effect user asked for in one variation,
		// or we can type the difference.

		// Let's implement a hybrid: fast type the difference
		if (targetText.startsWith(currentText)) {
			const remaining = targetText.slice(currentText.length)
			isTypingRef.current = true

			// Type remaining chars quickly
			for (let i = 0; i < remaining.length; i++) {
				editorInstance.trigger('keyboard', 'type', { text: remaining[i] })
				// Small random delay for realism, but very fast
				await new Promise((r) => setTimeout(r, 10 + Math.random() * 20))
			}
			isTypingRef.current = false
		} else {
			// Content changed drastically (e.g. newline formatting), just set it
			editorInstance.setValue(targetText)
			editorInstance.setPosition({ lineNumber: 1000, column: 1000 }) // Move to end
		}

		setStepIndex(nextStepIndex)

		// Trigger generic autocomplete if it feels right, or let the "Enter" key press logic handle it logic
		// For now, let's keep it simple: Just typing.
	}, [editorInstance, stepIndex])

	useEffect(() => {
		if (!isActive || !editorInstance) return

		const disposable = editorInstance.onKeyDown((e) => {
			// Intercept Enter to advance script
			if (e.code === 'Enter') {
				e.preventDefault()
				e.stopPropagation()
				advanceScript()
			}
		})

		return () => disposable.dispose()
	}, [isActive, editorInstance, advanceScript])

	return {
		isActive,
		toggleDemoMode,
		currentStep: stepIndex,
		totalSteps: DEMO_SCRIPT.length
	}
}
