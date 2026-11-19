# HyperStudio architecture

HyperStudio is a creative layer on HyperFrames, not a framework beside it. The original 13-package plan was
dropped after the research in [HYPERFRAMES-RESEARCH.md](HYPERFRAMES-RESEARCH.md); the reasoning is in
[TECHNICAL-DECISIONS.md](TECHNICAL-DECISIONS.md).

## Who owns what

| Concern                             | Owner                                                |
| ----------------------------------- | ---------------------------------------------------- |
| Creative thinking, storyboard       | Claude, through the `hyperstudio-director` skill     |
| The plan                            | Creative IR (`@hyperstudio/ir`)                      |
| Cinematic direction of a shot       | Recipes (`@hyperstudio/recipes`)                     |
| Turning the plan into a project     | Compiler (`@hyperstudio/compiler`)                   |
| Animation, variables, audio, render | HyperFrames                                          |
| Validation and visual QA            | HyperFrames `check` / `snapshot`, reviewed by Claude |

## Flow

```
brief ──▶ Creative IR (JSON) ──▶ hyperstudio compile ──▶ HyperFrames project ──▶ hyperframes check
                 ▲                      │                                              │
                 │                recipes (registry blocks)                     snapshot ─▶ render
                 └──────────── fix the IR, recompile ◀──────────────────────────────────┘
```

## Repository

```
packages/
  ir/          @hyperstudio/ir        Zod schema. No dependency on anything else here.
  recipes/     @hyperstudio/recipes   blocks/<name>/{registry-item.json, <name>.html}; exports RECIPES_DIR.
  compiler/    @hyperstudio/compiler  compile(), listRecipes(). Depends on ir and recipes.
  cli/         hyperstudio            Argument parsing and JSON output. Depends on compiler.
skills/hyperstudio-director/          Claude Code skill
examples/                             IR files with their assets
tests/
  integration/                        The CLI as a process; opt-in run against the HyperFrames CLI
  regression/                         Golden project output and fixed-bug cases
docs/
```

Unit tests sit beside the code they test (`packages/*/src/*.test.ts`).

Dependencies point one way: `cli → compiler → ir, recipes`. Only `compiler` knows HyperFrames' format, so a
change upstream is a change in one file. Packages are consumed as TypeScript source through pnpm workspace
links; there is no build step.

## Design rules

- **The IR is framework-agnostic.** It names recipes and values. No HTML, CSS, GSAP or `data-*` attributes.
- **A recipe is a HyperFrames registry block.** Its parameters are upstream's typed variables, so no separate
  preset engine exists. Adding a recipe is adding a folder.
- **The compiler is deterministic.** Same IR, recipes and assets give byte-identical output.
- **Nothing HyperFrames already does is rebuilt**: no renderer, validator, timeline engine, asset pipeline,
  MCP server or editor.

## Tooling

pnpm workspace · TypeScript strict, run directly by Node 24 · Zod 4 · Biome (lint + format) ·
`node:test` · Husky (`pre-commit`: Biome on staged files + type check; `pre-push`: tests).

## Next

Four recipes and seven examples exist. Likely next steps, when a real film needs them: wiring HyperFrames'
registry transitions into the IR, and layering more than one recipe in a scene.
