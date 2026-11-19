# Contributing

## Setup

```bash
pnpm install        # also installs the git hooks
pnpm verify         # Biome, type check, tests
```

Node 24 or newer and pnpm 12. Rendering needs FFmpeg and Chrome; `npx hyperframes doctor` checks both.

Update every dependency in the workspace with `pnpm deps:update` (npm-check-updates, then install and verify).

## Before you build something

HyperStudio does two things: a plan format with its compiler, and cinematic recipes. Anything HyperFrames
already does (rendering, validation, timeline editing, media, its registry) is used, not rebuilt. If a change
duplicates HyperFrames, it will not be merged; see [docs/TECHNICAL-DECISIONS.md](docs/TECHNICAL-DECISIONS.md).

## Workflow

1. Open or pick an issue. Every issue carries one `type:` label and one or more `area:` labels.
2. Branch from `main`: `feat/...`, `fix/...`, `chore/...`, `docs/...`.
3. Commit small, one concern per commit, in [Conventional Commits](https://www.conventionalcommits.org) form
   with the package as scope: `feat(compiler): ...`, `test(ir): ...`. Reference the issue in the body: `Refs #12`.
4. Open a pull request that closes the issue. Area labels are applied from the paths you touched; add the `type:` label.

Hooks run Biome on staged files and the type check before a commit, and the tests before a push.

## Tests

| Kind                        | Where                             | Run                                       |
| --------------------------- | --------------------------------- | ----------------------------------------- |
| Unit                        | `packages/*/src/*.test.ts`        | `pnpm test:unit`                          |
| Integration                 | `tests/integration/`              | `pnpm test:integration`                   |
| Regression                  | `tests/regression/`               | `pnpm test:regression`                    |
| Against the HyperFrames CLI | `tests/integration/*.e2e.test.ts` | `pnpm test:e2e` (needs `npx` and network) |

A recipe or compiler change alters the golden files. Review the diff, then accept it with `pnpm test:update`.
A bug fix comes with a regression test that fails without the fix.

## Recipes

Follow [docs/RECIPE-DEVELOPMENT.md](docs/RECIPE-DEVELOPMENT.md). A recipe is done when a project that uses it
twice passes `npx hyperframes check --json` with no errors, in landscape and in portrait, and you have looked
at snapshots of its entrance, hold and exit.
