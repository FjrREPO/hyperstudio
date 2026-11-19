# Benchmarks

Two films are frozen as the quality baseline. A change to the compiler or a recipe should leave both at
least as good; a new film should be judged against them, not copied from them.

Each benchmark is a git tag. At that tag, the example folder holds everything that produced the film:

| What                | Where                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| Creative brief      | `direction` in `video.json` (eight sentences, written before any beat)  |
| Storyboard and plan | `scenes[].beats` in `video.json`; `build/STORYBOARD.md` after a compile |
| Product             | `product/*.html`, the live pages the film drives                        |
| Sound               | `assets/` (with `LICENSES.json` where a licence applies)                |
| Review              | `REVIEW.md`: timeline, rubric and remaining weaknesses                  |

## Reproducing one

```bash
git checkout <tag>
pnpm install
pnpm hyperstudio review examples/<folder>/video.json --motion
cd examples/<folder>/build
npx hyperframes@0.9.69 render --quality looks -o ../renders/<name>.mp4
```

HyperFrames is pinned to 0.9.69; Node 24. The same IR, recipes and assets compile to byte-identical projects
(`pnpm test:regression` holds the compiled output of both). The rendered file is not kept in git.

## Lumen benchmark v1

- Tag `lumen-benchmark-v1`, folder `examples/saas-product-showcase`, file `video.json`
- 29.6 s, 1920×1080, 30 fps. Two takes: `product/before.html` (7.4 s), `product/index.html` (22.2 s)
- Direction: editorial. A serif headline and the product trade places on a stone stage; the camera is flat
- Measured at the tag: `hyperframes check` 0 errors, 0 warnings; the take's audit silent; 35% of frames
  still; mean level -22.5 dB with the music bed
- Music: "Inspire Action" by Yuri Megis, CC BY 4.0, Wikimedia Commons. Credit is owed wherever it is shown
- Placeholders: the product and both interfaces are examples; the interface sounds are synthesised

## Marlow benchmark v1

- Tag `marlow-benchmark-v1`, folder `examples/marlow-launch-film`, file `video.json`
- 29.0 s, 1920×1080, 30 fps. One take of `product/index.html`
- Direction: observational. The product fills the frame and the words run in a band beneath it; the camera
  travels across the page
- Measured at the tag: `hyperframes check` 0 errors, 0 warnings; the take's audit silent; 29% of frames
  still. No music
- Placeholders: the product and its interface are an example; the interface sounds are synthesised

## The two, side by side

Made with the same recipe (`product-take`) and compiler. Everything below was decided in the plan.

|                           | Lumen                                           | Marlow                                                 |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Structure                 | The old way, a cut, the product, the brand      | One user's six minutes after a meeting, no cut         |
| Where the problem is told | A headline and a second interface               | The product's own content: the transcript's last lines |
| Composition               | Headline and product trade places on a stage    | Product edge to edge; a band of type beneath           |
| Type                      | Playfair Display, two scales, five placements   | Outfit, one size, one place                            |
| Camera                    | Pushes in and reframes                          | Travels: down, across, down                            |
| How the product enters    | Through its question bar, which opens           | It is there at frame 0                                 |
| Ending                    | The interface closes like an iris onto its mark | The camera pulls back and leans; the name set in type  |
| Sound                     | Music bed and interface sounds                  | Interface sounds only                                  |

## Relay (not yet frozen)

- Folder `examples/relay-deploy-film`, file `video.json`. No tag: nobody but its author has watched it
- 27.4 s, 1920×1080, 30 fps. One take of `product/index.html`, a deploy tool for engineers
- Direction: dimensional. A black stage, the interface as an object a wide lens circles, a new angle for each
  stage of the deploy, and no type of the film's own: the log and a voice tell it
- Measured: `hyperframes check` 0 errors, 1 warning (the first frame is nearly empty); 42% of frames still;
  mean level -22.6 dB
- Placeholders: the product and its interface are examples; the interface sounds are synthesised

## Comparing them

`pnpm hyperstudio compare <a>/video.json <b>/video.json` reads two plans and lists eleven decisions (stage, type,
how the product sits, camera, entrance, structure, ending, sound) and whether the films made the same one.
Today: Lumen and Marlow share 2 of 11 (a light stage, large type); Lumen and Relay share none; Marlow and
Relay share 4 (bare product, present from frame 0, one take, the same kinds of sound). It reads plans, not
pictures: two films can differ on every row and still feel alike, and only a viewer can say so.

## Since v1

On `main` both films also carry narration generated locally with Kokoro (see
[AUDIO-ENGINE.md](AUDIO-ENGINE.md)). The v1 tags are the films without it.

## What these benchmarks do not establish

- Both interfaces were written by the same hand as the films, to suit them. Neither is a real product.
- Nobody has judged easing, rhythm or sound by watching and listening; the reviews are from frames,
  measurements and strips.
- Two films are two data points. A third product, not written for the purpose, is the next real test.
