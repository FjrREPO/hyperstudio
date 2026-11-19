# Changelog

Notable changes, newest first. Versions follow [Semantic Versioning](https://semver.org).

## Unreleased

### Added

- `@hyperstudio/studio`: the whole engine behind one API (workspace, compile outcomes, review, background render jobs, assets, audio).
- `@hyperstudio/mcp`: an MCP server on the official SDK with tools, resources, prompts and server instructions; STDIO, and Streamable HTTP with a required token.
- `@hyperstudio/api`: a versioned REST API generated from a route table, with an OpenAPI document, API key, rate limit and idempotent render starts.
- `@hyperstudio/sdk`: a TypeScript client with the same methods against the local engine or a remote API.
- Skill `hyperstudio-review`; project `.mcp.json`; `.env.example`.
- `@hyperstudio/audio` and `hyperstudio audio`: voiceover from local files or a system draft voice, and an optional ElevenLabs client that reads the plan first (Free plan inside its credits and marked non-commercial, paid plan confirmed, never upgraded, never generated twice); dubbing; `inspect`; `status`.
- Audio in the IR: `role` and `scene`, so narration follows the shot it belongs to; overlapping voice clips are rejected.
- `@hyperstudio/assets` and `hyperstudio assets`: search free sources (Openverse, Poly Haven, optional Pixabay) through refkit, a strict licence gate for commercial film use, a 24-hour cache and request log, downloads recorded in `LICENSES.json`, and credits owed reported by `compile`.

## 0.2.0 - 2026-11-19

The creative quality overhaul. The first recipes produced slideshows; this release replaces them.

### Added

- Creative direction in the IR: required `direction`, `brand`, per-scene `purpose`, `screens` with named regions, asset `origin`, `sources`.
- Art-direction rules in the compiler: brand variables only in `style`, no repeated shot, copy length limits, sourced statistics, real regions; warnings for slow pacing and a fade into the first scene; every placeholder listed.
- One stage per film, drawn by the compiler; `STORYBOARD.md` written with every project.
- Shot recipes `product-shot`, `statement` and `brand-close`.
- Stage `light: aurora` with an optional `glow` colour: drifting glows, a vignette and grain behind every shot.
- `product-shot`: perspective `up` and `desk`, stronger `left` and `right`, and `focus` for a shallow depth of field.
- Recipe `scatter`: the problem before the product, as notes that arrive scattered and are swept away.
- Live screens: a screen can be the product's own HTML (`screens.*.html`), driven by a scene's `beats`
  (camera, cursor, click, type, state, reveal, draw, highlight). New recipe `product-take` plays one
  continuous take of it.
- Takes can carry the whole film: `say` sets the film's lines in the frame beside the product, camera beats
  can turn, pull focus and move the product to one side, `count` counts a figure up, `veil` resolves the
  interface into its own mark. Loading and result are one element in the page (`data-leave`, `data-shimmer`).
- `hyperstudio compare <a.json> <b.json>`: where two films made the same choice, decision by decision.
- A third benchmark, Relay: a dark, type-free film of a deploy tool on a wide lens. One input can be
  typed into more than once in a take.
- A local voice with no key: Kokoro (Apache 2.0) through `hyperstudio audio setup kokoro` and
  `audio tts`; it is the default voice once set up. Both benchmark films are narrated with it.
- Benchmarks frozen as tags `lumen-benchmark-v1` and `marlow-benchmark-v1`, described in `docs/BENCHMARKS.md`.
- The Lumen film has a music bed: an openly licensed track downloaded through the asset engine, credited in
  `LICENSES.json` and by `compile`.
- A second live benchmark, `examples/marlow-launch-film`: a different product, structure, composition, type
  and ending, made with the same recipe. New: a caption `band` along the bottom for lines, `level: top`.
- A veil opened on the whole interface can close down onto one part like an iris.
- A take audits itself: a line outside the safe area, a line on top of the interface, and a camera move that
  crops its subject are reported as warnings in `hyperframes check`. Lines no longer show cut letters while
  entering or leaving; `level: bleed`; generated scenes are folded onto fewer lines.
- The benchmark is a 30-second film: the old way as a live page of its own, a reveal through the question
  bar, the answer filed to a board, and a follow-up question. New beat `scroll`; a film can use several live
  pages.
- Two directions that differ in composition, not colour: `say` takes corner placements and a `display` size
  with masked line reveals; camera beats take `level` and `zoom`; `veil` can open as well as close, so a
  product can be introduced through one element; `lens: wide` for an interface seen as an object in space.
- Generated scene files drop comments and blank lines.
- The HyperFrames release is pinned (0.9.69) wherever HyperStudio launches it.
- `hyperstudio review --motion`: a draft render, the share of still frames, the longest freeze, and one strip
  per shot at eight frames a second.
- The compiler warns when nothing starts in a take for more than 1.5 s.
- The benchmark is now one product in two art directions: `video.json` (plain light stage, one unbroken
  take) and `video-dark.json` (black stage, angled, shallow focus).
- A second example film, `examples/meeting-notes-launch`: a different product on a warm editorial stage with a serif voice.
- The benchmark film is re-cut on a dark aurora stage with a problem opening, and its example product has a redesigned interface.
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
