/**
 * @module brand-colors
 *
 * Copy-hex-to-clipboard behaviour for the `<BrandColors>` swatch grid
 * (src/components/inline/BrandColors.astro).
 *
 * DOM contract — a single delegated click listener is bound to the
 * document; any click that lands inside an element carrying:
 *
 *   data-brand-color-copy="#00FFC2"   (a swatch card <button>)
 *
 * copies that hex value to the clipboard via the async Clipboard API and
 * surfaces feedback through the global `window.toast()` helper
 * (`@arraypress/toast-astro`):
 *
 *   - success → `Copied #00FFC2`
 *   - failure (clipboard blocked) → an error toast
 *
 * Delegation means it works for any number of cards, present at load or
 * injected later, with no per-card binding.
 *
 * This is a side-effecting init module: importing it once (Astro bundles
 * + type-checks the processed `<script>`) wires the listener. The module
 * body executes exactly once for the lifetime of the page session, so the
 * original `window.__wgBrandColorsBound` re-entry guard is unnecessary and
 * has been dropped — a delegated document listener bound once survives
 * Astro View-Transition swaps without re-binding.
 */

declare global {
	interface Window {
		toast?: (
			message: string,
			options?: { variant?: 'success' | 'error' | string },
		) => void;
	}
}

/**
 * Bind the delegated copy-on-click listener to the document. Idempotent at
 * the module level (the bundled body runs once), so this is registered a
 * single time at import.
 */
function init(): void {
	document.addEventListener('click', (e: MouseEvent) => {
		const target = e.target as HTMLElement | null;
		const card = target?.closest<HTMLElement>('[data-brand-color-copy]');
		if (!card) return;

		const value = card.dataset.brandColorCopy;
		if (!value) return;

		void (async () => {
			try {
				await navigator.clipboard.writeText(value);
				window.toast?.(`Copied ${value}`, { variant: 'success' });
			} catch (_) {
				window.toast?.(
					'Copy failed — your browser blocked clipboard access.',
					{ variant: 'error' },
				);
			}
		})();
	});
}

init();

export {};
