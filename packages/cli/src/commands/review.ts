import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { CompileError, type CompileResult, compile } from "@hyperstudio/compiler";
import { bold, dim, green, red, yellow } from "../output.ts";

// The review gate: compile, run HyperFrames' own check, take a frame from every shot, and leave a rubric to
// be answered from those frames. The checks are HyperFrames'; the judgement is the reviewer's.

const RUBRIC = [
  ["Storytelling", "Does each shot move the story on? Could any be cut without loss?"],
  ["Art direction", "Is it one film: same stage, palette and light in every shot?"],
  ["Typography", "Is there a clear order of reading? Is any text too large, too small or crowded?"],
  ["Composition", "Is each frame balanced, with intended space, nothing clipped by accident?"],
  ["Shot variety", "Do neighbouring shots differ in subject or scale?"],
  ["Motion", "Does one thing lead in each shot? Does anything move without a reason?"],
  ["Transitions", "Does each cut land on an action or a change of idea?"],
  ["Assets", "Is everything on screen real? List every placeholder."],
  ["Brand", "Would the brand recognise its colours, type and voice?"],
  ["Coherence", "Watched start to finish, does it feel made by one hand?"],
] as const;

const hyperframes = (cwd: string, args: string[]) =>
  spawnSync("npx", ["-y", "hyperframes", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** `hyperstudio review <ir>`: returns the process exit code. */
export function runReview(input: string, flags: { output?: string }): number {
  let result: CompileResult;
  try {
    result = compile(input, { output: flags.output });
  } catch (error) {
    if (!(error instanceof CompileError)) throw error;
    console.log(
      `${red("✗")} ${bold("The IR was rejected")}; run hyperstudio compile ${input} for the details.`,
    );
    return 1;
  }
  const build = result.output as string;
  console.log(
    `${green("✓")} Compiled ${bold(result.title)} (${result.scenes.length} shots, ${result.duration}s)`,
  );

  // 1. HyperFrames' own gate.
  const check = hyperframes(build, ["check", "--json"]);
  let findings: { severity: string; code: string; message: string }[] = [];
  let ok = false;
  try {
    const report = JSON.parse(check.stdout.slice(check.stdout.indexOf("{")));
    ok = report.ok === true;
    findings = Object.values(report as Record<string, { findings?: typeof findings }>)
      .flatMap((section) => section?.findings ?? [])
      .filter((f) => f.severity !== "info");
  } catch {
    console.log(`${red("✗")} hyperframes check did not return a report:\n${check.stderr.slice(-600)}`);
    return 1;
  }
  const errors = findings.filter((f) => f.severity === "error").length;
  console.log(
    `${ok ? green("✓") : red("✗")} hyperframes check: ${errors} errors, ${findings.length - errors} warnings`,
  );
  for (const f of findings.slice(0, 12))
    console.log(dim(`    ${f.severity} ${f.code}: ${f.message.slice(0, 150)}`));

  // 2. One frame early in each shot and one late, so entrances and end states are both seen.
  const times = result.scenes
    .flatMap((s) => [s.start + Math.min(0.25, s.duration * 0.2), s.start + s.duration * 0.8])
    .map((t) => t.toFixed(2));
  hyperframes(build, ["snapshot", "--at", times.join(",")]);
  const root = join(build, ".hyperframes/artifacts/snapshots");
  const latest = existsSync(root)
    ? readdirSync(root)
        .map((name) => join(root, name))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0]
    : undefined;
  const sheets = latest
    ? readdirSync(latest)
        .filter((f) => f.startsWith("contact-sheet"))
        .map((f) => join(latest, f))
    : [];
  if (sheets.length === 0) {
    console.log(`${red("✗")} No snapshots were produced.`);
    return 1;
  }
  console.log(`${green("✓")} Snapshots: ${times.length} frames`);
  for (const sheet of sheets) console.log(dim(`    ${sheet}`));

  // 3. The rubric. Written once; an existing review is the reviewer's work and is never overwritten.
  const reviewFile = join(dirname(resolve(input)), "REVIEW.md");
  if (existsSync(reviewFile)) {
    console.log(`\n  ${bold("REVIEW.md")} already exists; update it from the new frames.`);
  } else {
    writeFileSync(reviewFile, template(result, findings.length, sheets));
    console.log(
      `\n  Wrote ${bold(relative(process.cwd(), reviewFile))}. Answer it from the frames before rendering.`,
    );
  }
  if (result.placeholders.length > 0)
    console.log(
      `  ${yellow("Placeholders")} (${result.placeholders.length}): ${result.placeholders.join("; ")}`,
    );
  return ok ? 0 : 1;
}

function template(result: CompileResult, findings: number, sheets: string[]): string {
  return `# Review: ${result.title}

Answer every row from the frames, not from the source. A passing check is not a passing review.

- Frames: ${sheets.map((s) => `\`${s}\``).join(", ")}
- HyperFrames check: ${findings} warnings or errors
- Placeholders: ${result.placeholders.length === 0 ? "none" : result.placeholders.join("; ")}

## Shots

| # | Shot | Length | Purpose | Does the frame deliver it? |
| --- | --- | --- | --- | --- |
${result.scenes.map((s, i) => `| ${i + 1} | ${s.id} | ${s.duration}s | ${s.purpose} | |`).join("\n")}

## Rubric

| | Question | Verdict (pass / revise) | Evidence from the frames |
| --- | --- | --- | --- |
${RUBRIC.map(([name, question]) => `| ${name} | ${question} | | |`).join("\n")}

## Decision

- [ ] Every row passes, and the film does not read as a template. Render it.
- [ ] Something needs revising. List it here, change the IR, and run the review again.
`;
}
