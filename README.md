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
| `…/page-behaviors` | Cross-cutting page behaviour: count-up on `.count-up[data-target]` via IntersectionObserver, and drag-to-scroll on horizontal carousels. |
| `…/modal` | Generic open/close wiring for native `<dialog>` modals, via a single delegated click handler. |
| `…/card-actions` | Wishlist toggle on `[data-wishlist-toggle]`, plus recently-viewed tracking. Fires a toast if `window.toast` exists. |
| `…/product-gallery` | Product detail gallery — thumbnail swap plus a native-`<dialog>` lightbox. |
| `…/upsell-modal` | One-step upsell prompt, triggered from a Buy button and remembered in `localStorage`. |
| `…/brand-colors` | Copy-hex-to-clipboard on a brand-colour swatch grid. |

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

69 tests across the seven modules, run under jsdom with `node --test`.

Two things the harness has to supply, because jsdom lacks them and the modules
genuinely depend on them: `IntersectionObserver` (count-up) and
`HTMLDialogElement.showModal()` (the modals and the gallery lightbox). Both
stubs are deliberately minimal, so a test cannot pass because the stub was more
generous than a browser.

It also owns the animation clock. jsdom's `requestAnimationFrame` timestamps
run on a different origin from its `performance.now()` — measurably negative
against it — so the count-up would compute a negative elapsed time and render
negative numbers. The harness serves both readings from one clock.

## License

MIT
