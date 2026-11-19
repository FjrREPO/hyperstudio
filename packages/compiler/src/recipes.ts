import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Scalar } from "@hyperstudio/ir";
import { RECIPES_DIR } from "@hyperstudio/recipes";
import { z } from "zod";

// A recipe is a HyperFrames registry block: registry-item.json + one scene HTML file.
// `hyperstudio` and the variable `role` values below are what the compiler adds on top of upstream's format.

/**
 * What a variable is for. The compiler acts on four of these:
 * - `brand`: part of the film's visual system; set once in `style`, never per scene.
 * - `region`: names a region of the scene's screen.
 * - `layout`: with `region`, defines the framing used to detect a repeated shot.
 * - `statistic`: a figure; the scene must cite a source for it.
 */
const Variable = z.looseObject({
  id: z.string(),
  type: z.enum(["string", "number", "color", "boolean", "enum", "font", "image"]),
  role: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().optional(),
  options: z.array(z.looseObject({ value: z.string() })).optional(),
});
export type Variable = z.infer<typeof Variable>;

const RecipeMeta = z.looseObject({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  duration: z.number().positive(),
  tags: z.array(z.string()).default([]),
  variables: z.array(Variable).default([]),
  files: z.array(z.looseObject({ path: z.string() })).min(1),
  hyperstudio: z
    .strictObject({
      minDuration: z.number().positive().optional(),
      maxDuration: z.number().positive().optional(),
      /** Variable ids a scene must set. */
      required: z.array(z.string()).default([]),
      /** The recipe shows a screen: the scene names one and the compiler supplies it. */
      screen: z.boolean().default(false),
    })
    .default({ required: [], screen: false }),
});
export type RecipeMeta = z.infer<typeof RecipeMeta>;

export interface Recipe {
  meta: RecipeMeta;
  /** The scene file's source. */
  html: string;
}

/** Variables the compiler fills in for a recipe that shows a screen. A scene cannot set them. */
export const SCREEN_VARIABLES = ["screen", "screenMeta"] as const;

/** Every recipe in `dir`, sorted by name. */
export function listRecipes(dir: string = RECIPES_DIR): RecipeMeta[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .flatMap((name) => loadRecipe(name, dir)?.meta ?? []);
}

/** One recipe by name, or undefined when there is no such folder. Throws when the folder is malformed. */
export function loadRecipe(name: string, dir: string = RECIPES_DIR): Recipe | undefined {
  const file = join(dir, name, "registry-item.json");
  if (!existsSync(file)) return undefined;
  const meta = RecipeMeta.parse(JSON.parse(readFileSync(file, "utf8")));
  if (meta.name !== name) throw new Error(`${file}: name "${meta.name}" must match its folder "${name}"`);
  const [scene] = meta.files;
  if (!scene) throw new Error(`${file}: files is empty`);
  return { meta, html: readFileSync(join(dir, name, scene.path), "utf8") };
}

/** Why `value` is not acceptable for `variable`, or null when it is. */
export function valueProblem(variable: Variable, value: Scalar): string | null {
  switch (variable.type) {
    case "number":
      if (typeof value !== "number") return "must be a number";
      if (variable.min !== undefined && value < variable.min) return `must be >= ${variable.min}`;
      if (variable.max !== undefined && value > variable.max) return `must be <= ${variable.max}`;
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : "must be true or false";
    case "color":
      return typeof value === "string" && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
        ? null
        : "must be a hex colour like #c9a35c";
    case "enum": {
      const allowed = (variable.options ?? []).map((o) => o.value);
      return typeof value === "string" && allowed.includes(value)
        ? null
        : `must be one of: ${allowed.join(", ")}`;
    }
    default:
      if (typeof value !== "string") return "must be a string";
      if (variable.maxLength !== undefined && value.length > variable.maxLength)
        return `is ${value.length} characters; this recipe sets it in at most ${variable.maxLength}`;
      return null;
  }
}
