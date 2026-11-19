import { z } from "zod";

/**
 * The Creative IR: one JSON document that says what a film is.
 *
 * It records the creative direction, names recipes and gives them values. It contains no HTML, CSS, GSAP or
 * HyperFrames attributes. Recipe-specific keys (`assets`, `text`, `params`, `style`) are validated by the
 * compiler against each recipe's own declarations.
 */

const id = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/, "use lowercase letters, digits and hyphens, starting with a letter");
const seconds = z.number().positive();
const scalar = z.union([z.string(), z.number(), z.boolean()]);
/** A sentence, not a keyword: direction fields are there to be reasoned from. */
const sentence = z.string().trim().min(12, "write a full sentence");

/** Where something on screen came from. A `placeholder` is reported by every compile. */
const origin = z.enum(["captured", "supplied", "placeholder"]);

export const ASPECT_RATIOS = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
} as const;

const Project = z.strictObject({
  title: z.string().min(1),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]).default(30),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
  /** Overrides aspectRatio when given. */
  resolution: z
    .strictObject({ width: z.number().int().positive(), height: z.number().int().positive() })
    .optional(),
  /** Optional assertion: compile fails if the scenes do not add up to this. */
  duration: seconds.optional(),
});

/** The decisions every scene must follow. Written before any scene exists. */
const Direction = z.strictObject({
  /** The idea of the film in one sentence. */
  concept: sentence,
  /** Who it is for and what they already know. */
  audience: sentence,
  /** The one thing the viewer should leave with. */
  message: sentence,
  /** How it should feel. */
  tone: sentence,
  /** The colour rule: what the background, the ink and the one accent are for. */
  palette: sentence,
  /** The type rule: which faces, at what scale, for what. */
  typography: sentence,
  /** The motion rule: what moves, how, and what stays still. */
  motion: sentence,
  /** The pacing rule: shot length and where the film breathes. */
  pacing: sentence,
});

const Brand = z.strictObject({
  name: z.string().min(1),
  /** `real`: an existing product, shown from its own assets. `example`: made for this film. */
  kind: z.enum(["real", "example"]),
  url: z.string().optional(),
});

/** A rectangle on a screen, in the screenshot's own CSS pixels: [x, y, width, height]. */
const rect = z.tuple([z.number().min(0), z.number().min(0), z.number().positive(), z.number().positive()]);

const Screen = z.strictObject({
  /** Screenshot file, relative to the IR file. Give this or `html`. */
  src: z.string().min(1).optional(),
  /**
   * The product's own page, relative to the IR file, to be mounted live and driven by a scene's beats.
   * Its regions are its `data-region` elements, so `regions` is left out.
   */
  html: z.string().min(1).optional(),
  /** Size of the screenshot in CSS pixels (the file may be 2x or 3x that). */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  origin,
  /** Named components of the screen that shots can frame, point at, highlight or type into. */
  regions: z.record(id, rect).default({}),
});

/** One thing that happens in a take of a live interface, at a time counted from the take's start. */
const Beat = z.strictObject({
  at: z.number().min(0),
  /**
   * `camera` frames a region; `cursor` moves the pointer there and `click` also clicks; `type` types `text`
   * into an input; `state` switches the interface's state; `reveal` brings a region's parts in one by one;
   * `draw` draws a chart's lines; `scroll` moves a region's content up; `count` counts a figure up to the value the page shows; `highlight` outlines
   * a region; `say` sets one of the film's own lines in the frame; `veil` covers everything but a region in the
   * stage's colour, so the interface resolves into that part.
   */
  do: z.enum([
    "camera",
    "cursor",
    "click",
    "type",
    "state",
    "reveal",
    "draw",
    "count",
    "scroll",
    "highlight",
    "say",
    "veil",
  ]),
  /** A `data-region` of the page; `window` is the whole interface. */
  target: id.optional(),
  text: z.string().optional(),
  /** The state the interface switches to at this beat. Allowed on `click` and `state`. */
  state: id.optional(),
  /** How long the beat takes, in seconds. */
  over: seconds.optional(),
  /** For `camera`: how much of the frame the region may take. */
  fill: z.number().min(0.2).max(1).optional(),
  ease: z.string().optional(),
  /** For `scroll`: how far the region's content moves up, in the page's pixels. */
  by: z.number().positive().optional(),
  /** For `camera`: turn to this angle, pull focus, or move the interface to one side of the frame. */
  tilt: z.enum(["none", "left", "right", "up", "desk"]).optional(),
  focus: z.enum(["all", "band", "near", "centre"]).optional(),
  side: z.enum(["left", "centre", "right"]).optional(),
  level: z.enum(["top", "high", "middle", "low", "bleed"]).optional(),
  /** For `camera`: the closest this one move may magnify, overriding the take's `maxZoom`. */
  zoom: z.number().min(1).max(8).optional(),
  /** For `say`: where the line sits and how large it is. */
  place: z
    .enum([
      "left",
      "right",
      "under",
      "over",
      "foot",
      "band",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ])
    .optional(),
  size: z.enum(["display", "hero", "title", "text"]).optional(),
});

const Transition = z.strictObject({
  type: z.enum(["cut", "fade", "crossfade"]),
  duration: seconds.default(0.6),
});

const Asset = z.union([
  z.string().min(1),
  z.strictObject({ src: z.string().min(1), origin: origin.default("supplied") }),
]);

const Scene = z.strictObject({
  id,
  recipe: id,
  duration: seconds,
  /** What this scene tells the viewer and why it is here. A scene without a purpose is filler. */
  purpose: sentence,
  /** The screen this scene shows, by its key in `screens`. */
  screen: id.optional(),
  /** Recipe image variables → file paths relative to the IR file. */
  assets: z.record(z.string(), Asset).default({}),
  /** Recipe string variables (copy). */
  text: z.record(z.string(), z.string()).default({}),
  /** Any other recipe variables. Brand variables are not allowed here; they belong in `style`. */
  params: z.record(z.string(), scalar).default({}),
  /** What happens in a take of a live interface, in order. Only for recipes that drive one. */
  beats: z.array(Beat).default([]),
  /** Where each figure shown in this scene comes from. Required when the recipe shows a statistic. */
  sources: z.array(z.string().min(3)).default([]),
  /** How this scene is entered. Omitted = cut. */
  transition: Transition.optional(),
});

const Audio = z.strictObject({
  id,
  src: z.string().min(1),
  origin: origin.default("supplied"),
  /** What the clip is. Two voice clips may not play at once. */
  role: z.enum(["voice", "music", "sfx"]).default("music"),
  /** Tie the clip to a scene: `start` then counts from that scene's start, so narration follows a retimed film. */
  scene: id.optional(),
  /** Seconds from the start of the film, or of `scene` when one is named. */
  start: z.number().min(0).default(0),
  duration: seconds.optional(),
  volume: z.number().min(0).max(3.98).default(1),
  fadeIn: z.number().min(0).default(0),
  fadeOut: z.number().min(0).default(0),
});

export const IR = z.strictObject({
  project: Project,
  direction: Direction,
  brand: Brand,
  /**
   * The film's visual system: brand variables shared by every recipe (`background`, `ink`, `accent`,
   * `displayFont`, `textFont`) and the stage's `light`. Set once; scenes cannot override them.
   */
  style: z.record(z.string(), scalar).default({}),
  screens: z.record(id, Screen).default({}),
  scenes: z.array(Scene).min(1),
  audio: z.array(Audio).default([]),
});

export type IR = z.infer<typeof IR>;
export type Scalar = z.infer<typeof scalar>;
export type Origin = z.infer<typeof origin>;
