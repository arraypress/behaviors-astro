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
import { load, ready, click } from './harness.js';

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

describe('page-behaviors — count-up formatting and motion', () => {
	it('writes money when given a currency', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="1240" data-currency="GBP" data-locale="en-GB">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '£1,240.00');
	});

	it('defaults the locale to the page’s lang', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="12500" data-decimals="0">0</span>',
		});
		document.documentElement.lang = 'de';
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		assert.equal(el.textContent, '12.500');
	});

	it('shows the final value at once with reduced motion', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50" data-suffix="%">0</span>',
			reducedMotion: true,
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		assert.equal(el.textContent, '50%');
	});

	/* After its first count the element follows data-target: a calculator
	 * sets the attribute and the number glides there. */
	it('glides to a new data-target after the first count', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await settle();
		el.dataset.target = '80';
		await new Promise((r) => setTimeout(r, 200));
		const midway = parseFloat(el.textContent);
		assert.ok(midway > 50 && midway < 80, `glides from 50, got ${el.textContent}`);
		await settle();
		assert.equal(el.textContent, '80');
	});

	it('retargets a count already in flight', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="500">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		await new Promise((r) => setTimeout(r, 200));
		el.dataset.target = '10';
		await settle();
		assert.equal(el.textContent, '10');
	});

	it('jumps to a new data-target with reduced motion', async () => {
		const { document, window } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
			reducedMotion: true,
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		observer(window).trigger(el);
		el.dataset.target = '75';
		await Promise.resolve();
		assert.equal(el.textContent, '75');
	});

	it('does not count before it is in view, even when data-target changes', async () => {
		const { document } = await load('page-behaviors', {
			html: '<span class="count-up" data-target="50">0</span>',
		});
		ready(document, 'astro:page-load');
		const el = document.querySelector('.count-up');
		el.dataset.target = '60';
		await new Promise((r) => setTimeout(r, 50));
		assert.equal(el.textContent, '0');
	});
});

/**
 * A drag-scroll track 400px wide over 1000px of content, with `scrollBy`
 * recorded (jsdom has no layout and no scrolling). Re-reads its edges via a
 * scroll event, since the module may have wired it before the geometry was set.
 */
function rail(document, selector = '.carousel') {
	const track = document.querySelector(selector);
	const calls = [];
	Object.defineProperty(track, 'scrollWidth', { value: 1000, configurable: true });
	Object.defineProperty(track, 'clientWidth', { value: 400, configurable: true });
	track.scrollBy = (options) => {
		calls.push(options);
		track.scrollLeft += options.left;
	};
	track.dispatchEvent(new globalThis.Event('scroll'));
	return { track, calls };
}

/** Dispatch a mouse pointer event on an element. */
function pointer(el, type, clientX, extra = {}) {
	el.dispatchEvent(
		new globalThis.PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerType: 'mouse',
			pointerId: 1,
			clientX,
			...extra,
		})
	);
}

/** Press at 300, drag left in two moves, and let go at 200. */
function dragLeft(el) {
	pointer(el, 'pointerdown', 300);
	pointer(el, 'pointermove', 250);
	pointer(el, 'pointermove', 200);
	pointer(el, 'pointerup', 200);
}

const RAIL = `
  <section>
    <button data-drag-scroll-prev>back</button>
    <button data-drag-scroll-next>on</button>
    <div class="carousel"><div class="card">card</div><a class="link" href="#x">link</a></div>
  </section>`;

describe('page-behaviors — drag-scroll edges and controls', () => {
	it('marks the ends on the track and disables the controls there', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track } = rail(document);
		const [prev, next] = document.querySelectorAll('button');

		assert.equal(track.hasAttribute('data-start'), false);
		assert.equal(track.hasAttribute('data-end'), true);
		assert.equal(prev.disabled, true);
		assert.equal(next.disabled, false);

		track.scrollLeft = 600;
		track.dispatchEvent(new globalThis.Event('scroll'));
		assert.equal(track.hasAttribute('data-start'), true);
		assert.equal(track.hasAttribute('data-end'), false);
		assert.equal(prev.disabled, false);
		assert.equal(next.disabled, true);
	});

	it('pages by 80% of the visible width, gliding', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { calls } = rail(document);
		click(document.querySelector('[data-drag-scroll-next]'));
		assert.deepEqual(calls, [{ left: 320, behavior: 'smooth' }]);
		click(document.querySelector('[data-drag-scroll-prev]'));
		assert.deepEqual(calls[1], { left: -320, behavior: 'smooth' });
	});

	it('jumps rather than glides with reduced motion', async () => {
		const { document } = await load('page-behaviors', { html: RAIL, reducedMotion: true });
		ready(document, 'astro:page-load');
		const { calls } = rail(document);
		click(document.querySelector('[data-drag-scroll-next]'));
		assert.deepEqual(calls, [{ left: 320, behavior: 'auto' }]);
	});

	it('finds controls that name the track by id from anywhere', async () => {
		const { document } = await load('page-behaviors', {
			html: `<nav><a data-drag-scroll-next="rail" href="#rail">on</a></nav>
			       <div><div id="rail" data-drag-scroll></div></div>`,
		});
		ready(document, 'astro:page-load');
		const { calls } = rail(document, '#rail');
		const next = document.querySelector('[data-drag-scroll-next]');
		assert.equal(next.hasAttribute('aria-disabled'), false, 'not at the end yet');
		click(next);
		assert.equal(calls.length, 1);

		document.querySelector('#rail').scrollLeft = 600;
		document.querySelector('#rail').dispatchEvent(new globalThis.Event('scroll'));
		assert.equal(next.getAttribute('aria-disabled'), 'true', 'non-buttons get aria-disabled');
	});

	it('ignores controls that name a different track', async () => {
		const { document } = await load('page-behaviors', {
			html: `<div><button data-drag-scroll-next="other">on</button><div id="rail" data-drag-scroll></div></div>`,
		});
		ready(document, 'astro:page-load');
		const { calls } = rail(document, '#rail');
		click(document.querySelector('button'));
		assert.equal(calls.length, 0);
	});

	/* Wiring twice would page twice per click. */
	it('wires each track once across page loads', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		ready(document, 'astro:page-load');
		const { calls } = rail(document);
		click(document.querySelector('[data-drag-scroll-next]'));
		assert.equal(calls.length, 1);
	});
});

describe('page-behaviors — drag-scroll dragging', () => {
	it('follows the mouse and throws on release', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track, calls } = rail(document);
		dragLeft(track.querySelector('.card'));
		assert.equal(calls.length, 1, 'one throw');
		assert.equal(calls[0].behavior, 'smooth');
		assert.ok(calls[0].left > 0, 'thrown on, the way the content was moving');
		assert.equal(track.scrollLeft, 100 + calls[0].left);
		assert.equal(track.style.scrollSnapType, '', 'snapping is back for the throw to land on');
	});

	it('drags without a throw under reduced motion', async () => {
		const { document } = await load('page-behaviors', { html: RAIL, reducedMotion: true });
		ready(document, 'astro:page-load');
		const { track, calls } = rail(document);
		dragLeft(track.querySelector('.card'));
		assert.equal(track.scrollLeft, 100);
		assert.equal(calls.length, 0);
	});

	it('swallows the click that ends a drag, and only that one', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track } = rail(document);
		const card = track.querySelector('.card');
		const clicks = [];
		card.addEventListener('click', () => clicks.push('card'));

		dragLeft(card);
		click(card);
		assert.deepEqual(clicks, [], 'the drag’s own click is swallowed');

		await new Promise((r) => setTimeout(r, 10));
		click(card);
		assert.deepEqual(clicks, ['card'], 'a later click goes through');
	});

	it('lets a tap through as a click', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track } = rail(document);
		const card = track.querySelector('.card');
		const clicks = [];
		card.addEventListener('click', () => clicks.push('card'));
		pointer(card, 'pointerdown', 300);
		pointer(card, 'pointermove', 297);
		pointer(card, 'pointerup', 297);
		click(card);
		assert.deepEqual(clicks, ['card']);
		assert.equal(track.scrollLeft, 0);
	});

	it('leaves touch and non-primary buttons to the browser', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track } = rail(document);
		const card = track.querySelector('.card');
		pointer(card, 'pointerdown', 300, { pointerType: 'touch' });
		pointer(card, 'pointermove', 200, { pointerType: 'touch' });
		assert.equal(track.scrollLeft, 0);
		pointer(card, 'pointerdown', 300, { button: 2 });
		pointer(card, 'pointermove', 200, { button: 2 });
		assert.equal(track.scrollLeft, 0);
	});

	it('skips presses on links unless forced', async () => {
		const { document } = await load('page-behaviors', { html: RAIL });
		ready(document, 'astro:page-load');
		const { track } = rail(document);
		const link = track.querySelector('.link');
		pointer(link, 'pointerdown', 300);
		pointer(link, 'pointermove', 200);
		assert.equal(track.scrollLeft, 0);
		pointer(link, 'pointerup', 200);

		link.setAttribute('data-drag-scroll-force', '');
		pointer(link, 'pointerdown', 300);
		pointer(link, 'pointermove', 200);
		assert.equal(track.scrollLeft, 100);
	});
});
