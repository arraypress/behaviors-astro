/**
 * @module card-actions
 *
 * Global runtime for the heart icon on every product card
 * (`CardActions.astro`), mounted once via `CardActionsScript.astro` in
 * `Layout.astro`. Bundled + type-checked by Astro (processed module), so
 * its body executes exactly once per page session; the View-Transition
 * lifecycle re-runs the per-page `init()` on each navigation.
 *
 * Responsibilities:
 *
 *   1. On page load (and on `astro:after-swap` after view transitions),
 *      reflect the current `localStorage['wg-wishlist']` state by adding
 *      `.is-active` to any `[data-wishlist-toggle]` whose product slug is
 *      in the saved set, and sync the header shortcut badge.
 *
 *   2. Delegate clicks on `[data-wishlist-toggle]` — toggle the slug in
 *      the saved set, update visual state, fire a toast.
 *
 *   3. Track product detail-page views into
 *      `localStorage['wg-recently-viewed']` — pushes the current slug to a
 *      capped FIFO queue. Consumed by `<RecentlyViewed>`.
 *
 * Quick View clicks are handled separately inside QuickViewModal.
 *
 * DOM contract (data-* attributes this module binds):
 *   - `[data-wishlist-toggle]`            — heart button; toggles wishlist
 *   - `[data-product-slug]`               — slug carried on the toggle
 *   - `[data-wishlist-label-add]`         — optional; icon-only toggle's
 *                                           name while not saved
 *   - `[data-wishlist-label-remove]`      — optional; icon-only toggle's
 *                                           name while saved
 *
 * Accessible name (WCAG 2.5.3, label in name): every toggle gets
 * `aria-pressed`. An icon-only toggle is also given an `aria-label` that
 * follows the state ("Add to wishlist" / "Remove from wishlist", or the
 * two `data-wishlist-label-*` values). A toggle with text of its own
 * ("Save" / "Saved") is named by that text, so any `aria-label` on it is
 * removed — a label that replaced the visible words would fail 2.5.3.
 *   - `[data-wishlist-trigger]`           — header shortcut anchor; gains
 *                                           `.has-items` when count > 0
 *   - `[data-wishlist-count]`             — badge child of the trigger;
 *                                           populated with the count
 *
 * Emits a `wg-wishlist-change` CustomEvent on `window` with detail
 * `{ slug, added }` whenever the saved set mutates.
 */

declare global {
	interface Window {
		toast?: (message: string, opts?: { variant?: string }) => void;
	}
}

const KEY_WISHLIST = 'wg-wishlist';
const KEY_VIEWED = 'wg-recently-viewed';
const MAX_VIEWED = 12;
const LABEL_ADD = 'Add to wishlist';
const LABEL_REMOVE = 'Remove from wishlist';

/* ───── LocalStorage helpers ───── */

function readSet(key: string): Set<string> {
	try {
		const raw = localStorage.getItem(key);
		return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
	} catch (_) {
		return new Set<string>();
	}
}

function writeSet(key: string, set: Set<string>): void {
	try {
		localStorage.setItem(key, JSON.stringify(Array.from(set)));
	} catch (_) {
		/* storage unavailable — ignore */
	}
}

function readArray(key: string): string[] {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as string[]) : [];
	} catch (_) {
		return [];
	}
}

function writeArray(key: string, arr: string[]): void {
	try {
		localStorage.setItem(key, JSON.stringify(arr));
	} catch (_) {
		/* storage unavailable — ignore */
	}
}

/* ───── Wishlist visual state ───── */

/**
 * Whether a toggle carries text of its own — any non-blank text not inside an
 * `aria-hidden="true"` or `hidden` element within it. CSS-hidden text (a "Saved" span
 * shown only while active) still counts: the toggle is a text button either
 * way, and the browser names it from whichever span is displayed.
 */
function hasOwnText(node: Node): boolean {
	for (const child of Array.from(node.childNodes)) {
		if (child.nodeType === child.TEXT_NODE) {
			if (child.textContent?.trim()) return true;
		} else if (child.nodeType === child.ELEMENT_NODE) {
			const el = child as Element;
			if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('hidden')) continue;
			if (hasOwnText(el)) return true;
		}
	}
	return false;
}

function syncWishlistState(): void {
	const wishlist = readSet(KEY_WISHLIST);
	document.querySelectorAll<HTMLElement>('[data-wishlist-toggle]').forEach((btn) => {
		const slug = btn.dataset.productSlug;
		const isIn = slug !== undefined && wishlist.has(slug);
		btn.classList.toggle('is-active', isIn);
		btn.setAttribute('aria-pressed', isIn ? 'true' : 'false');
		if (hasOwnText(btn)) {
			btn.removeAttribute('aria-label');
		} else {
			const add = btn.dataset.wishlistLabelAdd || LABEL_ADD;
			const remove = btn.dataset.wishlistLabelRemove || LABEL_REMOVE;
			btn.setAttribute('aria-label', isIn ? remove : add);
		}
	});

	/* Header shortcut badge — the `<a data-wishlist-trigger>` in
	 * HeaderActions carries a `[data-wishlist-count]` child that we toggle
	 * visible + populate with the current count. The trigger itself gets a
	 * `has-items` class for a filled-heart accent so the user can see at a
	 * glance there's something saved. */
	const count = wishlist.size;
	document.querySelectorAll<HTMLElement>('[data-wishlist-trigger]').forEach((trigger) => {
		trigger.classList.toggle('has-items', count > 0);
		const badge = trigger.querySelector<HTMLElement>('[data-wishlist-count]');
		if (!badge) return;
		if (count > 0) {
			badge.textContent = count > 99 ? '99+' : String(count);
			badge.hidden = false;
		} else {
			badge.hidden = true;
		}
	});
}

function toggleWishlist(slug: string): boolean {
	const wishlist = readSet(KEY_WISHLIST);
	const wasIn = wishlist.has(slug);
	if (wasIn) wishlist.delete(slug);
	else wishlist.add(slug);
	writeSet(KEY_WISHLIST, wishlist);
	window.dispatchEvent(new CustomEvent('wg-wishlist-change', { detail: { slug, added: !wasIn } }));
	if (typeof window.toast === 'function') {
		window.toast(wasIn ? 'Removed from wishlist' : 'Added to wishlist', { variant: 'success' });
	}
	return !wasIn;
}

/* ───── Recently viewed tracking ───── */

function trackView(): void {
	/* Only fire on product detail pages — match the same regex the
	 * Pagefind scope helper uses. */
	const m = location.pathname.match(/^\/products\/([^/]+)\/?$/);
	if (!m) return;
	const slug = m[1];
	let viewed = readArray(KEY_VIEWED).filter((s) => s !== slug);
	viewed.unshift(slug);
	if (viewed.length > MAX_VIEWED) viewed = viewed.slice(0, MAX_VIEWED);
	writeArray(KEY_VIEWED, viewed);
}

/* ───── Delegated click ───── */

document.addEventListener('click', (e) => {
	const target = e.target as HTMLElement | null;
	const heart = target?.closest<HTMLElement>('[data-wishlist-toggle]');
	if (!heart) return;
	/* Prevent the parent <a> from navigating when the heart is inside the
	 * card link. */
	e.preventDefault();
	e.stopPropagation();
	const slug = heart.dataset.productSlug;
	if (slug !== undefined) toggleWishlist(slug);
	syncWishlistState();
});

/* ───── Per-page init + View-Transition lifecycle ───── */

function init(): void {
	syncWishlistState();
	trackView();
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('astro:after-swap', init);
if (document.readyState !== 'loading') init();

export {};
