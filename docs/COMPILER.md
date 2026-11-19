# Compiler

`packages/compiler/src/index.ts` is the only code that knows HyperFrames. `compile(irPath, options)` reads a
Creative IR and writes a HyperFrames project; the CLI is a thin wrapper around it.

```bash
pnpm hyperstudio compile <ir.json> [--output <dir>] [--validate-only] [--pretty]
```

| Flag              | Meaning                                                 |
| ----------------- | ------------------------------------------------------- |
| `--output`, `-o`  | Project directory. Default: `build/` beside the IR file |
| `--validate-only` | Validate and report timing; write nothing               |
| `--pretty`        | Indent the JSON printed to stdout                       |

Exit code 0 prints `{ ok: true, duration, frames, scenes[], audio[], files[], output }`.
Exit code 1 prints `{ ok: false, errors: [{ path, message }] }`. All problems are reported at once.

## What it does

1. **Validates the IR** against the Zod schema (unknown keys rejected).
2. **Resolves recipes** from `packages/recipes/blocks/<name>/registry-item.json`. An unknown name lists the available ones.
3. **Validates values** against each recipe's variable declarations, and its `minDuration`, `maxDuration` and `required`.
4. **Resolves assets**: checks that each file exists and copies it to `assets/<basename>`. Two different files with the same basename are an error.
5. **Calculates timing in whole frames**, then converts back to seconds for output.
6. **Emits the project**.

## What it writes

| File                               | Content                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                       | Root composition: one host per scene (`data-composition-src`, `data-start`, `data-duration`, `data-variable-values`), `<audio>` clips, and one paused GSAP timeline holding the transitions |
| `compositions/<sceneId>.html`      | The recipe's scene file, instanced for that scene                                                                                                                                           |
| `assets/*`                         | Copies of referenced files                                                                                                                                                                  |
| `hyperframes.json`, `package.json` | Written once if missing, then left alone                                                                                                                                                    |

Scene files carry a `hyperstudio:generated` marker. On recompile, generated scene files that the IR no longer
has are removed; files without the marker are never touched.

### Instancing a recipe

A recipe uses its own name as composition id and as the prefix of every element id. The compiler replaces
that one token with the scene id, sets `data-duration`, `data-width` and `data-height` on the scene root, and
writes the recipe's variable declarations onto it as `data-composition-variables`. That gives each scene its
own id scope, so one recipe can be used any number of times in a project.

### What stays native

- **Values** reach a scene through HyperFrames' own `data-variable-values`; the recipe reads them with
  `window.__hyperframes.getVariables()`. The compiler does not bake values into HTML.
- **Audio** is plain `<audio class="clip">` with `data-volume`, `data-fade-in`, `data-fade-out`; HyperFrames mixes it.
- **Transitions** are single tweens on the root timeline: opacity of the incoming host for a crossfade, opacity
  of a black overlay for a fade.

## Determinism

The same IR, recipes and assets produce byte-identical output (covered by a test). The compiler writes no
timestamps, uses no randomness, and emits scenes in IR order. `package.json` is the one exception: it carries
the output folder's name.

## Registry integration (verified against HyperFrames 0.9.69)

| Question               | Finding                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry configuration | `hyperframes.json#registry`, one URL                                                                                                                                                        |
| Local paths            | **Not supported.** A `file://` URL fails with "registry unreachable or empty"; a bare path fails with "Invalid URL". The CLI source requires an absolute `https://` URL without credentials |
| Local recipe discovery | None in HyperFrames; `hyperstudio recipes` reads our folder directly                                                                                                                        |
| Parameter validation   | HyperFrames validates `add --vars` against the registry; for local recipes the compiler does this validation itself                                                                         |
| Installation           | The compiler copies the recipe file, which is what `hyperframes add` does for a block                                                                                                       |
| Compatibility          | Compiled projects pass `hyperframes check`, `snapshot`, `render` unchanged. `catalog` and `add` keep working against the public registry because `hyperframes.json` still points at it      |

Recipes keep the upstream registry-item format, so serving `packages/recipes/blocks` over HTTPS would make
them installable with `hyperframes add`. That is untested.

## Limits

- Recompiling overwrites `index.html` and generated scene files. Manual or Studio edits there are lost.
- No incremental compile; every run rewrites the whole project (it takes milliseconds).
- Asset files are copied, not probed: a wrong format or a broken image is caught later by `hyperframes check`.
- An audio clip's real length is not read. If `duration` is omitted the clip is given the rest of the video.
