import { afterEach, describe, expect, it } from 'vitest'
import { dropCostlyEditorFocusRule } from './focus-rule'

function addStyle(css: string): HTMLStyleElement {
	const style = document.createElement('style')
	style.textContent = css
	document.head.appendChild(style)
	return style
}

function selectorsOf(style: HTMLStyleElement): string[] {
	return Array.from(style.sheet?.cssRules ?? []).map((rule) => rule.cssText.split('{')[0].trim())
}

describe('dropCostlyEditorFocusRule', () => {
	afterEach(() => {
		document.head.querySelectorAll('style').forEach((style) => style.remove())
	})

	it('deletes the negated focus-within rule and keeps every other rule', () => {
		const style = addStyle(
			[
				'.workbench-hover-container:focus-within .workbench-hover-pointer:after { color: red; }',
				'.workbench-hover-container:not(:focus-within).locked .workbench-hover-pointer:after { color: blue; }',
				'.group-focus-within\\:flex:is(.group:focus-within *) { display: flex; }',
				'.monaco-editor { color: green; }'
			].join('\n')
		)

		dropCostlyEditorFocusRule()

		const selectors = selectorsOf(style)
		expect(selectors).toHaveLength(3)
		expect(selectors.some((selector) => selector.includes(':not(:focus-within)'))).toBe(false)
		expect(selectors.some((selector) => selector.includes('.monaco-editor'))).toBe(true)
	})

	it('is a no-op when the rule is absent or already removed', () => {
		const style = addStyle('.monaco-editor { color: green; }')

		dropCostlyEditorFocusRule()
		dropCostlyEditorFocusRule()

		expect(selectorsOf(style)).toHaveLength(1)
	})
})
