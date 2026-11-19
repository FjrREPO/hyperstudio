# Recipe development

A recipe is one shot: what the viewer sees, how it moves, and the few things that may change. It is a
HyperFrames registry block, so everything in the `hyperframes` skill applies (the contract,
`references/format.md`, `references/runtimes.md`).

Adding a recipe never changes the compiler: drop a folder into `packages/recipes/blocks/`.

```
packages/recipes/blocks/<name>/
  registry-item.json    name, description, length range, variables
  <name>.html           the scene, inside <template>
```

## Before writing one

- A recipe is a **shot**, not a slide. It shows one thing for one to four seconds and cuts. If it builds five
  things and then sits, it is a slide; split it.
- It sits on the film's **stage**. The scene is transparent; the compiler draws the background and light once
  behind every scene. A recipe does not bring its own background, blobs, grids or glow.
- **One thing leads.** One camera move, or one line arriving. Everything else is still.
- Type comes from the **scale**, in `u` (1% of the canvas's short side): label 3.3, body 3.5 to 3.9, title 6.2,
  display 9.6 to 10.8. Never size type to fill the canvas.
- **One accent**, used once per shot.
- If the shot shows a product, it shows the **real screen**. Draw nothing that stands in for one.

## `registry-item.json`

Upstream's format, plus one `hyperstudio` key and a `role` on each variable.

```json
{
  "name": "product-shot",
  "type": "hyperframes:block",
  "title": "Product Shot",
  "description": "What the shot is and when to use it.",
  "duration": 2,
  "hyperstudio": { "minDuration": 0.8, "maxDuration": 4, "required": [], "screen": true },
  "files": [
    {
      "path": "product-shot.html",
      "target": "compositions/product-shot.html",
      "type": "hyperframes:composition"
    }
  ],
  "variables": [
    { "id": "to", "type": "string", "role": "region", "label": "End framing", "default": "" },
    { "id": "accent", "type": "color", "role": "brand", "label": "Accent colour", "default": "#2747f0" }
  ]
}
```

| `hyperstudio`                | Meaning                                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minDuration`, `maxDuration` | The lengths the shot is built for. Keep the maximum short                                                                                                         |
| `required`                   | Variable ids a scene must set                                                                                                                                     |
| `screen`                     | The recipe shows a screen. The scene names one; the compiler fills `screen` (image) and `screenMeta` (JSON: `width`, `height`, `regions`). Declare both variables |

| `role`        | What the compiler does with it                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand`       | Settable only in the film's `style`. Use the shared ids: `background`, `ink`, `accent`, `displayFont`, `textFont`, with the shared option lists |
| `region`      | A string that must name a region of the scene's screen (or be empty)                                                                            |
| `layout`      | With `region`, defines the framing used to reject a repeated shot                                                                               |
| `statistic`   | A figure. The scene must give `sources`                                                                                                         |
| anything else | Documentation for whoever chooses the recipe                                                                                                    |

Other rules:

- `name` equals the folder name.
- **Every variable needs a `default`**, including images (`""`). HyperFrames rejects a declaration without one.
- Give copy a `maxLength`: the longest text the shot sets well.
- Prefer an `enum` over a free string wherever there is a fixed set of good answers.
- The description and labels are what an agent reads to choose and configure the recipe. Write them for that.

## The scene file

Rules the compiler relies on:

1. The root is `<div id="root" data-composition-id="<name>" data-duration="…" data-width="…" data-height="…">`
   inside `<template>`.
2. **Every element id starts with `<name>-`**, and scripts build ids from the name (`var ID = "<name>"`). The
   compiler renames that token per scene; an id without the prefix collides when the recipe is used twice.
3. The name appears nowhere it should not be renamed.
4. Read the length from the root's `data-duration` and the canvas from `data-width` and `data-height`.
   Handle portrait.
5. Read values once with `window.__hyperframes.getVariables()` and merge over your own defaults.
6. Register the timeline last: `window.__timelines[ID] = tl`.

Rules from HyperFrames that bite most often:

- Every visible state is a function of timeline time: no clocks, no unseeded randomness, finite repeats.
- `fromTo` only. A later tween on a property an earlier tween owns needs `immediateRender: false`.
- No CSS `transform` on an element GSAP transforms; wrap it instead.
- Font families must appear literally in the CSS (one class per allowed family), or they never load.
- Mark deliberate overflow with `data-layout-allow-overflow`, and decorative layers that sit over or under
  text with `data-layout-allow-occlusion`.
- Reading text is at least 2.6% of the canvas's short side.
- No `z-index: -1`; layer with sibling order.

Learned while building the recipes:

- **Text that changes over time needs a setter, not `onUpdate`.** HyperFrames seeks with events suppressed.
  Tween an object whose property setter writes the text (typing in `product-shot`).
- **Measuring text needs the typeface.** Load it (`document.fonts.load(...)`) and build the timeline in the
  `then`. Registering late is fine; registering before the tweens exist renders blank.
- **Frame 0 is the thumbnail.** A recipe that can open a film shows something at time 0.
- **Overlays on a screenshot live in the screenshot's pixel space**, inside the element the camera moves, so
  they stay attached to their component.
- **Portrait safe areas.** Keep text out of the top 12%, the bottom 36% and the right 30% of a 9:16 canvas.

## Develop and verify

```bash
pnpm hyperstudio recipes <name>            # parses, and the variable table reads well
pnpm hyperstudio review <film>/video.json  # check + frames from every shot
```

A recipe is done when a film that uses it twice passes `hyperframes check` with no errors, and you have looked
at frames of its start, middle and end and they look composed.

## The recipes

| Recipe                  | Shot                                                                                   | Length     |
| ----------------------- | -------------------------------------------------------------------------------------- | ---------- |
| `product-shot`          | A real screen: camera between named regions, cursor, typing, outline, label, isolation | 0.8 to 4 s |
| `statement`             | One short line with at most one emphasised word                                        | 1 to 4 s   |
| `brand-close`           | Mark, name, tagline, optional button                                                   | 2 to 5 s   |
| `luxury-product-reveal` | A physical product emerging from darkness                                              | 4 to 12 s  |

`pnpm hyperstudio recipes <name>` prints each one's variables.

## Limits

- The `hyperstudio` key and `role` values are our additions to upstream's registry-item format.
- Camera moves and tilts are 2.5D transforms of flat images.
- Recipes cannot be nested or layered by the compiler.
- There is no standalone recipe preview; preview through a small IR.
