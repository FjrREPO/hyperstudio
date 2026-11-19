# Recipe development

A recipe is one complete shot: composition, timing, motion, camera, lighting and typography are already
decided, and a handful of variables adapt it. It is a HyperFrames registry block, so everything in the
HyperFrames `hyperframes` skill (the contract, `references/format.md`, `references/runtimes.md`) applies.

Adding a recipe never changes the compiler: drop a folder into `packages/recipes/blocks/`.

```
packages/recipes/blocks/<name>/
  registry-item.json    name, description, duration, variables, hyperstudio constraints
  <name>.html           the scene, inside <template>
```

## `registry-item.json`

Upstream's format, plus one `hyperstudio` key:

```json
{
  "name": "luxury-product-reveal",
  "type": "hyperframes:block",
  "title": "…",
  "description": "What the shot is and when to choose it. Say plainly if the camera is simulated.",
  "duration": 6,
  "hyperstudio": { "minDuration": 4, "maxDuration": 12, "required": ["product", "headline"] },
  "files": [
    { "path": "<name>.html", "target": "compositions/<name>.html", "type": "hyperframes:composition" }
  ],
  "variables": [
    {
      "id": "camera",
      "type": "enum",
      "label": "Camera move",
      "default": "push-in",
      "options": [{ "value": "push-in", "label": "Slow push in" }]
    }
  ]
}
```

- `name` must equal the folder name.
- Variable types: `string`, `number` (`min`, `max`), `color`, `boolean`, `enum` (`options`), `font`, `image`.
- **Every variable needs a `default`**, including images (use `""`). HyperFrames rejects a declaration without one. Mark truly mandatory values in `hyperstudio.required` instead.
- `description` and each variable's `label`/`description` are what an agent reads to choose and configure the recipe. Write them for that reader.
- Prefer an `enum` over a free string for anything with a fixed set of good answers (fonts, layouts, looks).
- Use the shared ids `accent`, `background`, `ink`, `headingFont`, `bodyFont` when they apply, so a project's `style` reaches your recipe.

## The scene file

Rules the compiler relies on:

1. The root is `<div id="root" data-composition-id="<name>" data-duration="…" data-width="…" data-height="…">` inside `<template>`.
2. **Every element id starts with `<name>-`**, and scripts build ids from the name (`var ID = "<name>"`). The compiler renames that token per scene; an id without the prefix collides when the recipe is used twice.
3. The name must not appear anywhere it should not be renamed.
4. Read the scene length from the root (`data-duration`) and build the timeline from it. Do not hard-code the native duration.
5. Read the canvas from `data-width`/`data-height` and size everything from them (the reference recipe sets `--u` to 1% of the short side). Handle portrait.
6. Read values once with `window.__hyperframes.getVariables()` and merge over your own defaults.
7. Register the timeline last: `window.__timelines[ID] = tl`.

Rules from HyperFrames that bite most often:

- Every visible state is a function of timeline time: no clocks, no unseeded `Math.random()`, finite repeats.
- `fromTo` only. A later tween on a property an earlier tween owns needs `immediateRender: false`.
- No CSS `transform` on an element GSAP transforms; wrap it instead.
- Land end states just before the scene's last frame.
- Font families must appear literally in the CSS (the reference recipe uses one class per allowed family), or the renderer never loads them.
- Mark deliberate overflow with `data-layout-allow-overflow`, or `check` reports it.
- Reading text must be at least 2.6% of the canvas's short side.

Learned while building the four recipes:

- **Measuring text needs the typeface.** If a recipe sizes text from glyph widths, load the face first
  (`document.fonts.load(...)`) and build and register the timeline in its `then`. Registering late is fine;
  registering before the tweens exist renders blank.
- **Counting numbers need a setter, not `onUpdate`.** HyperFrames seeks with events suppressed, so a callback
  never fires. Tween an object whose property setter writes the text (see `data-storytelling`).
- **Frame 0 is the thumbnail.** `check` warns when the first frame is only background. A recipe that can open
  a film should already show something at time 0 (see the `opening` case in `kinetic-typography`).
- **Decorative layers behind text** can be reported as covering it; mark them `data-layout-allow-occlusion`.
- **Portrait safe areas.** Keep text out of the top 12%, the bottom 36% and the right 30% of a 9:16 canvas.
- **Share variable ids and option lists** (`accent`, `background`, `ink`, `headingFont`, `bodyFont`) so one
  project `style` can drive a film that mixes recipes.

## Develop and verify

```bash
pnpm hyperstudio recipes --pretty        # your recipe is listed and parses
```

Write a small IR that uses it (see `examples/`), then:

```bash
pnpm hyperstudio compile <ir.json>
cd <ir-dir>/build
npx hyperframes check --json             # 0 errors, 0 warnings
npx hyperframes snapshot                 # look at every state: entrance, hold, exit
```

Before calling it done, compile it at least twice in one project with different values, and once in portrait
(`"aspectRatio": "9:16"`).

## Reference recipe

`luxury-product-reveal` is the template to copy; `kinetic-typography` shows measured text and
`data-storytelling` shows counters. The variables of `luxury-product-reveal`:

| Id                            | Type           | Default                 | Notes                                                                |
| ----------------------------- | -------------- | ----------------------- | -------------------------------------------------------------------- |
| `product`                     | image          | required                | Transparent cut-out; its alpha shapes the glint                      |
| `headline`                    | string         | required                | Rises word by word                                                   |
| `eyebrow`, `subline`          | string         | empty                   | Empty hides the line                                                 |
| `layout`                      | enum           | `center`                | `center`, `left`, `right` (product position). Portrait always stacks |
| `camera`                      | enum           | `push-in`               | `push-in`, `pull-out`, `orbit`, `pan`, `static`                      |
| `intensity`                   | number 0.4–1.6 | 1                       | Camera travel multiplier                                             |
| `lighting`                    | enum           | `dramatic`              | `dramatic`, `soft`, `rim`                                            |
| `particles`                   | boolean        | true                    | Seeded dust                                                          |
| `exit`                        | enum           | `hold`                  | `hold` or `fade`                                                     |
| `accent`, `background`, `ink` | color          | gold on near-black      |                                                                      |
| `headingFont`, `bodyFont`     | enum           | Playfair Display, Inter | Bundled HyperFrames fonts only                                       |

Duration 4–12 s. The camera is a 2.5D simulation (scale, translate, perspective rotation of a flat image).

## Limits

- In portrait the copy sits in the middle band to stay clear of TikTok, Reels and Shorts interface areas, so the lower third is empty by design. A long headline can still trigger a TikTok right-edge warning.

- The `hyperstudio` key is our extension. It is not part of upstream's registry-item schema.
- Recipes cannot be nested or layered by the compiler.
- There is no standalone recipe preview; preview through a small IR.
