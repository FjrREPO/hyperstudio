---
name: hyperstudio-director
description: Direct a cinematic video from a brief with HyperStudio - plan the storyboard, write a Creative IR (JSON), pick and configure cinematic recipes, compile it to a HyperFrames project, then check, snapshot and render with the HyperFrames CLI. Use for "make a commercial / product video / launch film" requests in a repo that has HyperStudio, or when asked to write, fix or compile a Creative IR.
---

# HyperStudio director

HyperStudio turns a plan into a HyperFrames project. You write a **Creative IR** (one JSON file: scenes, recipes,
values); `hyperstudio compile` validates it and writes the project; HyperFrames does everything after that.
Run commands from the HyperStudio repo root. For anything HyperFrames-native (check, snapshot, preview, render,
media, registry) follow the `hyperframes`, `hyperframes-cli` and `media-use` skills - this skill does not repeat them.

## 1. Read the brief, then decide the film

Before any JSON, settle in words: who it is for, the one thing they should feel or know, the length, the
aspect ratio, and 2-5 scenes each with one job (reveal, prove, close). One idea per scene. If the brief gives
no length, a product spot is 12-20 s. Ask only for what you cannot default: the product image and the copy.

## 2. See what recipes exist

```bash
pnpm -s hyperstudio recipes --pretty
```

Each recipe lists its `variables` (id, type, default, options or min/max), `minDuration`/`maxDuration` and
`required` ids. A recipe is a whole shot - composition, timing, motion, camera, light and type are already
decided - so choose by the scene's job, then set variables. Never invent a variable or an option; the compiler
rejects them. If no recipe fits a scene, say so and either build that scene by hand with the `hyperframes`
skill or write a new recipe (`docs/RECIPE-DEVELOPMENT.md`).

## 3. Write the IR

Put it in its own folder with its assets: `<project>/video.json`, `<project>/assets/...`.

```json
{
  "project": { "title": "…", "fps": 30, "aspectRatio": "16:9", "duration": 16.2 },
  "style": { "accent": "#c9a35c", "headingFont": "Playfair Display" },
  "scenes": [
    {
      "id": "reveal",
      "recipe": "luxury-product-reveal",
      "duration": 6,
      "assets": { "product": "assets/product.png" },
      "text": { "eyebrow": "Introducing", "headline": "Time, distilled." },
      "params": { "layout": "center", "camera": "push-in", "lighting": "dramatic" },
      "transition": { "type": "fade", "duration": 0.8 }
    }
  ],
  "audio": [{ "id": "bed", "src": "assets/music.m4a", "volume": 0.8, "fadeIn": 1.5, "fadeOut": 2.5 }]
}
```

- `assets` takes image variables (paths relative to the IR file), `text` takes string variables, `params` the rest.
- `style` reaches every scene whose recipe declares that id; a scene's own value wins.
- `transition` is how a scene is **entered**: `cut` (default), `fade` (dip through black), `crossfade` (overlaps
  the previous scene, so the film gets shorter by its duration).
- Durations must land on whole frames. Set `project.duration` to the length you intend: the compiler then
  fails if the scenes do not add up, which catches a miscounted crossfade.
- Choose by the scene's job: `kinetic-typography` for a hook, a claim or a sign-off (no assets);
  `luxury-product-reveal` for a physical product (needs a cut-out image); `tech-product-launch` for software
  (needs a screenshot); `data-storytelling` for a number or a comparison (no assets).
- Open on a recipe that shows something at time 0 (kinetic type does) and do not `fade` into the first scene:
  frame 0 is the thumbnail.
- Do not `crossfade` between two scenes whose text sits in the same place; use `fade` or `cut`.
- Give each line time to be read: about 0.5 s plus 0.3 s per word, and at least 2 s for the film's last line.
- Vary what repeats. Reusing one recipe is fine when layout, camera and lighting change between scenes.
- Music and voice: get them with `media-use`, then reference the file in `audio`.

Full field reference: `docs/IR-SPECIFICATION.md`.

## 4. Compile

```bash
pnpm -s hyperstudio compile <project>/video.json --validate-only --pretty   # timing + errors, writes nothing
pnpm -s hyperstudio compile <project>/video.json --pretty                   # writes <project>/build/
```

Output is JSON. `ok: false` lists `errors` as `{ path, message }`; `path` points into the IR
(`scenes.1.params.camera`) and the message names the allowed values. Fix the IR and compile again - never edit
`build/`, it is regenerated on every compile.

## 5. Check, look, render

In `<project>/build/`:

```bash
npx hyperframes check --json                       # must be ok: true with 0 errors
npx hyperframes snapshot --at <mid-scene times and each transition>
```

Read the contact sheet and at least one full frame per scene. Judge it as a viewer: is the product the hero,
is every line readable, does each scene differ from the last, is anything clipped or colliding? Fix by changing
the IR (copy length, layout, camera, lighting, durations), recompile, and look again.

Then follow `hyperframes-cli`: preview for the person unless they asked for the file, and render with
`npx hyperframes render --quality looks -o ../renders/<name>.mp4` once checks and your review pass. Check free
disk first (`df -h .`); a 1080p render needs well under 1 GB. Confirm the file with `ffprobe` (duration equals
the IR's) and look at decoded frames before saying it is done.

## What this does not do

- Camera moves are 2.5D simulations on flat images, not a physical camera. Do not promise real 3D.
- One recipe per scene. Layering several recipes inside one scene means hand-editing with the `hyperframes` skill.
- Edits made in Studio or by hand under `build/` are lost on the next compile. For a one-off manual finish,
  compile to a fresh `--output` folder and stop compiling into it.
