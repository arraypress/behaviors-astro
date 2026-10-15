# @arraypress/behaviors-astro

> Client-side behaviour modules for Astro storefronts — wishlist, header nav, modals, product gallery, count-up and drag-scroll. View-transition safe, zero dependencies, no styling opinions.

Each module is a self-contained side-effect import. It binds its own listeners,
re-binds on `astro:page-load` so behaviour survives view transitions, and runs
immediately if the document is already interactive. There is nothing to call and
nothing to configure.

**They ship behaviour, not design.** Every module works against `data-` hooks
and class names; the styling stays in your theme. Same contract as
`@arraypress/toast-astro`.

## Install

```bash
npm install @arraypress/behaviors-astro
```

## Usage

Import the ones you need from a `<script>` in your layout:

```astro
---
// src/layouts/Layout.astro
---
<script>
  import '@arraypress/behaviors-astro/header-nav';
  import '@arraypress/behaviors-astro/page-behaviors';
  import '@arraypress/behaviors-astro/modal';
</script>
```

MDX can't host a processed `<script>` in its body — its compiler treats the
children as JSX. Wrap the import in a tiny `.astro` component and render that
from the page instead.

## Modules

| Import | What it binds |
|---|---|
| `…/header-nav` | Mega-menu / dropdown runtime for the primary nav row (Classic, Centered and Split header variants). |
| `…/page-behaviors` | Cross-cutting page behaviour: count-up on `.count-up[data-target]` via IntersectionObserver, and drag-to-scroll on horizontal carousels. See [Count-up](#count-up) and [Drag-to-scroll](#drag-to-scroll). |
| `…/modal` | Generic open/close wiring for native `<dialog>` modals, via a single delegated click handler. |
| `…/card-actions` | Wishlist toggle on `[data-wishlist-toggle]`, plus recently-viewed tracking. Fires a toast if `window.toast` exists. |
| `…/product-gallery` | Product detail gallery — thumbnail swap plus a native-`<dialog>` lightbox. |
| `…/upsell-modal` | One-step upsell prompt, triggered from a Buy button and remembered in `localStorage`. |
| `…/brand-colors` | Copy-hex-to-clipboard on a brand-colour swatch grid. |

### Count-up

Any `.count-up` element counts from 0 to its `data-target` as it scrolls into
view, easing out to land. Render the final number in the markup too, so it
reads right without JavaScript.

```html
<span class="count-up" data-target="12500" data-format="comma">12,500</span>
<span class="count-up" data-target="1240" data-currency="GBP">£1,240.00</span>
<span class="count-up" data-target="2500000" data-compact data-suffix="+">2.5M+</span>
```

| Attribute | Value | |
|---|---|---|
| `data-target` | number | **Required.** The value it lands on. Change it after the first count and the number glides from where it is to the new value — set it from a calculator or a price toggle. |
| `data-suffix` | string | Appended after the number (`%`, `+`, `k`). |
| `data-format` | `comma` \| `plain` | Classic mode: `comma` groups thousands in the browser's locale; default plain. Intl mode: thousands are grouped unless `plain`. |
| `data-currency` | ISO 4217 code | Write it as money (`GBP`, `USD`), with the currency's own decimals. *1.1* |
| `data-decimals` | 0–20 | Fixed decimal places. Without it a plain number keeps as many as `data-target` is written with, so `4.80` counts as `0.00` … `4.80`. *1.1* |
| `data-compact` | present, or `false` | Short form: 1.2K, 3.4M. *1.1* |
| `data-locale` | BCP 47 tag | The language to write it in. Default the page's `<html lang>`, else the browser's. *1.1* |
| `data-counted` | `1` | Written by the module once an element has counted, so a view transition never replays it. |

**Two formatting modes.** Without any of `data-currency`, `data-decimals`,
`data-compact` or `data-locale`, an element formats exactly as in 1.0: whole
numbers from 100 up, one decimal below, grouping only with
`data-format="comma"`. Any of those four switches it to `Intl.NumberFormat`.
A malformed currency or locale falls back to the classic format rather than
breaking the page.

With `prefers-reduced-motion: reduce` the number changes to its value at once,
on arrival and on every later change.

### Drag-to-scroll

Every `.carousel`, `.catalog-rail-track` and `[data-drag-scroll]` element
scrolls natively (touch, trackpad, keyboard, scroll-snap) and can also be
dragged with a mouse. On release it is thrown on by the drag's speed, then the
browser's scroll-snap settles it. The click that ends a drag is swallowed, so
dragging across a card doesn't open it; a plain tap still does.

```html
<section>
  <h2>New releases</h2>
  <button type="button" data-drag-scroll-prev aria-label="Previous">‹</button>
  <button type="button" data-drag-scroll-next aria-label="Next">›</button>
  <div class="catalog-rail-track">…cards…</div>
</section>
```

| Attribute | On | |
|---|---|---|
| `data-drag-scroll` | the track | Opts any element in, beside the two class names. |
| `data-drag-scroll-force` | a link or button in the track, or an element around it | Presses there start a drag too. Otherwise links, buttons and form fields are left alone so their clicks work. |
| `data-start` | the track (written) | Present while it can scroll back towards the start. *1.1* |
| `data-end` | the track (written) | Present while it can scroll on towards the end. *1.1* |
| `data-drag-scroll-prev` / `data-drag-scroll-next` | a control | Pages the track back / on by 80% of its visible width, and is disabled at that end (`disabled` on a `<button>`, `aria-disabled="true"` on anything else). Leave the value empty to control the track in the same parent, or set it to the track's `id` to place the control anywhere. *1.1* |

The edge attributes are hooks, not styles — fade the edges in your theme:

```css
.catalog-rail-track {
  mask-image: linear-gradient(90deg, transparent, #000 var(--from, 0px),
    #000 calc(100% - var(--to, 0px)), transparent);
}
.catalog-rail-track[data-start] { --from: 3rem; }
.catalog-rail-track[data-end] { --to: 3rem; }
```

Only the primary mouse button drags; touch and pens keep the browser's own
scrolling. With `prefers-reduced-motion: reduce` there is no throw and the
prev/next controls jump instead of gliding. Right-to-left tracks are handled.

### Soft dependency on toast

`card-actions` calls `window.toast()` when a wishlist toggle succeeds, and
skips it when the global is absent. Mount
[`@arraypress/toast-astro`](https://github.com/arraypress/toast-astro) if you
want those confirmations; nothing breaks without it.

### localStorage keys

`card-actions` and `upsell-modal` persist under `wg-` prefixed keys —
`wg-wishlist`, `wg-recently-viewed`, `wg-upsell-modal`. The prefix is
historical and shared by every theme these were extracted from, so it is kept
exactly as-is: changing it would orphan the wishlists of anyone already using
them.

If you run two of these sites on one origin, be aware they share that storage.

## Why these and not others

These seven modules were byte-identical across four themes — the same 928 lines
maintained in four places. Everything else in those themes had already diverged,
often for good reason, so it stayed put.

The cost of that duplication wasn't the copying, it was the drift: a keyboard
accessibility fix landing in one theme and never reaching its siblings. Sharing
the behaviour makes that a single fix.

## Tests

```bash
npm test
```

123 tests across the seven modules and their pure helpers (number formatting,
the drag-scroll throw, edge and paging maths), run under jsdom with
`node --test`.

Three things the harness has to supply, because jsdom lacks them and the
modules genuinely depend on them: `IntersectionObserver` (count-up),
`HTMLDialogElement.showModal()` (the modals and the gallery lightbox) and
`matchMedia` (reduced motion, switchable per test). The stubs are deliberately
minimal, so a test cannot pass because a stub was more generous than a
browser. jsdom has no layout either, so the drag-scroll tests give a track its
widths and record `scrollBy` calls.

It also owns the animation clock. jsdom's `requestAnimationFrame` timestamps
run on a different origin from its `performance.now()` — measurably negative
against it — so the count-up would compute a negative elapsed time and render
negative numbers. The harness serves both readings from one clock.

## License

MIT
