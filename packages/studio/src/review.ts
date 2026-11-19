import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type CompileResult, compile } from "@hyperstudio/compiler";

// The review gate: compile, run HyperFrames' own check, take frames from every shot, and leave a rubric to be
// answered from those frames. The checks are HyperFrames'; the judgement is the reviewer's.

export const RUBRIC = [
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

export interface Finding {
  severity: string;
  code: string;
  message: string;
}

export interface Review {
  compiled: CompileResult;
  check: { ok: boolean; errors: number; warnings: number; findings: Finding[] };
  /** How many frames were taken, and the contact sheets that show them. */
  frames: number;
  sheets: string[];
  reviewFile: string;
  /** False when REVIEW.md already existed: a review is the reviewer's work and is never overwritten. */
  createdReviewFile: boolean;
}

/** Run a HyperFrames CLI command in a project. */
export const hyperframes = (cwd: string, args: string[]) =>
  spawnSync("npx", ["-y", "hyperframes", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * Compile a film and gather what a reviewer needs.
 * @throws CompileError when the IR is rejected; Error when HyperFrames does not answer.
 */
export function reviewFilm(irPath: string, options: { output?: string } = {}): Review {
  const compiled = compile(irPath, { output: options.output });
  const build = compiled.output as string;

  const run = hyperframes(build, ["check", "--json"]);
  let report: Record<string, { findings?: Finding[] }> & { ok?: boolean };
  try {
    report = JSON.parse(run.stdout.slice(run.stdout.indexOf("{")));
  } catch {
    throw new Error(`hyperframes check did not return a report: ${run.stderr.slice(-400)}`);
  }
  const findings = Object.values(report)
    .flatMap((section) => (typeof section === "object" && section !== null ? (section.findings ?? []) : []))
    .filter((f) => f.severity !== "info");
  const errors = findings.filter((f) => f.severity === "error").length;

  // One frame early in each shot and one late, so entrances and end states are both seen.
  const times = compiled.scenes
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
        .sort()
        .map((f) => join(latest, f))
    : [];
  if (sheets.length === 0) throw new Error("hyperframes snapshot produced no frames");

  const reviewFile = join(dirname(resolve(irPath)), "REVIEW.md");
  const createdReviewFile = !existsSync(reviewFile);
  if (createdReviewFile) writeFileSync(reviewFile, template(compiled, findings.length, sheets));
  return {
    compiled,
    check: { ok: report.ok === true, errors, warnings: findings.length - errors, findings },
    frames: times.length,
    sheets,
    reviewFile,
    createdReviewFile,
  };
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
