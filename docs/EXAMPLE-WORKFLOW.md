# Example workflow: one product, two art directions

`examples/saas-product-showcase/` from a brief to two reviewed, rendered films of the same product. This is
the quality benchmark. Two earlier cuts were rejected as template-like; why, and what changed, is in
[TECHNICAL-DECISIONS.md](TECHNICAL-DECISIONS.md) (D25, D26). Figures below are from 2026-11-19
(HyperFrames 0.9.69, Apple M4 Pro).

**Lumen is an example product.** No real product was supplied, so its interface was written for this film and
everything about it is marked as a placeholder. The method is the one a real product goes through.

## 1. The product, as a live page

`product/index.html` is the interface as one HTML file. Everything sits in an `.app` element, and what is
shown depends only on its `data-state`: `home`, `asked`, `thinking`, `answer`, `share`. Components a film
uses carry `data-region`; parts of the answer that should arrive one by one carry `data-reveal`, and the
chart's lines carry `data-draw`. Open the file with `#answer` to see a state.

The film mounts this page and drives it. Nothing is screenshotted.

## 2. Two directions

Written before any shot (see `direction` in each file):

|             | `video.json`                                | `video-dark.json`                             |
| ----------- | ------------------------------------------- | --------------------------------------------- |
| Concept     | One question asked and answered in one take | The product as the only light on a dark stage |
| Structure   | Journey, interaction, result                | The old way, reveal, proof, brand             |
| Stage       | Plain cool grey                             | Plain black                                   |
| The product | Flat and frontal, in a window               | Leaning back, then turned, in shallow focus   |
| Type        | Inter, left on the margin                   | Playfair Display, centred                     |

## 3. The 30-second film

`video.json` is two takes with one cut between them.

| Time     | Take     | What happens                                                                                                                                                                                                         |
| -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.0-7.4  | `before` | `product/before.html`: an export scrolls, a thread opens, a reply is typed and goes unanswered                                                                                                                       |
| 7.4-30.2 | `lumen`  | `product/index.html`: the question bar alone, the question typed, the bar opens into the product, the answer arrives, it is filed to a board, a follow-up is asked and answered, the product closes down to its mark |

The film's own lines are `say` beats inside the takes, in a different place each time. `video-dark.json` is a
15-second cinematic cut of the same product page.

## 4. Compile and review

```bash
pnpm hyperstudio review examples/saas-product-showcase/video.json --motion
```

`review` compiles, runs `hyperframes check` (0 errors, 0 warnings), takes two frames per take, and with
`--motion` renders a draft and measures it: 32% of frames still, the longest freeze 1.6 s. The strips in
`build/.hyperstudio/` show each take at eight frames a second. The answers are in `REVIEW.md`.

## 5. Render and verify

```bash
cd examples/saas-product-showcase/build
npx hyperframes@0.9.69 render --quality looks -o ../renders/saas-product-showcase-30s.mp4
```

Result: 30.200 s, 1920×1080, 30 fps, H.264 with AAC, about 9.5 MB; `ffprobe` duration equals the IR's. Frames
pulled from the rendered file at one per second were looked at.

## What is still not real

- The product, its data and its mark are an example.
- The sound is synthesised clicks and tones (`assets/make-sfx.mjs`). There is no music.

## The other examples

`examples/meeting-notes-launch/` is a second product shown from screenshots with `product-shot`: the way to
work when a product can only be captured.

`examples/luxury-watch-commercial/` is a slow, three-scene film for a physical product, made with
`luxury-product-reveal`. Its average shot is 5.4 s, so `compile` warns that it is slow; that is its direction,
stated in its IR. The watch image and the music are placeholders.
