/**
 * @module product-gallery
 *
 * Client behaviour for `<ProductGallery>` on the product detail page:
 * thumbnail swap + a native-`<dialog>` lightbox.
 *
 * Two behaviours, both bound per-gallery:
 *
 *   1. Thumbnail swap — clicking a `[data-product-gallery-thumb]` swaps the
 *      main image's `src` / `alt` (and drops its responsive `srcset` so the
 *      new src wins), then moves the active tab state across the thumbs.
 *
 *   2. Lightbox — clicking the main image opens the gallery's own
 *      `<dialog data-lightbox>`; arrow keys + prev/next buttons cycle, the
 *      close button / backdrop click / Esc close it. The active index lives
 *      on the dialog's `data-active-index` so multiple galleries on one page
 *      each manage their own state.
 *
 * DOM contract (set by ProductGallery.astro):
 *   [data-product-gallery]               root; carries `data-lightbox-images`
 *                                        (JSON `[{src, alt}]`) and a runtime
 *                                        `data-pg-init` idempotency flag.
 *   [data-product-gallery-main]          the swappable main <img>.
 *   [data-product-gallery-thumb]         thumb <button>s; carry `data-src`,
 *                                        `data-alt`, `data-index`.
 *   [data-lightbox]                      the gallery's <dialog>, found by
 *                                        walking forward from the root's
 *                                        next siblings; carries
 *                                        `data-active-index`.
 *   [data-lightbox-img]                  the <img> shown inside the dialog.
 *   [data-lightbox-counter]              "n / total" live region.
 *   [data-lightbox-prev] / -next         nav <button>s.
 *   [data-lightbox-close]                close <button>.
 *
 * Lifecycle: re-binds on Astro's `astro:page-load` (so it survives View
 * Transitions) and also runs once immediately on first load — guarded on
 * `document.readyState` to handle being imported before/after DOMContentLoaded.
 * Per-element `data-pg-init` keeps re-init idempotent.
 *
 * Side-effecting init module — exports nothing.
 */

interface LightboxImage {
	src: string;
	alt?: string;
}

/** Bind both behaviours to a single gallery root (idempotent). */
function bind(gallery: HTMLElement): void {
	if (gallery.dataset.pgInit) return;
	gallery.dataset.pgInit = '1';

	const mainImg = gallery.querySelector<HTMLImageElement>('[data-product-gallery-main]');
	const thumbs = gallery.querySelectorAll<HTMLButtonElement>('[data-product-gallery-thumb]');
	if (!mainImg) return;

	/* Parse the JSON image list once. The dialog lives right after the
	   gallery in the DOM but isn't a child, so we walk to the next sibling
	   that carries `[data-lightbox]`. */
	let images: LightboxImage[] = [];
	try {
		images = JSON.parse(gallery.getAttribute('data-lightbox-images') || '[]');
	} catch (_) {
		images = [];
	}

	let dialog = gallery.nextElementSibling as HTMLElement | null;
	while (dialog && !dialog.matches('[data-lightbox]')) {
		dialog = dialog.nextElementSibling as HTMLElement | null;
	}

	const setActive = (i: number): void => {
		if (!thumbs.length) return;
		thumbs.forEach(t => {
			const isMe = Number(t.dataset.index) === i;
			t.classList.toggle('is-active', isMe);
			t.setAttribute('aria-selected', isMe ? 'true' : 'false');
		});
	};

	thumbs.forEach(thumb => {
		thumb.addEventListener('click', () => {
			mainImg.src = thumb.dataset.src || mainImg.src;
			mainImg.alt = thumb.dataset.alt || mainImg.alt;
			mainImg.removeAttribute('srcset');
			setActive(Number(thumb.dataset.index) || 0);
		});
	});

	if (!dialog || images.length === 0) return;

	const lbImg = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]');
	const counter = dialog.querySelector<HTMLElement>('[data-lightbox-counter]');
	const btnPrev = dialog.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
	const btnNext = dialog.querySelector<HTMLButtonElement>('[data-lightbox-next]');
	const btnClose = dialog.querySelector<HTMLButtonElement>('[data-lightbox-close]');

	const lbDialog = dialog as HTMLDialogElement;

	const render = (i: number): void => {
		if (i < 0) i = images.length - 1;
		if (i >= images.length) i = 0;
		lbDialog.dataset.activeIndex = String(i);
		const entry = images[i] || images[0];
		if (lbImg && entry) {
			lbImg.src = entry.src;
			lbImg.alt = entry.alt || '';
		}
		if (counter) counter.textContent = i + 1 + ' / ' + images.length;
	};

	const open = (startIndex?: number): void => {
		render(typeof startIndex === 'number' ? startIndex : 0);
		if (typeof lbDialog.showModal === 'function') lbDialog.showModal();
		else lbDialog.setAttribute('open', '');
		document.body.classList.add('product-lightbox-open');
	};
	const close = (): void => {
		if (typeof lbDialog.close === 'function') lbDialog.close();
		else lbDialog.removeAttribute('open');
		document.body.classList.remove('product-lightbox-open');
	};
	const step = (dir: number): void => {
		const i = Number(lbDialog.dataset.activeIndex || 0);
		render(i + dir);
	};

	mainImg.addEventListener('click', () => {
		/* Find which image is currently shown in the main slot so the
		   lightbox opens on the same one — fall back to 0. */
		const current = mainImg.getAttribute('src') || '';
		const idx = images.findIndex(im => im.src === current);
		open(idx >= 0 ? idx : 0);
	});

	if (btnPrev) btnPrev.addEventListener('click', e => { e.stopPropagation(); step(-1); });
	if (btnNext) btnNext.addEventListener('click', e => { e.stopPropagation(); step(1); });
	if (btnClose) btnClose.addEventListener('click', close);

	/* Backdrop click — native <dialog> reports clicks on the dialog itself
	   when the user clicks outside the inner content. Bail if the click
	   landed on the image or any of the chrome. */
	lbDialog.addEventListener('click', e => {
		if (e.target === lbDialog) close();
	});
	lbDialog.addEventListener('cancel', () => {
		document.body.classList.remove('product-lightbox-open');
	});
	lbDialog.addEventListener('close', () => {
		document.body.classList.remove('product-lightbox-open');
	});
	lbDialog.addEventListener('keydown', e => {
		if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
		else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
	});
}

/** Bind every gallery currently in the DOM. */
function init(): void {
	document.querySelectorAll<HTMLElement>('[data-product-gallery]').forEach(bind);
}

document.addEventListener('astro:page-load', init);
if (document.readyState !== 'loading') init();
else document.addEventListener('DOMContentLoaded', init);

export {};
