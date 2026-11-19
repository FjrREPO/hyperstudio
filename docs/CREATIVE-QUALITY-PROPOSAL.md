# Creative quality: review and proposal

Status: **implemented on 2026-11-19** (sections 4 and 5; see [EXAMPLE-WORKFLOW.md](EXAMPLE-WORKFLOW.md) for the benchmark). The three decisions in section 7 were not answered, so the stated defaults were used: an example product built as real HTML and marked as a placeholder, the slide-based recipes and examples removed, and synthesised interface sounds marked as placeholders with no music. `data-point` was not built. Written 2026-11-19 after the owner rejected
`saas-product-launch.mp4` as generic AI motion graphics. That verdict is correct. This document says why,
what two reference films do differently, and what to change.

## 1. How this was checked

| Source                                                                               | Method                                                                             | Limits                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Our `saas-product-launch.mp4` (23 s)                                                 | One frame per second of the rendered file, plus four per second across the opening | None; full resolution                                        |
| Reference 1: "ChatGPT - Codex, AI SaaS Product Launch Video Ad", Noflex Studio, 36 s | One frame per second, 480p                                                         | No audio analysis; easing and sub-second motion not measured |
| Reference 2: "Quill Meetings" product launch, LA Motion, 61 s                        | One frame per second, 480p                                                         | Same                                                         |

Reference frames were viewed for analysis only and are not in this repository. Everything below about the
references is what those sampled frames show. Sound design, exact easing curves and anything between samples
are **not verified**.

## 2. What is wrong with our film

Each line is a defect seen in the rendered frames, with its cause in the system rather than in the one film.

| Seen in the render                                                            | Cause                                                                                                                                  |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| "ONE QUESTION." collides into "ONEQUESTION" for several frames                | `slam` scales each word up in place, so a word mid-punch overlaps its neighbour. The recipe allows a motion that breaks its own layout |
| Every text scene is all-caps, weight 900, as wide as the canvas               | `kinetic-typography` sizes type to _fill the box_. There is no type scale, so there is no hierarchy and no negative space              |
| The dashboard is small, unreadable, and identical for 4 s, then again for 4 s | The product is a static SVG I drew, shown whole. Nothing in it changes, so the only "motion" is a slow tilt on a picture               |
| "214%" with bars; mid-count the headline reads 198% while the bar reads 195%  | The figure is invented. No brief supplied it. The recipe makes inventing a number easy and sourcing one optional                       |
| Purple and cyan blobs, a grid, a glow behind every scene                      | Decoration is the default in every recipe. It stands in for a designed environment                                                     |
| Five shots in 23 s, each held 4–5 s                                           | A recipe is a _slide_: one composition that builds and then sits. The film is a slideshow because its unit is a slide                  |
| "LUMEN. START FREE TODAY." as the ending                                      | There is no brand mark, no end-card composition, only the text recipe reused                                                           |
| Scenes share nothing but colours                                              | The IR has no creative direction. Each scene was configured on its own, so nothing carries from one to the next                        |

The pattern: HyperStudio optimised for _filling a scene with something that passes validation_. Nothing in the
IR, the recipes, or the skill asks what the film is saying or whether a frame is designed.

## 3. What the references do

Seen in both films unless noted.

1. **The product UI is the picture.** Most frames are the real interface. Type is small: roughly 3–5% of frame
   height, sentence case, one short line. Our type was 15–25% of frame height.
2. **One environment for the whole film.** Reference 1: white, with a soft blue-violet field behind UI windows.
   Reference 2: warm paper with soft window-light shadows, and one dark passage for contrast. Neither changes
   palette per scene.
3. **The camera works on the UI.** Extreme close crops of one component (a prompt box, a send button, one line
   of typed text filling the frame), pans along text, then wide again. Reference 2 also tilts panels in
   perspective. Scale contrast between consecutive shots carries the rhythm.
4. **The UI is alive.** Text is typed in real time, a cursor travels and clicks, chips swap ("Filter by Topic →
   Person → Date") and the panel beneath changes with them. This cannot be done by moving a screenshot.
5. **Shots are short.** About 25–30 distinct shots in 36 s (ref 1) and 45+ in 61 s (ref 2): a new picture every
   1–2 s. Ours: one every 4.6 s.
6. **Continuity between shots.** An element survives the cut: the app icon becomes the wordmark, the input box
   grows from tiny to full-frame, the same panel is seen wide then close.
7. **One emphasis device.** Reference 2 puts one word in a filled chip ("To Action", "Topic"). No gradient text,
   no colour changes per scene.
8. **A built ending.** The mark animates on, then the name, a tagline, and (ref 2) a button. Quiet background.
9. **Narrative.** Reference 2: promise → problem ("and still losing important information…") → the product
   answering a real question → features, each named in a line and then shown → sign-off. Each line of copy is
   followed by the UI doing what the line said.

## 4. What this means for HyperStudio

The architecture stays: Creative IR → deterministic compiler → HyperFrames. What changes is the unit of work
and what the system refuses to do.

### 4.1 Real product first

- A product film starts from the product: `npx hyperframes capture <url>` for screenshots, colours, fonts and
  the logo. The skill makes this step one.
- IR gains `brand` (name, logo, colours, typefaces, where each came from) and each asset records its `origin`:
  `captured`, `supplied` or `placeholder`.
- The compiler **rejects** a statistic without a `source`, and reports every `placeholder` asset in its output so
  a stand-in can never pass silently.
- Without real assets the skill asks for them. It does not draw a dashboard.

### 4.2 From slides to shots

Replace the four slide recipes with a small set of **shot** recipes, 1–3 s each, that cut together:

| Recipe               | What it is                                                                                                                                                                                                           | Covers                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `product-shot`       | A real screen on the film's stage. Camera goes from one named region to another (wide → close, a pan, a hold). Optional: cursor travel and click, a highlight on a region, text typed into a region, a short caption | Reveal, zoom-in, focus, highlight, cursor, typing, walkthrough |
| `statement`          | One short line, small, on the stage. One emphasised word in a chip. Reveals by line; may be static                                                                                                                   | Hook, benefit, bridge                                          |
| `brand-close`        | Mark, name, tagline, optional button                                                                                                                                                                                 | Ending, brand reveal                                           |
| `data-point` (later) | One sourced number, set as typography                                                                                                                                                                                | Proof, only with a source                                      |

- **Regions**: named rectangles on a screenshot (`"ask-bar": [x, y, w, h]`), defined once per screen in the IR.
  Scenes refer to names. This is how a shot points at a real component.
- **Typing and cursor** are drawn over the screenshot at a region (a recreated input, a cursor sprite). The
  screenshot stays the source of truth; only the part that must move is rebuilt.
- **One stage per film**: background, light and accent live in `style` and are rendered once behind all shots,
  so a cut changes the picture, not the world.
- Type comes from a **scale** (caption, body, title, display), never from "fill the box".
- Defaults are quiet: no blobs, grids, glows or particles. Motion is one move per shot.
- Perspective tilts stay CSS 3D. Three.js only if a shot needs true depth that CSS cannot give.

Existing recipes: `luxury-product-reveal` stays (it is closest to a designed shot). `kinetic-typography`,
`tech-product-launch` and `data-storytelling` are rebuilt into the three above or removed, and the six example
films made from them are removed with them rather than left as a quality bar.

### 4.3 Direction in the IR

- `direction` (required): concept, audience, the one message, tone, and the rules of the film — palette, type,
  motion, pacing — each one sentence.
- Each scene states `purpose` (what it tells the viewer) and, for product shots, `shows` (what the UI does).
- Compiler checks it can make mechanically:
  - no two adjacent shots with the same recipe, regions and layout;
  - brand colours and typefaces set only in `style`, never per scene;
  - one accent colour;
  - shot length within a range, and a warning when the film's average shot is too long;
  - copy length limits per variable;
  - statistics carry a source; placeholders are listed.
- The compiler writes a HyperFrames `STORYBOARD.md` from `direction` and the scenes, so the plan sits beside the
  project in the format HyperFrames already reads.

These checks catch carelessness. They do not measure taste; that is the next section.

### 4.4 Review before render

The skill's loop becomes: direction → storyboard (in words, before any JSON) → IR → compile → `check` →
snapshots → **review against a written rubric** → revise → render → inspect the rendered file again.

The rubric is the ten points from the brief (storytelling, art direction, typography, composition, scene
uniqueness, motion, transitions, assets, brand, coherence), each answered from frames, in a `REVIEW.md` next to
the project. A film is not reported as done on a passing `check` alone. `hyperstudio review` builds the contact
sheet and the empty rubric; the judgement is Claude's and the owner's.

### 4.5 Two modes

- **Design-led** (this proposal): HyperFrames draws everything. SaaS, product, brand, data, type.
- **AI cinematic**: footage or stills from a generator, with HyperFrames for edit, type and finish. This goes
  through the existing `media-use` skill and needs a paid generator. Not part of the first benchmark.

## 5. First benchmark

One 15-second SaaS product showcase, before anything longer:

| Time    | Beat                     | Shots                                              |
| ------- | ------------------------ | -------------------------------------------------- |
| 0–3 s   | Hook                     | `statement`, then a close `product-shot`           |
| 3–6 s   | Brand and product reveal | `product-shot` wide on the stage                   |
| 6–11 s  | One real feature         | 3–4 `product-shot`s: cursor, typing, result, close |
| 11–13 s | Benefit                  | `statement`                                        |
| 13–15 s | Close                    | `brand-close`                                      |

About nine shots. If it still reads as a template, we stop and revise before building anything else.

## 6. Limits, stated now

- I can inspect frames; I cannot hear. Music and sound effects need a real source (a licensed track, or
  generation through `media-use`). The synthesised drone in the current examples is not acceptable for this bar.
- Regions on a screenshot are placed by inspection or from capture data; a wrong rectangle is a visible error,
  so every product shot gets a snapshot check.
- This raises the floor and removes the template look. It does not guarantee agency-level work; that is judged
  per film, in review, by a person.

## 7. Decisions needed

1. **Which product is the benchmark about?** A real product needs a URL (and permission to use its brand in a
   demo film in a public repository). Without one, the benchmark uses an example product that is built as real
   HTML UI and labelled as a placeholder everywhere.
2. **Remove the six slide-based examples and three recipes**, or keep them marked as legacy?
3. **Sound**: supply a track, generate one through `media-use`, or deliver the benchmark silent?
