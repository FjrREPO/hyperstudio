# Technical decisions

Each decision cites [HYPERFRAMES-RESEARCH.md](HYPERFRAMES-RESEARCH.md). Status: proposed, awaiting owner sign-off.

## D1. Do not rebuild what HyperFrames ships

The brief assumed HyperFrames is a bare renderer. It is not: it ships an editing SDK, a ~40-command CLI,
a 456-item registry with typed parameters, lint/layout/contrast QA, an async render API, and agent skills
(research §2, §5–7). The brief's own principle — "do not duplicate existing HyperFrames capabilities without a
clear reason" — rules out 11 of the 13 planned packages.
**Tradeoff:** HyperStudio is much smaller than envisioned and depends on upstream staying healthy.
Upstream is Apache-2.0 and pinned by version, so that risk is acceptable.

## D2. Recipes are registry blocks, not a TypeScript motion engine

A custom preset/recipe engine would need its own parameter schema, docs, search, install and seek-safety
checks. The registry item format already provides all five (research §6).
**Tradeoff:** recipes are HTML + GSAP, not composable TS objects like the `recipe.sequence[]` sketch in the brief.
Composition happens at the scene level (IR lists recipes in order). Revisit if we need to merge several
recipes inside one scene often enough that hand-editing the installed block becomes the bottleneck.

## D3. One package, not a pnpm monorepo

Three source files do not need workspaces. Split when a second consumer needs one part without the others.

## D4. No local MCP server

Claude Code already operates HyperFrames through Bash + skills, with `--json` output and `Fix:` lines.
An MCP server would wrap the same CLI calls. A hosted MCP exists for hosts without a shell (research §7).
**Add when:** a target host has no shell access and the hosted connector's cloud-only rendering is unacceptable.

## D5. One skill, not six

The installed `hyperframes*` skills already cover direction, story, spec, motion, check, review and render.
Six more would mostly restate them — which the brief forbids. One `hyperstudio` skill covers the delta:
writing an IR, choosing our recipes, running `hyperstudio compile`.

## D6. The compiler shells out to `hyperframes add`; it does not import registry internals

`add` handles dependency resolution, path remapping and `--vars`. Importing its internals would couple us to
unexported code. **Tradeoff:** needs network at compile time (`add` requires it, research §6).
**Open:** whether `hyperframes.json#registry` accepts a local/`file:` path — verify first thing in Phase 2;
fallback is copying recipe files directly, which is what `add` does anyway.

## D7. Time is seconds in the IR

HyperFrames' model is seconds (`data-start`, GSAP positions) with frame time derived as `frame / fps`.
A separate internal unit would only add a conversion to get wrong.

## Not doing (and when to reconsider)

| Skipped | Reconsider when |
| --- | --- |
| Playground / UI editor | Never ours — HyperFrames Studio and desktop app exist |
| Asset metadata/caching layer | A recipe needs probe data the CLI doesn't expose |
| Render job tracker | We run renders outside the CLI (`producer` already reports progress) |
| Structured logging, error boundaries | There is a long-running process to log from |
