# Changelog

All notable changes to `@arraypress/behaviors-astro` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — Unreleased

### Added

- Seven behaviour modules extracted from the storefront themes, where they were
  maintained as byte-identical copies in four repos: `brand-colors`,
  `card-actions`, `header-nav`, `modal`, `page-behaviors`, `product-gallery`
  and `upsell-modal`.

  Each is a side-effect import that binds its own listeners and re-binds on
  `astro:page-load`, so behaviour survives view transitions. Behaviour only —
  the styling stays in the theme.
