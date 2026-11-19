# HyperStudio architecture

Status: proposal after Phase 1. The original 13-package plan is **not** recommended — see
[TECHNICAL-DECISIONS.md](TECHNICAL-DECISIONS.md). Research basis: [HYPERFRAMES-RESEARCH.md](HYPERFRAMES-RESEARCH.md).

## Brief → finding

| Planned module | HyperFrames already has | Build? |
| --- | --- | --- |
| Project / Scene / Timeline engines | Composition format, `@hyperframes/sdk`, `timeline` CLI edits | No |
| Motion presets | GSAP + 238 registry components with typed variables | Only new recipes |
| Camera | ~11 camera/parallax registry items | Only new recipes |
| Transitions | Registry transitions + `@hyperframes/shader-transitions` | Only new recipes |
| Effects | Registry effects + `media-treatment` | Only new recipes |
| Typography | Registry kinetic type + caption styles | Only new recipes |
| Asset / Audio engines | `assets/`, `media-use` skill, `data-volume`/fades/automation, FFmpeg mix | No |
| Renderer | `render` CLI, `@hyperframes/producer` (async job + progress) | No |
| Validator / QA | `check --json`, `snapshot`, `compare` | No |
| CLI | `hyperframes` (~40 commands) | One command |
| MCP server | Hosted only | No (Claude Code drives the CLI through skills) |
| Skills ×6 | 6 installed that cover the same loop | One |
| **Composition IR → project** | Storyboard is advisory; nothing compiles a plan | **Yes** |
| **Cinematic recipe library** | Generic items; no "luxury product reveal"-level sequences | **Yes** |

## What HyperStudio is

Two things HyperFrames lacks, and nothing else:

```
hyperstudio/
├── src/
│   ├── ir.ts          Zod schema: project + scenes[{ id, recipe, duration, vars, transition }]
│   ├── compile.ts     IR → index.html + hyperframes add <recipe> --vars per scene
│   └── cli.ts         hyperstudio compile <ir.json> <dir>   (then: npx hyperframes check / render)
├── registry/          Our recipes, in HyperFrames' own registry-item format
│   └── blocks/<recipe>/{registry-item.json, <recipe>.html, demo.html}
├── skills/hyperstudio/SKILL.md   When to write an IR, which recipes exist, then defer to hyperframes skills
├── examples/*.json    The seven example videos as IR files
└── package.json       Single package. zod + hyperframes. No workspace.
```

- **A recipe is a registry block.** "Motion Recipe System" = one HTML scene with a GSAP timeline that
  sequences camera, reveal, particles and light, with its parameters as typed `variables`. HyperFrames
  already documents, validates, searches and installs that format, so recipes need no engine of ours.
- **The IR is framework-agnostic** (scene order, durations, recipe names, variable values, transitions).
  `compile.ts` is the only file that knows HyperFrames — it is the "adapter", as a file not a package.
- **Everything after compile is HyperFrames**: `check`, `snapshot`, `preview`, `render`.
- Camera recipes are 2D/2.5D transform simulations and say so in their descriptions.

## Phases (replacing the eight in the brief)

1. Research — done.
2. IR schema + compiler + one recipe + one example rendered end to end.
3. Recipe library (cinematic set from the brief), each with a `demo.html` that passes `check`.
4. Remaining six examples; the skill.
