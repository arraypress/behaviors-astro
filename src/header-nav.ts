/**
 * @module header-nav
 *
 * Header mega-menu / dropdown runtime for the primary nav row
 * (Classic / Centered / Split header variants).
 *
 * Behaviour:
 *   - Hover or keyboard-focus over a trigger → its panel opens.
 *   - Click the trigger → the panel "locks" open (stays after the
 *     pointer leaves) for touch + keyboard users; clicking again closes.
 *   - Outside click, Esc, or hovering away from a non-locked dropdown
 *     closes it. Only one dropdown is open at a time.
 *   - The caret rotation is handled in CSS off `aria-expanded`.
 *
 * DOM contract (data-* attributes emitted by HeaderNav.astro):
 *   - `[data-header-nav]`        — the nav wrapper; outside-click is
 *                                  anything NOT inside this element.
 *   - `[data-nav-dropdown]`      — each dropdown wrapper; owns the
 *                                  hover/focus listeners so moving from
 *                                  trigger to panel doesn't drop state.
 *   - `[data-dropdown-trigger]`  — the trigger anchor; carries
 *                                  `aria-controls` (panel id) and
 *                                  `aria-expanded` (open state).
 *   - `[data-dropdown-panel]`    — the panel; opened via `data-open`.
 *
 * This is a side-effecting init module — it exports nothing. It is
 * bundled (so its body runs exactly once) and re-binds on every Astro
 * View-Transition navigation via the `astro:page-load` event. A
 * per-wrapper `dataset` flag keeps re-init idempotent.
 */

const HOVER_CLOSE_DELAY = 180;

/** Module-scoped runtime state, shared across (re)inits. */
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let lockedTrigger: HTMLElement | null = null;

/** Close a single dropdown, given its trigger element. */
function close(trigger: HTMLElement): void {
	trigger.setAttribute('aria-expanded', 'false');
	const panelId = trigger.getAttribute('aria-controls');
	const panel = panelId ? document.getElementById(panelId) : null;
	if (panel) panel.dataset.open = 'false';
	if (lockedTrigger === trigger) lockedTrigger = null;
}

/** Close every open dropdown except an optional one to keep open. */
function closeAll(except: HTMLElement | null): void {
	document
		.querySelectorAll<HTMLElement>('[data-dropdown-trigger][aria-expanded="true"]')
		.forEach((t) => {
			if (t !== except) close(t);
		});
}

/** Open a dropdown, closing any others first. */
function open(trigger: HTMLElement): void {
	if (closeTimer) {
		clearTimeout(closeTimer);
		closeTimer = null;
	}
	closeAll(trigger);
	trigger.setAttribute('aria-expanded', 'true');
	const panelId = trigger.getAttribute('aria-controls');
	const panel = panelId ? document.getElementById(panelId) : null;
	if (panel) panel.dataset.open = 'true';
}

/**
 * Bind hover/focus listeners to each dropdown wrapper and (once) the
 * document-level click/keydown handlers.
 *
 * Safe to call repeatedly: each wrapper carries a `dataset.navBound`
 * flag so its listeners are attached only once, and the global
 * document handlers are guarded by a module-level flag.
 */
function init(): void {
	/* Hover handlers — only on the wrapper, so moving from trigger to
	 * panel doesn't drop the open state. Uses `mouseenter` /
	 * `mouseleave` (no bubbling) for precise scope. */
	document.querySelectorAll<HTMLElement>('[data-nav-dropdown]').forEach((wrap) => {
		if (wrap.dataset.navBound === 'true') return;
		const trigger = wrap.querySelector<HTMLElement>('[data-dropdown-trigger]');
		if (!trigger) return;
		wrap.dataset.navBound = 'true';

		wrap.addEventListener('mouseenter', () => {
			if (closeTimer) {
				clearTimeout(closeTimer);
				closeTimer = null;
			}
			open(trigger);
		});
		wrap.addEventListener('mouseleave', () => {
			if (lockedTrigger === trigger) return;
			closeTimer = setTimeout(() => close(trigger), HOVER_CLOSE_DELAY);
		});
		/* Keyboard focus — open on focus-in, close on focus-out
		 * (unless focus moved INSIDE the same wrapper). */
		wrap.addEventListener('focusin', () => open(trigger));
		wrap.addEventListener('focusout', (e: FocusEvent) => {
			if (wrap.contains(e.relatedTarget as Node | null)) return;
			close(trigger);
		});
	});

	bindDocumentHandlers();
}

let documentBound = false;

/** Document-level click + keydown handlers — bound once per page. */
function bindDocumentHandlers(): void {
	if (documentBound) return;
	documentBound = true;

	/* Click handler — "locks" the dropdown open so it stays after the
	 * pointer leaves. Useful for touch + keyboard. Clicking again
	 * closes it. */
	document.addEventListener('click', (e: MouseEvent) => {
		const target = e.target as HTMLElement | null;
		const trigger = target?.closest<HTMLElement>('[data-dropdown-trigger]') ?? null;
		if (trigger) {
			e.preventDefault();
			const wasLocked = lockedTrigger === trigger;
			if (wasLocked) {
				close(trigger);
			} else {
				open(trigger);
				lockedTrigger = trigger;
			}
			return;
		}
		/* Outside click — close any open dropdown. */
		if (!target?.closest('[data-header-nav]')) closeAll(null);
	});

	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape') closeAll(null);
	});
}

/* Re-bind wrapper listeners on every Astro View-Transition navigation
 * (the nav row is re-rendered on swap; `document` persists). */
document.addEventListener('astro:page-load', init);

/* Bundled module body runs once — run init immediately too, guarding
 * on readyState so we don't bind before the nav markup exists. */
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
	init();
}

export {};
