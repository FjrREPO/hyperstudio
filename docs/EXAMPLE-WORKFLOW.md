# Example workflow: luxury watch commercial

`examples/luxury-watch-commercial/` taken from a sentence to a verified MP4. The figures below are from the
run on 2026-11-19 (HyperFrames 0.9.69, Apple M4 Pro).

## 1. Brief

> A short commercial for the Noctis One watch. Dark luxury, cinematic, premium.

Decisions made from it: 16:9, about 16 s, three scenes with one job each — reveal the watch, prove the
movement, close on the name. One recipe (`luxury-product-reveal`) used three times with different layout,
camera and lighting so the scenes do not repeat.

The watch and the brand are fictional. `assets/noctis-one.svg` is a drawn stand-in and `assets/night-bed.m4a`
is a synthesised drone made with FFmpeg; a real project supplies the product photo and licensed music.

## 2. Creative IR

[`video.json`](../examples/luxury-watch-commercial/video.json):

| Scene     | Duration | Layout | Camera     | Lighting        | Entered by             |
| --------- | -------- | ------ | ---------- | --------------- | ---------------------- |
| `reveal`  | 6 s      | center | push-in    | dramatic        | fade from black, 0.8 s |
| `calibre` | 5 s      | left   | orbit ×0.8 | rim             | crossfade, 0.8 s       |
| `closing` | 6 s      | right  | pull-out   | soft, exit fade | fade, 0.8 s            |

`project.duration` is 16.2 s: 6 + 5 + 6, minus the 0.8 s the crossfade overlaps.

## 3. Validate and compile

```bash
pnpm hyperstudio compile examples/luxury-watch-commercial/video.json --validate-only --pretty
pnpm hyperstudio compile examples/luxury-watch-commercial/video.json --pretty
```

Result: 16.2 s, 486 frames, scenes starting at 0, 5.2 and 10.2 s, written to `build/` (`index.html`, three
scene files, two assets).

## 4. HyperFrames check

```bash
cd examples/luxury-watch-commercial/build
npx hyperframes check --json
```

Result: `ok: true`; lint, runtime, layout, motion, contrast, craft and audio all 0 errors and 0 warnings
(21 of 21 contrast samples passed).

The first run did not pass, and what it caught is now in the recipe guide: an image variable without a
`default`, an eyebrow below the 28 px reading floor, and intentional overflow that needed
`data-layout-allow-overflow`.

## 5. Snapshot inspection

```bash
npx hyperframes snapshot --at 0.5,1.6,3.5,5.6,7.5,9.8,10.2,12.5,15.8
```

Reviewed on the contact sheet and full frames: the watch resolves out of blur, the glint crosses its
silhouette, the headline rises word by word; the crossfade at 5.6 s shows both scenes; 10.2 s is the black
midpoint of the fade; the closing copy fades at the end. The review led to two changes: a wider orbit (it was
too subtle to read) and more room between the watch and the copy in the centered layout.

## 6. Render and verify

```bash
df -h .                                                      # 6.4 GB free at the time
npx hyperframes render --quality looks -o ../renders/noctis-one.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate ../renders/noctis-one.mp4
```

Result: 5.9 MB, rendered in 18 s. `ffprobe`: H.264 1920×1080 at 30 fps with AAC audio, duration 16.200 s —
equal to the IR. Audio mean −21.4 dB, peak −12.8 dB. Decoded frames at nine points match the snapshots.

`build/` and `renders/` are git-ignored; run the commands above to reproduce them.

## The other examples

The same steps were run for six more films on 2026-11-19. Each passes `hyperframes check` with 0 errors and
0 warnings, and each rendered file's duration equals its IR's.

| Example                   | Canvas | Length | What it shows                                         |
| ------------------------- | ------ | ------ | ----------------------------------------------------- |
| `saas-product-launch`     | 16:9   | 23 s   | Four recipes in one film under one `style`            |
| `kinetic-typography`      | 16:9   | 13.6 s | Both text modes, all three entrances, three typefaces |
| `data-visualization`      | 16:9   | 18.4 s | Split, stacked and number-only data scenes            |
| `web3-protocol-promo`     | 16:9   | 18.2 s | Product screen plus a counted figure                  |
| `luxury-brand-commercial` | 16:9   | 19.6 s | Serif kinetic type around two product reveals         |
| `social-short`            | 9:16   | 16.3 s | Portrait layouts inside the social safe areas         |

What the checks caught on the first pass, and how the IR fixed it:

- **Text crossfading over text** in the same area (`content_overlap`): changed those transitions to `fade`.
- **A line on screen too briefly** (`line_unread`): lengthened the scene. A line needs about 0.5 s plus
  0.3 s per word, and a film's last line at least 2 s.
- **Only background on frame 0** (`first_frame_empty`): fixed in the recipe, and the luxury film now opens
  on a cut instead of a fade from black.

## With Claude Code

`pnpm skill:link` makes the `hyperstudio-director` skill available in this repo. Then a request such as
"make a 15-second commercial for this product, dark and premium" follows the same steps: plan, IR, compile,
check, snapshot review, render.
