#!/usr/bin/env node
// ponytail: runs as TypeScript through Node's type stripping, which Node refuses inside node_modules.
// Fine while this is used from its own checkout; add a build step when it is published as a dependency.
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { runCompile } from "./commands/compile.ts";
import { runRecipes } from "./commands/recipes.ts";
import { runReview } from "./commands/review.ts";
import { bold, dim, red } from "./output.ts";

const HELP = `${bold("hyperstudio")} ${dim(pkg.version)}  Creative IR compiler for HyperFrames

${bold("Usage")}
  hyperstudio compile <ir.json> [--output <dir>] [--validate-only]
  hyperstudio review  <ir.json> [--output <dir>]
  hyperstudio recipes [name]

${bold("Commands")}
  compile   Validate a Creative IR and write a HyperFrames project.
  review    Compile, run hyperframes check, snapshot every shot and start a REVIEW.md rubric.
  recipes   List the recipes, or show one recipe's variables.

${bold("Options")}
  -o, --output <dir>   Project directory (default: build/ beside the IR file)
      --validate-only  compile: validate and plan; write nothing
      --json           Machine-readable output
      --pretty         Indented JSON (implies --json)
  -h, --help           Show this help
  -v, --version        Show the version

${bold("Exit codes")}
  0  success    1  the IR was rejected or a check failed    2  the command line was wrong

After compile, the output is a normal HyperFrames project:
  npx hyperframes check --json && npx hyperframes snapshot && npx hyperframes render -o out.mp4
`;

function main(argv: string[]): number {
  let parsed: ReturnType<typeof parse>;
  try {
    parsed = parse(argv);
  } catch (error) {
    return usage((error as Error).message);
  }
  const { values, positionals } = parsed;
  const [command, target, ...extra] = positionals;
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
      return runReview(target, { output: values.output });
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

process.exitCode = main(process.argv.slice(2));
