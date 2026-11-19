# HyperStudio architecture

HyperStudio is a creative direction layer on HyperFrames, not a framework beside it. Two earlier shapes were
dropped: a 13-package engine ([research](HYPERFRAMES-RESEARCH.md)), and slide-style recipes whose output was
rejected as generic ([review and proposal](CREATIVE-QUALITY-PROPOSAL.md)). Decisions are in
[TECHNICAL-DECISIONS.md](TECHNICAL-DECISIONS.md).

## Who owns what

| Concern                                                  | Owner                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Direction, storyboard, judgement                         | Claude, through the `hyperstudio-director` skill, and then the person |
| The plan, and what in it is real                         | Creative IR (`@hyperstudio/ir`)                                       |
| One shot's design                                        | Recipes (`@hyperstudio/recipes`)                                      |
| Turning the plan into a project, refusing careless plans | Compiler (`@hyperstudio/compiler`)                                    |
| Animation, variables, audio, validation, render          | HyperFrames                                                           |
| Whether the film is good                                 | Review of real frames, written in `REVIEW.md`                         |

## Flow

```
product (capture) ─┐
brief ─────────────┼─▶ direction ─▶ shots ─▶ Creative IR ─▶ hyperstudio compile ─▶ HyperFrames project
                   │                              ▲                                      │
                   │                              │                       hyperstudio review:
                   │                              │                       hyperframes check + frames + REVIEW.md
                   │                              └──── revise the IR ◀──────────────────┤
                   │                                                                     ▼
                   └──────────────────────────────────────────────────────── render ─▶ look at the file
```

## Repository

```
packages/
  ir/          @hyperstudio/ir        Zod schema. Depends on nothing else here.
  recipes/     @hyperstudio/recipes   blocks/<name>/{registry-item.json, <name>.html}; exports RECIPES_DIR.
  compiler/    @hyperstudio/compiler  compile.ts, recipes.ts, values.ts, emit.ts, errors.ts
  assets/      @hyperstudio/assets    providers.ts, license.ts, http.ts, search.ts, ledger.ts (on refkit)
  cli/         hyperstudio            cli.ts, commands/{compile,review,recipes,assets}.ts, output.ts
skills/hyperstudio-director/          Claude Code skill
examples/                             A film per folder: video.json, screens/, assets/, REVIEW.md
tests/
  integration/                        The CLI as a process; opt-in run against the HyperFrames CLI
  regression/                         Golden project output and fixed-bug cases
docs/
```

Unit tests sit beside the code they test. Dependencies point one way: `cli → compiler → ir, recipes`, and `cli → assets`. The compiler does not depend on `assets`; it only reads the `LICENSES.json` ledger beside a film's files. Only
`compiler/emit.ts` writes HyperFrames' format, so a change upstream is a change in one file. Packages are
consumed as TypeScript source through pnpm workspace links; there is no build step.

## Design rules

- **The unit is a shot, not a slide.** A recipe shows one thing for a second or two and cuts.
- **One stage per film.** Background and light are drawn once behind every scene; recipes are transparent.
- **The product is real.** Product shots use screenshots with named regions; nothing is drawn to stand in.
- **Direction is data.** The IR records it; the compiler enforces what can be enforced; review covers the rest.
- **The IR is framework-agnostic**: no HTML, CSS, GSAP or `data-*` attributes.
- **A recipe is a HyperFrames registry block**, so there is no separate preset engine.
- **The compiler is deterministic.**
- **Nothing HyperFrames already does is rebuilt.**

## Tooling

pnpm workspace · TypeScript strict, run directly by Node 24 · Zod 4 · Biome · `node:test` · Husky
(`pre-commit`: Biome on staged files and type check; `pre-push`: tests) · GitHub Actions.
