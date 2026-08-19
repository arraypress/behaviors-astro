/**
 * page-behaviors — count-up on scroll, and drag-to-scroll carousels.
 *
 * jsdom has no IntersectionObserver and never scrolls, so the harness supplies
 * a stub whose `trigger()` stands in for "this element came into view". The
 * animation itself runs on real requestAnimationFrame, so the tests wait for it
 * to settle rather than asserting mid-flight.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready } from './harness.js';

/** Let the 1.4s animation finish. */
const settle = () => new Promise((r) => setTimeout(r, 1700));

/** The observer the module created for count-up elements. */
const observer = (window) => window.__observers.at(-1);

describe('page-behaviors — count-up', () => {
	it('does not run before the element is in view', async () => {
		const { document } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		assert.equal(document.querySelector('.count-up').textContent, '0');
	});

	it('counts to the target once it comes into view', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '50');
	});

	it('appends a suffix', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="99" data-suffix="%">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '99%');
	});

	it('formats large numbers with separators when asked', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="12500" data-format="comma">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, (12500).toLocaleString());
	});

	/* Under 100 the module keeps one decimal, so a rating reads 4.8 not 5. */
	it('keeps one decimal below 100', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="4.8">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '4.8');
	});

	it('ignores an element leaving the viewport', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el, false);
		await new Promise((r) => setTimeout(r, 50));
		assert.equal(el.textContent, '0');
	});

	/* The `counted` flag is what stops a second view transition replaying every
	 * number on the page. */
	it('runs once and marks the element', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.dataset.counted, '1');

		el.textContent = 'untouched';
		observer(window).trigger(el);
		await new Promise((r) => setTimeout(r, 50));
		assert.equal(el.textContent, 'untouched', 'a second intersection must not restart it');
	});

	it('treats a missing target as zero rather than NaN', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up">x</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '0');
	});
});

describe('page-behaviors — lifecycle', () => {
	/* Each page-load rebuilds the observer; the old one is disconnected so
	 * elements from the previous page stop being watched. */
	it('replaces the observer on each page load', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="10">0</span>',
		});
		ready(document, 'astro:page-load');
		const first = observer(window);
		ready(document, 'astro:page-load');
		const second = observer(window);
		assert.notEqual(first, second, 'a fresh observer per navigation');
		assert.equal(first.elements.size, 0, 'the previous one is disconnected');
	});

	it('picks up elements added by a view transition', async () => {
		const { document, window } = await load('page-behaviors', { html: '' });
		ready(document, 'astro:page-load');
		document.body.innerHTML = '<span class="count-up" data-target="7">0</span>';
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '7');
	});
});
