/**
 * @module count-up
 *
 * The `.count-up` half of `page-behaviors`: a number that counts up from 0 to
 * its `data-target` as it scrolls into view, easing out to land. After that
 * first count it glides to any new value set on `data-target`, so a calculator
 * or a price toggle can drive it. With prefers-reduced-motion the number
 * changes without counting.
 *
 * Formatting has two modes, chosen per element:
 *
 *   - Classic (no `data-currency`, `data-decimals`, `data-compact` or
 *     `data-locale`): exactly what 1.0 did. Whole numbers from 100 up, one
 *     decimal below; `data-format="comma"` groups thousands in the browser's
 *     locale, otherwise the digits are plain.
 *
 *   - Intl (any of those four present): `Intl.NumberFormat` in `data-locale`,
 *     else the page's `lang`. Thousands are grouped unless
 *     `data-format="plain"`. Without `data-decimals` a plain number keeps as
 *     many decimals as `data-target` is written with, so the in-between frames
 *     never show more digits than the landing value.
 *
 * `data-suffix` is appended in both modes.
 */

import { numberFormat } from './number-format.ts';
import { prefersReducedMotion } from './reduced-motion.ts';

/** How long one count or glide takes, in ms. */
const DURATION = 1400;

/** The attributes that switch an element to Intl formatting. */
const INTL_KEYS = ['currency', 'decimals', 'compact', 'locale'] as const;

/** Live IntersectionObserver for count-up elements, recreated per page-load. */
let countObserver: IntersectionObserver | null = null;

/**
 * Ease-out cubic: fast away, slow to land.
 *
 * @param t Progress, 0 to 1.
 * @returns Eased progress, 0 to 1.
 */
export function easeOut(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * How many decimal places a number is written with: `'4.80'` has two,
 * `'1240'` none.
 *
 * @param text The number as written.
 * @returns The count of digits after the point.
 */
export function decimalPlaces(text: string): number {
	const match = /\.(\d+)/.exec(text);
	return match ? match[1].length : 0;
}

/**
 * Read a whole-number attribute, ignoring anything that isn't one.
 *
 * @param text The attribute's value.
 * @returns The number, or undefined when missing or not a whole number 0–20.
 */
function places(text: string | undefined): number | undefined {
	if (text === undefined || !/^\d+$/.test(text.trim())) return undefined;
	const n = parseInt(text, 10);
	return n <= 20 ? n : undefined;
}

/**
 * The 1.0 formatter: whole numbers from 100 up, one decimal below, with
 * optional thousands grouping in the browser's locale.
 *
 * @param target The value being counted to; decides the rounding.
 * @param comma Group thousands.
 * @returns Writes a number.
 */
function classicFormat(target: number, comma: boolean): (n: number) => string {
	return (n) => {
		const rounded = target >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
		return comma ? rounded.toLocaleString() : String(rounded);
	};
}

/**
 * Build the formatter a count-up element asks for through its data
 * attributes, suffix included. Pure: pass the element's `dataset`.
 *
 * A malformed `data-locale` or `data-currency` falls back to the classic
 * formatter rather than breaking the page.
 *
 * @param data The element's data attributes (`target`, `suffix`, `format`,
 *   `currency`, `decimals`, `compact`, `locale`).
 * @returns Writes a number the way the element wants it shown.
 */
export function countUpFormat(data: DOMStringMap): (value: number) => string {
	const target = parseFloat(data.target || '0') || 0;
	const suffix = data.suffix || '';
	const classic = classicFormat(target, data.format === 'comma');
	let write = classic;
	if (INTL_KEYS.some((key) => data[key] !== undefined)) {
		const currency = data.currency?.trim() || undefined;
		const compact = data.compact !== undefined && data.compact !== 'false';
		const decimals =
			places(data.decimals) ??
			(currency || compact ? undefined : decimalPlaces(data.target || ''));
		try {
			write = numberFormat({
				locale: data.locale?.trim() || undefined,
				currency,
				decimals,
				compact,
				grouping: data.format !== 'plain',
			});
		} catch {
			write = classic;
		}
	}
	return (value) => write(value) + suffix;
}

/**
 * Make the counter for one element: a function that animates its text from
 * the value it shows now to a new one, re-reading the formatting attributes
 * each time. A new value mid-count picks up from wherever the count is.
 *
 * @param el The count-up element.
 * @returns Counts to a value, optionally from a given start.
 */
function counter(el: HTMLElement): (to: number, from?: number) => void {
	let shown = 0;
	let start = 0;
	let end = 0;
	let began = 0;
	let running = false;
	let write = countUpFormat(el.dataset);

	/**
	 * One frame of a count.
	 *
	 * @param now The frame's timestamp, ms.
	 */
	const tick = (now: number): void => {
		const t = Math.min(1, Math.max(0, (now - began) / DURATION));
		shown = start + (end - start) * easeOut(t);
		if (t < 1) {
			el.textContent = write(shown);
			requestAnimationFrame(tick);
		} else {
			shown = end;
			el.textContent = write(end);
			running = false;
		}
	};

	return (to, from = shown) => {
		write = countUpFormat(el.dataset);
		start = from;
		end = to;
		if (prefersReducedMotion() || start === end) {
			shown = end;
			el.textContent = write(end);
			return;
		}
		began = performance.now();
		if (!running) {
			running = true;
			requestAnimationFrame(tick);
		}
	};
}

/**
 * The value an element should land on.
 *
 * @param el The count-up element.
 * @returns Its `data-target`, or 0 when missing or not a number.
 */
function targetOf(el: HTMLElement): number {
	return parseFloat(el.dataset.target || '0') || 0;
}

/**
 * Run an element's first count, then watch its `data-target` so later changes
 * glide there. Marks it `data-counted` so a re-init never replays it.
 *
 * @param el The count-up element.
 */
function startCount(el: HTMLElement): void {
	if (el.dataset.counted) return;
	el.dataset.counted = '1';
	const countTo = counter(el);
	countTo(targetOf(el), 0);
	/** Glide from what it shows now to its new `data-target`. */
	const glide = (): void => countTo(targetOf(el));
	new MutationObserver(glide).observe(el, {
		attributes: true,
		attributeFilter: ['data-target'],
	});
}

/**
 * (Re)bind count-up on the current page. Safe to call repeatedly: it replaces
 * the observer, and `data-counted` keeps finished elements from replaying.
 * Without IntersectionObserver every element counts at once.
 */
export function initCountUp(): void {
	if (countObserver) countObserver.disconnect();
	countObserver = null;
	const elements = document.querySelectorAll<HTMLElement>('.count-up:not([data-counted])');
	if (typeof IntersectionObserver === 'undefined') {
		elements.forEach(startCount);
		return;
	}
	/**
	 * Start the count of each element that has come into view.
	 *
	 * @param entries The elements whose visibility changed.
	 */
	const arrive = (entries: IntersectionObserverEntry[]): void => {
		entries.forEach((e) => {
			if (!e.isIntersecting) return;
			observer.unobserve(e.target);
			startCount(e.target as HTMLElement);
		});
	};
	const observer = new IntersectionObserver(arrive, { threshold: 0.3 });
	countObserver = observer;
	elements.forEach((el) => observer.observe(el));
}
