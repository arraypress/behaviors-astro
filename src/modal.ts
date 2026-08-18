/**
 * @module modal
 *
 * Generic dialog open/close wiring for `<Modal>` (native `<dialog>`).
 *
 * Binds a SINGLE delegated `click` listener on `document` that handles every
 * modal on the page — so triggers added later (e.g. via View Transitions, or
 * MDX-rendered content) just work without re-binding. The native `<dialog>`
 * element provides the focus trap, `::backdrop`, ESC-to-close and ARIA wiring;
 * this module only toggles open state.
 *
 * DOM contract (data-* attributes):
 *   - `[data-modal-open="<id>"]`  — any element; click opens the dialog `#<id>`.
 *   - `a[href^="#<id>"]`          — hash link whose target is a `<dialog>` opens it.
 *   - `[data-modal-close]`        — element inside a dialog; click closes its dialog.
 *   - `[data-wg-modal]`           — marks a `<dialog>` as a modal; a click landing
 *                                   directly on the element (the backdrop) closes it.
 *
 * Side-effecting init module — imported for effect, exports nothing. Because it
 * is bundled it executes exactly once, so the legacy `window.__wgModalBound`
 * guard is dropped; the delegated listener is registered a single time and an
 * element-level dataset guard keeps re-init idempotent.
 */

/** Open the dialog with the given id, if it exists and is closed. */
function open(id: string | null): void {
	if (!id) return;
	const d = document.getElementById(id) as HTMLDialogElement | null;
	if (d && typeof d.showModal === 'function' && !d.open) d.showModal();
}

/** Close a dialog if it is currently open. */
function close(d: HTMLDialogElement | null): void {
	if (d && d.open) d.close();
}

/**
 * Register the delegated click handler once. Guarded by a dataset flag on
 * `document.documentElement` so repeated calls across the View-Transition
 * lifecycle never stack listeners.
 */
function init(): void {
	const root = document.documentElement;
	if (root.dataset.wgModalBound) return;
	root.dataset.wgModalBound = 'true';

	document.addEventListener('click', (e: MouseEvent) => {
		const target = e.target as Element | null;
		if (!target || !target.closest) return;

		// Open via data attribute or hash link.
		const opener = target.closest<HTMLElement>('[data-modal-open]');
		if (opener) {
			e.preventDefault();
			open(opener.getAttribute('data-modal-open'));
			return;
		}
		const hashLink = target.closest<HTMLAnchorElement>('a[href^="#"]');
		if (hashLink) {
			const hash = hashLink.getAttribute('href')!.slice(1);
			if (hash && document.getElementById(hash)?.tagName === 'DIALOG') {
				e.preventDefault();
				open(hash);
				return;
			}
		}

		// Close via close button or backdrop.
		const closer = target.closest<HTMLElement>('[data-modal-close]');
		if (closer) {
			close(closer.closest('dialog'));
			return;
		}
		if (target.tagName === 'DIALOG' && target.matches('[data-wg-modal]')) {
			close(target as HTMLDialogElement);
		}
	});
}

// Re-bind on Astro's View-Transition navigation, and run once on first load.
document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') {
	init();
} else {
	document.addEventListener('DOMContentLoaded', init);
}

export {};
