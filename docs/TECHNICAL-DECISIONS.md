# Technical decisions

Each decision cites [HYPERFRAMES-RESEARCH.md](HYPERFRAMES-RESEARCH.md). Status: lean scope approved by the owner on 2026-11-19. D3 and D6 were revised the same day; see each.

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

## D3. A small pnpm monorepo: four packages

First proposed as a single package. The owner asked for a monorepo, so the code is split along its real seams:
`ir`, `recipes`, `compiler`, `cli`, with dependencies pointing one way. Still far from the 13 packages of the
original brief: a package exists only where something can be used without the rest (the schema without the
compiler, the recipes without the CLI).
**Tradeoff:** workspace wiring for about 600 lines of code. Packages are consumed as TypeScript source, so there
is no build step to maintain.

## D4. No local MCP server

Claude Code already operates HyperFrames through Bash + skills, with `--json` output and `Fix:` lines.
An MCP server would wrap the same CLI calls. A hosted MCP exists for hosts without a shell (research §7).
**Add when:** a target host has no shell access and the hosted connector's cloud-only rendering is unacceptable.

## D5. One skill, not six

The installed `hyperframes*` skills already cover direction, story, spec, motion, check, review and render.
Six more would mostly restate them — which the brief forbids. One `hyperstudio` skill covers the delta:
writing an IR, choosing our recipes, running `hyperstudio compile`.

## D6. The compiler copies recipe files; it does not go through `hyperframes add`

Verified against HyperFrames 0.9.69: `hyperframes.json#registry` accepts only an absolute `https://` URL. A
`file://` URL and a bare path both fail (details in [COMPILER.md](COMPILER.md)). So local recipes cannot be
installed with `add`, and the compiler copies the recipe file itself, which is what `add` does for a block.
This also keeps compilation offline and deterministic.
**Tradeoff:** the compiler validates recipe values itself instead of relying on `add --vars`. Recipes keep the
upstream registry-item format, so publishing them over HTTPS later needs no rewrite.

## D7. Time is seconds in the IR

HyperFrames' model is seconds (`data-start`, GSAP positions) with frame time derived as `frame / fps`.
A separate internal unit would only add a conversion to get wrong.

## Not doing (and when to reconsider)

| Skipped                              | Reconsider when                                                      |
| ------------------------------------ | -------------------------------------------------------------------- |
| Playground / UI editor               | Never ours — HyperFrames Studio and desktop app exist                |
| Asset metadata/caching layer         | A recipe needs probe data the CLI doesn't expose                     |
| Render job tracker                   | We run renders outside the CLI (`producer` already reports progress) |
| Structured logging, error boundaries | There is a long-running process to log from                          |

## D8. One recipe file serves many scenes by renaming one token

HyperFrames keys a scene's variables and timeline by composition id, and element ids must be unique on the
assembled page. A recipe therefore uses its own name as composition id and id prefix, and the compiler renames
that token to the scene id. Alternatives rejected: mounting one file several times (ids collide) and a
template language in recipes (they would stop being valid HyperFrames files).
**Tradeoff:** recipe authors must prefix every id; a regression test checks the result.

## D9. Tests in three layers, golden files for output

Unit tests beside the code (schema, validation, timing), integration tests that run the CLI as a process, and
regression tests that compare the compiled example with committed golden files. The run against the real
HyperFrames CLI is opt-in (`pnpm test:e2e`) because it needs `npx` and, the first time, the network.
**Tradeoff:** any recipe edit changes the golden files; `pnpm test:update` accepts an intended change.

## D10. The unit of a film is a shot, and recipes are shots

The first recipes were slides: one composition that built and then held for four or five seconds. Five of
them made a 23-second film that was rejected as generic. Two reference launch films cut every one to two
seconds, on the real interface. Recipes are now shots of 0.8 to 4 seconds, and a product film is many of them.
**Tradeoff:** an IR has more scenes and needs a storyboard before it is written. That is the work the first
version skipped.

## D11. One stage, drawn by the compiler

Each slide recipe brought its own background, so every cut changed the world. The compiler now draws one
background and one slow light behind all scenes, and recipes are transparent.
**Tradeoff:** a recipe cannot have its own background. A scene that needs a different ground is a different film.

## D12. Screens and regions instead of drawn interfaces

A product shot takes a screenshot and named rectangles on it. The camera, cursor, outline and typed text all
refer to those names, and the compiler checks they exist. Only what must move (typed text, the cursor) is
drawn over the screenshot.
**Tradeoff:** an interface change that is not typing or a click needs another screenshot. Recreating whole
interfaces as animated DOM would remove that limit and is not done.

## D13. Direction is required data; taste is reviewed, not computed

`direction` and each scene's `purpose` are required. The compiler enforces only what is mechanical: one palette
and type system, no repeated shot, copy length, sourced figures, real regions, listed placeholders. Whether a
frame is well composed is answered by a person or an agent looking at frames, in `REVIEW.md`.
**Tradeoff:** the gate can be skipped. `hyperstudio review` makes the right path one command, and the skill
forbids reporting a film as verified from a passing check.

## D14. The six slide-based examples were removed

They were made from the rejected recipes and would have stood as the quality bar. Two examples remain: the
15-second benchmark and the watch film. History keeps the rest.

## D15. CLI output is for people by default

`compile` prints a summary; `--json` gives the machine form the earlier version always printed. Usage errors
exit 2, so a script can tell a bad command from a rejected IR.

## D16. Asset search is built on refkit, not written from scratch

The owner asked for free, openly licensed asset discovery with a licence gate. refkit (Apache-2.0) already
provides the search fan-out, per-result licence normalisation and maintained adapters for Openverse, Poly
Haven and Pixabay. `@hyperstudio/assets` adds only what is specific to making films: a stricter verdict (no
derivatives is a refusal, share-alike needs a person), the 24-hour cache and request log, the download ledger
and the credits a compile reports.
**Tradeoff:** a young dependency (0.x). Its API is confined to two files (`providers.ts`, `search.ts`), and the
gate is our own code and tests, so replacing it would not touch the policy.

## D17. The licence gate is strict and separate from the software licence

An asset is selected automatically only when its own licence is known to allow commercial use and
modification. Unknown is not free. This is stated in the CLI output as well as the docs, because the easy
mistake is to treat an open-source search tool as a guarantee about what it finds.

## D18. Audio is local and free by default; ElevenLabs is optional and plan-aware

Voiceover defaults to files you have and a system draft voice. ElevenLabs is used only when named and keyed,
and its client reads the account's plan first: the Free plan runs inside its credits and its output is marked
non-commercial; a paid plan must be confirmed; nothing is ever upgraded or generated twice.
**Tradeoff:** an extra free request before each generation, and a draft voice that only exists on macOS.
Mixing is not ours: the IR places clips and HyperFrames mixes them.

## D19. Narration is tied to scenes in the IR

An audio clip may name a `scene`; its `start` then counts from that scene. Retiming a shot moves its narration
with it, which a fixed timestamp would not. Two `voice` clips may not overlap.
**Tradeoff:** the compiler does not read a file's length, so a voice clip states its `duration`
(`hyperstudio audio inspect` gives it).

## D20. An MCP server after all (D4 reversed)

D4 skipped a local MCP server because Claude Code could already drive the CLI through a shell. The owner now
wants HyperStudio usable by any agent, including ones with no shell and ones that are not Claude. MCP is the
standard way to do that, so `@hyperstudio/mcp` exists, on the official SDK.
**Tradeoff:** a second interface to keep in step with the CLI. That is why D21 exists.

## D21. One engine, thin adapters

`@hyperstudio/studio` holds everything an interface needs: the workspace, compile outcomes, the review gate,
render jobs, assets and audio. The CLI, the MCP server, the REST API and the SDK call it and add only their own
shape (arguments, tools, routes, methods). The review logic moved out of the CLI into it.
**Tradeoff:** one more package; in exchange, a rule or a fix is made once.

## D22. No storyboard-generating tool

The brief asked for `analyze_creative_brief` and `generate_storyboard` tools. They would need a language model
inside HyperStudio, which would tie it to a provider. The agent calling the tools is the model: it writes the
direction and the shots, and `save_ir` and `review_video` check them. The method is served as a resource.

## D23. The REST API is a route table

Routes are data: path, summary, the one engine call behind each. The server and the OpenAPI document are both
generated from that list. Webhooks, per-user keys and a persistent idempotency store are not built; they
belong to a hosted service, and there is none.

## D25. The product is mounted live, not shown as screenshots

Two rounds of films were judged template-like. Measured against five reference films at ten frames a second,
ours held a frozen picture for 17 to 25% of their length; the references, 1 to 2% in three of four. The cause
was structural: a screen was a PNG, so the interface could not change inside a shot and every change of state
became a cut to another picture.

A screen may now be the product's own HTML (`screens.*.html`), mounted in a shadow root so its styles and
the film's cannot meet, and a scene lists `beats` that drive it: cursor, click, type, state, reveal, draw,
camera. One take replaces five cut-together screenshots. Screenshot screens and `product-shot` stay, for
products that can only be captured.

Not chosen: an iframe (HyperFrames cannot seek what is inside one, and the capture path is unknown); a
recorded screen video (not editable, not deterministic at any frame rate); CSS transitions inside the page
(they run on the wall clock, not the timeline).

## D27. Type and brand live inside the take

A review of the first live cuts found the same skeleton as before: a card of centred type, the product, a card
of type, a logo on the stage. The cause was that the film's lines and its ending were separate scenes, so
every film alternated type and product.

A take can now hold the whole film. `say` sets a line in the frame, in a clear column beside the interface
(`side` moves the interface over). Camera beats can turn (`tilt`) and pull focus (`focus`) as the product
changes state, so the camera's behaviour follows the story. `veil` covers everything but one region in the
stage's colour, so the film ends on the product's own mark, where it sits in the interface, instead of
cutting to a logo card. `statement` and `brand-close` remain for films that want them.

## D31. A second product, to test that the direction is not a template

One good film of one product proves little. `examples/marlow-launch-film` was made with the same recipe and
no new one, and differs from the Lumen film in structure (a journey with no cut and no "old way"), in where
the problem is told (the product's own transcript), in composition (product full-width, words in a band), in
type, in camera and in ending. The recipe gained only a caption band and a higher vertical placement.

What it does not test: both example interfaces were written by the same hand as the films. Whether the
quality holds for a product that was not is still open.

## D30. A take audits its own composition

HyperFrames' layout checks cannot see into a shadow root, and the film's lines are exempt from them, so a
headline touching the interface passed `check` and was found by a person. Each take now steps through its
timeline once at build time and reports with `console.warn`, which `hyperframes check` lists as warnings: a
line outside the safe area (3% of the frame), a line overlapping the interface unless it has its own column,
and a camera move whose subject ends partly outside the frame. It measures boxes; it cannot judge whether a
composition is good.

## D29. An art direction is a composition system, not a palette

The editorial and cinematic cuts were reviewed as "the same composition in two colours": headline left,
product right, in both. A direction now has to differ in where things sit, how the product enters, what the
camera does and how the film ends. The recipe gained what that needs and nothing decorative: corner
placements and a display size for type, vertical placement for the product, a wide lens, and a veil that
opens as well as closes. The benchmark review has a row for differentiation.

## D28. HyperFrames is pinned

`npx hyperframes` takes the newest release. On 2026-11-19 a release appeared mid-session and the review
stopped working. Every launch now names `hyperframes@0.9.69`; upgrading is a deliberate change.

## D26. Motion is reviewed from evidence

`hyperstudio review --motion` renders a draft, reports the share of still frames and the longest freeze, and
writes one strip per shot at eight frames a second. Two frames a shot could not show a frozen hold, and a row
marked "not judged" let weak motion through twice.

## D24. Two skills, not seven

The brief listed seven skills. Making a film is one job with an order to it, and splitting it would let an
agent load "motion design" without "real product first". So there is `hyperstudio-director` (make a film) and
`hyperstudio-review` (judge one), which is the one part that is used on its own.
