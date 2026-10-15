/**
 * @module page-behaviors
 *
 * Generic, cross-cutting page-load behaviors that re-run on every Astro
 * view-transition page-load. These aren't tied to any one component — they
 * fire against whatever markup happens to be on the page.
 *
 * Two behaviors are bound here, each in its own file:
 *
 *   1. Count-up (`count-up.ts`) — any `.count-up` element animates from 0 to
 *      its `data-target` value over 1.4s with an ease-out-cubic curve when it
 *      scrolls into view (IntersectionObserver, 0.3 threshold), then glides to
 *      any new `data-target` set on it.
 *
 *   2. Drag-to-scroll (`drag-scroll.ts`) — horizontal carousels can be
 *      press-held, dragged and thrown with a mouse; touch devices keep their
 *      native scroll.
 *
 * DOM contract (data-* attributes this module reads/writes):
 *
 *   Count-up — selector `.count-up`
 *     - `data-target`   (number)  required — the value to count up to. Change
 *                        it after the first count and the number glides there.
 *     - `data-suffix`   (string)  optional — appended after the number (e.g. '%', 'k').
 *     - `data-format`   ('comma' | 'plain')  optional — 'comma' uses
 *                        `Number.toLocaleString()` grouping. Default 'plain'.
 *                        With Intl formatting, grouping is on unless 'plain'.
 *     - `data-currency` (ISO 4217)  optional — write it as money (`GBP`).
 *     - `data-decimals` (integer)   optional — fixed decimal places.
 *     - `data-compact`  (boolean)   optional — short form: 1.2K, 3.4M.
 *     - `data-locale`   (BCP 47)    optional — default the page's `lang`.
 *                        Any of these four switches on `Intl.NumberFormat`.
 *     - `data-counted`  ('1')  written by this module to mark an element as
 *                        already animated so re-init is idempotent.
 *
 *   Drag-to-scroll — selectors `.carousel`, `.catalog-rail-track`, `[data-drag-scroll]`
 *     - `[data-drag-scroll-force]`  on/within an interactive child opts that
 *                        child back INTO drag handling (otherwise links/buttons
 *                        inside the track are skipped so clicks still work).
 *     - `data-start` / `data-end`  written on the track while it can scroll
 *                        back / on, for edge fades styled by the site.
 *     - `[data-drag-scroll-prev]` / `[data-drag-scroll-next]`  optional
 *                        controls: valueless inside the track's parent, or
 *                        set to the track's id from anywhere. They page by 80%
 *                        of the visible width and are disabled at the ends.
 *     - Non-DOM `__wgDragInit` / `__wgDragEdges` stamps on the element
 *                        guarantee each track is only wired once.
 *
 * Lifecycle: registers on Astro's `astro:page-load` (fires on initial load
 * AND after every view transition). The module body runs once because it's
 * bundled; element-level idempotency guards (`data-counted`, `__wgDragInit`)
 * keep re-init safe across transitions.
 */

import { initCountUp } from './count-up.ts';
import { initDragScroll } from './drag-scroll.ts';

/**
 * (Re)bind the page behaviors. Safe to call repeatedly — count-up uses a
 * fresh observer + `data-counted` guard, and drag-scroll uses the
 * `__wgDragInit` flag so each track is only wired once.
 */
function initPageBehaviors(): void {
	initCountUp();
	initDragScroll();
}

// Bind on every Astro view-transition page-load (also fires on initial load).
document.addEventListener('astro:page-load', initPageBehaviors);

// The bundled module runs once; if the document is already interactive when
// this executes (no astro:page-load pending), kick off immediately so the
// behaviors are live without waiting for a transition.
if (document.readyState !== 'loading') {
	initPageBehaviors();
}

export {};
