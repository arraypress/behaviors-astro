/**
 * @module reduced-motion
 *
 * Whether the visitor has asked for less motion. Shared by count-up (which
 * then shows its final value at once) and drag-scroll (which then jumps rather
 * than gliding). Read at the moment it is needed, so a change to the setting
 * applies without a reload.
 */

/**
 * Whether `prefers-reduced-motion: reduce` matches. False where `matchMedia`
 * is missing (old browsers, server rendering, test DOMs).
 *
 * @returns True when motion should be kept to a minimum.
 */
export function prefersReducedMotion(): boolean {
	return (
		typeof matchMedia === 'function' &&
		matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}
