type TClassValue = string | number | false | null | undefined

/**
 * Join class names, dropping falsy values. Lightweight stand-in for clsx —
 * marketing doesn't pull in clsx/tailwind-merge, and the components here don't
 * rely on Tailwind conflict resolution.
 */
export function cn(...inputs: TClassValue[]): string {
	return inputs.filter(Boolean).join(' ')
}
