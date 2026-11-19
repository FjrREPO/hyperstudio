#!/usr/bin/env node
// ponytail: runs as TypeScript through Node's type stripping, which Node refuses inside node_modules.
// Fine while this is used from its own checkout; add a build step when it is published as a dependency.
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { runAssets } from "./commands/assets.ts";
import { runAudio } from "./commands/audio.ts";
import { runCompile } from "./commands/compile.ts";
import { runRecipes } from "./commands/recipes.ts";
import { runReview } from "./commands/review.ts";
import { bold, dim, red } from "./output.ts";

const HELP = `${bold("hyperstudio")} ${dim(pkg.version)}  Creative IR compiler for HyperFrames

${bold("Usage")}
  hyperstudio compile <ir.json> [--output <dir>] [--validate-only]
  hyperstudio review  <ir.json> [--output <dir>] [--motion]
  hyperstudio recipes [name]
  hyperstudio assets  providers | search <query> | download <#> | list [dir] | usage
  hyperstudio audio   providers | tts <text> | voices | dub <file> | inspect <file> | status [job]

${bold("Commands")}
  compile   Validate a Creative IR and write a HyperFrames project.
  review    Compile, run hyperframes check, snapshot every shot and start a REVIEW.md rubric.
  recipes   List the recipes, or show one recipe's variables.
  assets    Find openly licensed media on free sources, gated by licence, and record what is used.
  audio     Voiceover and dubbing: local and free by default; ElevenLabs only when named and keyed.

${bold("Options")}
  -o, --output <dir>   Project directory (default: build/ beside the IR file)
      --validate-only  compile: validate and plan; write nothing
      --motion         review: also render a draft and measure how much the film moves
      --kind <kind>    assets search: image (default), audio or video
      --source <ids>   assets search: only these sources, comma separated
      --limit <n>      assets search: how many results (default 10)
      --held-back      assets search: also show what the licence gate held back
      --to <dir>       assets download: where to save, usually <film>/assets
      --name <name>    assets download: file name without extension
      --accept-review  assets download: you have read a needs-review licence and accept it
      --provider <id>  audio tts: system (default, a draft voice) or elevenlabs
      --voice <id>     audio tts: a system voice name, or an ElevenLabs voice id
      --model <id>     audio tts: ElevenLabs model (default eleven_multilingual_v2)
      --lang <code>    audio tts, dub: language code, for example id
      --out <file>     audio tts, status: where to write the audio
      --dry-run        audio tts, dub: show what it would use; generate nothing
      --confirm-cost   audio tts, dub: agree to the estimate on a paid plan
      --json           Machine-readable output
      --pretty         Indented JSON (implies --json)
  -h, --help           Show this help
  -v, --version        Show the version

${bold("Exit codes")}
  0  success    1  the IR was rejected or a check failed    2  the command line was wrong

After compile, the output is a normal HyperFrames project:
  npx hyperframes check --json && npx hyperframes snapshot && npx hyperframes render -o out.mp4
`;

async function main(argv: string[]): Promise<number> {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return usage((error as Error).message);
  }
  const { values, positionals } = parsed;
  const [command, target, ...extra] = positionals;
  if (command === "audio")
    return await runAudio(target, extra, {
      provider: values.provider,
      voice: values.voice,
      model: values.model,
      lang: values.lang,
      out: values.out,
      confirmCost: values["confirm-cost"],
      dryRun: values["dry-run"],
      json: values.json || values.pretty,
      pretty: values.pretty,
    });
  if (command === "assets")
    return await runAssets(target, extra, {
      kind: values.kind,
      source: values.source,
      limit: values.limit,
      to: values.to,
      name: values.name,
      heldBack: values["held-back"],
      acceptReview: values["accept-review"],
      json: values.json || values.pretty,
      pretty: values.pretty,
    });
  const json = values.json || values.pretty;

  if (values.version) {
    console.log(pkg.version);
    return 0;
  }
  if (values.help || command === "help") {
    console.log(HELP);
    return 0;
  }
  if (command === undefined) return usage("no command given");
  if (extra.length > 0) return usage(`unexpected argument "${extra[0]}"`);

  switch (command) {
    case "compile":
      if (!target) return usage("compile needs an IR file");
      return runCompile(target, {
        output: values.output,
        validateOnly: values["validate-only"],
        json,
        pretty: values.pretty,
      });
    case "review":
      if (!target) return usage("review needs an IR file");
      return runReview(target, { output: values.output, motion: values.motion });
    case "recipes":
      return runRecipes(target, { json, pretty: values.pretty });
    default:
      return usage(`unknown command "${command}"`);
  }
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      "validate-only": { type: "boolean", default: false },
      motion: { type: "boolean", default: false },
      provider: { type: "string" },
      voice: { type: "string" },
      model: { type: "string" },
      lang: { type: "string" },
      out: { type: "string" },
      "confirm-cost": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      kind: { type: "string" },
      source: { type: "string" },
      limit: { type: "string" },
      to: { type: "string" },
      name: { type: "string" },
      "held-back": { type: "boolean", default: false },
      "accept-review": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      pretty: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
}

function usage(problem: string): number {
  console.error(`${red("✗")} ${problem}\n\n${HELP}`);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
