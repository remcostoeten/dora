/**
 * Explicit do-nothing. Use in a `catch` when the failure is genuinely
 * ignorable, so an empty block never reads as an oversight.
 */
export function noop(): void {}
