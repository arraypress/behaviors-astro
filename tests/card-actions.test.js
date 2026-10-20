/**
 * card-actions — wishlist toggling, the header badge, and recently-viewed.
 *
 * The storage keys are the contract that matters most here: they are `wg-`
 * prefixed and shared by every theme these modules came from, so a rename
 * would orphan real wishlists. These tests pin them deliberately.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const CARD = (slug) => `<button data-wishlist-toggle data-product-slug="${slug}"></button>`;
const HEADER = `
  <a data-wishlist-trigger><span data-wishlist-count hidden></span></a>`;

describe('card-actions — wishlist toggle', () => {
	it('adds a slug on first click and persists it', async () => {
		const { document, window } = await load('card-actions', { html: CARD('pads-vol-2') });
		ready(document);
		click(document.querySelector('[data-wishlist-toggle]'));
		assert.deepEqual(JSON.parse(window.localStorage.getItem('wg-wishlist')), ['pads-vol-2']);
	});

	it('removes it on second click', async () => {
		const { document, window } = await load('card-actions', { html: CARD('a') });
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		click(btn);
		click(btn);
		assert.deepEqual(JSON.parse(window.localStorage.getItem('wg-wishlist')), []);
	});

	it('reflects saved state on load, before any click', async () => {
		const { document } = await load('card-actions', {
			html: CARD('saved'),
			storage: { 'wg-wishlist': JSON.stringify(['saved']) },
		});
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		assert.equal(btn.classList.contains('is-active'), true);
		assert.equal(btn.getAttribute('aria-pressed'), 'true');
		assert.equal(btn.getAttribute('aria-label'), 'Remove from wishlist');
	});

	/* The heart usually sits inside the card's <a>, so an uncancelled click
	 * would navigate away instead of toggling. The module's handler is bound
	 * to `document`, so it runs after the anchor's own listeners — but the
	 * default action is resolved only once propagation finishes, so cancelling
	 * there still suppresses the navigation. Assert on the event afterwards,
	 * which is what the browser actually consults. */
	it('cancels the click so the surrounding link does not navigate', async () => {
		const { document } = await load('card-actions', {
			html: `<a href="/products/x">${CARD('x')}</a>`,
		});
		ready(document);
		const ev = new globalThis.MouseEvent('click', { bubbles: true, cancelable: true });
		document.querySelector('[data-wishlist-toggle]').dispatchEvent(ev);
		assert.equal(ev.defaultPrevented, true, 'navigation must be suppressed');
	});

	it('ignores a toggle with no slug rather than storing undefined', async () => {
		const { document, window } = await load('card-actions', {
			html: '<button data-wishlist-toggle></button>',
		});
		ready(document);
		click(document.querySelector('[data-wishlist-toggle]'));
		const raw = window.localStorage.getItem('wg-wishlist');
		assert.ok(raw === null || JSON.parse(raw).length === 0);
	});
});

/* WCAG 2.5.3 (label in name): a control's accessible name must contain its
 * visible text. An aria-label overrides the text, so a "Save" button labelled
 * "Add to wishlist" fails (axe `label-content-name-mismatch`). Icon-only
 * toggles have no visible text and keep a state-following aria-label. */
const TEXT_TOGGLE = (slug) => `
  <button data-wishlist-toggle data-product-slug="${slug}" aria-label="Add to wishlist">
    <svg aria-hidden="true"><path d="M0 0"/></svg>
    <span class="add">Save</span>
    <span class="remove">Saved</span>
  </button>`;

describe('card-actions — accessible name', () => {
	it('names an icon-only toggle by its state, as before', async () => {
		const { document } = await load('card-actions', { html: CARD('a') });
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		assert.equal(btn.getAttribute('aria-label'), 'Add to wishlist');
		click(btn);
		assert.equal(btn.getAttribute('aria-label'), 'Remove from wishlist');
		assert.equal(btn.getAttribute('aria-pressed'), 'true');
	});

	it('takes an icon-only toggle\'s labels from data-wishlist-label-*', async () => {
		const { document } = await load('card-actions', {
			html: '<button data-wishlist-toggle data-product-slug="a" data-wishlist-label-add="Merken" data-wishlist-label-remove="Nicht mehr merken"></button>',
		});
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		assert.equal(btn.getAttribute('aria-label'), 'Merken');
		click(btn);
		assert.equal(btn.getAttribute('aria-label'), 'Nicht mehr merken');
	});

	it('falls back to the default for an empty label attribute', async () => {
		const { document } = await load('card-actions', {
			html: '<button data-wishlist-toggle data-product-slug="a" data-wishlist-label-add=""></button>',
		});
		ready(document);
		assert.equal(document.querySelector('[data-wishlist-toggle]').getAttribute('aria-label'), 'Add to wishlist');
	});

	it('removes aria-label from a toggle with visible text, so the text names it', async () => {
		const { document } = await load('card-actions', { html: TEXT_TOGGLE('a') });
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		assert.equal(btn.hasAttribute('aria-label'), false);
		assert.equal(btn.getAttribute('aria-pressed'), 'false');
	});

	it('never writes an aria-label onto a text toggle as its state changes', async () => {
		const { document } = await load('card-actions', {
			html: TEXT_TOGGLE('a'),
			storage: { 'wg-wishlist': JSON.stringify(['a']) },
		});
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		assert.equal(btn.getAttribute('aria-pressed'), 'true');
		assert.equal(btn.hasAttribute('aria-label'), false);
		click(btn);
		assert.equal(btn.getAttribute('aria-pressed'), 'false');
		assert.equal(btn.hasAttribute('aria-label'), false);
	});

	it('ignores configured labels on a text toggle', async () => {
		const { document } = await load('card-actions', {
			html: '<button data-wishlist-toggle data-product-slug="a" data-wishlist-label-add="Add">Save</button>',
		});
		ready(document);
		assert.equal(document.querySelector('[data-wishlist-toggle]').hasAttribute('aria-label'), false);
	});

	/* Text the user can't see doesn't make a visible label: an aria-hidden
	 * glyph or a `hidden` span leaves the toggle icon-only. */
	it('treats aria-hidden and hidden text as no text', async () => {
		const { document } = await load('card-actions', {
			html: '<button data-wishlist-toggle data-product-slug="a"><span aria-hidden="true">♥</span><span hidden>Saved</span>  </button>',
		});
		ready(document);
		assert.equal(document.querySelector('[data-wishlist-toggle]').getAttribute('aria-label'), 'Add to wishlist');
	});

	/* The toggle can sit inside an aria-hidden region (a closed modal). That
	 * hides the whole control, not its text, so it is still a text toggle. */
	it('looks for hiding only inside the toggle itself', async () => {
		const { document } = await load('card-actions', {
			html: `<div aria-hidden="true">${TEXT_TOGGLE('a')}</div>`,
		});
		ready(document);
		assert.equal(document.querySelector('[data-wishlist-toggle]').hasAttribute('aria-label'), false);
	});
});

describe('card-actions — header badge', () => {
	it('shows the count and marks the trigger when items are saved', async () => {
		const { document } = await load('card-actions', {
			html: HEADER + CARD('a'),
			storage: { 'wg-wishlist': JSON.stringify(['a', 'b', 'c']) },
		});
		ready(document);
		const trigger = document.querySelector('[data-wishlist-trigger]');
		const badge = document.querySelector('[data-wishlist-count]');
		assert.equal(trigger.classList.contains('has-items'), true);
		assert.equal(badge.hidden, false);
		assert.equal(badge.textContent, '3');
	});

	it('hides the badge when the wishlist empties', async () => {
		const { document } = await load('card-actions', {
			html: HEADER + CARD('only'),
			storage: { 'wg-wishlist': JSON.stringify(['only']) },
		});
		ready(document);
		click(document.querySelector('[data-wishlist-toggle]'));
		const badge = document.querySelector('[data-wishlist-count]');
		assert.equal(badge.hidden, true);
		assert.equal(document.querySelector('[data-wishlist-trigger]').classList.contains('has-items'), false);
	});

	it('caps the badge at 99+', async () => {
		const many = Array.from({ length: 150 }, (_, i) => `p${i}`);
		const { document } = await load('card-actions', {
			html: HEADER,
			storage: { 'wg-wishlist': JSON.stringify(many) },
		});
		ready(document);
		assert.equal(document.querySelector('[data-wishlist-count]').textContent, '99+');
	});
});

describe('card-actions — notifications', () => {
	it('announces both directions through window.toast', async () => {
		const { document, toasts } = await load('card-actions', { html: CARD('a') });
		ready(document);
		const btn = document.querySelector('[data-wishlist-toggle]');
		click(btn);
		click(btn);
		assert.deepEqual(toasts.map((t) => t.message), ['Added to wishlist', 'Removed from wishlist']);
	});

	it('emits wg-wishlist-change with the slug and direction', async () => {
		const { document, window } = await load('card-actions', { html: CARD('pads') });
		ready(document);
		const seen = [];
		window.addEventListener('wg-wishlist-change', (e) => seen.push(e.detail));
		const btn = document.querySelector('[data-wishlist-toggle]');
		click(btn);
		click(btn);
		assert.deepEqual(seen, [
			{ slug: 'pads', added: true },
			{ slug: 'pads', added: false },
		]);
	});

	/* toast-astro is a soft dependency — the wishlist must still work without it. */
	it('works when window.toast is absent', async () => {
		const { document, window } = await load('card-actions', { html: CARD('a') });
		delete window.toast;
		ready(document);
		click(document.querySelector('[data-wishlist-toggle]'));
		assert.deepEqual(JSON.parse(window.localStorage.getItem('wg-wishlist')), ['a']);
	});
});

describe('card-actions — recently viewed', () => {
	it('records a view on a product page', async () => {
		const { document, window } = await load('card-actions', {
			url: 'https://example.com/products/lush-pads',
		});
		ready(document);
		assert.deepEqual(JSON.parse(window.localStorage.getItem('wg-recently-viewed')), ['lush-pads']);
	});

	it('records nothing off a product page', async () => {
		const { document, window } = await load('card-actions', { url: 'https://example.com/blog/post' });
		ready(document);
		assert.equal(window.localStorage.getItem('wg-recently-viewed'), null);
	});

	it('moves a revisited product to the front without duplicating it', async () => {
		const { document, window } = await load('card-actions', {
			url: 'https://example.com/products/b',
			storage: { 'wg-recently-viewed': JSON.stringify(['a', 'b', 'c']) },
		});
		ready(document);
		assert.deepEqual(JSON.parse(window.localStorage.getItem('wg-recently-viewed')), ['b', 'a', 'c']);
	});

	it('caps the queue at 12', async () => {
		const twelve = Array.from({ length: 12 }, (_, i) => `p${i}`);
		const { document, window } = await load('card-actions', {
			url: 'https://example.com/products/newest',
			storage: { 'wg-recently-viewed': JSON.stringify(twelve) },
		});
		ready(document);
		const got = JSON.parse(window.localStorage.getItem('wg-recently-viewed'));
		assert.equal(got.length, 12);
		assert.equal(got[0], 'newest');
		assert.equal(got.includes('p11'), false, 'the oldest entry should drop off');
	});
});

describe('card-actions — resilience', () => {
	/* Safari in private mode throws on localStorage access. The module wraps
	 * every read and write for exactly this reason, and a throw here would
	 * take out the whole page script. */
	it('survives localStorage throwing', async () => {
		const { document, window } = await load('card-actions', { html: CARD('a') });
		window.localStorage.getItem = () => { throw new Error('denied'); };
		window.localStorage.setItem = () => { throw new Error('denied'); };
		assert.doesNotThrow(() => {
			ready(document);
			click(document.querySelector('[data-wishlist-toggle]'));
		});
	});

	it('ignores corrupt JSON in storage', async () => {
		const { document } = await load('card-actions', {
			html: CARD('a'),
			storage: { 'wg-wishlist': 'not json{' },
		});
		assert.doesNotThrow(() => ready(document));
		assert.equal(document.querySelector('[data-wishlist-toggle]').classList.contains('is-active'), false);
	});

	/* View transitions swap the DOM and re-run init; new cards must pick up
	 * the saved state without a reload. */
	it('re-syncs after a view transition', async () => {
		const { document } = await load('card-actions', {
			html: CARD('a'),
			storage: { 'wg-wishlist': JSON.stringify(['b']) },
		});
		ready(document);
		document.body.innerHTML = CARD('b');
		ready(document, 'astro:after-swap');
		assert.equal(document.querySelector('[data-wishlist-toggle]').classList.contains('is-active'), true);
	});
});
