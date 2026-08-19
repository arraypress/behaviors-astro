/**
 * brand-colors — copy a hex value to the clipboard from a swatch.
 *
 * The clipboard is permission-gated in every browser, so the failure path
 * matters as much as the success path: a blocked write must surface as a toast
 * rather than an unhandled rejection.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { load, ready, click } from './harness.js';

const SWATCH = '<button data-brand-color-copy="#1f2937">Slate</button>';

/** jsdom has no clipboard; install one that records or rejects. */
function stubClipboard(window, { fail = false } = {}) {
	const written = [];
	Object.defineProperty(window.navigator, 'clipboard', {
		value: {
			writeText: (v) => {
				if (fail) return Promise.reject(new Error('blocked'));
				written.push(v);
				return Promise.resolve();
			},
		},
		configurable: true,
	});
	Object.defineProperty(globalThis, 'navigator', {
		value: window.navigator, configurable: true, writable: true,
	});
	return written;
}

/** Let the module's async clipboard handler settle. */
const flush = () => new Promise((r) => setTimeout(r, 10));

describe('brand-colors', () => {
	it('copies the swatch value', async () => {
		const { document, window } = await load('brand-colors', { html: SWATCH });
		const written = stubClipboard(window);
		ready(document);
		click(document.querySelector('[data-brand-color-copy]'));
		await flush();
		assert.deepEqual(written, ['#1f2937']);
	});

	it('confirms the copy by toast, quoting the value', async () => {
		const { document, window, toasts } = await load('brand-colors', { html: SWATCH });
		stubClipboard(window);
		ready(document);
		click(document.querySelector('[data-brand-color-copy]'));
		await flush();
		assert.equal(toasts[0].message, 'Copied #1f2937');
		assert.equal(toasts[0].opts.variant, 'success');
	});

	/* A rejected clipboard write must not escape as an unhandled rejection —
	 * it would surface in the console of every page carrying a swatch grid. */
	it('reports a blocked clipboard instead of throwing', async () => {
		const { document, window, toasts } = await load('brand-colors', { html: SWATCH });
		stubClipboard(window, { fail: true });
		ready(document);
		assert.doesNotThrow(() => click(document.querySelector('[data-brand-color-copy]')));
		await flush();
		assert.match(toasts[0].message, /Copy failed/);
		assert.equal(toasts[0].opts.variant, 'error');
	});

	it('ignores a swatch with no value', async () => {
		const { document, window, toasts } = await load('brand-colors', {
			html: '<button data-brand-color-copy=""></button>',
		});
		const written = stubClipboard(window);
		ready(document);
		click(document.querySelector('[data-brand-color-copy]'));
		await flush();
		assert.deepEqual(written, []);
		assert.equal(toasts.length, 0);
	});

	it('ignores clicks elsewhere', async () => {
		const { document, window } = await load('brand-colors', { html: `<button>other</button>${SWATCH}` });
		const written = stubClipboard(window);
		ready(document);
		click(document.querySelectorAll('button')[0]);
		await flush();
		assert.deepEqual(written, []);
	});

	/* toast-astro is optional — copying still has to work without it. */
	it('copies even when window.toast is absent', async () => {
		const { document, window } = await load('brand-colors', { html: SWATCH });
		const written = stubClipboard(window);
		delete window.toast;
		ready(document);
		click(document.querySelector('[data-brand-color-copy]'));
		await flush();
		assert.deepEqual(written, ['#1f2937']);
	});
});
