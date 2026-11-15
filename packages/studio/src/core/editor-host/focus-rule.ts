import { noop } from '@studio/shared/utils/noop'

// Monaco's locked-hover pointer rule: `.workbench-hover-container:not(:focus-within).locked ...`
const COSTLY_FOCUS_RULE = /\.workbench-hover-container:not\(:focus-within\)/

function dropMatchingRules(owner: CSSStyleSheet | CSSGroupingRule): void {
	for (let index = owner.cssRules.length - 1; index >= 0; index -= 1) {
		const rule = owner.cssRules[index]
		if (rule instanceof CSSStyleRule) {
			if (COSTLY_FOCUS_RULE.test(rule.selectorText)) owner.deleteRule(index)
		} else if (rule instanceof CSSGroupingRule) {
			dropMatchingRules(rule)
		}
	}
}

/**
 * @name dropCostlyEditorFocusRule
 * @description Deletes the one Monaco stylesheet rule that negates
 * `:focus-within` on an ancestor. WebKit cannot key that rule by class, so
 * while it is loaded every focus() and blur() anywhere in the app walks the
 * subtree of each ancestor of the focused element (5 to 9 ms on a large view).
 * The rule only tints the pointer of a locked editor hover. Safe to call again.
 *
 * @example
 * dropCostlyEditorFocusRule()
 */
export function dropCostlyEditorFocusRule(): void {
	if (typeof document === 'undefined') return
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			dropMatchingRules(sheet)
		} catch {
			// Reading the rules of a cross-origin stylesheet throws.
			noop()
		}
	}
}
