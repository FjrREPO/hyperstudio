# Changelog

Notable changes, newest first. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

### Added

- `@hyperstudio/assets` and `hyperstudio assets`: search free sources (Openverse, Poly Haven, optional Pixabay) through refkit, a strict licence gate for commercial film use, a 24-hour cache and request log, downloads recorded in `LICENSES.json`, and credits owed reported by `compile`.

## 0.2.0 - 2026-11-19

The creative quality overhaul. The first recipes produced slideshows; this release replaces them.

### Added

- Creative direction in the IR: required `direction`, `brand`, per-scene `purpose`, `screens` with named regions, asset `origin`, `sources`.
- Art-direction rules in the compiler: brand variables only in `style`, no repeated shot, copy length limits, sourced statistics, real regions; warnings for slow pacing and a fade into the first scene; every placeholder listed.
- One stage per film, drawn by the compiler; `STORYBOARD.md` written with every project.
- Shot recipes `product-shot`, `statement` and `brand-close`.
- `hyperstudio review`: `hyperframes check`, frames from every shot, and a `REVIEW.md` rubric.
- CLI: readable output by default, `--json`, `recipes <name>`, `--version`, exit code 2 for usage errors.
- Example `saas-product-showcase`: a 15-second, nine-shot benchmark with its product built as real HTML.
- Repository essentials: licence, CI, issue forms, pull request template, automatic area labels.

### Changed

- The compiler is split into `compile`, `recipes`, `values`, `emit` and `errors` modules.
- `luxury-product-reveal` sits on the shared stage and uses the shared brand variables.
- Dependencies updated (TypeScript 7, Biome 2.6, Zod 4.6, pnpm 12).

### Removed

- Recipes `kinetic-typography`, `tech-product-launch` and `data-storytelling`, and the six examples built from them.

## 0.1.0 - 2026-11-19

### Added

- Creative IR schema (`@hyperstudio/ir`).
- Deterministic compiler from Creative IR to a HyperFrames project (`@hyperstudio/compiler`).
- `hyperstudio compile` and `hyperstudio recipes` commands.
- Recipe `luxury-product-reveal`.
- Example `luxury-watch-commercial`, verified from IR to rendered MP4.
- Claude Code skill `hyperstudio-director`.
- Unit, integration and regression tests; Biome and Husky.
