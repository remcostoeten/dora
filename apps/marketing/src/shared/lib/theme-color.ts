/**
 * Resolves a CSS custom property to a concrete color string.
 *
 * Canvas and WebGL color sinks (`ctx.fillStyle`, `THREE.Color`, …) cannot parse
 * `var(--token)` — they silently ignore it and keep whatever color was set
 * before. Anything painting a themed color into a canvas has to resolve the
 * token to a literal first, which is what this does.
 *
 * The browser does the parsing: assigning to `fillStyle` normalises any CSS
 * color it understands (including `oklch()` and `color-mix()`) down to a hex or
 * `rgba()` string, which we read back off the getter.
 *
 * @param token  Custom property name, e.g. `"--color-brand-300"`.
 * @param scope  Element to resolve against, for tokens redefined on a subtree.
 *               Defaults to the document root.
 */
export function readThemeColor(token: string, scope?: Element | null): string {
  const source = scope ?? document.documentElement;
  const declared = getComputedStyle(source).getPropertyValue(token).trim();
  if (!declared) return 'transparent';

  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return declared;

  probe.fillStyle = declared;
  return probe.fillStyle;
}

/**
 * Same as {@link readThemeColor}, but returns sRGB channels so callers can
 * interpolate between two themed colors per-frame.
 */
export function readThemeRgb(
  token: string,
  scope?: Element | null,
): [number, number, number] {
  const resolved = readThemeColor(token, scope);

  const hex = resolved.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rgb = resolved.match(/(\d+(?:\.\d+)?)/g);
  if (rgb && rgb.length >= 3) {
    return [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])];
  }

  return [0, 0, 0];
}
