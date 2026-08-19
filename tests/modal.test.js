/**
 * modal — delegated open/close for native `<dialog>`.
 *
 * The idempotency guard is the thing most worth pinning: the handler is bound
 * to `document`, so a second `init()` after a view transition would stack a
 * duplicate listener and every click would fire twice.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const DIALOG = `
  <dialog id="d" data-wg-modal>
    <button data-modal-close>close</button>
  </dialog>`;

describe('modal — opening', () => {
	it('opens by data-modal-open', async () => {
		const { document } = await load('modal', {
			html: `<button data-modal-open="d">open</button>${DIALOG}`,
		});
		ready(document, 'astro:page-load');
		click(document.querySelector('[data-modal-open]'));
		assert.equal(document.getElementById('d').open, true);
	});

	it('opens from a hash link pointing at a dialog', async () => {
		const { document } = await load('modal', { html: `<a href="#d">open</a>${DIALOG}` });
		ready(document, 'astro:page-load');
		click(document.querySelector('a'));
		assert.equal(document.getElementById('d').open, true);
	});

	/* A hash link to an ordinary element must keep working as an anchor. */
	it('leaves a hash link alone when the target is not a dialog', async () => {
		const { document } = await load('modal', {
			html: `<a href="#section">jump</a><section id="section"></section>`,
		});
		ready(document, 'astro:page-load');
		const ev = new globalThis.MouseEvent('click', { bubbles: true, cancelable: true });
		document.querySelector('a').dispatchEvent(ev);
		assert.equal(ev.defaultPrevented, false, 'in-page anchors must still navigate');
	});

	it('does nothing for an id that does not exist', async () => {
		const { document } = await load('modal', { html: `<button data-modal-open="nope"></button>` });
		ready(document, 'astro:page-load');
		assert.doesNotThrow(() => click(document.querySelector('[data-modal-open]')));
	});

	it('does not reopen an already-open dialog', async () => {
		const { document } = await load('modal', {
			html: `<button data-modal-open="d">open</button>${DIALOG}`,
		});
		ready(document, 'astro:page-load');
		const d = document.getElementById('d');
		let calls = 0;
		const real = d.showModal.bind(d);
		d.showModal = () => { calls++; real(); };
		click(document.querySelector('[data-modal-open]'));
		click(document.querySelector('[data-modal-open]'));
		assert.equal(calls, 1);
	});
});

describe('modal — closing', () => {
	it('closes via a close button', async () => {
		const { document } = await load('modal', {
			html: `<button data-modal-open="d">open</button>${DIALOG}`,
		});
		ready(document, 'astro:page-load');
		click(document.querySelector('[data-modal-open]'));
		click(document.querySelector('[data-modal-close]'));
		assert.equal(document.getElementById('d').open, false);
	});

	/* Clicking the dialog element itself is the backdrop — children sit in a
	 * wrapper, so a click landing on <dialog> means outside the content. */
	it('closes on a backdrop click', async () => {
		const { document } = await load('modal', {
			html: `<button data-modal-open="d">open</button>${DIALOG}`,
		});
		ready(document, 'astro:page-load');
		click(document.querySelector('[data-modal-open]'));
		click(document.getElementById('d'));
		assert.equal(document.getElementById('d').open, false);
	});

	it('ignores a backdrop click on a dialog it does not own', async () => {
		const { document } = await load('modal', {
			html: `<dialog id="other" open></dialog>`,
		});
		ready(document, 'astro:page-load');
		click(document.getElementById('other'));
		assert.equal(document.getElementById('other').open, true, 'no [data-wg-modal], so not ours');
	});
});

describe('modal — lifecycle', () => {
	/* Without the dataset guard this would bind twice and the second click
	 * handler would immediately reopen what the first closed. */
	it('binds once across repeated view transitions', async () => {
		const { document } = await load('modal', {
			html: `<button data-modal-open="d">open</button>${DIALOG}`,
		});
		ready(document, 'astro:page-load');
		ready(document, 'astro:page-load');
		ready(document, 'astro:page-load');
		const d = document.getElementById('d');
		let calls = 0;
		const real = d.showModal.bind(d);
		d.showModal = () => { calls++; real(); };
		click(document.querySelector('[data-modal-open]'));
		assert.equal(calls, 1, 'handler must not stack');
		assert.equal(document.documentElement.dataset.wgModalBound, 'true');
	});
});
