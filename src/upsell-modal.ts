/**
 * @module upsell-modal
 *
 * Runtime for the one-step upsell prompt (`<UpsellModal>`). When a product
 * page's Buy button carries `data-upsell-trigger`, a capture-phase click
 * handler intercepts the click and opens the `<dialog id="wg-upsell-modal">`
 * as a true modal (focus-trapped, with backdrop) instead of following the
 * link. Accept / decline buttons inside the dialog navigate to one of two
 * URLs baked onto the dialog as data-attributes.
 *
 * DOM contract:
 *   [data-upsell-trigger]            — the Buy button; clicking it (capture
 *                                      phase) opens the dialog and preventsdefault
 *   #wg-upsell-modal                 — the native <dialog> element
 *     data-upsell-target-url=URL     — buyUrl for the upsell ("upgrade") path
 *     data-upsell-original-url=URL   — buyUrl for the original ("continue") path
 *   [data-upsell-accept]   (in dialog) — navigates to the target URL
 *   [data-upsell-decline]  (in dialog) — navigates to the original URL
 *
 * Both handlers are bound at the `document` level via event delegation, so a
 * single binding survives Astro View Transitions (the listeners are not torn
 * down on swap). The module body executes exactly once because it is bundled,
 * so no global `window.__wgXxxBound` flag is needed; a dataset idempotency
 * guard on `document.documentElement` keeps re-init safe regardless.
 */

/**
 * Bind the capture-phase trigger handler and the accept/decline handler at
 * the document level. Idempotent: a dataset flag prevents double-binding if
 * `init()` is ever invoked more than once.
 */
function init(): void {
	const root = document.documentElement;
	if (root.dataset.wgUpsellBound === 'true') return;
	root.dataset.wgUpsellBound = 'true';

	// Capture-phase trigger: opening the dialog must happen before the
	// Buy link's own navigation, so we listen in the capture phase and
	// preventDefault when a [data-upsell-trigger] is clicked.
	document.addEventListener(
		'click',
		(e: MouseEvent) => {
			const target = e.target as Element | null;
			const trigger = target?.closest?.('[data-upsell-trigger]');
			if (!trigger) return;
			const dialog = document.getElementById('wg-upsell-modal') as HTMLDialogElement | null;
			if (!dialog) return;
			e.preventDefault();
			// Always open as a true modal so focus is trapped and the
			// backdrop renders (WCAG 2.1.1 / 2.4.3). The non-modal
			// `open` attribute fallback left focus loose behind the
			// dialog, so it has been removed.
			dialog.showModal();
		},
		true,
	);

	// Bubble-phase accept/decline: navigate to the matching buyUrl.
	document.addEventListener('click', (e: MouseEvent) => {
		const dialog = document.getElementById('wg-upsell-modal') as HTMLDialogElement | null;
		if (!dialog) return;
		const target = e.target as Element | null;
		const accept = target?.closest?.('[data-upsell-accept]');
		const decline = target?.closest?.('[data-upsell-decline]');
		if (accept) {
			const url = dialog.getAttribute('data-upsell-target-url');
			if (url) window.location.href = url;
		} else if (decline) {
			const url = dialog.getAttribute('data-upsell-original-url');
			if (url) window.location.href = url;
		}
	});
}

// The original bound globally (document-level delegation) and relied on the
// listeners surviving View Transitions — there was no per-page re-init. We
// preserve that: bind once at module load. The dataset guard above keeps a
// second call (if ever added) safe.
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}

export {};
