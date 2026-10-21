/**
 * drag-scroll — the arithmetic behind the throw, the edge attributes and the
 * prev/next paging, tested as pure functions. The wiring is covered in
 * page-behaviors.test.js under jsdom.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { smoothSpeed, throwDistance, scrollEdges, pageDistance, settleTarget } from '../src/drag-scroll.ts';

describe('drag-scroll — speed', () => {
	it('weights the latest move over the running speed', () => {
		assert.equal(smoothSpeed(0, 10, 10), 0.4);
		assert.equal(smoothSpeed(1, 0, 10), 0.6);
	});

	it('never divides by a zero interval', () => {
		assert.equal(smoothSpeed(0, 10, 0), 4);
	});
});

describe('drag-scroll — throw', () => {
	/* Dragging the pointer left reveals what is to the right, so the throw
	 * carries the scroll position on, the opposite sign. */
	it('throws opposite to the pointer, scaled by speed', () => {
		assert.equal(throwDistance(-2, 0), 360);
		assert.equal(throwDistance(2, 0), -360);
	});

	it('does not throw when the hand had stopped before letting go', () => {
		assert.equal(throwDistance(-2, 150), 0);
	});

	it('ignores a throw too small to see', () => {
		assert.equal(throwDistance(0.001, 0), 0);
		assert.equal(Object.is(throwDistance(0, 0), 0), true, 'no negative zero');
	});
});

describe('drag-scroll — edges', () => {
	it('can only scroll on at the start', () => {
		assert.deepEqual(scrollEdges(0, 1000, 400), { start: false, end: true });
	});

	it('can scroll both ways in the middle', () => {
		assert.deepEqual(scrollEdges(300, 1000, 400), { start: true, end: true });
	});

	it('can only scroll back at the end, within a pixel', () => {
		assert.deepEqual(scrollEdges(599.5, 1000, 400), { start: true, end: false });
	});

	it('reads negative scrollLeft in right-to-left layouts', () => {
		assert.deepEqual(scrollEdges(-300, 1000, 400), { start: true, end: true });
		assert.deepEqual(scrollEdges(-600, 1000, 400), { start: true, end: false });
	});

	it('has no edges when nothing overflows', () => {
		assert.deepEqual(scrollEdges(0, 400, 400), { start: false, end: false });
	});
});

describe('drag-scroll — paging', () => {
	it('pages by 80% of the visible width', () => {
		assert.equal(pageDistance(500, 'next', false), 400);
		assert.equal(pageDistance(500, 'prev', false), -400);
	});

	it('flips in right-to-left layouts', () => {
		assert.equal(pageDistance(500, 'next', true), -400);
		assert.equal(pageDistance(500, 'prev', true), 400);
	});
});

describe('drag-scroll — settle', () => {
	const cards = [0, 300, 600, 900];

	it('moves on one card after a short, slow drag (no need to pass halfway)', () => {
		assert.equal(settleTarget(cards, 0, 40), 300);
		assert.equal(settleTarget(cards, 600, 560), 300);
	});

	it('leaves a tiny wobble to the browser snap', () => {
		assert.equal(settleTarget(cards, 300, 310), null);
		assert.equal(settleTarget(cards, 300, 290), null);
	});

	it('moves as far as a long or thrown drag went, in its direction', () => {
		assert.equal(settleTarget(cards, 0, 640), 900);
		assert.equal(settleTarget(cards, 900, 250), 0);
	});

	it('stays put at the ends', () => {
		assert.equal(settleTarget(cards, 900, 980), null);
		assert.equal(settleTarget(cards, 0, -60), null);
	});

	it('does nothing without snap points', () => {
		assert.equal(settleTarget([], 0, 200), null);
	});
});
