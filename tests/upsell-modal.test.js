/**
 * upsell-modal — intercepts a Buy click and offers an upgrade first.
 *
 * The capture-phase binding is the load-bearing detail: the trigger is an
 * anchor, so the handler has to run and cancel before the browser follows the
 * link. Bubble phase would be too late.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const MARKUP = `
  <a href="/buy/original" data-upsell-trigger>Buy</a>
  <dialog id="wg-upsell-modal"
          data-upsell-target-url="/buy/upgrade"
          data-upsell-original-url="/buy/original">
    <button data-upsell-accept>Upgrade</button>
    <button data-upsell-decline>No thanks</button>
  </dialog>`;

describe('upsell-modal — interception', () => {
	it('opens the dialog instead of following the Buy link', async () => {
		const { document } = await load('upsell-modal', { html: MARKUP });
		ready(document);
		const ev = new globalThis.MouseEvent('click', { bubbles: true, cancelable: true });
		document.querySelector('[data-upsell-trigger]').dispatchEvent(ev);
		assert.equal(document.getElementById('wg-upsell-modal').open, true);
		assert.equal(ev.defaultPrevented, true, 'the Buy link must not navigate');
	});

	/* Without the dialog on the page the Buy button has to keep working as an
	 * ordinary link, or the product is unbuyable. */
	it('leaves the link alone when no dialog is present', async () => {
		const { document } = await load('upsell-modal', {
			html: '<a href="/buy/original" data-upsell-trigger>Buy</a>',
		});
		ready(document);
		const ev = new globalThis.MouseEvent('click', { bubbles: true, cancelable: true });
		document.querySelector('[data-upsell-trigger]').dispatchEvent(ev);
		assert.equal(ev.defaultPrevented, false, 'must fall through to a normal purchase');
	});

	it('ignores clicks that are not the trigger', async () => {
		const { document } = await load('upsell-modal', { html: `<a href="/x">other</a>${MARKUP}` });
		ready(document);
		click(document.querySelector('a[href="/x"]'));
		assert.equal(document.getElementById('wg-upsell-modal').open, false);
	});
});

describe('upsell-modal — choices', () => {
	/* jsdom cannot navigate and will not let `window.location` be replaced, so
	 * the assertion is split: which URL attribute the module read (that is the
	 * accept-vs-decline branch), and that it then tried to navigate at all. */
	const spyAttrs = (dialog) => {
		const read = [];
		const real = dialog.getAttribute.bind(dialog);
		dialog.getAttribute = (name) => { read.push(name); return real(name); };
		return read;
	};

	it('accept reads the upgrade URL and navigates', async () => {
		const { document, navigations } = await load('upsell-modal', { html: MARKUP });
		ready(document);
		const read = spyAttrs(document.getElementById('wg-upsell-modal'));
		click(document.querySelector('[data-upsell-accept]'));
		assert.ok(read.includes('data-upsell-target-url'), 'should read the upgrade URL');
		assert.ok(!read.includes('data-upsell-original-url'), 'should not read the decline URL');
		assert.equal(navigations.length, 1);
	});

	it('decline reads the original URL and navigates', async () => {
		const { document, navigations } = await load('upsell-modal', { html: MARKUP });
		ready(document);
		const read = spyAttrs(document.getElementById('wg-upsell-modal'));
		click(document.querySelector('[data-upsell-decline]'));
		assert.ok(read.includes('data-upsell-original-url'), 'should read the original URL');
		assert.ok(!read.includes('data-upsell-target-url'), 'should not read the upgrade URL');
		assert.equal(navigations.length, 1);
	});

	it('does not navigate when the URL attribute is missing', async () => {
		const { document, navigations } = await load('upsell-modal', {
			html: `<dialog id="wg-upsell-modal"><button data-upsell-accept>go</button></dialog>`,
		});
		ready(document);
		click(document.querySelector('[data-upsell-accept]'));
		assert.equal(navigations.length, 0, 'a missing URL must not send the user anywhere');
	});
});

describe('upsell-modal — lifecycle', () => {
	it('marks itself bound so a second init cannot stack handlers', async () => {
		const { document } = await load('upsell-modal', { html: MARKUP });
		ready(document);
		assert.equal(document.documentElement.dataset.wgUpsellBound, 'true');
	});
});
