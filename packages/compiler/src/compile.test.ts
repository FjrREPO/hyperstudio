import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { CompileError, compile, listRecipes } from "./index.ts";

const EXAMPLE_DIR = join(import.meta.dirname, "../../../examples/saas-product-showcase");
const EXAMPLE = join(EXAMPLE_DIR, "video.json");
const base = JSON.parse(readFileSync(EXAMPLE, "utf8"));

/** Compile a variation of the showcase example; return the issue paths it is rejected with. */
function rejections(mutate: (ir: typeof base) => void): string[] {
  const ir = structuredClone(base);
  mutate(ir);
  // Written one folder below the example, so its relative file paths get one more "../".
  const up = (path: string) => `../${path}`;
  for (const screen of Object.values(ir.screens) as { src: string }[]) screen.src = up(screen.src);
  for (const scene of ir.scenes)
    for (const [key, asset] of Object.entries(scene.assets ?? {}) as [string, { src: string } | string][])
      scene.assets[key] = typeof asset === "string" ? up(asset) : { ...asset, src: up(asset.src) };
  for (const a of ir.audio ?? []) a.src = up(a.src);
  const file = join(mkdtempSync(join(EXAMPLE_DIR, ".tmp-")), "ir.json");
  writeFileSync(file, JSON.stringify(ir));
  try {
    compile(file, { validateOnly: true });
    return [];
  } catch (e) {
    assert.ok(e instanceof CompileError, String(e));
    return e.issues.map((i) => i.path);
  } finally {
    rmSync(dirname(file), { recursive: true });
  }
}

test("the showcase compiles with frame-accurate timing", () => {
  const r = compile(EXAMPLE, { validateOnly: true });
  assert.equal(r.duration, 15);
  assert.equal(r.frames, 450);
  assert.equal(r.scenes.length, 9);
  assert.deepEqual(
    r.scenes.slice(0, 4).map((s) => [s.id, s.start]),
    [
      ["hook", 0],
      ["meet", 2.4],
      ["reveal", 3.6],
      ["answer", 5.3],
    ],
  );
  assert.deepEqual(r.warnings, []);
});

test("placeholders are reported, never silent", () => {
  const { placeholders } = compile(EXAMPLE, { validateOnly: true });
  assert.ok(placeholders.some((p) => p.startsWith("brand:")));
  assert.ok(placeholders.includes("screen: home"));
  assert.ok(placeholders.includes("audio: sfx"));
});

test("one recipe used many times gets isolated scenes, and screens reach their shots", () => {
  const out = mkdtempSync(join(tmpdir(), "hs-c-"));
  compile(EXAMPLE, { output: out });
  const share = readFileSync(join(out, "compositions/share.html"), "utf8");
  assert.match(share, /data-composition-id="share"/);
  assert.match(share, /id="share-world"/);
  assert.match(share, /data-duration="1.1"/);
  assert.doesNotMatch(share, /product-shot/);
  const index = readFileSync(join(out, "index.html"), "utf8");
  assert.match(index, /id="share"[^>]*"screen":"assets\/answer.png"/);
  assert.match(index, /id="share"[^>]*share-button/);
  assert.match(index, /id="hs-stage"/);
  assert.match(readFileSync(join(out, "STORYBOARD.md"), "utf8"), /## Frame 6 — share/);
});

test("the IR is rejected where it is wrong, with the path to the mistake", () => {
  assert.deepEqual(
    rejections((ir) => void ir),
    [],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.glow = 2)),
    ["scenes.0.params.glow"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[2].params.enter = "spin")),
    ["scenes.2.params.enter"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.fill = 9)),
    ["scenes.0.params.fill"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[8].assets.mark = "nope.svg")),
    ["scenes.8.assets.mark"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].text = {})),
    ["scenes.1"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].recipe = "does-not-exist")),
    ["scenes.1.recipe", "project.duration"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[2].id = "hook")),
    ["scenes.2.id"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].duration = 2.41)),
    ["scenes.0.duration"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].transition = { type: "crossfade", duration: 0.2 })),
    ["scenes.0.transition"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.style.neon = "#fff")),
    ["style.neon"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.style.light = "disco")),
    ["style.light"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.project.duration = 30)),
    ["project.duration"],
  );
});

test("art direction: the film's visual system cannot be overridden per scene", () => {
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].params.accent = "#ff0000")),
    ["scenes.1.params.accent"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].params.displayFont = "Oswald")),
    ["scenes.1.params.displayFont"],
  );
});

test("art direction: a shot that repeats the previous one is rejected", () => {
  assert.deepEqual(
    rejections((ir) => (ir.scenes[5].params = { ...ir.scenes[4].params })),
    ["scenes.5"],
  );
});

test("art direction: copy that is too long for its recipe is rejected", () => {
  assert.deepEqual(
    rejections(
      (ir) => (ir.scenes[1].text.line1 = "A very long line that no one could read in the time it has"),
    ),
    ["scenes.1.text.line1"],
  );
});

test("screens: shots must name a screen and regions that exist", () => {
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].screen = "pricing")),
    ["scenes.0.screen"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].screen = undefined)),
    ["scenes.0.screen"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[1].screen = "home")),
    ["scenes.1.screen"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.from = "navbar")),
    ["scenes.0.params.from"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.scenes[0].params.screenMeta = "{}")),
    ["scenes.0.params.screenMeta"],
  );
  assert.deepEqual(
    rejections((ir) => (ir.screens.home.regions.wide = [0, 0, 5000, 10])),
    ["screens.home.regions.wide"],
  );
});

test("a figure on screen needs a source", () => {
  // A throwaway recipe with one statistic variable.
  const recipes = mkdtempSync(join(tmpdir(), "hs-recipes-"));
  mkdirSync(join(recipes, "figure"));
  writeFileSync(
    join(recipes, "figure/registry-item.json"),
    JSON.stringify({
      name: "figure",
      title: "Figure",
      description: "One number.",
      duration: 2,
      files: [{ path: "figure.html" }],
      variables: [{ id: "value", type: "number", role: "statistic", default: 0 }],
    }),
  );
  writeFileSync(
    join(recipes, "figure/figure.html"),
    '<template><div id="root" data-composition-id="figure"></div></template>',
  );
  const dir = mkdtempSync(join(tmpdir(), "hs-ir-"));
  const write = (sources: string[]) => {
    const scene = {
      id: "n",
      recipe: "figure",
      duration: 2,
      purpose: "Show the one number that matters.",
      params: { value: 42 },
      sources,
    };
    writeFileSync(
      join(dir, "ir.json"),
      JSON.stringify({
        ...base,
        screens: {},
        style: {},
        audio: [],
        project: { title: "t" },
        scenes: [scene],
      }),
    );
    return join(dir, "ir.json");
  };
  assert.throws(
    () => compile(write([]), { validateOnly: true, recipesDir: recipes }),
    (e: unknown) => e instanceof CompileError && e.issues[0]?.path === "scenes.0.sources",
  );
  assert.equal(
    compile(write(["Q3 billing export, supplied by the client"]), { validateOnly: true, recipesDir: recipes })
      .ok,
    true,
  );
});

test("audio can follow a scene, and two voices may not overlap", () => {
  const sfx = { src: "assets/ui-sfx.m4a", origin: "placeholder" };
  // Compile a variation that keeps the files and return the audio plan.
  const starts = (audio: object[]) => {
    const ir = structuredClone(base);
    ir.audio = audio.map((a) => ({ ...sfx, ...a }));
    const file = join(EXAMPLE_DIR, ".tmp-audio.json");
    writeFileSync(file, JSON.stringify(ir));
    try {
      return compile(file, { validateOnly: true }).audio.map((a) => [a.id, a.start]);
    } catch (e) {
      assert.ok(e instanceof CompileError, String(e));
      return e.issues.map((i) => i.path);
    } finally {
      rmSync(file);
    }
  };
  // "answer" starts at 5.3 s, so a clip 0.2 s into it starts at 5.5 s.
  assert.deepEqual(starts([{ id: "vo", role: "voice", scene: "answer", start: 0.2, duration: 1.4 }]), [
    ["vo", 5.5],
  ]);
  assert.deepEqual(starts([{ id: "vo", role: "voice", scene: "nowhere", duration: 1 }]), ["audio.0.scene"]);
  assert.deepEqual(
    starts([
      { id: "one", role: "voice", start: 1, duration: 2 },
      { id: "two", role: "voice", start: 2.5, duration: 1 },
    ]),
    ["audio"],
  );
  // Music under a voice is the normal case and is fine.
  assert.equal(starts([{ id: "bed" }, { id: "vo", role: "voice", start: 1, duration: 2 }]).length, 2);
});

test("a slow film is allowed but flagged", () => {
  const watch = join(EXAMPLE_DIR, "../luxury-watch-commercial/video.json");
  const { warnings } = compile(watch, { validateOnly: true });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]?.message ?? "", /average shot is 5\.4s/);
});

test("every recipe declares defaults HyperFrames accepts", () => {
  const recipes = listRecipes();
  assert.deepEqual(
    recipes.map((r) => r.name),
    ["brand-close", "luxury-product-reveal", "product-shot", "statement"],
  );
  for (const r of recipes)
    for (const v of r.variables) assert.notEqual(v.default, undefined, `${r.name}.${v.id} needs a default`);
});
