# Changelog

All notable changes to `@arraypress/behaviors-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] — 2026-10-21

Backwards compatible for icon-only wishlist toggles: their `aria-label`,
`aria-pressed` and `.is-active` are exactly 1.1's.

### Added

- `data-wishlist-label-add` / `data-wishlist-label-remove` on an icon-only
  wishlist toggle set its `aria-label` for each state, for translation or
  wording. Without them the labels are 1.1's, "Add to wishlist" and "Remove
  from wishlist".

### Changed

- A wishlist toggle with text of its own ("Save" / "Saved") no longer gets an
  `aria-label`, and any `aria-label` already on it is removed, so the visible
  text is its accessible name. Its state stays on `aria-pressed`. Text inside
  an `aria-hidden="true"` or `hidden` element doesn't count as its own.

### Fixed

- WCAG 2.5.3 (label in name): the module overwrote every toggle's
  `aria-label` with "Add to wishlist" / "Remove from wishlist", so a button
  that read "Save" was announced as something else and a speech-input user
  saying "click Save" could not reach it (axe `label-content-name-mismatch`).

## [1.1.0] — 2026-10-15

Backwards compatible: every 1.0 selector, attribute and output is unchanged.
`page-behaviors` is now split into `count-up.ts` and `drag-scroll.ts`, which it
imports; the import path stays `@arraypress/behaviors-astro/page-behaviors`.

### Added

- Count-up formats the reader's way through `Intl.NumberFormat` when given any
  of `data-currency` (ISO 4217), `data-decimals`, `data-compact` or
  `data-locale` (default the page's `lang`). Without them the output is
  exactly 1.0's. A malformed currency or locale falls back to that format.
- Count-up glides to a new value whenever `data-target` changes after the first
  count (a MutationObserver), picking up mid-count if one is running — so a
  calculator or price toggle can drive it.
- Drag-scroll throws the track on by the drag's speed on release; scroll-snap is
  restored first, so the throw lands on a snap point.
- Drag-scroll writes `data-start` / `data-end` on the track while it can scroll
  back / on, as hooks for edge fades the site styles itself.
- Optional prev/next controls, `[data-drag-scroll-prev]` and
  `[data-drag-scroll-next]`: valueless inside the track's parent, or naming the
  track's `id` from anywhere. They page by 80% of the visible width and are
  disabled at the ends (`disabled`, or `aria-disabled` on non-buttons).

### Changed

- prefers-reduced-motion is respected: count-up shows its value at once, and
  drag-scroll skips the throw and jumps rather than glides when paging.
- Only the primary mouse button starts a drag.
- A native image or link drag no longer cancels a drag-scroll mid-gesture.
- Count-up counts every element at once where IntersectionObserver is missing,
  rather than throwing.

### Fixed

- The click suppression after a drag could linger when no click followed (a
  drag released outside the track) and swallow the next genuine click. It now
  lasts only for the click that ends the drag.

## [1.0.0] — 2026-08-19

### Added

- Seven behaviour modules extracted from the storefront themes, where they were
  maintained as byte-identical copies in four repos: `brand-colors`,
  `card-actions`, `header-nav`, `modal`, `page-behaviors`, `product-gallery`
  and `upsell-modal`.

  Each is a side-effect import that binds its own listeners and re-binds on
  `astro:page-load`, so behaviour survives view transitions. Behaviour only —
  the styling stays in the theme.
