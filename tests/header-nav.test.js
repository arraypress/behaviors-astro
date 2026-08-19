/**
 * header-nav — dropdown open/close for the primary nav.
 *
 * The accessibility contract is the point of these tests: `aria-expanded` on
 * the trigger and `data-open` on the panel are what screen readers and the CSS
 * both key on, so they have to move together.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const NAV = (n = 1) => `
  <nav data-header-nav>
    ${Array.from({ length: n }, (_, i) => `
      <div data-nav-dropdown>
        <a data-dropdown-trigger aria-expanded="false" aria-controls="panel${i}">Menu ${i}</a>
        <div id="panel${i}" data-dropdown-panel data-open="false"></div>
      </div>`).join('')}
  </nav>
  <main>elsewhere</main>`;

const trigger = (document, i = 0) => document.querySelectorAll('[data-dropdown-trigger]')[i];
const panel = (document, i = 0) => document.getElementById(`panel${i}`);

describe('header-nav — opening', () => {
	it('opens on click and marks both trigger and panel', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		click(trigger(document));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'true');
		assert.equal(panel(document).dataset.open, 'true');
	});

	it('closes again on a second click', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		click(trigger(document));
		click(trigger(document));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'false');
		assert.equal(panel(document).dataset.open, 'false');
	});

	it('opens on hover', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		document.querySelector('[data-nav-dropdown]')
			.dispatchEvent(new globalThis.Event('mouseenter'));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'true');
	});

	/* Two panels open at once would overlap and trap focus ambiguously. */
	it('only ever has one dropdown open', async () => {
		const { document } = await load('header-nav', { html: NAV(2) });
		ready(document, 'astro:page-load');
		click(trigger(document, 0));
		click(trigger(document, 1));
		assert.equal(trigger(document, 0).getAttribute('aria-expanded'), 'false');
		assert.equal(trigger(document, 1).getAttribute('aria-expanded'), 'true');
		assert.equal(panel(document, 0).dataset.open, 'false');
	});
});

describe('header-nav — dismissal', () => {
	it('closes when clicking outside the nav', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		click(trigger(document));
		click(document.querySelector('main'));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'false');
	});

	it('closes on Escape', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		click(trigger(document));
		document.dispatchEvent(new globalThis.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'false');
	});

	it('stays open when clicking inside its own panel', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		click(trigger(document));
		click(panel(document));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'true');
	});
});

describe('header-nav — lifecycle', () => {
	/* Re-binding on every navigation would stack hover handlers and make the
	 * dropdown flicker; the per-wrapper flag prevents it. */
	it('binds each dropdown once', async () => {
		const { document } = await load('header-nav', { html: NAV() });
		ready(document, 'astro:page-load');
		ready(document, 'astro:page-load');
		assert.equal(document.querySelector('[data-nav-dropdown]').dataset.navBound, 'true');
		click(trigger(document));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'true');
	});

	it('binds dropdowns introduced by a view transition', async () => {
		const { document } = await load('header-nav', { html: '<nav data-header-nav></nav>' });
		ready(document, 'astro:page-load');
		document.body.innerHTML = NAV();
		ready(document, 'astro:page-load');
		click(trigger(document));
		assert.equal(trigger(document).getAttribute('aria-expanded'), 'true');
	});

	it('tolerates a wrapper with no trigger', async () => {
		const { document } = await load('header-nav', {
			html: '<nav data-header-nav><div data-nav-dropdown></div></nav>',
		});
		assert.doesNotThrow(() => ready(document, 'astro:page-load'));
	});
});
