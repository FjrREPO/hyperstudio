import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { ASPECT_RATIOS, IR, type Scalar } from "@hyperstudio/ir";
import { RECIPES_DIR } from "@hyperstudio/recipes";
import { z } from "zod";

// The only file that knows HyperFrames. IR in, a HyperFrames project out.
// It emits what the HyperFrames skills tell a human to write (hosts, data-* timing, data-variable-values,
// one paused root timeline) and leaves animation, variable binding, audio mix and rendering to HyperFrames.

const MARKER = "<!-- hyperstudio:generated - edit the IR and recompile, do not edit here -->";
const GSAP_URL = "https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"; // same pin as `hyperframes init` 0.9.69
const RESERVED_IDS = new Set(["main", "root"]);

export interface Issue {
  path: string;
  message: string;
}

export class CompileError extends Error {
  issues: Issue[];
  constructor(issues: Issue[]) {
    super(issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("\n"));
    this.issues = issues;
  }
}

// ── Recipes ────────────────────────────────────────────────────────────────
// A recipe is a HyperFrames registry block: registry-item.json + one scene HTML file.
// `hyperstudio` is our one extension key; everything else is upstream's format.

const Variable = z.looseObject({
  id: z.string(),
  type: z.enum(["string", "number", "color", "boolean", "enum", "font", "image"]),
  label: z.string().optional(),
  description: z.string().optional(),
  default: z.unknown().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(z.looseObject({ value: z.string() })).optional(),
});
type Variable = z.infer<typeof Variable>;

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
      required: z.array(z.string()).default([]),
    })
    .default({ required: [] }),
});
export type RecipeMeta = z.infer<typeof RecipeMeta>;

export function listRecipes(dir = RECIPES_DIR): RecipeMeta[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .sort()
    .filter((name) => existsSync(join(dir, name, "registry-item.json")))
    .flatMap((name) => loadRecipe(name, dir)?.meta ?? []);
}

function loadRecipe(name: string, dir: string): { meta: RecipeMeta; html: string } | undefined {
  const file = join(dir, name, "registry-item.json");
  if (!existsSync(file)) return undefined;
  const meta = RecipeMeta.parse(JSON.parse(readFileSync(file, "utf8")));
  if (meta.name !== name) throw new Error(`${file}: name "${meta.name}" must match its folder "${name}"`);
  const [scene] = meta.files;
  if (!scene) throw new Error(`${file}: files is empty`);
  return { meta, html: readFileSync(join(dir, name, scene.path), "utf8") };
}

/** Why `value` is not acceptable for `v`, or null when it is. */
function valueProblem(v: Variable, value: Scalar): string | null {
  switch (v.type) {
    case "number":
      if (typeof value !== "number") return "must be a number";
      if (v.min !== undefined && value < v.min) return `must be >= ${v.min}`;
      if (v.max !== undefined && value > v.max) return `must be <= ${v.max}`;
      return null;
    case "boolean":
      return typeof value === "boolean" ? null : "must be true or false";
    case "color":
      return typeof value === "string" && /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)
        ? null
        : "must be a hex colour like #c9a35c";
    case "enum": {
      const allowed = (v.options ?? []).map((o) => o.value);
      return typeof value === "string" && allowed.includes(value)
        ? null
        : `must be one of: ${allowed.join(", ")}`;
    }
    default:
      return typeof value === "string" ? null : "must be a string";
  }
}

/** Why `v` cannot take `value` from the IR group it was written in, or null when it can. */
function groupProblem(group: string, v: Variable | undefined, value: Scalar, known = ""): string | null {
  if (!v) return `is not a variable of this recipe. ${known}`;
  if (group === "assets")
    return v.type === "image" ? null : `is a ${v.type} variable, not an image; set it in params`;
  if (v.type === "image") return "is an image; set it in a scene's assets";
  if (group === "text" && v.type !== "string") return `is a ${v.type} variable, not text; set it in params`;
  return valueProblem(v, value);
}

/** Callbacks the value resolver reports through. */
interface Reporter {
  fail: (path: string, message: string) => void;
  useAsset: (src: string, path: string) => string;
  usedStyle: Set<string>;
}

/** The variable values one scene hands its recipe: project style first, then the scene's own. */
function resolveValues(
  scene: IR["scenes"][number],
  meta: RecipeMeta,
  style: IR["style"],
  at: string,
  { fail, useAsset, usedStyle }: Reporter,
): Record<string, Scalar> {
  const byId = new Map(meta.variables.map((v) => [v.id, v]));
  const known = `Declared by ${meta.name}: ${[...byId.keys()].join(", ")}`;
  const values: Record<string, Scalar> = {};

  for (const [key, value] of Object.entries(style)) {
    const v = byId.get(key);
    if (!v) continue; // style only reaches recipes that declare the id
    usedStyle.add(key);
    const problem = groupProblem("style", v, value);
    if (problem) fail(`style.${key}`, `"${key}" ${problem} (for recipe ${meta.name})`);
    else values[key] = value;
  }

  const seen = new Map<string, string>();
  const entries = (["assets", "text", "params"] as const).flatMap((group) =>
    Object.entries(scene[group]).map(([key, value]) => ({ group, key, value })),
  );
  for (const { group, key, value } of entries) {
    const path = `${at}.${group}.${key}`;
    const v = byId.get(key);
    const problem = seen.has(key) ? `is also set in ${seen.get(key)}` : groupProblem(group, v, value, known);
    seen.set(key, group);
    if (problem) fail(path, `"${key}" ${problem}`);
    else values[key] = group === "assets" ? useAsset(String(value), path) : value;
  }
  for (const key of meta.hyperstudio.required)
    if (!(key in values)) fail(`${at}`, `${meta.name} requires "${key}"`);
  return values;
}

// ── Compile ────────────────────────────────────────────────────────────────

export interface CompileOptions {
  /** Project directory to write. Default: `build/` beside the IR file. */
  output?: string;
  validateOnly?: boolean;
  recipesDir?: string;
}

export interface CompileResult {
  ok: true;
  title: string;
  output: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  scenes: { id: string; recipe: string; start: number; duration: number; transition: string }[];
  audio: { id: string; start: number }[];
  files: string[];
}

const sec = (frames: number, fps: number) => Number((frames / fps).toFixed(6));
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
/** JSON for a single-quoted attribute. */
const jsonAttr = (v: unknown) =>
  JSON.stringify(v).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");

export function compile(irPath: string, options: CompileOptions = {}): CompileResult {
  const issues: Issue[] = [];
  const fail = (path: string, message: string) => void issues.push({ path, message });
  const bail = (): never => {
    throw new CompileError(issues);
  };

  const irFile = resolve(irPath);
  const irDir = dirname(irFile);
  const recipesDir = options.recipesDir ?? RECIPES_DIR;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(irFile, "utf8"));
  } catch (e) {
    fail("", `cannot read ${irFile}: ${(e as Error).message}`);
    bail();
  }
  const parsed = IR.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) fail(i.path.join("."), i.message);
    throw new CompileError(issues);
  }
  const ir = parsed.data;
  const fps = ir.project.fps;
  const { width, height } = ir.project.resolution ?? ASPECT_RATIOS[ir.project.aspectRatio];

  /** Seconds → whole frames, or an issue when the value does not land on a frame. */
  const toFrames = (seconds: number, path: string): number => {
    const f = Math.round(seconds * fps);
    if (Math.abs(seconds * fps - f) > 1e-6)
      fail(path, `${seconds}s is not a whole number of frames at ${fps} fps (nearest: ${sec(f, fps)}s)`);
    return f;
  };

  // Assets: IR-relative source → assets/<basename> in the project.
  const copies = new Map<string, string>(); // target → source
  const useAsset = (src: string, path: string): string => {
    const source = resolve(irDir, src);
    if (!(existsSync(source) && statSync(source).isFile())) {
      fail(path, `file not found: ${src} (resolved from ${irDir})`);
      return src;
    }
    const target = `assets/${basename(source)}`;
    const other = copies.get(target);
    if (other && other !== source)
      fail(path, `two different files are both named ${basename(source)}; rename one`);
    copies.set(target, source);
    return target;
  };

  // ── Scenes: recipe resolution, value validation, timing ──
  const ids = new Set<string>();
  const claimId = (id: string, path: string) => {
    if (RESERVED_IDS.has(id) || id.startsWith("hs-")) fail(path, `"${id}" is reserved`);
    else if (ids.has(id)) fail(path, `duplicate id "${id}"`);
    ids.add(id);
  };

  const usedStyle = new Set<string>();
  const scenes: {
    id: string;
    recipe: string;
    html: string;
    variables: Variable[];
    values: Record<string, Scalar>;
    start: number; // frames
    frames: number;
    transition: { type: "cut" | "fade" | "crossfade"; frames: number };
  }[] = [];
  let cursor = 0;

  ir.scenes.forEach((scene, i) => {
    const at = `scenes.${i}`;
    claimId(scene.id, `${at}.id`);
    const frames = toFrames(scene.duration, `${at}.duration`);

    const recipe = loadRecipe(scene.recipe, recipesDir);
    if (!recipe) {
      const known = listRecipes(recipesDir).map((r) => r.name);
      fail(`${at}.recipe`, `unknown recipe "${scene.recipe}". Available: ${known.join(", ") || "(none)"}`);
      return;
    }
    const { meta } = recipe;
    const { minDuration, maxDuration } = meta.hyperstudio;
    if (minDuration !== undefined && scene.duration < minDuration)
      fail(`${at}.duration`, `${meta.name} needs at least ${minDuration}s`);
    if (maxDuration !== undefined && scene.duration > maxDuration)
      fail(`${at}.duration`, `${meta.name} supports at most ${maxDuration}s`);

    const values = resolveValues(scene, meta, ir.style, at, { fail, useAsset, usedStyle });

    // Timing: scenes run back to back; a crossfade overlaps the previous scene.
    const t = scene.transition ?? { type: "cut" as const, duration: 0 };
    const tFrames = t.type === "cut" ? 0 : toFrames(t.duration, `${at}.transition.duration`);
    const prev = scenes[scenes.length - 1];
    if (t.type === "crossfade" && i === 0)
      fail(`${at}.transition`, "the first scene has nothing to crossfade from; use fade");
    if (tFrames >= frames || (prev && i > 0 && tFrames >= prev.frames))
      fail(`${at}.transition.duration`, "must be shorter than both scenes it joins");
    const start = cursor - (t.type === "crossfade" && i > 0 ? tFrames : 0);
    cursor = start + frames;
    scenes.push({
      id: scene.id,
      recipe: meta.name,
      html: recipe.html,
      variables: meta.variables,
      values,
      start,
      frames,
      transition: { type: t.type, frames: tFrames },
    });
  });

  for (const key of Object.keys(ir.style))
    if (!usedStyle.has(key)) fail(`style.${key}`, "no recipe used in this project declares this variable");

  const total = cursor;
  if (ir.project.duration !== undefined && Math.abs(ir.project.duration * fps - total) > 1e-6)
    fail("project.duration", `scenes add up to ${sec(total, fps)}s, not ${ir.project.duration}s`);

  // ── Audio ──
  const audio = ir.audio.map((a, i) => {
    const at = `audio.${i}`;
    claimId(a.id, `${at}.id`);
    const start = toFrames(a.start, `${at}.start`);
    const frames = a.duration === undefined ? total - start : toFrames(a.duration, `${at}.duration`);
    if (start >= total) fail(`${at}.start`, `starts after the video ends (${sec(total, fps)}s)`);
    else if (start + frames > total)
      fail(`${at}.duration`, `runs past the end of the video (${sec(total, fps)}s)`);
    return { ...a, src: useAsset(a.src, `${at}.src`), start, frames };
  });

  if (issues.length) bail();

  // ── Emit ──
  const S = (frames: number) => sec(frames, fps);
  const hosts = scenes.map(
    (s, i) =>
      `      <div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html"` +
      ` data-start="${S(s.start)}" data-duration="${S(s.frames)}" data-track-index="${(i % 2) + 1}"` +
      ` data-track-kind="graphics" data-width="${width}" data-height="${height}"` +
      ` data-variable-values='${jsonAttr(s.values)}' style="z-index: ${i + 1}"></div>`,
  );
  const audioTags = audio.map(
    (a, i) =>
      `      <audio id="${a.id}" class="clip" src="${attr(a.src)}" data-start="${S(a.start)}" data-duration="${S(a.frames)}"` +
      ` data-track-index="${3 + i}" data-volume="${a.volume}"` +
      (a.fadeIn ? ` data-fade-in="${a.fadeIn}"` : "") +
      (a.fadeOut ? ` data-fade-out="${a.fadeOut}"` : "") +
      `></audio>`,
  );

  // Transitions live on the root timeline. Each is one tween on one element, so seeking in any order is safe.
  const dips: string[] = [];
  const tweens: string[] = [];
  scenes.forEach((s, i) => {
    const d = S(s.transition.frames);
    if (s.transition.type === "crossfade") {
      tweens.push(
        `tl.fromTo("#${s.id}", { opacity: 0 }, { opacity: 1, duration: ${d}, ease: "power1.inOut" }, ${S(s.start)});`,
      );
    } else if (s.transition.type === "fade") {
      dips.push(`      <div id="hs-dip-${s.id}" class="hs-dip"></div>`);
      tweens.push(
        i === 0
          ? `tl.fromTo("#hs-dip-${s.id}", { opacity: 1 }, { opacity: 0, duration: ${d}, ease: "power2.out" }, 0);`
          : `tl.fromTo("#hs-dip-${s.id}", { opacity: 0 }, { keyframes: [{ opacity: 1, duration: ${d / 2}, ease: "power2.in" }, { opacity: 0, duration: ${d / 2}, ease: "power2.out" }] }, ${Number((S(s.start) - d / 2).toFixed(6))});`,
      );
    }
  });

  const index = `<!doctype html>
${MARKER}
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${attr(ir.project.title)}</title>
    <script src="${GSAP_URL}"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: #000; }
      #root { position: relative; width: 100%; height: 100%; }
      .hs-dip { position: absolute; inset: 0; background: #000; opacity: 0; z-index: 1000; pointer-events: none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${S(total)}" data-width="${width}" data-height="${height}">
${[...hosts, ...audioTags, ...dips].join("\n")}
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${tweens.map((t) => `      ${t}`).join("\n")}
      tl.set({}, {}, ${S(total)});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;

  const files = new Map<string, string>([["index.html", index]]);
  for (const s of scenes) files.set(`compositions/${s.id}.html`, instantiate(s, width, height, S(s.frames)));

  const result: CompileResult = {
    ok: true,
    title: ir.project.title,
    output: null,
    width,
    height,
    fps,
    duration: S(total),
    frames: total,
    scenes: scenes.map((s) => ({
      id: s.id,
      recipe: s.recipe,
      start: S(s.start),
      duration: S(s.frames),
      transition: s.transition.type,
    })),
    audio: audio.map((a) => ({ id: a.id, start: S(a.start) })),
    files: [...files.keys(), ...copies.keys()].sort(),
  };
  if (options.validateOnly) return result;

  const out = resolve(options.output ?? join(irDir, "build"));
  mkdirSync(join(out, "compositions"), { recursive: true });
  mkdirSync(join(out, "assets"), { recursive: true });
  // Drop scenes we generated earlier that the IR no longer has. Files without our marker are never touched.
  for (const f of readdirSync(join(out, "compositions"))) {
    const p = join(out, "compositions", f);
    if (f.endsWith(".html") && !files.has(`compositions/${f}`) && readFileSync(p, "utf8").includes(MARKER))
      rmSync(p);
  }
  for (const [rel, content] of files) writeFileSync(join(out, rel), content);
  for (const [rel, source] of copies) copyFileSync(source, join(out, rel));
  // Project config is written once and then left to the user.
  const once = (rel: string, content: unknown) => {
    if (!existsSync(join(out, rel))) writeFileSync(join(out, rel), `${JSON.stringify(content, null, 2)}\n`);
  };
  once("hyperframes.json", {
    $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
    registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
    paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
    media: { autoProxy: true },
    authoringSkill: "hyperframes",
  });
  once("package.json", {
    name: basename(out) === "build" ? basename(irDir) : basename(out),
    private: true,
    type: "module",
    scripts: {
      dev: "npx hyperframes preview",
      check: "npx hyperframes check",
      render: "npx hyperframes render",
    },
  });
  return { ...result, output: out };
}

/**
 * One scene file from a recipe. Recipes use their own name as composition id and as the prefix of every
 * element id, so renaming that one token gives each scene a unique scope (a recipe can be used many times).
 */
function instantiate(
  s: { id: string; recipe: string; html: string; variables: Variable[] },
  width: number,
  height: number,
  duration: number,
): string {
  const html = s.html.replaceAll(s.recipe, s.id);
  const rootTag = new RegExp(`<div\\b[^>]*\\bdata-composition-id="${s.id}"[^>]*>`).exec(html);
  if (!rootTag)
    throw new Error(`recipe ${s.recipe}: no <div data-composition-id="${s.recipe}"> root element`);
  const set = (tag: string, name: string, value: string, quote = '"') => {
    const re = new RegExp(`\\s${name}=("[^"]*"|'[^']*')`);
    const next = ` ${name}=${quote}${value}${quote}`;
    return re.test(tag) ? tag.replace(re, next) : tag.replace(/>$/, `${next}>`);
  };
  let tag = rootTag[0];
  tag = set(tag, "data-duration", String(duration));
  tag = set(tag, "data-width", String(width));
  tag = set(tag, "data-height", String(height));
  tag = set(tag, "data-composition-variables", jsonAttr(s.variables), "'");
  const out = html.replace(rootTag[0], tag);
  return out.replace(/<template>/, `<template>\n  ${MARKER}`);
}
