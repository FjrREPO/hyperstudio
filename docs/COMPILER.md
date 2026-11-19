# Compiler

`packages/compiler` is the only code that knows HyperFrames. `compile(irPath, options)` reads a Creative IR
and writes a HyperFrames project; the CLI is a thin wrapper around it.

| Module       | Responsibility                                                                          |
| ------------ | --------------------------------------------------------------------------------------- |
| `compile.ts` | Orchestration: read the IR, plan scenes and timing, collect problems, write the project |
| `recipes.ts` | Load recipes and validate one value against one variable declaration                    |
| `values.ts`  | Resolve the values a scene hands its recipe; the art-direction rules on values          |
| `emit.ts`    | Everything in HyperFrames' format: `index.html`, scene files, `STORYBOARD.md`           |
| `errors.ts`  | `Issue` and `CompileError`                                                              |

## Command line

```bash
hyperstudio compile <ir.json> [--output <dir>] [--validate-only] [--json | --pretty]
hyperstudio review  <ir.json> [--output <dir>]
hyperstudio recipes [name] [--json | --pretty]
```

`compile` prints a summary by default: the shot table, placeholders and warnings. With `--json` it prints
`{ ok, duration, frames, scenes[], audio[], files[], warnings[], placeholders[], output }`, or
`{ ok: false, errors: [{ path, message }] }`. All problems are reported at once, each with a path into the IR.

Exit codes: 0 success, 1 the IR was rejected or a check failed, 2 the command line was wrong.

`review` compiles, runs `npx hyperframes check --json`, snapshots two frames per shot with
`npx hyperframes snapshot`, and writes a `REVIEW.md` rubric beside the IR if there is none. It runs
HyperFrames' own commands; it reimplements none of them.

## What compile does

1. **Validates the IR** against the schema (unknown keys rejected).
2. **Builds the stage** from `style.background` and `style.light`.
3. **Places screens**: copies each screenshot, checks its regions lie inside it.
4. **Resolves each scene**: its recipe, its screen, its values against the recipe's declarations.
5. **Applies the art-direction rules** (below).
6. **Calculates timing in whole frames**, then converts back to seconds for output.
7. **Emits the project**.

## Art-direction rules

These are the things a compiler can check. They catch carelessness; they do not measure taste.

| Rule                                                  | Why                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| Brand variables (`role: brand`) only in `style`       | A film has one palette and one type system                        |
| No shot may frame the same thing as the one before it | Repetition is what makes a film read as a template                |
| Copy within each variable's `maxLength`               | Long copy breaks the composition it was designed for              |
| A statistic (`role: statistic`) needs `sources`       | Figures are never invented                                        |
| Region names must exist on the scene's screen         | A shot points at a real component                                 |
| Shot length within the recipe's range                 | A recipe is built for a range; outside it the shot rushes or dies |
| Warning: average shot above 3.5 s                     | A product film that slow reads as a slideshow                     |
| Warning: fade into the first scene                    | Frame 0 is the thumbnail                                          |
| Every placeholder is listed                           | A stand-in never passes silently                                  |

## What it writes

| File                               | Content                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                       | The stage, one host per scene (`data-composition-src`, `data-start`, `data-duration`, `data-variable-values`), `<audio>` clips, and one paused GSAP timeline holding the transitions and the stage light |
| `compositions/<sceneId>.html`      | The recipe's scene file, instanced for that scene                                                                                                                                                        |
| `STORYBOARD.md`                    | The direction and the shots, in the format HyperFrames reads                                                                                                                                             |
| `assets/*`                         | Copies of referenced files                                                                                                                                                                               |
| `hyperframes.json`, `package.json` | Written once if missing, then left alone                                                                                                                                                                 |

Generated files carry a `hyperstudio:generated` marker. On recompile, generated scene files the IR no longer
has are removed; files without the marker are never touched.

### The stage

One background and its light: `soft` is one pale light that moves once across the whole film; `aurora` is
three glows in the film's `accent` and `glow` colours that drift once across it, under a vignette and grain. It is drawn in
`index.html` behind every scene, and recipes are transparent. A cut therefore changes the picture and not the
place. Fades dip to the stage colour, not to black.

### Live pages

For a screen given as `html`, the compiler reads the page, drops its scripts and comments, renames its custom
properties, and writes its styles and markup into the scene file as one line of JSON. The recipe mounts that
in a shadow root. Region and state names are taken from the page, so a beat that names one the page does not
have is rejected at compile time.

### Instancing a recipe

A recipe uses its own name as composition id and as the prefix of every element id. The compiler replaces
that one token with the scene id, sets `data-duration`, `data-width` and `data-height` on the scene root, and
writes the recipe's variable declarations onto it. Each scene gets its own id scope, so one recipe can be used
any number of times in a film.

### What stays native

- **Values** reach a scene through HyperFrames' `data-variable-values`; the recipe reads them with
  `window.__hyperframes.getVariables()`.
- **Audio** is plain `<audio class="clip">`; HyperFrames mixes it.
- **Transitions** are single tweens on the root timeline.

## Determinism

The same IR, recipes and assets give byte-identical output (covered by tests against golden files). The
compiler writes no timestamps, uses no randomness, and emits scenes in IR order. `package.json` is the one
exception: it carries the output folder's name.

## Registry integration (verified against HyperFrames 0.9.69)

| Question               | Finding                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry configuration | `hyperframes.json#registry`, one URL                                                                                                                                                        |
| Local paths            | **Not supported.** A `file://` URL fails with "registry unreachable or empty"; a bare path fails with "Invalid URL". The CLI source requires an absolute `https://` URL without credentials |
| Local recipe discovery | None in HyperFrames; `hyperstudio recipes` reads our folder directly                                                                                                                        |
| Parameter validation   | HyperFrames validates `add --vars` against the registry; for local recipes the compiler validates                                                                                           |
| Installation           | The compiler copies the recipe file, which is what `hyperframes add` does for a block                                                                                                       |
| Compatibility          | Compiled projects pass `hyperframes check`, `snapshot` and `render` unchanged. `catalog` and `add` keep working against the public registry                                                 |

Recipes keep the upstream registry-item format (plus the `hyperstudio` key and `role` values), so serving
`packages/recipes/blocks` over HTTPS would make them installable with `hyperframes add`. That is untested.

## Limits

- Recompiling overwrites generated files. Manual or Studio edits there are lost.
- Files are copied, not probed: a broken image is caught later by `hyperframes check`.
- An audio clip's real length is not read; without `duration` it is given the rest of the film.
