import { z } from "zod";

// The Creative IR. It names recipes and their values; it knows nothing about HTML, GSAP or HyperFrames.
// Recipe-specific keys (assets/text/params/style) are validated in compile.ts against the recipe's own declarations.

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "use lowercase letters, digits and hyphens, starting with a letter");
const seconds = z.number().positive();
const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const ASPECT_RATIOS = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
} as const;

const Transition = z.strictObject({
  type: z.enum(["cut", "fade", "crossfade"]),
  duration: seconds.default(0.6),
});

const Scene = z.strictObject({
  id,
  recipe: id,
  duration: seconds,
  /** Recipe image variables → file paths relative to the IR file. */
  assets: z.record(z.string(), z.string().min(1)).default({}),
  /** Recipe string variables (copy). */
  text: z.record(z.string(), z.string()).default({}),
  /** Any other recipe variables (motion, camera, lighting, typography…). */
  params: z.record(z.string(), scalar).default({}),
  /** How this scene is entered. Omitted = cut. */
  transition: Transition.optional(),
});

const Audio = z.strictObject({
  id,
  src: z.string().min(1),
  start: z.number().min(0).default(0),
  duration: seconds.optional(),
  volume: z.number().min(0).max(3.98).default(1),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
});

export const IR = z.strictObject({
  project: z.strictObject({
    title: z.string().min(1),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]).default(30),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
    /** Overrides aspectRatio when given. */
    resolution: z
      .strictObject({ width: z.number().int().positive(), height: z.number().int().positive() })
      .optional(),
    /** Optional assertion: compile fails if the scenes do not add up to this. */
    duration: seconds.optional(),
  }),
  /** Values applied to every scene whose recipe declares a variable with that id. Scene values win. */
  style: z.record(z.string(), scalar).default({}),
  scenes: z.array(Scene).min(1),
  audio: z.array(Audio).default([]),
});

export type IR = z.infer<typeof IR>;
export type Scalar = z.infer<typeof scalar>;
