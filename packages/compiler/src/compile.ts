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
import { ASPECT_RATIOS, IR, type Origin, type Scalar } from "@hyperstudio/ir";
import { RECIPES_DIR } from "@hyperstudio/recipes";
import { type Film, instantiate, MARKER, type PlannedScene, renderIndex, renderStoryboard } from "./emit.ts";
import { CompileError, type Issue } from "./errors.ts";
import { checkBeats, type LivePage, readLivePage } from "./live.ts";
import { listRecipes, loadRecipe, type RecipeMeta } from "./recipes.ts";
import { framing, resolveValues } from "./values.ts";

export interface CompileOptions {
  /** Project directory to write. Default: `build/` beside the IR file. */
  output?: string;
  /** Validate and plan only; write nothing. */
  validateOnly?: boolean;
  /** Folder of recipes. Default: the recipes shipped with HyperStudio. */
  recipesDir?: string;
}

export interface CompileResult {
  ok: true;
  title: string;
  /** Directory written, or null with `validateOnly`. */
  output: string | null;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  scenes: {
    id: string;
    recipe: string;
    start: number;
    duration: number;
    transition: string;
    purpose: string;
  }[];
  audio: { id: string; start: number }[];
  /** Project-relative paths written or copied. */
  files: string[];
  /** Things that are allowed but that a reviewer should look at. */
  warnings: Issue[];
  /** Everything on screen or in the mix that is a stand-in rather than the real thing. */
  placeholders: string[];
  /** Credit lines the film owes for the licensed assets it uses, from each asset folder's LICENSES.json. */
  credits: string[];
}

const RESERVED_IDS = new Set(["main", "root"]);
/** Style keys the compiler itself reads for the stage; they need no recipe to declare them. */
const STAGE_KEYS = new Set(["background", "light", "glow"]);
/** Above this average shot length a product film starts to read as a slideshow. */
const SLOW_AVERAGE_SHOT = 3.5;

/**
 * Compile a Creative IR file into a HyperFrames project.
 *
 * Deterministic: the same IR, recipes and assets give byte-identical output.
 * @throws CompileError listing every problem when the IR is rejected.
 */
export function compile(irPath: string, options: CompileOptions = {}): CompileResult {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const placeholders: string[] = [];
  const fail = (path: string, message: string) => void issues.push({ path, message });

  const irFile = resolve(irPath);
  const irDir = dirname(irFile);
  const recipesDir = options.recipesDir ?? RECIPES_DIR;

  const ir = readIR(irFile);
  const fps = ir.project.fps;
  const { width, height } = ir.project.resolution ?? ASPECT_RATIOS[ir.project.aspectRatio];
  const seconds = (frames: number) => Number((frames / fps).toFixed(6));

  /** Seconds → whole frames, reporting a value that does not land on a frame. */
  const toFrames = (value: number, path: string): number => {
    const frames = Math.round(value * fps);
    if (Math.abs(value * fps - frames) > 1e-6)
      fail(path, `${value}s is not a whole number of frames at ${fps} fps (nearest: ${seconds(frames)}s)`);
    return frames;
  };

  // Files: IR-relative source → assets/<basename> in the project.
  const copies = new Map<string, string>(); // target → source
  const useAsset = (src: string, path: string, origin: Origin, what: string): string => {
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
    if (origin === "placeholder" && !placeholders.includes(what)) placeholders.push(what);
    return target;
  };

  const ids = new Set<string>();
  const claimId = (id: string, path: string) => {
    if (RESERVED_IDS.has(id) || id.startsWith("hs-")) fail(path, `"${id}" is reserved`);
    else if (ids.has(id)) fail(path, `duplicate id "${id}"`);
    ids.add(id);
  };

  if (ir.brand.kind === "example")
    placeholders.push(`brand: ${ir.brand.name} is an example product, not a real one`);

  const { background, light, glow } = stage(ir.style, fail);

  /** A live page: read it, and give its regions names the checks can look up. */
  const liveScreen = (id: string, def: IR["screens"][string], file: string, at: string): PlacedScreen => {
    const page = existsSync(file) ? readLivePage(file) : `file not found: ${def.html}`;
    if (typeof page === "string") {
      fail(`${at}.html`, page);
      return { id, def, src: "" };
    }
    if (def.origin === "placeholder") placeholders.push(`screen: ${id}`);
    const regions = Object.fromEntries(
      page.regions.map((name) => [name, [0, 0, 1, 1]]),
    ) as typeof def.regions;
    return { id, def: { ...def, regions }, src: "", page };
  };

  // ── Screens ──
  const screens = new Map(
    Object.entries(ir.screens).map(([id, def]) => {
      const at = `screens.${id}`;
      if ((def.src === undefined) === (def.html === undefined))
        fail(at, 'give exactly one of "src" (a screenshot) or "html" (the live page)');
      if (def.html !== undefined) return [id, liveScreen(id, def, resolve(irDir, def.html), at)] as const;
      const src = useAsset(def.src ?? "", `${at}.src`, def.origin, `screen: ${id}`);
      for (const [name, [x, y, w, h]] of Object.entries(def.regions))
        if (x + w > def.width || y + h > def.height)
          fail(`${at}.regions.${name}`, `extends outside the ${def.width}x${def.height} screen`);
      return [id, { id, def, src }] as const;
    }),
  );

  // ── Scenes: recipe resolution, value validation, timing ──
  const usedStyle = new Set<string>();
  const usedScreens = new Set<string>();
  const planned: (PlannedScene & { frames: number; startFrame: number; framing: string })[] = [];
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
    checkLength(scene.duration, meta, `${at}.duration`, fail);
    const screen = sceneScreen(scene.screen, meta, screens, `${at}.screen`, fail);

    const values = resolveValues(scene, meta, ir.style, screen, at, { fail, useAsset, usedStyle });
    if (screen && meta.hyperstudio.screen) usedScreens.add(screen.id);
    Object.assign(values, screenValues(scene, meta, screen, at, fail, warnings));

    // A shot that frames the same thing the same way as the one before it is a repeat.
    const shot = framing(scene, meta, values as Record<string, Scalar>);
    const previous = planned[planned.length - 1];
    if (previous && previous.framing === shot)
      fail(
        at,
        `repeats the previous shot (same recipe, screen and framing as "${previous.id}"); show something else or cut it`,
      );

    // Timing: scenes run back to back; a crossfade overlaps the previous scene.
    const t = scene.transition ?? { type: "cut" as const, duration: 0 };
    const tFrames = t.type === "cut" ? 0 : toFrames(t.duration, `${at}.transition.duration`);
    const shortest = Math.min(frames, previous?.frames ?? frames);
    if (t.type === "fade" && !previous)
      warnings.push({
        path: `${at}.transition`,
        message:
          "fading into the first scene leaves frame 0 empty, and frame 0 is the thumbnail; open on a cut",
      });
    if (t.type === "crossfade" && !previous)
      fail(`${at}.transition`, "the first scene has nothing to crossfade from; use fade or cut");
    if (tFrames >= shortest) fail(`${at}.transition.duration`, "must be shorter than both scenes it joins");
    const startFrame = cursor - (t.type === "crossfade" && previous ? tFrames : 0);
    cursor = startFrame + frames;
    planned.push({
      id: scene.id,
      recipe: meta.name,
      purpose: scene.purpose,
      html: recipe.html,
      variables: meta.variables,
      values,
      payload: screen?.page && { css: screen.page.css, html: screen.page.html },
      start: seconds(startFrame),
      duration: seconds(frames),
      transition: { type: t.type, duration: seconds(tFrames) },
      frames,
      startFrame,
      framing: shot,
    });
  });

  for (const key of Object.keys(ir.style))
    if (!(usedStyle.has(key) || STAGE_KEYS.has(key)))
      fail(`style.${key}`, "no recipe used in this film declares this variable");
  for (const id of screens.keys())
    if (!usedScreens.has(id)) warnings.push({ path: `screens.${id}`, message: "no scene shows this screen" });

  const total = cursor;
  if (ir.project.duration !== undefined && Math.abs(ir.project.duration * fps - total) > 1e-6)
    fail("project.duration", `scenes add up to ${seconds(total)}s, not ${ir.project.duration}s`);
  const average = seconds(total) / Math.max(1, planned.length);
  if (planned.length > 1 && average > SLOW_AVERAGE_SHOT)
    warnings.push({
      path: "scenes",
      message: `average shot is ${average.toFixed(1)}s. Above ${SLOW_AVERAGE_SHOT}s a film reads as a slideshow; cut to more, shorter shots`,
    });

  // ── Audio ──
  const audio = ir.audio.map((a, i) => {
    const at = `audio.${i}`;
    claimId(a.id, `${at}.id`);
    const anchor = a.scene === undefined ? undefined : planned.find((s) => s.id === a.scene);
    if (a.scene !== undefined && !anchor)
      fail(`${at}.scene`, `unknown scene "${a.scene}". Scenes: ${planned.map((s) => s.id).join(", ")}`);
    const start = (anchor?.startFrame ?? 0) + toFrames(a.start, `${at}.start`);
    const frames = a.duration === undefined ? total - start : toFrames(a.duration, `${at}.duration`);
    if (start >= total) fail(`${at}.start`, `starts after the video ends (${seconds(total)}s)`);
    else if (start + frames > total)
      fail(`${at}.duration`, `runs past the end of the video (${seconds(total)}s)`);
    return {
      id: a.id,
      role: a.role,
      explicit: a.duration !== undefined,
      src: useAsset(a.src, `${at}.src`, a.origin, `audio: ${a.id}`),
      start: seconds(start),
      duration: seconds(frames),
      volume: a.volume,
      fadeIn: a.fadeIn,
      fadeOut: a.fadeOut,
    };
  });

  // Two voices at once cannot both be heard. Only clips with a stated length can be compared.
  const voices = audio.filter((a) => a.role === "voice" && a.explicit).sort((x, y) => x.start - y.start);
  voices.forEach((voice, i) => {
    const next = voices[i + 1];
    if (next && voice.start + voice.duration > next.start + 1e-6)
      fail("audio", `voice clips "${voice.id}" and "${next.id}" overlap; shorten one or move it`);
  });

  if (issues.length > 0) throw new CompileError(issues);

  // ── Emit ──
  const film: Film = {
    title: ir.project.title,
    width,
    height,
    duration: seconds(total),
    background,
    light,
    glows: [
      typeof ir.style.accent === "string" && HEX.test(ir.style.accent) ? ir.style.accent : "#ffffff",
      glow,
    ].filter((c): c is string => c !== null),
    scenes: planned,
    audio,
  };
  const files = new Map<string, string>([
    ["index.html", renderIndex(film)],
    ["STORYBOARD.md", renderStoryboard(ir, film)],
  ]);
  for (const scene of planned) files.set(`compositions/${scene.id}.html`, instantiate(scene, width, height));

  const result: CompileResult = {
    ok: true,
    title: film.title,
    output: null,
    width,
    height,
    fps,
    duration: film.duration,
    frames: total,
    scenes: planned.map((s) => ({
      id: s.id,
      recipe: s.recipe,
      start: s.start,
      duration: s.duration,
      transition: s.transition.type,
      purpose: s.purpose,
    })),
    audio: audio.map((a) => ({ id: a.id, start: a.start })),
    files: [...files.keys(), ...copies.keys()].sort(),
    warnings,
    placeholders,
    credits: creditsOwed([...copies.values()]),
  };
  if (options.validateOnly) return result;

  const out = resolve(options.output ?? join(irDir, "build"));
  write(out, files, copies, basename(out) === "build" ? basename(irDir) : basename(out));
  return { ...result, output: out };
}

/** What the compiler itself hands a recipe that shows a screen: the screen, its geometry, and the beats. */
function screenValues(
  scene: IR["scenes"][number],
  meta: RecipeMeta,
  screen: PlacedScreen | undefined,
  at: string,
  fail: Fail,
  warnings: Issue[],
): Record<string, Scalar> {
  const takes = meta.hyperstudio.beats;
  if (!takes && screen?.page)
    fail(`${at}.screen`, `${meta.name} shows a screenshot; "${screen.id}" is a live page. Use product-take`);
  checkBeats(scene, meta, screen?.page, at, fail, (path, message) => void warnings.push({ path, message }));
  const values: Record<string, Scalar> = takes ? { beats: JSON.stringify(scene.beats) } : {};
  if (!(screen && meta.hyperstudio.screen)) return values;
  const { width, height, regions } = screen.def;
  return {
    ...values,
    screen: screen.src,
    screenMeta: JSON.stringify(screen.page ? { width, height } : { width, height, regions }),
  };
}

type PlacedScreen = { id: string; def: IR["screens"][string]; src: string; page?: LivePage };
type Fail = (path: string, message: string) => void;

/** The screen a scene looks at, checked against what its recipe expects. */
function sceneScreen(
  name: string | undefined,
  meta: RecipeMeta,
  screens: Map<string, PlacedScreen>,
  path: string,
  fail: Fail,
): PlacedScreen | undefined {
  const shows = meta.hyperstudio.screen;
  if (name === undefined) {
    if (shows) fail(path, `${meta.name} shows a screen; name one from "screens"`);
    return undefined;
  }
  if (!shows) {
    fail(path, `${meta.name} does not show a screen`);
    return undefined;
  }
  const screen = screens.get(name);
  if (!screen) fail(path, `unknown screen "${name}". Screens: ${[...screens.keys()].join(", ") || "(none)"}`);
  return screen;
}

/**
 * Credit lines owed for the files a film uses. Each asset folder may hold a LICENSES.json ledger
 * (written by `hyperstudio assets download`); only entries for files actually used are reported.
 */
function creditsOwed(sources: string[]): string[] {
  const owed = new Set<string>();
  for (const source of sources) {
    const ledger = join(dirname(source), "LICENSES.json");
    if (!existsSync(ledger)) continue;
    const entries = JSON.parse(readFileSync(ledger, "utf8")) as { file: string; attribution?: string }[];
    const entry = entries.find((e) => e.file === basename(source));
    if (entry?.attribution) owed.add(entry.attribution);
  }
  return [...owed].sort();
}

/** A recipe is built for a range of lengths; outside it the shot either rushes or goes dead. */
function checkLength(duration: number, meta: RecipeMeta, path: string, fail: Fail): void {
  const { minDuration, maxDuration } = meta.hyperstudio;
  if (minDuration !== undefined && duration < minDuration)
    fail(path, `${meta.name} needs at least ${minDuration}s`);
  if (maxDuration !== undefined && duration > maxDuration)
    fail(path, `${meta.name} holds for at most ${maxDuration}s; split it into shots`);
}

/** The stage every scene sits on, from the film's style. */
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LIGHTS = ["none", "soft", "aurora"] as const;
type Light = (typeof LIGHTS)[number];

function stage(style: IR["style"], fail: Fail): { background: string; light: Light; glow: string | null } {
  const background = style.background ?? "#000000";
  if (typeof background !== "string" || !HEX.test(background))
    fail("style.background", "must be a hex colour like #f3efe6");
  const light = LIGHTS.find((l) => l === (style.light ?? "none"));
  if (!light) fail("style.light", `must be one of: ${LIGHTS.join(", ")}`);
  const glow = style.glow;
  if (glow !== undefined && (typeof glow !== "string" || !HEX.test(glow)))
    fail("style.glow", "must be a hex colour like #7a5cff");
  return {
    background: String(background),
    light: light ?? "none",
    glow: typeof glow === "string" ? glow : null,
  };
}

/** Read and parse an IR file, or throw with every schema problem. */
function readIR(irFile: string): IR {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(irFile, "utf8"));
  } catch (e) {
    throw new CompileError([{ path: "", message: `cannot read ${irFile}: ${(e as Error).message}` }]);
  }
  const parsed = IR.safeParse(raw);
  if (!parsed.success)
    throw new CompileError(parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return parsed.data;
}

/** Write the project. Generated files are replaced; anything without our marker is left alone. */
function write(out: string, files: Map<string, string>, copies: Map<string, string>, name: string): void {
  mkdirSync(join(out, "compositions"), { recursive: true });
  mkdirSync(join(out, "assets"), { recursive: true });
  // Drop scenes we generated earlier that the IR no longer has.
  for (const file of readdirSync(join(out, "compositions"))) {
    const path = join(out, "compositions", file);
    const stale = file.endsWith(".html") && !files.has(`compositions/${file}`);
    if (stale && readFileSync(path, "utf8").includes(MARKER)) rmSync(path);
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
    name,
    private: true,
    type: "module",
    scripts: {
      dev: "npx hyperframes preview",
      check: "npx hyperframes check",
      render: "npx hyperframes render",
    },
  });
}
