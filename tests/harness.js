/**
 * Test harness for the behaviour modules.
 *
 * Every module here is a side-effecting import: it binds its listeners at
 * import time and re-runs `init()` on `astro:page-load` / `astro:after-swap`.
 * That shape drives three things about this harness.
 *
 *   1. The DOM has to exist *before* the import, so `load()` installs the
 *      globals first and imports second.
 *   2. Node caches ES modules by specifier, so a second import of the same
 *      path is a no-op and the listeners never rebind. Each `load()` appends a
 *      unique query string to defeat that — every test gets a clean module.
 *   3. jsdom is missing two APIs these modules rely on, so we supply them
 *      rather than skip the tests that need them. Both stubs are deliberately
 *      minimal and are asserted against directly, so a test can't pass because
 *      the stub was too generous.
 */

import { JSDOM, VirtualConsole } from 'jsdom';

/* Captured before any test overrides the global, so the shim below always has
 * a real clock to read. */
const NODE_PERFORMANCE = globalThis.performance;

let seq = 0;

/* The window from the previous `load()`. jsdom keeps its timer and
 * requestAnimationFrame loops running for the lifetime of the window, so an
 * animation still in flight from an earlier test would go on calling the
 * globals this harness swaps out underneath it. Closing the old window first
 * stops those loops and keeps each test genuinely isolated. */
let previous = null;

/**
 * Minimal IntersectionObserver. jsdom has none, and `page-behaviors` uses it
 * to trigger the count-up animation. Instances register themselves on
 * `window.__observers` so a test can drive an intersection by hand — there is
 * no scrolling in jsdom, so "element came into view" has to be simulated.
 */
function installIntersectionObserver(win) {
	win.__observers = [];
	win.IntersectionObserver = class {
		constructor(cb, opts) {
			this.cb = cb;
			this.opts = opts;
			this.elements = new Set();
			win.__observers.push(this);
		}
		observe(el) {
			this.elements.add(el);
		}
		unobserve(el) {
			this.elements.delete(el);
		}
		disconnect() {
			this.elements.clear();
		}
		/** Fire the callback as though `el` scrolled into view. */
		trigger(el, isIntersecting = true) {
			this.cb([{ target: el, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }], this);
		}
	};
}

/**
 * `<dialog>` support. jsdom implements the element but not `showModal()` /
 * `close()`, which is exactly the API `modal`, `product-gallery` and
 * `upsell-modal` drive. Track state through the `open` property so assertions
 * read the same way they would in a browser.
 */
function installDialog(win) {
	const proto = win.HTMLDialogElement.prototype;
	proto.showModal = function showModal() {
		this.open = true;
		this.setAttribute('open', '');
	};
	proto.show = proto.showModal;
	proto.close = function close(returnValue) {
		this.open = false;
		this.removeAttribute('open');
		if (returnValue !== undefined) this.returnValue = returnValue;
		this.dispatchEvent(new win.Event('close'));
	};
}

/**
 * Build a fresh document and load one behaviour module against it.
 *
 * @param {string} module - Module file name, e.g. 'card-actions'.
 * @param {Object} [options]
 * @param {string} [options.html=''] - Body markup.
 * @param {string} [options.url='https://example.com/'] - Document URL. Matters
 *   for `card-actions`, which only records a view on `/products/<slug>`.
 * @param {Object} [options.storage] - Seed values for localStorage.
 * @returns {Promise<{window: Window, document: Document, toasts: Array, navigations: Array}>}
 */
export async function load(module, options = {}) {
	const { html = '', url = 'https://example.com/', storage = {} } = options;

	if (previous) {
		try { previous.close(); } catch { /* already torn down */ }
	}

	/* jsdom cannot navigate, and `window.location` is not redefinable, so a
	 * module doing `location.href = …` surfaces only as a jsdomError. Capture
	 * those so a test can assert that navigation was attempted at all. */
	const navigations = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (err) => {
		if (/navigation/i.test(err.message)) navigations.push(err.message);
	});

	const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
		url,
		pretendToBeVisual: true,
		virtualConsole,
	});
	previous = dom.window;
	const { window: win } = dom;

	installIntersectionObserver(win);
	installDialog(win);

	for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);

	/* Record toast calls instead of requiring @arraypress/toast-astro — the
	 * modules treat `window.toast` as an optional global, and asserting on the
	 * calls is what we actually care about. */
	const toasts = [];
	win.toast = (message, opts) => toasts.push({ message, opts });

	/* The modules reach for these as bare globals. Some of them — `navigator`
	 * and `location` — are getter-only on Node's global object, so plain
	 * assignment throws; defineProperty replaces them regardless. */
	for (const k of [
		'window', 'document', 'navigator', 'location', 'localStorage',
		'HTMLElement', 'Event', 'CustomEvent', 'MouseEvent', 'KeyboardEvent',
		'IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame',
		'getComputedStyle', 'HTMLDialogElement',
	]) {
		const value = k === 'window' ? win : win[k];
		if (value === undefined) continue;
		Object.defineProperty(globalThis, k, { value, configurable: true, writable: true });
	}

	/* The animation code reads `performance.now()` for its start time and takes
	 * the frame timestamp from `requestAnimationFrame`. Those must share an
	 * origin or the elapsed time is meaningless — and in jsdom they do not:
	 * its rAF timestamps run on a different clock from its `performance`,
	 * measurably negative against it.
	 *
	 * Rather than chase an offset between two clocks we do not control, the
	 * harness owns both: `performance.now()` counts from window creation, and
	 * rAF hands the callback that very same reading. jsdom still does the
	 * scheduling; only the timestamp is ours.
	 */
	const createdAt = NODE_PERFORMANCE.now();
	const now = () => NODE_PERFORMANCE.now() - createdAt;
	Object.defineProperty(globalThis, 'performance', {
		value: { now },
		configurable: true,
		writable: true,
	});
	const rawRaf = win.requestAnimationFrame.bind(win);
	Object.defineProperty(globalThis, 'requestAnimationFrame', {
		value: (cb) => rawRaf(() => cb(now())),
		configurable: true,
		writable: true,
	});

	/* Defeat the ES module cache so listeners rebind per test. */
	await import(`../src/${module}.ts?fresh=${++seq}`);

	return { window: win, document: win.document, toasts, navigations, dom };
}

/** Fire the lifecycle events a real Astro page would. */
export function ready(document, event = 'DOMContentLoaded') {
	document.dispatchEvent(new globalThis.Event(event));
}

/** Click an element the way a user would, so delegated handlers see it. */
export function click(el) {
	el.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
}
