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
- A product whose front end you have, or can rebuild faithfully: make it a **live page**, one HTML file whose
  `.app` element shows each state from its `data-state` (`docs/IR-SPECIFICATION.md`, Live screens). The film then
  drives the real interface instead of cutting between pictures. This is the strongest option.
- An app you can only open: screenshot the states the story needs (empty, filled, result). One screenshot per state.
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
No particles or grids standing in for design. A still frame is allowed.

What makes a film read as a template, and is therefore not a default: a blurred colour gradient behind
everything, notes or cards floating for decoration, a line of centred type between every two shots, a zoom
into a dashboard, and a logo on the same background to finish. Use any of these only when this product's
story needs it, and say why in `purpose`.

Two films of one product in two colours are one direction, not two. A direction is a composition system:
where type and product sit and whether they trade places, how the product first appears (whole, or through
one element that opens), what the camera does (holds flat while the layout moves, or orbits an object), and
how it ends (on the mark, or on the product). Write those four down before any beat.

### Story and look are two decisions

Write the story from what the product is worth to its user. Then choose the look separately, from the
product's personality, its audience, its category and the feeling the film is for. A story that worked does
not choose the look of the next film: a light stage, a large headline beside a window, and a push-in are one
look, and they are not the default.

Looks that differ in kind, to choose between or combine with a reason: a page where type and product trade
places (editorial); the product alone, edge to edge, with captions (observational); the interface as an object
in the dark that a wide lens circles, with no type of the film's own (dimensional); a strict grid with small
type and nothing turned (Swiss). These are not presets, and a new product may need one that is not here.

When the repository already holds films, run `pnpm -s hyperstudio compare <new>/video.json <other>/video.json`
against each. Every row marked `same` needs a reason that comes from this product; "it worked last time" is
not one.

Decide these from the product, not from the last film:

- **The stage.** Usually plain: the product's own surface colour, or black, with nothing on it. `light: soft`
  or `aurora` only when the brand itself looks like that.
- **How the product sits in the frame.** Flat and frontal reads as a recording; turned (`tilt`) with `focus`
  reads as a photograph of a screen. Pick one manner for the film.
- **The voice.** One typeface for the film's own lines, set where the composition needs it (left on the
  margin, or centred), not centred by habit.

## 3. Storyboard, in shots

**Story before technique.** Write the film as milestones first: what has happened by the end of each, in
the viewer's words. Only then choose how each is shown. Do not start from what a recipe can do.

- Each milestone must change what the picture **is**: another view, or a state that redraws the frame. A
  new camera position on the same interface is not an event; five of them are a tour of a screenshot.
- If the product's main screen cannot show a milestone, show where that milestone really happens (an
  editor, a terminal, a fleet, an inbox) as its own live page and cut to it.
- What moves should be the thing the story is about (a line typed, a bar filling, machines turning). The
  camera steps back to show how far it has got; it does not carry the story.
- The last milestone is the payoff and gets the longest hold. The name comes after it, not instead of it.

List the shots in plain words before writing JSON. For each: what the viewer sees, what happens in it, why it
is there (`purpose`), and how long. Then check the list:

- Every shot moves the story on. A shot you could delete without loss, delete.
- A line of copy is followed by the product doing what the line said.
- Neighbouring shots differ in subject or scale: wide, then close.
- Cut on action (a click, a line finishing), not on a timer.
- Product films cut fast: 1 to 2.5 s a shot. The compiler warns above a 3.5 s average.
- Open on something visible at frame 0 (it is the thumbnail) and end on the brand.

Choose the structure the product calls for. They produce different films:

| Structure | When |
| --- | --- |
| Problem, solution, product, outcome | The product removes a pain the viewer already feels |
| Reveal, experience, what sets it apart, brand | A premium launch; the product is the event |
| User journey, interaction, result, call to action | A demonstration; the product is best understood by watching it used |
| Concept, explanation, product, positioning | A technical product that needs one idea explained first |

A film does not have to alternate cards of type with shots of the product. With `product-take` the whole film
can be one take: the film's lines are set in the frame beside the interface (`say`, with the interface moved
over by `side`), the camera turns and pulls focus as the product changes state, and the film ends by resolving
the interface into its own mark (`veil`). Use separate `statement` and `brand-close` scenes only when a cut to
type is what the story needs.

Then write the storyboard as actions, not pictures: who does what, what the product does back, and where the
camera is while it happens. A change the viewer should understand (a click and its result) belongs in one
take, not on either side of a cut.

## 4. See what recipes exist

```bash
pnpm -s hyperstudio recipes                # the list
pnpm -s hyperstudio recipes product-shot   # one recipe: every variable, where it is set, what it accepts
```

| Recipe | Use it for |
| --- | --- |
| `product-take` | **The default for showing a product.** One continuous take of the live interface: the scene's `beats` type, click, change state, reveal and draw, and the camera follows. Needs the product as an HTML page (`screens.*.html`) |
| `product-shot` | For products that can only be screenshotted. One shot of a real screen: camera from one named region to another, optional cursor and click, typed text, outlined component, short label. `isolate` floats one component on the stage |
| `scatter` | Short notes arrive scattered around one line, then are swept away. Only when the story is about scattered requests; not a default opening |
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
pnpm -s hyperstudio review <film>/video.json --motion
```

This compiles, runs `hyperframes check`, takes two frames from every shot, and writes `<film>/REVIEW.md` with
a rubric. With `--motion` it also renders a draft, reports how much of the film is a frozen picture, and
writes one strip per shot at eight frames a second (`build/.hyperstudio/motion-*.jpg`). **Open the strips.**
A freeze of a second or more inside a product shot is a fault: add a beat, or shorten the shot. Compare with
films you admire: professional product films hold a still picture for a few percent of their length. Then **open the contact sheets and at least one full frame per shot, and answer the rubric from
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

A film needs sound from a real source. In order of preference: what the person supplies; openly licensed
music and effects from `hyperstudio assets search --kind audio`; a generated voice.

```bash
pnpm -s hyperstudio audio providers
pnpm -s hyperstudio audio tts "One line of narration." --out <film>/assets/vo-1.m4a   # Kokoro if set up, else the system draft voice
pnpm -s hyperstudio audio inspect <film>/assets/vo-1.m4a                              # its real length
```

- Write narration per shot, one clip per line, and place it with `"role": "voice", "scene": "<id>", "start": 0.1,
  "duration": <from inspect>`. It then follows the shot when the film is retimed.
- Kokoro (`audio providers` shows whether it is set up) is a local open-weight voice: its clips are real
  assets, `"origin": "supplied"`. If it is not set up, ask before running `audio setup kokoro` (a 190 MB download).
- The system voice is a **draft**: give it `"origin": "placeholder"` and say so in your report.
- ElevenLabs runs only with `--provider elevenlabs` and its key. Start with `audio status` and `--dry-run`.
  **Never pass `--confirm-cost` yourself**: show the estimate and ask the person. Free-plan output is
  non-commercial; say that when you deliver.
- Dubbing localises a finished film; it is a separate per-minute cost. Ask before starting one.
- You cannot hear. Report measured facts (lengths, levels), not that it "sounds good".

See `docs/AUDIO-ENGINE.md` and `docs/AUDIO-COST-CONTROLS.md`.

## Footage-led films

People, places, live action and photoreal product footage are not drawn by HyperFrames. Get the footage
through `media-use`, then use HyperStudio and HyperFrames for the edit, type and finish. Say when a brief
needs this rather than faking it with graphics.

## Limits

- Camera moves and tilts are 2.5D transforms of flat images.
- One recipe per scene.
- `build/` is regenerated on every compile; manual edits there are lost.
- The mechanical checks catch carelessness. Taste is judged in review, by you and then by the person.
