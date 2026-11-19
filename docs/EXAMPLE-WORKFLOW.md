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

## 3. Shots

The light cut is four shots: a line of type, one 9.2 s take, a line of type, the brand. The take's beats:

| At    | Beat                                                        |
| ----- | ----------------------------------------------------------- |
| 0.1 s | Camera pushes in to the ask bar                             |
| 0.8 s | The question is typed                                       |
| 2.6 s | Click on send; the interface switches to `thinking`         |
| 3.6 s | It switches to `answer`; the answer's parts arrive in order |
| 4.0 s | The chart's lines are drawn                                 |
| 5.1 s | Camera moves to the Team row; it is outlined                |
| 7.2 s | Click on Share; the popover opens                           |
| 8.3 s | Camera pulls back to the whole answer                       |

The dark cut divides the same actions into two takes around one line of type.

## 4. Compile and review

```bash
pnpm hyperstudio review examples/saas-product-showcase/video.json --motion
pnpm hyperstudio review examples/saas-product-showcase/video-dark.json --output examples/saas-product-showcase/build-dark --motion
```

`review` compiles, runs `hyperframes check` (0 errors, 0 warnings for both), takes two frames per shot, and
with `--motion` renders a draft and measures it: 18% and 21% of frames still, the longest freeze 1.7 s and
1.6 s, both on the closing mark. The strips in `build/.hyperstudio/` show each take at eight frames a second.
The answers are in `REVIEW.md`.

## 5. Render and verify

```bash
cd examples/saas-product-showcase/build
npx hyperframes render --quality looks -o ../renders/saas-product-showcase.mp4
```

Result: 14.700 s (light) and 15.600 s (dark), 1920×1080, 30 fps, H.264 with AAC, about 5 and 6 MB; `ffprobe`
durations equal the IRs'. Frames pulled from the rendered files at two per second were looked at.

## What is still not real

- The product, its data and its mark are an example.
- The sound is synthesised clicks and tones (`assets/make-sfx.mjs`). There is no music.

## The other examples

`examples/meeting-notes-launch/` is a second product shown from screenshots with `product-shot`: the way to
work when a product can only be captured.

`examples/luxury-watch-commercial/` is a slow, three-scene film for a physical product, made with
`luxury-product-reveal`. Its average shot is 5.4 s, so `compile` warns that it is slow; that is its direction,
stated in its IR. The watch image and the music are placeholders.
