import { compareFilms, readFilm } from "@hyperstudio/studio";
import { bold, dim, green, printJson, table, yellow } from "../output.ts";

/** `hyperstudio compare <a.json> <b.json>`: where two films made the same choice. Returns the exit code. */
export function runCompare(
  a: string | undefined,
  b: string | undefined,
  flags: { json: boolean; pretty: boolean },
): number {
  if (!(a && b)) {
    console.error("compare needs two IR files");
    return 2;
  }
  const [fa, fb] = [readFilm(a), readFilm(b)];
  const result = compareFilms(fa, fb);
  if (flags.json) {
    printJson({ a: fa.brand.name, b: fb.brand.name, ...result }, flags.pretty);
    return 0;
  }
  console.log(
    `${bold(fa.brand.name)} and ${bold(fb.brand.name)} make the same choice in ${result.shared} of ${result.of} decisions\n`,
  );
  console.log(
    table([
      ["", "decision", fa.brand.name, fb.brand.name].map(dim),
      ...result.rows.map((r) => [r.same ? yellow("same") : green("differs"), r.decision, r.a, r.b]),
    ]),
  );
  console.log(
    dim("\n  This reads the plans, not the pictures. A shared choice is not wrong; it needs a reason."),
  );
  return 0;
}
