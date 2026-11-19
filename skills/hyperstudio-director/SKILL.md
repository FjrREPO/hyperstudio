---
name: hyperstudio-director
description: Direct a product or brand film with HyperStudio - set the creative direction, capture the real product, storyboard in shots, write a Creative IR (JSON), compile it to a HyperFrames project, review real frames against a rubric, then render. Use for "make a launch video / product video / commercial" requests in a repo that has HyperStudio, or when asked to write, fix, compile or review a Creative IR.
---

# HyperStudio director

You are directing a film, not filling a template. A render that passes validation is not a finished film;
a film is finished when its frames look designed and say something.

HyperStudio gives you three things: a **Creative IR** (one JSON file that records the direction and the shots),
a compiler that turns it into a HyperFrames project, and a few **shot recipes**. HyperFrames does the rest.
Run commands from the HyperStudio repo root. For check, snapshot, preview, render and media follow the
`hyperframes`, `hyperframes-cli` and `media-use` skills; this skill does not repeat them.

Work in this order. Do not skip ahead to JSON.

## 1. Real product first

A product film shows the product. Before anything else, get the real thing:

- A live product or site: `npx hyperframes capture <url> --json` for screenshots, colours, fonts and the logo.
  Take the brand's colours and typefaces from there, not from taste.
- An app you can open: screenshot the states the story needs (empty, filled, result). One screenshot per state.
- Nothing available: **ask for it.** If the person wants to proceed anyway, build the screens as real HTML and
  mark every one `"origin": "placeholder"`. Never draw a dashboard to fill space.

Never invent a metric, a customer, a feature or a quote. A number on screen needs a source in the IR
(`sources`), and the compiler rejects a statistic without one.

## 2. Direction, in words

Write the eight `direction` sentences before any scene exists. Each is a decision the whole film obeys:

| Field | Decide |
| --- | --- |
| `concept` | The idea of the film in one sentence. If you cannot say it, there is no film yet |
| `audience` | Who it is for and what they already know |
| `message` | The one thing they should leave with |
| `tone` | How it feels |
| `palette` | Background, ink, and **one** accent, and what the accent is for |
| `typography` | Which faces, at what scale, for what |
| `motion` | What moves, how, and what stays still |
| `pacing` | Shot length, and where the film breathes |

Restraint is the default: one stage, one accent, one camera move per shot, small type with space around it.
No gradient blobs, glows, particles or grids standing in for design. A still frame is allowed.

## 3. Storyboard, in shots

List the shots in plain words before writing JSON. For each: what the viewer sees, what happens in it, why it
is there (`purpose`), and how long. Then check the list:

- Every shot moves the story on. A shot you could delete without loss, delete.
- A line of copy is followed by the product doing what the line said.
- Neighbouring shots differ in subject or scale: wide, then close.
- Cut on action (a click, a line finishing), not on a timer.
- Product films cut fast: 1 to 2.5 s a shot. The compiler warns above a 3.5 s average.
- Open on something visible at frame 0 (it is the thumbnail) and end on the brand.

A shape that often fits a launch film, to adapt and not to follow: hook, product reveal, one feature shown
working, what it means for the viewer, close.

## 4. See what recipes exist

```bash
pnpm -s hyperstudio recipes                # the list
pnpm -s hyperstudio recipes product-shot   # one recipe: every variable, where it is set, what it accepts
```

| Recipe | Use it for |
| --- | --- |
| `product-shot` | One shot of a real screen: camera from one named region to another, optional cursor and click, typed text, outlined component, short label. `isolate` floats one component on the stage |
| `statement` | One short line of copy, small, with at most one emphasised word |
| `brand-close` | The ending: mark, name, tagline, optional button |
| `luxury-product-reveal` | A physical product emerging from darkness (slow, 4 to 12 s) |

If no recipe fits a shot, say so, and either build that shot by hand with the `hyperframes` skill or write a
recipe (`docs/RECIPE-DEVELOPMENT.md`). Do not bend a recipe into something it is not.

## 5. Write the IR

One folder per film: `video.json`, `screens/`, `assets/`. Full reference: `docs/IR-SPECIFICATION.md`; a complete
example: `examples/saas-product-showcase/video.json`.

```json
{
  "project": { "title": "…", "aspectRatio": "16:9", "duration": 15 },
  "direction": { "concept": "…", "audience": "…", "message": "…", "tone": "…", "palette": "…", "typography": "…", "motion": "…", "pacing": "…" },
  "brand": { "name": "Lumen", "kind": "real" },
  "style": { "background": "#f3efe6", "ink": "#17150f", "accent": "#2747f0", "displayFont": "Inter", "textFont": "Inter", "light": "soft" },
  "screens": {
    "answer": { "src": "screens/answer.png", "width": 1440, "height": 900, "origin": "captured",
      "regions": { "answer": [456, 178, 760, 364], "share-button": [1110, 480, 73, 37] } }
  },
  "scenes": [
    { "id": "share", "recipe": "product-shot", "duration": 1.1, "screen": "answer",
      "purpose": "The next step a team takes: pass the answer on.",
      "params": { "isolate": "answer", "from": "answer", "to": "share-button", "cursor": "share-button" } }
  ]
}
```

- **Regions** are rectangles `[x, y, width, height]` in the screenshot's CSS pixels, one per component a shot
  frames, points at, outlines or types into. Read them from the page's DOM when you can; otherwise measure
  them on the screenshot. A wrong rectangle is a visible mistake, so every product shot gets looked at.
- **`style` is the film's visual system** and is set once. A scene cannot override colours or typefaces.
- **`purpose`** is required for every scene and must be a sentence.
- Typed text should be what the next screen shows as entered, so the cut is continuous.
- Durations land on whole frames. State `project.duration` so a miscount fails the compile.

## 6. Compile

```bash
pnpm -s hyperstudio compile <film>/video.json --validate-only   # plan and problems, writes nothing
pnpm -s hyperstudio compile <film>/video.json                   # writes <film>/build/
```

Read the summary: the shot table, **Placeholders** and **Warnings**. Add `--json` when you need to parse it.
Exit code 1 means the IR was rejected; each problem names its place in the IR (`scenes.4.params.to`) and what
is allowed. Fix the IR and compile again. Never edit `build/`.

## 7. Review real frames

```bash
pnpm -s hyperstudio review <film>/video.json
```

This compiles, runs `hyperframes check`, takes two frames from every shot, and writes `<film>/REVIEW.md` with
a rubric. Then **open the contact sheets and at least one full frame per shot, and answer the rubric from
what you see**:

1. Storytelling: does each shot move the story on?
2. Art direction: is it one film, the same stage and light throughout?
3. Typography: a clear order of reading; nothing too large, too small or crowded?
4. Composition: balanced, with intended space, nothing clipped by accident, no label on top of UI text?
5. Shot variety: do neighbours differ in subject or scale?
6. Motion: does one thing lead? Does anything move without a reason?
7. Transitions: does each cut land on an action or a change of idea?
8. Assets: is everything real? List every placeholder.
9. Brand: would the brand recognise itself?
10. Coherence: does it feel made by one hand?

Write a verdict and the evidence for each row. If any row is "revise", change the IR and run the review
again. Typical fixes: `isolate` a component so the stage shows around it, change `fill` to give a frame room,
move a label off the UI, retime a shot, cut a shot.

Do not report a film as verified because `check` passed or the render succeeded. Say what you looked at.

## 8. Render, then look again

Follow `hyperframes-cli`: preview for the person unless they asked for the file; render with
`npx hyperframes render --quality looks -o ../renders/<name>.mp4` in `build/` once the review passes. Check free
disk first. Confirm the file with `ffprobe` (duration equals the IR's), then pull frames from the **rendered
file** and look at them once more.

Report plainly: what the film is, what is a placeholder, and what you would still improve.

## Finding free media

When a film needs a texture, a photograph or a sound the person has not supplied:

```bash
pnpm -s hyperstudio assets search "soft piano" --kind audio     # image, audio or video
pnpm -s hyperstudio assets download 1 --to <film>/assets --name bed
pnpm -s hyperstudio assets list <film>/assets                   # licences and credits owed
```

Only assets whose own licence allows commercial use and editing are returned. Never use `--accept-review`
yourself: it records that a **person** read a licence. `compile` lists the credits a film owes; put them in
the film or its description. Licence data comes from the source and can be wrong, so say which assets came
from where when you report. This never replaces the real product: do not search for a stand-in screenshot.
See `docs/ASSET-ENGINE.md`.

## Sound

Music and sound design need a real source: a track the person supplies, or `media-use` (the free catalogue
needs `npx hyperframes auth login`). Synthesised effects are placeholders; mark them so.

## Footage-led films

People, places, live action and photoreal product footage are not drawn by HyperFrames. Get the footage
through `media-use`, then use HyperStudio and HyperFrames for the edit, type and finish. Say when a brief
needs this rather than faking it with graphics.

## Limits

- Camera moves and tilts are 2.5D transforms of flat images.
- One recipe per scene.
- `build/` is regenerated on every compile; manual edits there are lost.
- The mechanical checks catch carelessness. Taste is judged in review, by you and then by the person.
