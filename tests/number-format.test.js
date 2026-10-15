/**
 * number-format — the Intl formatter behind count-up's currency, decimals,
 * compact and locale attributes. Pure, so no DOM: every case names its locale
 * so the result doesn't depend on the machine running the tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { numberFormat, pageLocale } from '../src/number-format.ts';

describe('number-format', () => {
	it('groups thousands in the given locale', () => {
		assert.equal(numberFormat({ locale: 'en-GB' })(12500), '12,500');
		assert.equal(numberFormat({ locale: 'de-DE' })(12500), '12.500');
	});

	it('writes money with the currency’s own decimals', () => {
		assert.equal(numberFormat({ locale: 'en-GB', currency: 'GBP' })(1240), '£1,240.00');
		assert.equal(numberFormat({ locale: 'en-US', currency: 'JPY' })(1240), '¥1,240');
	});

	it('fixes the decimal places when asked', () => {
		assert.equal(numberFormat({ locale: 'en-GB', decimals: 2 })(4.8), '4.80');
		assert.equal(numberFormat({ locale: 'en-GB', decimals: 0 })(4.8), '5');
		assert.equal(numberFormat({ locale: 'en-GB', currency: 'GBP', decimals: 0 })(1240.4), '£1,240');
	});

	it('writes compact numbers with one decimal at most', () => {
		assert.equal(numberFormat({ locale: 'en-US', compact: true })(1240), '1.2K');
		assert.equal(numberFormat({ locale: 'en-US', compact: true })(3_400_000), '3.4M');
	});

	it('can leave thousands ungrouped', () => {
		assert.equal(numberFormat({ locale: 'en-GB', grouping: false })(12500), '12500');
	});

	it('throws on a malformed currency code', () => {
		assert.throws(() => numberFormat({ currency: 'POUNDS' }), RangeError);
	});

	it('has no page locale without a document', () => {
		assert.equal(pageLocale(), undefined);
	});
});
