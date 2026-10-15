/**
 * @module number-format
 *
 * Numbers written the reader's way, via `Intl.NumberFormat`: the page's
 * language, a currency, a fixed number of decimals or compact notation (1.2K).
 * Pure — no DOM beyond reading the page's `lang` for the default locale.
 */

/** How to write a number. Every field is optional. */
export interface NumberStyle {
	/** A BCP 47 language tag. Default the page's `lang`, else the browser's. */
	locale?: string;
	/** An ISO 4217 code (`GBP`, `USD`) to write it as money. */
	currency?: string;
	/** Decimal places, fixed. Default a currency's own, one for compact, else up to three. */
	decimals?: number;
	/** Short form: 1.2K, 3.4M. Default false. */
	compact?: boolean;
	/** Group thousands (12,500). Default true. */
	grouping?: boolean;
}

/**
 * The page's language, from `<html lang>`, or undefined (the browser's own)
 * when there is none or no document at all.
 *
 * @returns A language tag, or undefined.
 */
export function pageLocale(): string | undefined {
	return (typeof document !== 'undefined' && document.documentElement.lang) || undefined;
}

/**
 * Make a formatter for a style. Build it once and reuse it: constructing an
 * `Intl.NumberFormat` is the expensive part, formatting is cheap.
 *
 * @param style How to write numbers.
 * @returns Writes a number.
 * @throws {RangeError} For a malformed locale tag or currency code.
 */
export function numberFormat(style: NumberStyle = {}): (value: number) => string {
	const { locale, currency, decimals, compact = false, grouping = true } = style;
	const format = new Intl.NumberFormat(locale || pageLocale(), {
		style: currency ? 'currency' : 'decimal',
		currency,
		notation: compact ? 'compact' : 'standard',
		useGrouping: grouping,
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals ?? (compact ? 1 : undefined),
	});
	return (value) => format.format(value);
}
