#!/usr/bin/env node
// ponytail: runs as TypeScript through Node's type stripping, which Node refuses inside node_modules.
// Fine while this is used from its own checkout; add a build step when it is published as a dependency.
import { parseArgs } from "node:util";
import { CompileError, compile, listRecipes } from "@hyperstudio/compiler";

const HELP = `hyperstudio - Creative IR compiler for HyperFrames

Usage:
  hyperstudio compile <input.json> [--output <dir>] [--validate-only] [--pretty]
  hyperstudio recipes [--pretty]

compile   Validate a Creative IR file and write a HyperFrames project.
            --output <dir>     Project directory (default: build/ beside the input file)
            --validate-only    Validate and report timing; write nothing
            --pretty           Indent the JSON result
recipes   List the available recipes and the variables each one accepts.

Output is JSON on stdout. Exit code 1 means the IR was rejected; "errors" says where and why.
After compile, use the HyperFrames CLI in the output directory:
  npx hyperframes check --json && npx hyperframes snapshot && npx hyperframes render -o out.mp4
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o" },
    "validate-only": { type: "boolean", default: false },
    pretty: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});
const print = (v: unknown) => console.log(JSON.stringify(v, null, values.pretty ? 2 : undefined));
const [command, input] = positionals;

if (values.help || !command) {
  console.log(HELP);
  process.exit(command || values.help ? 0 : 1);
} else if (command === "recipes") {
  print(
    listRecipes().map((r) => ({
      name: r.name,
      title: r.title,
      description: r.description,
      tags: r.tags,
      nativeDuration: r.duration,
      ...r.hyperstudio,
      variables: r.variables,
    })),
  );
} else if (command === "compile" && input) {
  try {
    print(compile(input, { output: values.output, validateOnly: values["validate-only"] }));
  } catch (e) {
    if (!(e instanceof CompileError)) throw e;
    print({ ok: false, errors: e.issues });
    process.exit(1);
  }
} else {
  console.error(command === "compile" ? "compile needs an input file\n" : `unknown command "${command}"\n`);
  console.error(HELP);
  process.exit(1);
}
