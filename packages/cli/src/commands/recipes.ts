import { listRecipes, type Variable } from "@hyperstudio/compiler";
import { bold, clip, dim, printJson, red, table } from "../output.ts";

/** `hyperstudio recipes [name]`: returns the process exit code. */
export function runRecipes(name: string | undefined, flags: { json: boolean; pretty: boolean }): number {
  const recipes = listRecipes().map((r) => ({
    name: r.name,
    title: r.title,
    description: r.description,
    tags: r.tags,
    nativeDuration: r.duration,
    ...r.hyperstudio,
    variables: r.variables,
  }));

  if (name === undefined) {
    if (flags.json) printJson(recipes, flags.pretty);
    else {
      console.log(
        table([
          ["recipe", "length", "what it is"].map(dim),
          ...recipes.map((r) => [
            r.name,
            `${r.minDuration ?? "?"}–${r.maxDuration ?? "?"}s`,
            clip(r.description.split(". ")[0] ?? "", 84),
          ]),
        ]),
      );
      console.log(dim("\n  hyperstudio recipes <name> shows a recipe's variables."));
    }
    return 0;
  }

  const recipe = recipes.find((r) => r.name === name);
  if (!recipe) {
    console.error(
      `${red("✗")} No recipe named "${name}". Available: ${recipes.map((r) => r.name).join(", ")}`,
    );
    return 1;
  }
  if (flags.json) {
    printJson(recipe, flags.pretty);
    return 0;
  }
  console.log(`${bold(recipe.name)}  ${dim(`${recipe.minDuration ?? "?"}–${recipe.maxDuration ?? "?"}s`)}\n`);
  console.log(`  ${recipe.description}\n`);
  if (recipe.required.length > 0) console.log(`  Required: ${recipe.required.join(", ")}`);
  if (recipe.screen) console.log('  Shows a screen: the scene names one with "screen".');
  console.log();
  const where = (v: Variable) =>
    v.role === "brand"
      ? "style"
      : v.type === "image"
        ? "assets"
        : v.type === "string" && v.role !== "region"
          ? "text"
          : "params";
  const allowed = (v: Variable) =>
    v.options?.map((o) => o.value).join(" | ") ??
    (v.min !== undefined || v.max !== undefined
      ? `${v.min ?? ""}…${v.max ?? ""}`
      : v.maxLength
        ? `≤ ${v.maxLength} chars`
        : v.type);
  console.log(
    table([
      ["variable", "set in", "default", "accepts"].map(dim),
      ...recipe.variables
        .filter((v) => v.id !== "screen" && v.id !== "screenMeta")
        .map((v) => [v.id, where(v), clip(JSON.stringify(v.default ?? ""), 22), clip(allowed(v), 70)]),
    ]),
  );
  return 0;
}
