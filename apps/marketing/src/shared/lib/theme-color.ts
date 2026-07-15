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
 *
 * Reads the channels back from an actual rendered pixel rather than parsing
 * the `fillStyle` getter's string: some browsers return wide-gamut colors
 * (e.g. `oklch(...)`) from that getter unconverted, and naively regexing the
 * numbers out of it misreads lightness/chroma/hue as red/green/blue.
 */
export function readThemeRgb(
  token: string,
  scope?: Element | null,
): [number, number, number] {
  const resolved = readThemeColor(token, scope);

  const probe = document.createElement('canvas');
  probe.width = 1;
  probe.height = 1;
  const ctx = probe.getContext('2d');
  if (!ctx) return [0, 0, 0];

  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
