import { relative } from "node:path";
import { CompileError, type CompileResult, compile } from "@hyperstudio/compiler";
import { bold, clip, dim, green, printJson, red, table, yellow } from "../output.ts";

export interface CompileFlags {
  output?: string;
  validateOnly: boolean;
  json: boolean;
  pretty: boolean;
}

/** `hyperstudio compile <ir>`: returns the process exit code. */
export function runCompile(input: string, flags: CompileFlags): number {
  let result: CompileResult;
  try {
    result = compile(input, { output: flags.output, validateOnly: flags.validateOnly });
  } catch (error) {
    if (!(error instanceof CompileError)) throw error;
    if (flags.json) printJson({ ok: false, errors: error.issues }, flags.pretty);
    else {
      const n = error.issues.length;
      console.log(`${red("✗")} ${bold(`${n} problem${n === 1 ? "" : "s"}`)} in ${input}\n`);
      for (const issue of error.issues)
        console.log(`  ${bold(issue.path || "(document)")}\n    ${issue.message}\n`);
    }
    return 1;
  }
  if (flags.json) printJson(result, flags.pretty);
  else printSummary(result);
  return 0;
}

export function printSummary(result: CompileResult): void {
  const shots = result.scenes.length;
  const average = (result.duration / shots).toFixed(1);
  console.log(`${green("✓")} ${bold(result.title)}`);
  console.log(
    dim(
      `  ${result.width}×${result.height} · ${result.fps} fps · ${result.duration}s · ${shots} shot${shots === 1 ? "" : "s"} (average ${average}s)\n`,
    ),
  );
  console.log(
    table([
      ["#", "start", "length", "recipe", "scene", "purpose"].map(dim),
      ...result.scenes.map((s, i) => [
        String(i + 1),
        `${s.start.toFixed(1)}s`,
        `${s.duration.toFixed(1)}s`,
        s.recipe,
        s.id,
        clip(s.purpose, 60),
      ]),
    ]),
  );
  list(
    yellow("Placeholders"),
    result.placeholders,
    "Stand-ins for the real thing. Replace them before publishing.",
  );
  list(
    yellow("Warnings"),
    result.warnings.map((w) => `${w.path}: ${w.message}`),
  );
  list(bold("Credits owed"), result.credits, "Show these in the film or beside it.");
  console.log();
  if (result.output === null) console.log(dim("  Validated. Nothing written."));
  else {
    const dir = relative(process.cwd(), result.output) || ".";
    console.log(`  Written to ${bold(dir)}`);
    console.log(dim(`  Next: hyperstudio review, or in ${dir}: npx hyperframes check --json`));
  }
}

function list(title: string, items: string[], note?: string): void {
  if (items.length === 0) return;
  console.log(`\n  ${title} (${items.length})${note ? dim(`  ${note}`) : ""}`);
  for (const item of items) console.log(`    - ${item}`);
}
