import { relative } from "node:path";
import { CompileError } from "@hyperstudio/compiler";
import { reviewFilm } from "@hyperstudio/studio";
import { bold, dim, green, red, yellow } from "../output.ts";

/** `hyperstudio review <ir>`: returns the process exit code. The work is done by @hyperstudio/studio. */
export function runReview(input: string, flags: { output?: string; motion?: boolean }): number {
  let review: ReturnType<typeof reviewFilm>;
  try {
    review = reviewFilm(input, { output: flags.output, motion: flags.motion });
  } catch (error) {
    if (error instanceof CompileError) {
      console.log(
        `${red("✗")} ${bold("The IR was rejected")}; run hyperstudio compile ${input} for the details.`,
      );
      return 1;
    }
    console.log(`${red("✗")} ${(error as Error).message}`);
    return 1;
  }
  const { compiled, check } = review;
  console.log(
    `${green("✓")} Compiled ${bold(compiled.title)} (${compiled.scenes.length} shots, ${compiled.duration}s)`,
  );
  console.log(
    `${check.ok ? green("✓") : red("✗")} hyperframes check: ${check.errors} errors, ${check.warnings} warnings`,
  );
  for (const f of check.findings.slice(0, 12))
    console.log(dim(`    ${f.severity} ${f.code}: ${f.message.slice(0, 150)}`));
  console.log(`${green("✓")} Snapshots: ${review.frames} frames`);
  for (const sheet of review.sheets) console.log(dim(`    ${sheet}`));
  if (review.motion) {
    const m = review.motion;
    const frozen = m.longestStill.seconds >= 1;
    console.log(
      `${frozen ? yellow("!") : green("✓")} Motion: ${m.stillPercent}% of frames still, longest freeze ${m.longestStill.seconds}s at ${m.longestStill.at}s, median change ${m.medianChange}`,
    );
    console.log(
      dim(
        `    one strip per shot in ${relative(process.cwd(), m.strips[0] ?? m.file).replace(/[^/]+$/, "")}`,
      ),
    );
  }
  const file = relative(process.cwd(), review.reviewFile);
  console.log(
    review.createdReviewFile
      ? `\n  Wrote ${bold(file)}. Answer it from the frames before rendering.`
      : `\n  ${bold(file)} already exists; update it from the new frames.`,
  );
  if (compiled.placeholders.length > 0)
    console.log(
      `  ${yellow("Placeholders")} (${compiled.placeholders.length}): ${compiled.placeholders.join("; ")}`,
    );
  return check.ok ? 0 : 1;
}
