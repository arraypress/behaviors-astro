/**
 * count-up — the formatter a `.count-up` element's attributes select, tested
 * as a pure function of its dataset. The animation itself is covered in
 * page-behaviors.test.js under jsdom.
 *
 * The first block pins the 1.0 output exactly: elements without any of the
 * new attributes must read the same as they always did.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countUpFormat, decimalPlaces, easeOut } from '../src/count-up.ts';

describe('count-up — classic formatting (1.0)', () => {
	it('writes whole numbers from 100 up', () => {
		assert.equal(countUpFormat({ target: '500' })(123.6), '124');
	});

	it('keeps one decimal below 100', () => {
		assert.equal(countUpFormat({ target: '4.8' })(4.8), '4.8');
		assert.equal(countUpFormat({ target: '4.8' })(2.345), '2.3');
	});

	it('groups with comma, in the browser’s locale', () => {
		assert.equal(countUpFormat({ target: '12500', format: 'comma' })(12500), (12500).toLocaleString());
	});

	it('leaves the digits plain by default', () => {
		assert.equal(countUpFormat({ target: '12500' })(12500), '12500');
	});

	it('appends the suffix', () => {
		assert.equal(countUpFormat({ target: '99', suffix: '%' })(99), '99%');
	});

	it('treats a missing or broken target as zero', () => {
		assert.equal(countUpFormat({})(0), '0');
		assert.equal(countUpFormat({ target: 'lots' })(0), '0');
	});
});

describe('count-up — Intl formatting', () => {
	it('writes money in the given locale', () => {
		const write = countUpFormat({ target: '1240', currency: 'GBP', locale: 'en-GB' });
		assert.equal(write(1240), '£1,240.00');
	});

	it('groups thousands by default, and not with format="plain"', () => {
		assert.equal(countUpFormat({ target: '12500', locale: 'de-DE' })(12500), '12.500');
		assert.equal(countUpFormat({ target: '12500', locale: 'de-DE', format: 'plain' })(12500), '12500');
	});

	/* Without data-decimals the frames on the way never show more digits than
	 * the number lands on. */
	it('keeps as many decimals as the target is written with', () => {
		const write = countUpFormat({ target: '4.80', locale: 'en-GB' });
		assert.equal(write(2.12345), '2.12');
		assert.equal(write(4.8), '4.80');
		assert.equal(countUpFormat({ target: '1240', locale: 'en-GB' })(617.3), '617');
	});

	it('fixes the decimals when asked', () => {
		assert.equal(countUpFormat({ target: '4.8', decimals: '0', locale: 'en-GB' })(4.8), '5');
		assert.equal(countUpFormat({ target: '4', decimals: '2', locale: 'en-GB' })(4), '4.00');
	});

	it('ignores decimals that aren’t a small whole number', () => {
		assert.equal(countUpFormat({ target: '4.5', decimals: 'two', locale: 'en-GB' })(4.5), '4.5');
		assert.equal(countUpFormat({ target: '4.5', decimals: '99', locale: 'en-GB' })(4.5), '4.5');
	});

	it('writes compact numbers, and data-compact="false" turns it off', () => {
		assert.equal(countUpFormat({ target: '12500', compact: '', locale: 'en-US' })(12500), '12.5K');
		assert.equal(countUpFormat({ target: '12500', compact: 'false', locale: 'en-US' })(12500), '12,500');
	});

	it('keeps the suffix', () => {
		assert.equal(countUpFormat({ target: '2.5', compact: '', locale: 'en-US', suffix: '+' })(2_500_000), '2.5M+');
	});

	it('falls back to classic formatting on a malformed currency', () => {
		assert.equal(countUpFormat({ target: '12500', currency: 'POUNDS' })(12500), '12500');
	});
});

describe('count-up — helpers', () => {
	it('counts the decimals a number is written with', () => {
		assert.equal(decimalPlaces('1240'), 0);
		assert.equal(decimalPlaces('4.8'), 1);
		assert.equal(decimalPlaces('4.80'), 2);
		assert.equal(decimalPlaces(''), 0);
	});

	it('eases out from 0 to 1', () => {
		assert.equal(easeOut(0), 0);
		assert.equal(easeOut(1), 1);
		assert.ok(easeOut(0.5) > 0.5, 'past halfway by half time');
	});
});
