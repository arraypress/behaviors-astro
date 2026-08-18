/**
 * @module page-behaviors
 *
 * Generic, cross-cutting page-load behaviors that re-run on every Astro
 * view-transition page-load. These aren't tied to any one component — they
 * fire against whatever markup happens to be on the page.
 *
 * Two behaviors are bound here:
 *
 *   1. Count-up animation — any `.count-up` element animates from 0 to its
 *      `data-target` value over 1.4s with an ease-out-cubic curve when it
 *      scrolls into view (IntersectionObserver, 0.3 threshold).
 *
 *   2. Drag-to-scroll — horizontal carousels can be press-held and dragged
 *      with a mouse; touch devices keep their native scroll.
 *
 * DOM contract (data-* attributes this module reads/writes):
 *
 *   Count-up — selector `.count-up`
 *     - `data-target`  (number)  required — the value to count up to.
 *     - `data-suffix`  (string)  optional — appended after the number (e.g. '%', 'k').
 *     - `data-format`  ('comma' | 'plain')  optional — 'comma' uses
 *                       `Number.toLocaleString()` grouping. Default 'plain'.
 *     - `data-counted` ('1')  written by this module to mark an element as
 *                       already animated so re-init is idempotent.
 *
 *   Drag-to-scroll — selectors `.carousel`, `.catalog-rail-track`, `[data-drag-scroll]`
 *     - `[data-drag-scroll-force]`  on/within an interactive child opts that
 *                       child back INTO drag handling (otherwise links/buttons
 *                       inside the track are skipped so clicks still work).
 *     - A non-DOM `__wgDragInit` flag is stamped on the element to guarantee
 *                       each track is only wired once.
 *
 * Lifecycle: registers on Astro's `astro:page-load` (fires on initial load
 * AND after every view transition). The module body runs once because it's
 * bundled; element-level idempotency guards (`data-counted`, `__wgDragInit`)
 * keep re-init safe across transitions.
 */

/** A drag-scroll track carries a one-time init flag we stamp on the element. */
interface DragScrollElement extends HTMLElement {
	__wgDragInit?: boolean;
}

/** Live IntersectionObserver for count-up elements, recreated per page-load. */
let countObserver: IntersectionObserver | null = null;

/**
 * (Re)bind the page behaviors. Safe to call repeatedly — count-up uses a
 * fresh observer + `data-counted` guard, and drag-scroll uses the
 * `__wgDragInit` flag so each track is only wired once.
 */
function initPageBehaviors(): void {
	// Count-up animation
	if (countObserver) countObserver.disconnect();
	countObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((e) => {
				if (!e.isIntersecting) return;
				const el = e.target as HTMLElement;
				if (el.dataset.counted) return;
				el.dataset.counted = '1';
				const target = parseFloat(el.dataset.target || '0');
				const suffix = el.dataset.suffix || '';
				const format = el.dataset.format || 'plain';
				const fmt = (n: number): string => {
					const rounded =
						target >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
					return format === 'comma' ? rounded.toLocaleString() : String(rounded);
				};
				const duration = 1400;
				const start = performance.now();
				const ease = (t: number): number => 1 - Math.pow(1 - t, 3);
				const tick = (now: number): void => {
					const t = Math.min(1, (now - start) / duration);
					el.textContent = fmt(target * ease(t)) + suffix;
					if (t < 1) requestAnimationFrame(tick);
					else el.textContent = fmt(target) + suffix;
				};
				requestAnimationFrame(tick);
				countObserver!.unobserve(el);
			});
		},
		{ threshold: 0.3 }
	);
	document.querySelectorAll<HTMLElement>('.count-up').forEach((el) => {
		if (!el.dataset.counted) countObserver!.observe(el);
	});

	/* Drag-to-scroll on every horizontal carousel.
	 *
	 * Press + hold + drag horizontally on the track. Each
	 * pointermove updates `scrollLeft` by the inverse of the
	 * cursor delta. Skips presses that land on a card, button or
	 * link (those still receive normal clicks). A 6px movement
	 * threshold activates the drag — any tap shorter is treated as
	 * a click. Touch devices already scroll natively; we only
	 * bind for `pointerType === 'mouse'`. */
	document
		.querySelectorAll<DragScrollElement>(
			'.carousel, .catalog-rail-track, [data-drag-scroll]'
		)
		.forEach((track) => {
			if (track.__wgDragInit) return;
			track.__wgDragInit = true;

			const ACTIVATION_PX = 6;
			let startX = 0;
			let startScroll = 0;
			let dragging = false;
			let activated = false;

			track.style.cursor = 'grab';

			track.addEventListener('pointerdown', (e: PointerEvent) => {
				if (e.pointerType !== 'mouse') return;
				const eventTarget = e.target as HTMLElement;
				const isInteractive = eventTarget.closest(
					'a, button, input, select, textarea, [role="button"]'
				);
				if (isInteractive && !eventTarget.closest('[data-drag-scroll-force]'))
					return;
				dragging = true;
				activated = false;
				startX = e.clientX;
				startScroll = track.scrollLeft;
			});

			track.addEventListener('pointermove', (e: PointerEvent) => {
				if (!dragging) return;
				const dx = e.clientX - startX;
				if (!activated) {
					if (Math.abs(dx) < ACTIVATION_PX) return;
					activated = true;
					track.style.cursor = 'grabbing';
					document.body.style.userSelect = 'none';
					/* Suspend scroll-snap during the drag. `mandatory`
					 * snap fights programmatic scrollLeft updates — the
					 * browser keeps yanking back to the nearest snap
					 * point so the drag feels frozen. Turn it off
					 * mid-gesture; restore (with smooth re-snap) on
					 * release via scroll-behavior:smooth on the track. */
					track.style.scrollSnapType = 'none';
					try {
						track.setPointerCapture?.(e.pointerId);
					} catch (_) {}
				}
				track.scrollLeft = startScroll - dx;
			});

			const endDrag = (e?: PointerEvent): void => {
				if (!dragging) return;
				const wasActivated = activated;
				dragging = false;
				activated = false;
				track.style.cursor = 'grab';
				document.body.style.userSelect = '';
				/* Re-enable scroll-snap so the next user gesture (mouse
				 * wheel / arrow buttons / touch) still snaps to items. */
				track.style.scrollSnapType = '';
				if (e && e.pointerId != null) {
					try {
						track.releasePointerCapture?.(e.pointerId);
					} catch (_) {}
				}
				/* Suppress the click that fires right after pointerup
				 * IF we actually scrolled — so a tap-and-release on a
				 * card still navigates, but a drag doesn't. */
				if (wasActivated) {
					const suppressClick = (ev: Event): void => {
						ev.stopPropagation();
						ev.preventDefault();
					};
					track.addEventListener('click', suppressClick, {
						capture: true,
						once: true,
					});
				}
			};
			track.addEventListener('pointerup', endDrag as EventListener);
			track.addEventListener('pointercancel', endDrag as EventListener);
			track.addEventListener('pointerleave', endDrag as EventListener);
		});
}

// Bind on every Astro view-transition page-load (also fires on initial load).
document.addEventListener('astro:page-load', initPageBehaviors);

// The bundled module runs once; if the document is already interactive when
// this executes (no astro:page-load pending), kick off immediately so the
// behaviors are live without waiting for a transition.
if (document.readyState !== 'loading') {
	initPageBehaviors();
}

export {};
