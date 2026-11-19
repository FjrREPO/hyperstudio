# HyperStudio

[![CI](https://github.com/FjrREPO/hyperstudio/actions/workflows/ci.yml/badge.svg)](https://github.com/FjrREPO/hyperstudio/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A creative layer on top of [HyperFrames](https://github.com/heygen-com/hyperframes). You describe a video as a
small JSON plan; HyperStudio validates it and writes a HyperFrames project; HyperFrames checks, previews and
renders it.

HyperStudio adds two things HyperFrames does not have, and nothing else:

1. **Creative IR + deterministic compiler** — a typed plan (scenes, recipes, values, transitions, audio) that
   compiles to the same project every time.
2. **Cinematic recipes** — whole shots with composition, timing, motion, camera, lighting and typography
   already decided, written in HyperFrames' own registry block format.

Animation, variable binding, audio mixing, validation, snapshots and rendering stay with HyperFrames.

## Requirements

Node ≥ 24, pnpm 10, FFmpeg, and Chrome (HyperFrames uses them; `npx hyperframes doctor` checks).

## Quick start

```bash
pnpm install
pnpm hyperstudio recipes --pretty                                             # what you can use
pnpm hyperstudio compile examples/luxury-watch-commercial/commercial.json    # writes .../build/

cd examples/luxury-watch-commercial/build
npx hyperframes check --json
npx hyperframes snapshot
npx hyperframes render --quality looks -o ../renders/noctis-one.mp4
```

## Layout

```
packages/
  ir/          @hyperstudio/ir        Zod schema of the Creative IR
  compiler/    @hyperstudio/compiler  IR → HyperFrames project (the only code that knows HyperFrames)
  recipes/     @hyperstudio/recipes   blocks/<name>/{registry-item.json, <name>.html}
  cli/         hyperstudio            `hyperstudio compile`, `hyperstudio recipes`
skills/
  hyperstudio-director/               Claude Code skill: brief → IR → compile → check → render
examples/
  luxury-watch-commercial/            IR + assets; build/ and renders/ are generated
docs/                                 research, architecture, specifications
```

## Commands

| Command                                                                          | Does                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm hyperstudio compile <ir.json> [--output dir] [--validate-only] [--pretty]` | Validate an IR and write a project                                 |
| `pnpm hyperstudio recipes [--pretty]`                                            | List recipes and their variables                                   |
| `pnpm verify`                                                                    | Biome lint, type check and tests                                   |
| `pnpm lint:fix`                                                                  | Apply Biome fixes and formatting                                   |
| `pnpm skill:link`                                                                | Link the skill into `.claude/skills/` for Claude Code in this repo |

Husky runs Biome on staged files and the type check before each commit, and the tests before each push.

## Documentation

- [IR specification](docs/IR-SPECIFICATION.md)
- [Compiler](docs/COMPILER.md)
- [Recipe development](docs/RECIPE-DEVELOPMENT.md)
- [Example workflow](docs/EXAMPLE-WORKFLOW.md)
- [Architecture](docs/ARCHITECTURE.md) · [Technical decisions](docs/TECHNICAL-DECISIONS.md) ·
  [HyperFrames research](docs/HYPERFRAMES-RESEARCH.md)

## Limits

- One recipe exists so far: `luxury-product-reveal`.
- One recipe per scene; recipes are not layered inside a scene.
- Transitions are `cut`, `fade` and `crossfade`. HyperFrames' registry and shader transitions are not wired in.
- Camera moves are 2.5D simulations on flat images.
- `build/` is regenerated on every compile, so manual or Studio edits there do not survive.
- The CLI runs as TypeScript through Node's type stripping, so it works from a checkout, not as an installed dependency.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE). HyperFrames is a separate project under Apache-2.0.
