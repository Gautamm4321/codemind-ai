// Inline-style helpers that follow the theme tokens in app/globals.css.
// Use these instead of hardcoded rgba() values so changing --color-navy re-themes everything.

/** The ink color (--color-navy) at a given strength, 0..1 */
export const ink = (alpha = 1): string =>
  alpha >= 1 ? "var(--color-navy)" : `color-mix(in srgb, var(--color-navy) ${Math.round(alpha * 100)}%, transparent)`;
