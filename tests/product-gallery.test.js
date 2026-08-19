/**
 * product-gallery — thumbnail swapping and the lightbox.
 *
 * Two details here are easy to regress and expensive when they go: the dialog
 * is found by walking *siblings* rather than descending (it sits outside the
 * gallery root), and `srcset` must be cleared on swap or the browser keeps
 * serving the previous image's responsive candidate.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const IMAGES = JSON.stringify([
	{ src: '/a.jpg', alt: 'A' },
	{ src: '/b.jpg', alt: 'B' },
	{ src: '/c.jpg', alt: 'C' },
]);

const GALLERY = `
  <div data-product-gallery data-lightbox-images='${IMAGES}'>
    <img data-product-gallery-main src="/a.jpg" alt="A" srcset="/a-2x.jpg 2x">
    <button data-product-gallery-thumb data-src="/a.jpg" data-alt="A" data-index="0"></button>
    <button data-product-gallery-thumb data-src="/b.jpg" data-alt="B" data-index="1"></button>
    <button data-product-gallery-thumb data-src="/c.jpg" data-alt="C" data-index="2"></button>
  </div>
  <dialog data-lightbox data-active-index="0">
    <img data-lightbox-img>
    <span data-lightbox-counter></span>
  </dialog>`;

const main = (d) => d.querySelector('[data-product-gallery-main]');
const thumb = (d, i) => d.querySelectorAll('[data-product-gallery-thumb]')[i];

describe('product-gallery — thumbnails', () => {
	it('swaps the main image', async () => {
		const { document } = await load('product-gallery', { html: GALLERY });
		ready(document, 'astro:page-load');
		click(thumb(document, 1));
		assert.match(main(document).src, /\/b\.jpg$/);
		assert.equal(main(document).alt, 'B');
	});

	/* Leaving srcset in place lets the browser keep serving the old image's
	 * 2x candidate — the picture appears not to change on retina displays. */
	it('clears srcset so the previous image cannot persist', async () => {
		const { document } = await load('product-gallery', { html: GALLERY });
		ready(document, 'astro:page-load');
		assert.equal(main(document).hasAttribute('srcset'), true);
		click(thumb(document, 1));
		assert.equal(main(document).hasAttribute('srcset'), false);
	});

	it('moves the selected state across thumbnails', async () => {
		const { document } = await load('product-gallery', { html: GALLERY });
		ready(document, 'astro:page-load');
		click(thumb(document, 2));
		assert.equal(thumb(document, 2).classList.contains('is-active'), true);
		assert.equal(thumb(document, 2).getAttribute('aria-selected'), 'true');
		assert.equal(thumb(document, 0).getAttribute('aria-selected'), 'false');
	});

	it('keeps the current image when a thumb carries no src', async () => {
		const { document } = await load('product-gallery', {
			html: GALLERY.replace('data-src="/b.jpg"', ''),
		});
		ready(document, 'astro:page-load');
		click(thumb(document, 1));
		assert.match(main(document).src, /\/a\.jpg$/);
	});
});

describe('product-gallery — resilience', () => {
	it('survives malformed lightbox JSON', async () => {
		const { document } = await load('product-gallery', {
			html: GALLERY.replace(`'${IMAGES}'`, `'not json{'`),
		});
		assert.doesNotThrow(() => ready(document, 'astro:page-load'));
		click(thumb(document, 1));
		assert.match(main(document).src, /\/b\.jpg$/, 'thumbnails still work without a lightbox list');
	});

	it('does nothing without a main image', async () => {
		const { document } = await load('product-gallery', {
			html: '<div data-product-gallery><button data-product-gallery-thumb></button></div>',
		});
		assert.doesNotThrow(() => ready(document, 'astro:page-load'));
	});

	it('tolerates the dialog being absent', async () => {
		const { document } = await load('product-gallery', {
			html: GALLERY.slice(0, GALLERY.indexOf('<dialog')),
		});
		assert.doesNotThrow(() => ready(document, 'astro:page-load'));
		click(thumb(document, 1));
		assert.match(main(document).src, /\/b\.jpg$/);
	});
});

describe('product-gallery — lifecycle', () => {
	/* Re-binding would attach a second click handler to every thumb, so each
	 * click would swap twice. */
	it('binds a gallery once', async () => {
		const { document } = await load('product-gallery', { html: GALLERY });
		ready(document, 'astro:page-load');
		ready(document, 'astro:page-load');
		assert.equal(document.querySelector('[data-product-gallery]').dataset.pgInit, '1');
		click(thumb(document, 1));
		assert.match(main(document).src, /\/b\.jpg$/);
	});

	it('binds a gallery introduced by a view transition', async () => {
		const { document } = await load('product-gallery', { html: '' });
		ready(document, 'astro:page-load');
		document.body.innerHTML = GALLERY;
		ready(document, 'astro:page-load');
		click(thumb(document, 2));
		assert.match(main(document).src, /\/c\.jpg$/);
	});
});
