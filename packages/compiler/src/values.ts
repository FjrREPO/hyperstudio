import type { IR, Origin, Scalar } from "@hyperstudio/ir";
import { type RecipeMeta, SCREEN_VARIABLES, type Variable, valueProblem } from "./recipes.ts";

type Scene = IR["scenes"][number];
type Screen = IR["screens"][string];

/** What value resolution reports back through. */
export interface Reporter {
  fail: (path: string, message: string) => void;
  /** Register a file to copy into the project; returns its project-relative path. */
  useAsset: (src: string, path: string, origin: Origin, what: string) => string;
  /** Style keys that reached at least one recipe. */
  usedStyle: Set<string>;
}

const isScreenVariable = (id: string) => (SCREEN_VARIABLES as readonly string[]).includes(id);

/** Why `variable` cannot take `value` from the IR group it was written in, or null when it can. */
function groupProblem(
  group: string,
  variable: Variable | undefined,
  value: unknown,
  known: string,
): string | null {
  if (!variable) return `is not a variable of this recipe. ${known}`;
  if (isScreenVariable(variable.id))
    return 'is supplied by the compiler; name a screen with "screen" instead';
  if (variable.role === "brand" && group !== "style")
    return "is part of the film's visual system; set it once in style so every scene shares it";
  if (group === "assets")
    return variable.type === "image"
      ? null
      : `is a ${variable.type} variable, not an image; set it in params`;
  if (variable.type === "image") return "is an image; set it in a scene's assets";
  if (group === "text" && variable.type !== "string")
    return `is a ${variable.type} variable, not text; set it in params`;
  return valueProblem(variable, value as Scalar);
}

/**
 * The variable values one scene hands its recipe: the film's style first, then the scene's own.
 * Reports every problem it finds and returns what it could resolve.
 */
export function resolveValues(
  scene: Scene,
  meta: RecipeMeta,
  style: IR["style"],
  screen: { id: string; def: Screen } | undefined,
  at: string,
  { fail, useAsset, usedStyle }: Reporter,
): Record<string, Scalar> {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const settable = [...byId.values()].filter((v) => !isScreenVariable(v.id) && v.role !== "brand");
  const known = `It accepts: ${settable.map((v) => v.id).join(", ")}`;
  const values: Record<string, Scalar> = {};

  Object.assign(values, styleValues(style, byId, meta.name, known, { fail, usedStyle }));

  const seen = new Map<string, string>();
  const entries = (["assets", "text", "params"] as const).flatMap((group) =>
    Object.entries(scene[group]).map(([key, value]) => ({ group, key, value })),
  );
  for (const { group, key, value } of entries) {
    const path = `${at}.${group}.${key}`;
    const variable = byId.get(key);
    const raw = typeof value === "object" ? value.src : value;
    const problem = seen.has(key)
      ? `is also set in ${seen.get(key)}`
      : groupProblem(group, variable, raw, known);
    seen.set(key, group);
    if (problem) {
      fail(path, `"${key}" ${problem}`);
    } else if (group === "assets") {
      const assetOrigin = typeof value === "object" ? value.origin : "supplied";
      values[key] = useAsset(String(raw), path, assetOrigin, `${scene.id}: ${key}`);
    } else {
      values[key] = raw as Scalar;
    }
  }

  if (screen) checkRegions(meta, values, screen, at, fail);
  checkSources(scene, meta, values, at, fail);
  // A value that was given but rejected has its own error; only a missing one is reported here.
  for (const key of meta.hyperstudio.required)
    if (!(key in values || seen.has(key))) fail(at, `${meta.name} requires "${key}"`);
  return values;
}

/** A variable that names a region must name one that exists on the scene's screen. */
function checkRegions(
  meta: RecipeMeta,
  values: Record<string, Scalar>,
  screen: { id: string; def: Screen },
  at: string,
  fail: Reporter["fail"],
): void {
  const regions = Object.keys(screen.def.regions);
  for (const variable of meta.variables.filter((v) => v.role === "region")) {
    const name = values[variable.id];
    if (typeof name === "string" && name !== "" && !regions.includes(name))
      fail(
        `${at}.params.${variable.id}`,
        `"${name}" is not a region of screen "${screen.id}". Regions: ${regions.join(", ") || "(none)"}`,
      );
  }
}

/** A figure on screen needs a source. */
function checkSources(
  scene: Scene,
  meta: RecipeMeta,
  values: Record<string, Scalar>,
  at: string,
  fail: Reporter["fail"],
): void {
  const figures = meta.variables.filter((v) => v.role === "statistic" && v.id in values);
  if (figures.length > 0 && scene.sources.length === 0)
    fail(
      `${at}.sources`,
      `this scene shows a figure (${figures.map((v) => v.id).join(", ")}); say where it comes from. Never invent a metric`,
    );
}

/** The film's style, for the variables this recipe declares. */
function styleValues(
  style: IR["style"],
  byId: Map<string, Variable>,
  recipe: string,
  known: string,
  { fail, usedStyle }: Pick<Reporter, "fail" | "usedStyle">,
): Record<string, Scalar> {
  const values: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(style)) {
    const variable = byId.get(key);
    if (!variable) continue; // style only reaches recipes that declare the id
    usedStyle.add(key);
    const problem = groupProblem("style", variable, value, known);
    if (problem) fail(`style.${key}`, `"${key}" ${problem} (for recipe ${recipe})`);
    else values[key] = value;
  }
  return values;
}

/** What makes a shot the same picture as another: recipe, screen and framing. */
export function framing(scene: Scene, meta: RecipeMeta, values: Record<string, Scalar>): string {
  const keys = meta.variables.filter((v) => v.role === "region" || v.role === "layout").map((v) => v.id);
  return JSON.stringify([meta.name, scene.screen ?? null, keys.map((k) => values[k] ?? null)]);
}
