import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * @name cn
 * @description Joins class names and resolves conflicting Tailwind utilities,
 * keeping the last one.
 *
 * @example
 * cn("px-4", active && "bg-foreground/6", "px-5") // "bg-foreground/6 px-5"
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}
