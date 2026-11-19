# Example workflow: a 15-second product showcase

`examples/saas-product-showcase/` from a brief to a reviewed, rendered film. This is the quality benchmark:
the earlier slide-based examples were removed after their output was rejected as generic
([CREATIVE-QUALITY-PROPOSAL.md](CREATIVE-QUALITY-PROPOSAL.md)). Figures below are from 2026-11-19
(HyperFrames 0.9.69, Apple M4 Pro).

**Lumen is an example product.** No real product was supplied, so its interface was built as real HTML for this
film and everything about it is marked as a placeholder. The method is the one a real product goes through.

## 1. The product

`product/index.html` is the product's interface as a working page, with four states chosen by the URL hash:
`#home`, `#asked`, `#answer`, `#share`. Components the film needs carry a `data-region` name.

```bash
node examples/saas-product-showcase/product/capture.mjs
```

That screenshots each state at 2× with headless Chrome and reads every region's rectangle from the DOM. The
screenshots are in `screens/`; the rectangles are in `video.json` under `screens.*.regions`. For a real
product, `npx hyperframes capture <url>` and a screenshot per state replace this step.

## 2. Direction

Written before any shot (see `direction` in `video.json`):

- **Concept:** one question being asked and answered inside the product, start to finish.
- **Palette:** warm paper stage, near-black ink, one cobalt accent where the eye should land.
- **Typography:** Inter, the product's own face; copy small, sentence case, one line at a time.
- **Motion:** one camera move per shot on the real interface; cursor and typing are the only other motion.
- **Pacing:** nine shots in fifteen seconds, cut on action.

## 3. Shots

| #   | Shot      | Length | Recipe       | What happens                                           |
| --- | --------- | ------ | ------------ | ------------------------------------------------------ |
| 1   | `hook`    | 2.4 s  | product-shot | The ask bar alone on the stage; the question is typed  |
| 2   | `meet`    | 1.2 s  | statement    | "Meet Lumen."                                          |
| 3   | `reveal`  | 1.7 s  | product-shot | The whole app rises in; the cursor sends the question  |
| 4   | `answer`  | 1.7 s  | product-shot | The answer card alone, with a label                    |
| 5   | `proof`   | 1.3 s  | product-shot | Push in to the row the answer rests on; it is outlined |
| 6   | `share`   | 1.1 s  | product-shot | Close on the card's footer; the cursor clicks Share    |
| 7   | `shared`  | 1.3 s  | product-shot | The "Link copied" popover alone                        |
| 8   | `benefit` | 1.7 s  | statement    | "The answer, before the meeting starts."               |
| 9   | `close`   | 2.6 s  | brand-close  | Mark, name, tagline, address                           |

Shots 1 to 7 are one interaction seen at different scales, each cut on an action; the two statements name what
was just shown.

## 4. Compile and review

```bash
pnpm hyperstudio compile examples/saas-product-showcase/video.json
pnpm hyperstudio review  examples/saas-product-showcase/video.json
```

`compile` prints the shot table and lists seven placeholders (the brand, four screens, the mark, the sound).
`review` runs `hyperframes check` (0 errors, 0 warnings), takes 18 frames and starts `REVIEW.md`.

The answered rubric is [REVIEW.md](../examples/saas-product-showcase/REVIEW.md). Three rounds of looking at
frames changed the film:

| Seen in the frames                                   | Change                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| Labels sat on top of interface text                  | Components are isolated on the stage, so labels sit on the stage |
| Close-ups cut the window at odd edges, leaving voids | Shots frame a component or a whole row, not an arbitrary point   |
| The cursor covered the word on the button it clicked | The cursor aims below and right of a component's centre          |
| Three shots of the same card at nearly the same size | The `proof` shot cuts closer and pushes in                       |
| The closing line was on screen under two seconds     | The close runs longer and its lines arrive sooner                |

## 5. Render and verify

```bash
cd examples/saas-product-showcase/build
npx hyperframes render --quality looks -o ../renders/saas-product-showcase.mp4
```

Result: 15.000 s, 1920×1080, 30 fps, H.264 with AAC, about 3.5 MB; `ffprobe` duration equals the IR's. Frames
pulled from the rendered file at two per second match the snapshots.

## What is still not real

- The product, its data and its mark are an example.
- The sound is synthesised clicks and tones (`assets/make-sfx.mjs`). There is no music.
- Only Inter is used, because the example product's interface uses it.

## The other example

`examples/luxury-watch-commercial/` is a slow, three-scene film for a physical product, made with
`luxury-product-reveal`. Its average shot is 5.4 s, so `compile` warns that it is slow; that is its direction,
stated in its IR. The watch image and the music are placeholders.
