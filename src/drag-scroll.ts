/**
 * @module drag-scroll
 *
 * The drag-to-scroll half of `page-behaviors`, for every horizontal track
 * matching `.carousel`, `.catalog-rail-track` or `[data-drag-scroll]`.
 *
 * Touch, trackpads and the keyboard scroll a track natively. A mouse can also
 * press, hold and drag it: it follows the hand, and on release it is thrown on
 * by the drag's speed and settles on the next card in the direction it was
 * dragged (a short drag is enough — `settleTarget`), then snap comes back. The click
 * that ends a drag is swallowed, so dragging across a card doesn't open it.
 *
 * While it can scroll back the track carries `data-start`, and while it can
 * scroll on, `data-end` — hooks for edge fades the site styles itself. Optional
 * prev/next controls page it by most of its visible width and are disabled at
 * the ends. With prefers-reduced-motion there is no throw and paging jumps
 * rather than gliding.
 */

import { prefersReducedMotion } from './reduced-motion.ts';

/** The elements that get drag-to-scroll. */
const TRACKS = '.carousel, .catalog-rail-track, [data-drag-scroll]';

/** CSS px a mouse must move before a press becomes a drag. */
const ACTIVATION_PX = 6;

/** How far a throw carries: the release speed (px/ms) times this many ms. */
const THROW_MS = 180;

/** A pause longer than this (ms) before letting go means no throw. */
const IDLE_MS = 100;

/** A prev/next control pages by this share of the visible width. */
const PAGE_SHARE = 0.8;

/**
 * CSS px a released drag must have moved for the track to settle on the next
 * card in that direction. Without this, `mandatory` snap pulls a slow drag back
 * to the card it started on unless it passed the halfway point — the "you have
 * to drag it really far" feel.
 */
const NUDGE_PX = 24;

/** Longest wait (ms) for a settle glide to finish before snap comes back anyway. */
const SETTLE_MS = 700;

/** A track carries its one-time init flag and its edge updater. */
interface DragScrollElement extends HTMLElement {
	__wgDragInit?: boolean;
	__wgDragEdges?: () => void;
}

/** Which control: back towards the start, or on towards the end. */
type Way = 'prev' | 'next';

/** Live ResizeObserver keeping every track's edges current, recreated per page-load. */
let resizeObserver: ResizeObserver | null = null;

/**
 * Fold one pointer move into a running speed, weighted to the latest moves so
 * the throw follows how the drag ended, not how it began.
 *
 * @param speed The running speed, px/ms.
 * @param dx Pointer movement since the last move, px.
 * @param dt Time since the last move, ms.
 * @returns The new running speed, px/ms.
 */
export function smoothSpeed(speed: number, dx: number, dt: number): number {
	return speed * 0.6 + (dx / Math.max(1, dt)) * 0.4;
}

/**
 * How far to throw a track on release: opposite to the pointer's motion (the
 * content follows the hand), nothing if the hand had already stopped.
 *
 * @param speed The pointer's speed at release, px/ms.
 * @param idle Time between the last move and the release, ms.
 * @returns The scroll distance, px; 0 for no throw.
 */
export function throwDistance(speed: number, idle: number): number {
	if (idle > IDLE_MS) return 0;
	const distance = -speed * THROW_MS;
	return Math.abs(distance) < 1 ? 0 : distance;
}

/**
 * Where a released drag should come to rest: the first snap point beyond the
 * landing spot in the direction of travel, so a drag of a few px is enough to
 * move on one card and a long or thrown drag moves on as far as it went.
 *
 * @param targets The track's snap points, scroll px, ascending.
 * @param from Where the drag started, scroll px.
 * @param landing Where it would land (position at release plus any throw), scroll px.
 * @param nudge Minimum travel before it counts as a move, px.
 * @returns The scroll position to settle on, or null to let the browser's snap decide.
 */
export function settleTarget(targets: number[], from: number, landing: number, nudge = NUDGE_PX): number | null {
	const travel = landing - from;
	if (!targets.length || Math.abs(travel) < nudge) return null;
	if (travel > 0) {
		const ahead = targets.filter((t) => t > from + 1);
		if (!ahead.length) return null;
		return ahead.find((t) => t >= landing - 1) ?? ahead[ahead.length - 1];
	}
	const behind = targets.filter((t) => t < from - 1).reverse();
	if (!behind.length) return null;
	return behind.find((t) => t <= landing + 1) ?? behind[behind.length - 1];
}

/**
 * A track's snap points in scroll px, from its children's `scroll-snap-align`
 * (start / center / end) and the track's `scroll-padding-left`, clamped to the
 * scrollable range. Empty when nothing in it snaps.
 *
 * @param track The track (left-to-right).
 * @returns Snap positions, ascending, de-duplicated.
 */
function snapPoints(track: HTMLElement): number[] {
	const box = track.getBoundingClientRect();
	const max = track.scrollWidth - track.clientWidth;
	const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
	const out = new Set<number>();
	for (const child of Array.from(track.children) as HTMLElement[]) {
		const align = getComputedStyle(child).scrollSnapAlign.split(' ').pop();
		if (!align || align === 'none') continue;
		const r = child.getBoundingClientRect();
		const left = r.left - box.left + track.scrollLeft;
		const pos = align === 'center' ? left + r.width / 2 - track.clientWidth / 2
			: align === 'end' ? left + r.width - track.clientWidth
			: left - pad;
		out.add(Math.round(Math.min(max, Math.max(0, pos))));
	}
	return [...out].sort((a, b) => a - b);
}

/**
 * Whether a track can scroll back and on. Uses the magnitude of `scrollLeft`,
 * which runs negative in right-to-left layouts.
 *
 * @param left The track's `scrollLeft`.
 * @param scrollWidth Its `scrollWidth`.
 * @param clientWidth Its `clientWidth`.
 * @returns `start`: there is more to scroll back to; `end`: more to scroll on to.
 */
export function scrollEdges(
	left: number,
	scrollWidth: number,
	clientWidth: number
): { start: boolean; end: boolean } {
	const at = Math.abs(left);
	return { start: at > 1, end: at < scrollWidth - clientWidth - 1 };
}

/**
 * How far a prev/next control scrolls: most of a screenful, so the last card
 * of one page is still in view at the start of the next.
 *
 * @param clientWidth The track's visible width, px.
 * @param way Back or on.
 * @param rtl The track lays out right to left.
 * @returns The `scrollBy` distance, px.
 */
export function pageDistance(clientWidth: number, way: Way, rtl: boolean): number {
	const direction = (way === 'next' ? 1 : -1) * (rtl ? -1 : 1);
	return direction * clientWidth * PAGE_SHARE;
}

/**
 * Find a track's prev or next controls: any `[data-drag-scroll-<way>]` naming
 * the track's id, plus valueless ones inside the track's parent.
 *
 * @param track The track.
 * @param way Which control.
 * @returns The controls, possibly none.
 */
function controlsFor(track: HTMLElement, way: Way): HTMLElement[] {
	const attr = `data-drag-scroll-${way}`;
	const found = new Set<HTMLElement>();
	track.parentElement
		?.querySelectorAll<HTMLElement>(`[${attr}=""]`)
		.forEach((el) => found.add(el));
	if (track.id) {
		document
			.querySelectorAll<HTMLElement>(`[${attr}]`)
			.forEach((el) => {
				if (el.getAttribute(attr) === track.id) found.add(el);
			});
	}
	return [...found];
}

/**
 * Disable or enable a control: `disabled` on a button, `aria-disabled`
 * on anything else.
 *
 * @param el The control.
 * @param off Disable it.
 */
function setDisabled(el: HTMLElement, off: boolean): void {
	if (el instanceof HTMLButtonElement) el.disabled = off;
	else if (off) el.setAttribute('aria-disabled', 'true');
	else el.removeAttribute('aria-disabled');
}

/**
 * Scroll a track by a distance, gliding unless reduced motion is asked for.
 *
 * @param track The track.
 * @param left The distance, px.
 */
function scrollTrack(track: HTMLElement, left: number): void {
	const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
	if (typeof track.scrollBy === 'function') track.scrollBy({ left, behavior });
	else track.scrollLeft += left;
}

/**
 * Wire one track: mouse dragging with a throw, click suppression after a
 * drag, the edge attributes and its prev/next controls.
 *
 * Presses that land on a link, button or form field are left alone (they keep
 * their clicks) unless inside `[data-drag-scroll-force]`. Touch and pen input
 * scroll natively; only the primary mouse button drags.
 *
 * @param track The track.
 */
function wire(track: DragScrollElement): void {
	track.__wgDragInit = true;

	let startX = 0;
	let startScroll = 0;
	let lastX = 0;
	let lastAt = 0;
	let speed = 0;
	let dragging = false;
	let activated = false;
	let swallow = false;
	const prev = controlsFor(track, 'prev');
	const next = controlsFor(track, 'next');

	track.style.cursor = 'grab';

	/** Mark the ends on the track and its controls. */
	const edges = (): void => {
		const { start, end } = scrollEdges(track.scrollLeft, track.scrollWidth, track.clientWidth);
		track.toggleAttribute('data-start', start);
		track.toggleAttribute('data-end', end);
		prev.forEach((el) => setDisabled(el, !start));
		next.forEach((el) => setDisabled(el, !end));
	};
	track.__wgDragEdges = edges;

	/**
	 * Page the track back or on.
	 *
	 * @param way Which way.
	 */
	const page = (way: Way): void => {
		const rtl = getComputedStyle(track).direction === 'rtl';
		scrollTrack(track, pageDistance(track.clientWidth, way, rtl));
	};

	/**
	 * Note a primary-button mouse press that could become a drag.
	 *
	 * @param e The press.
	 */
	const down = (e: PointerEvent): void => {
		swallow = false;
		if (e.pointerType !== 'mouse' || e.button !== 0) return;
		const eventTarget = e.target as HTMLElement;
		const isInteractive = eventTarget.closest(
			'a, button, input, select, textarea, [role="button"]'
		);
		if (isInteractive && !eventTarget.closest('[data-drag-scroll-force]')) return;
		dragging = true;
		activated = false;
		startX = lastX = e.clientX;
		lastAt = e.timeStamp;
		speed = 0;
		startScroll = track.scrollLeft;
	};

	/**
	 * Drag the track with the mouse once it has moved far enough, tracking
	 * its speed for the throw.
	 *
	 * @param e The move.
	 */
	const move = (e: PointerEvent): void => {
		if (!dragging) return;
		const dx = e.clientX - startX;
		if (!activated) {
			if (Math.abs(dx) < ACTIVATION_PX) return;
			activated = true;
			track.style.cursor = 'grabbing';
			document.body.style.userSelect = 'none';
			/* Suspend scroll-snap during the drag. `mandatory` snap fights
			 * programmatic scrollLeft updates — the browser keeps yanking back
			 * to the nearest snap point so the drag feels frozen. It comes back
			 * on release, before the throw, so the throw lands on a snap point. */
			track.style.scrollSnapType = 'none';
			try {
				track.setPointerCapture?.(e.pointerId);
			} catch (_) {}
		}
		speed = smoothSpeed(speed, e.clientX - lastX, e.timeStamp - lastAt);
		lastX = e.clientX;
		lastAt = e.timeStamp;
		track.scrollLeft = startScroll - dx;
	};

	/**
	 * Let go: restore the track, throw it on if it was moving, and arm the
	 * click suppression if a drag actually happened.
	 *
	 * @param e The release, cancel or leave.
	 */
	const endDrag = (e: PointerEvent): void => {
		if (!dragging) return;
		const wasActivated = activated;
		dragging = false;
		activated = false;
		track.style.cursor = 'grab';
		document.body.style.userSelect = '';
		if (!wasActivated) track.style.scrollSnapType = '';
		if (e.pointerId != null) {
			try {
				track.releasePointerCapture?.(e.pointerId);
			} catch (_) {}
		}
		if (!wasActivated) return;
		/* Swallow the click that follows this release, so a tap on a card
		 * still navigates but a drag doesn't. It fires in the same task, so
		 * the flag is dropped on the next one in case no click comes. */
		swallow = true;
		setTimeout(() => {
			swallow = false;
		}, 0);
		const thrown = prefersReducedMotion() ? 0 : throwDistance(speed, e.timeStamp - lastAt);
		const rtl = getComputedStyle(track).direction === 'rtl';
		const target = rtl ? null : settleTarget(snapPoints(track), startScroll, track.scrollLeft + thrown);
		if (target === null) {
			track.style.scrollSnapType = '';
			if (thrown) scrollTrack(track, thrown);
			return;
		}
		/* Glide to the next card in the drag's direction with snap still off
		 * (snap would pull it back), then hand snap back once it arrives. */
		const restore = (): void => {
			track.style.scrollSnapType = '';
			track.removeEventListener('scrollend', restore);
		};
		track.addEventListener('scrollend', restore);
		setTimeout(restore, SETTLE_MS);
		const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
		if (typeof track.scrollTo === 'function') track.scrollTo({ left: target, behavior });
		else track.scrollLeft = target;
	};

	/**
	 * Swallow the click that ends a drag, before any card or link sees it.
	 *
	 * @param e The click.
	 */
	const swallowClick = (e: MouseEvent): void => {
		if (!swallow) return;
		swallow = false;
		e.stopPropagation();
		e.preventDefault();
	};

	/**
	 * Stop an image or forced link inside starting a native drag-and-drop
	 * mid-gesture, which would cancel the pointer stream.
	 *
	 * @param e The native drag.
	 */
	const nativeDrag = (e: DragEvent): void => {
		if (dragging) e.preventDefault();
	};

	/** Page back. */
	const back = (): void => page('prev');
	/** Page on. */
	const on = (): void => page('next');

	track.addEventListener('pointerdown', down);
	track.addEventListener('pointermove', move);
	track.addEventListener('pointerup', endDrag);
	track.addEventListener('pointercancel', endDrag);
	track.addEventListener('pointerleave', endDrag);
	track.addEventListener('click', swallowClick, true);
	track.addEventListener('dragstart', nativeDrag);
	track.addEventListener('scroll', edges, { passive: true });
	prev.forEach((el) => el.addEventListener('click', back));
	next.forEach((el) => el.addEventListener('click', on));
	edges();
}

/**
 * Watch every track's size so its edges stay right as it is resized (the
 * viewport changing, a sidebar opening); scrolling is caught by its own
 * listener. One observer for the page, replaced on each page-load so
 * tracks from earlier pages are let go.
 *
 * @param tracks The tracks on the page.
 */
function watchSizes(tracks: NodeListOf<DragScrollElement>): void {
	if (resizeObserver) resizeObserver.disconnect();
	resizeObserver = null;
	if (typeof ResizeObserver === 'undefined') return;
	const observer = new ResizeObserver((entries) => {
		entries.forEach((entry) => (entry.target as DragScrollElement).__wgDragEdges?.());
	});
	tracks.forEach((track) => observer.observe(track));
	resizeObserver = observer;
}

/**
 * (Re)bind drag-scroll on the current page. Safe to call repeatedly: each
 * track is wired once, guarded by `__wgDragInit`.
 */
export function initDragScroll(): void {
	const tracks = document.querySelectorAll<DragScrollElement>(TRACKS);
	tracks.forEach((track) => {
		if (!track.__wgDragInit) wire(track);
	});
	watchSizes(tracks);
}
