# HyperFrames research (Phase 1)

Verified 2026-11-19 against `heygen-com/hyperframes` @ `1cf98cf` (v0.9.69, Apache-2.0), its `docs/` folder,
the installed skills, and a local `npx hyperframes doctor` / `catalog` run. Nothing here is from memory.
Items marked **unverified** were not checked and must be before they are relied on.

## 1. What HyperFrames is

HTML is the composition format. A render never plays the page: for each frame it computes
`t = floor(frame) / fps`, seeks every registered animation to `t`, captures with Chrome's
`HeadlessExperimental.beginFrame`, and FFmpeg encodes and mixes audio. Same input, same pixels.

## 2. Packages (all published at 0.9.69)

| Package                                                   | Role                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hyperframes` / `@hyperframes/cli`                        | CLI: init, capture, lint, check, snapshot, timeline edits, catalog/add, preview, render, cloud/lambda/cloudrun, tts, transcribe, beats, media-treatment      |
| `@hyperframes/sdk`                                        | Headless composition editing: query, typed mutations, `dispatch()` data-shaped ops, `can()`, batch, undo/redo, JSON patches, fs/memory persistence           |
| `@hyperframes/core`                                       | Parse/generate HTML, variables, project compile, static contract check, `FrameAdapter` (experimental v0), storyboard parser (`@hyperframes/core/storyboard`) |
| `@hyperframes/producer`                                   | Node render API: `createRenderJob()` / `executeRenderJob(job, dir, out, onProgress)`; mp4, webm, mov (ProRes 4444), gif, png-sequence, hls; HDR              |
| `@hyperframes/engine`                                     | Seekable page → frames (Puppeteer + FFmpeg)                                                                                                                  |
| `@hyperframes/lint`, `parsers`, `inspector`               | Static rules, HTML parsing, inspection                                                                                                                       |
| `@hyperframes/shader-transitions`                         | WebGL shader transitions                                                                                                                                     |
| `@hyperframes/player`, `studio`, `studio-server`, `share` | Embeddable player, browser editor, sharing                                                                                                                   |
| `@hyperframes/aws-lambda`, `gcp-cloud-run`                | Distributed rendering                                                                                                                                        |

Requires Node ≥ 22 and FFmpeg. The upstream repo builds with bun 1.4.4; consumers only need npm packages.

## 3. Composition format (the contract)

- `index.html` is the root composition; one scene per sub-composition in `compositions/`, mounted with
  `data-composition-src` + `data-composition-id` (host id = scene root id = timeline key).
- Timed elements: `class="clip"`, `data-start`, `data-duration` in **seconds**; visible over `[start, start+duration)`.
  `data-start="intro + 0.5"` gives relative sequencing. Video length = root `data-duration`.
- Each composition builds one paused GSAP timeline and registers it: `window.__timelines["<id>"] = tl`.
- Determinism rules: no `Date.now()`, unseeded `Math.random()`, timers, mid-render fetch, or `repeat: -1`.
- Scene files wrap styles/markup/script in `<template>`; asset paths are `assets/...`.
- Variables: `data-composition-variables` (string, number, color, boolean, enum, font, image — seven kinds),
  bound with `data-var-text`, `data-var-src`, `var(--id)`; per-mount values via `data-variable-values`.
- Audio: `<audio id>` with `data-volume`, `data-fade-in`, `data-fade-out`, `data-automation` envelopes;
  `<video data-has-audio="true">`. FFmpeg does the mix.

## 4. Animation runtimes it seeks natively

GSAP (primary), CSS `@keyframes`, WAAPI, Lottie/dotLottie, anime.js v4, Three.js / WebGPU / p5 / canvas
(via an `hf-seek` listener drawing from `e.detail.time`), TypeGPU. Custom hosts implement `FrameAdapter`
(`init` → `seekFrame` × N → `destroy`).

## 5. SDK edit operations (`@hyperframes/sdk`)

Element: `setStyle`, `setText`, `setAttribute`, `setTiming`, `setHold`, `moveElement`, `removeElement`.
Structure: `addElement`, `reorderElements`, `setClassStyle`, `deleteAllForSelector`, `setCompositionMetadata`.
Variables: `setVariableValue`, `declareVariable`, `removeVariable`.
GSAP: `addGsapTween` (method, position, duration, ease, from/to props, repeat, yoyo, stagger), `setGsapTween`,
`removeGsapTween`, `removeGsapProperty`, plus nine keyframe ops.
Typed error codes (`E_TARGET_NOT_FOUND`, `E_NO_GSAP_TIMELINE`, …).

## 6. Registry

456 items: 210 blocks (scenes with their own timeline), 238 components (snippets), 8 examples.
Each item is `registry-item.json` (name, tags, family, typed `variables` with defaults/options/descriptions)

- HTML + demo. Installed as editable source with `hyperframes add <name> [--vars '{…}']`; searched with
  `hyperframes catalog --query … --json`. `hyperframes.json#registry` is a URL field, so a project can point
  at another registry — **unverified**: auth/private-registry behaviour.

Already covered (names from `registry.json`):

- Camera: `camera-dolly-zoom`, `push-in`, `pull-back-reveal`, `frost-sequence-camera-orbit`, `camera-rig-depth-stack`,
  `parallax-zoom`, `parallax-unzoom`, `parallax-device-dive`, `camera-shake`, `cursor-zoom-follow`, `ui-focus-zoom`
- Transitions: `cinematic-zoom`, `zoom-through-transition`, `directional-wipe`, `transitions-blur`, `glitch`, `light-leak`,
  `svg-mask-reveal`, `iris-reveal`, `cross-warp-morph`, `morph-swap`, `chromatic-radial-split`, shader transitions
- Effects: `grain-overlay`, `grain-field`, `vignette`, `godrays`, `motion-blur`, `vfx-anamorphic-flare`,
  `chromatic-aberration-wipe`, `aurora`, particle items
- Typography: `typewriter`, `kinetic-type-swap`, `kinetic-center-build`, `bottom-up-letters`, `scramble-reveal`,
  `morph-text`, `rgb-glitch-text`, caption styles
- Examples: `product-promo`, `kinetic-type`, `nyt-graph`, `warm-grain`, `swiss-grid`, `vignelli`, `decision-tree`, `play-mode`

## 7. Agent surface that already exists

- **Skills** (installed on this machine): `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`,
  `reverse-any-video`, `style-sampling`; upstream also ships `slideshow`, `figma`, `remotion-to-hyperframes`.
  They cover story → spec → build → check → snapshot review → preview → render.
- **MCP**: hosted only, `https://mcp.heygen.com/mcp/hyperframes/` (beta, HeyGen account, cloud render, no local
  project folder). There is **no local MCP server** in the repo.
- **Storyboard**: `STORYBOARD.md` (frontmatter + `## Frame N` sections) parsed to `StoryboardManifest`.
  `transition_in` is "a note only, build it yourself" — the manifest is a plan, not a compiler input.
- **QA**: `check --json` (lint, runtime, layout, contrast, with `Fix:` lines), `snapshot`, `keyframes`, `compare`.

## 8. Limits found

- 3D camera is not a built-in primitive; camera moves are CSS/GSAP transforms (2D/2.5D) or a Three.js scene you draw.
- Effects on footage must go through `media-treatment`, not CSS filters. Motion blur breaks the
  "seek order doesn't matter" guarantee and costs render time.
- `FrameAdapter` is experimental v0.
- Variables cannot change root `data-duration`; no CLI command changes it either.
- `timeline` reads one level of nesting.
- No deterministic "structured plan → project" compiler: the storyboard is advisory and the agent hand-writes scenes.

## 9. This machine

`doctor`: Node 24.22.1, FFmpeg 9.0.2, system Chrome, M4 Pro — render-ready. Optional and missing:
whisper-cpp, Kokoro TTS, MusicGen; Docker installed but not running. **3.3 GB free disk** — tight for renders.
